# Arquitetura — NOMADE RUN (MVP)

> Dono: **Arquiteto de software**. Mudanças de arquitetura entram aqui e em `DECISOES_TECNICAS.md` (com ID `D-xx`).
> Última revisão: 2026-10-22 (A6, conferida contra as migrations, as functions e as decisões D-16 a D-53).

## 1. Visão geral

Três componentes, como no ERS §2.1. O painel web é o próprio app Expo rodando no navegador (D-08).

```
┌──────────────────────────── apps/mobile (Expo SDK 57, RN 0.86, TS) ───────────────────────────┐
│  src/app/            rotas Expo Router (auth, abas, corrida, resumo, zona, moderação)            │
│  src/features/       telas e casos de uso de UI (auth, run, screens, safety, moderation)        │
│  src/components/     UI reutilizável do design system "Pista" (NÃO alterar visual sem motivo)    │
│  src/store/          estado de UI/sessão (Zustand)                                               │
│  src/services/       infraestrutura: api (supabase), auth, location, offline (SQLite),           │
│                      sync, signing (HMAC), sensors, notifications, safety                        │
│  src/domain/         REGRAS PURAS (pontuação, território, antifraude, minigames) — sem React     │
└────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                             │ HTTPS/JSON (JWT do Supabase Auth) + WebSocket
┌────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│ supabase/  (Supabase: Postgres 17 + PostGIS, Auth, Edge Functions Deno, Realtime)               │
│  migrations/     esquema, RLS, funções SQL, views, índices GiST, jobs (pg_cron), Realtime        │
│  functions/      ingest-points · finish-activity · zones · zone · register-device ·             │
│                  moderate-activity · account-export · account-delete                             │
│                  → importam o MESMO src/domain do app (fonte única das regras, D-02)             │
│  tests/          pgTAP (RLS e funções SQL) e teste adversarial HTTP (security/)                  │
│  seed.sql        dados de demonstração (Goiânia), marcados como demonstração                     │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Camadas e regras de dependência

| Camada | Pode importar | Não pode importar |
|---|---|---|
| `src/domain` | só `h3-js` e outros arquivos do domain | React, Expo, supabase, services |
| `src/services` | domain, bibliotecas Expo/supabase | telas, components, store |
| `src/store` | domain, services (tipos) | telas |
| `src/features`, `src/app` | tudo acima + components | — |
| `supabase/functions` | `src/domain` (caminho relativo), `_shared` | código de UI |

Padrões usados:
- **Repository** (`src/services/api/*-repo.ts`): telas nunca chamam `supabase.from()` direto.
- **Outbox / fila persistente** (`src/services/offline`): toda corrida é gravada localmente antes de ir à rede.
- **Result tipado para erros esperados** (`{ ok: true, data } | { ok: false, error: AppError }`): falhas de rede, permissão e validação viram mensagens em português; exceções só para bugs.
- **Servidor autoritativo** (RNF-006): o app mostra *estimativas*; o resultado oficial vem de `finish-activity`.

## 3. Modelo de dados (Postgres)

17 tabelas no schema `public`, todas com RLS:

```
auth.users 1─1 profiles ─┬─< devices                (chave HMAC por aparelho, RNF-006)
                         ├─< activities ─< activity_points   (único: activity_id+seq)
                         │        └─< activity_zones          (RP por zona, resultado)
                         ├─< safety_contacts         (≤ 5, RF-024)
                         ├─< privacy_zones           (≤ 3, RN-010)
                         ├─< notifications           (RF-009, RF-019)
                         ├─< fog_cells               (RF-022)
                         ├─< chests / chest_opens    (RF-023: sorteio diário e aberturas)
                         ├── crew_members >─ crews   (RF-011, RN-011)
                         └─< moderation_reviews      (RF-018, feitas por staff)
zones (h3 text PK, geom PostGIS, influence jsonb, owner, shield, attack_*, blocked, name, city)
zone_events (captured / under_attack / defended / neutralized)
seasons (mensal, RN-006)
```

- `profiles.role`: `runner | moderator | admin`; `profiles.status`: `active | suspended | inactive`. Funções `is_staff()` / `is_admin()` (security definer) usadas nas policies.
- **Leitura pelo cliente:** dados privados só do dono; `profiles` só o próprio (D-50). Dados de outras pessoas só por views sem colunas sensíveis: `public_profiles`, `staff_profiles` (painel de moderação), `public_crews` (sem código de convite), `leaderboard_individual|crews|factions|cities`.
- **Escrita em zonas e corridas só pelo service role** (Edge Functions), por RPCs `svc_*`. `devices.secret` nunca volta ao cliente.
- **RPCs do cliente:** `choose_faction`, `join_crew`, `leave_crew`, `mark_notifications_read`, `username_available`, `daily_chests`, `ranking_runners|crews|factions`, `district_label`, `zones_in_bbox(_json)`, `admin_set_user_status` (só admin).
- **Edge Functions (8):** `register-device`, `ingest-points`, `finish-activity`, `zones`, `zone`, `moderate-activity`, `account-export`, `account-delete`. Contrato em `API_CONTRATO.md`.
- **Realtime:** `zones` (mapa) e `notifications` (central) na publicação `supabase_realtime`; a RLS vale para quem assina.
- **Jobs (pg_cron, horário de Brasília):** `job_fortify_zones` 00:05 (escudo, RN-004), `job_decay_zones` 03:00 (redução diária, RN-005), `job_close_week` segunda 00:10 (sequência, RN-014), `job_season_rollover` dia 1 00:15 (temporada, RN-006).
- **Storage:** bucket `avatars`, uma pasta por usuário.

## 4. Fluxo principal (UC-01: correr e conquistar)

1. App cria `activity_id` (UUID v4) localmente e grava cada ponto GPS no SQLite com `seq` crescente.
2. A cada 5 s (ou ao voltar a internet), o sync envia lotes `POST /ingest-points` assinados com HMAC-SHA256 da chave do aparelho. O servidor verifica assinatura, ordem (`seq`) e duplicidade, grava e responde rápido (RNF-009). Reenvio do mesmo lote é idempotente (RF-005).
3. Ao finalizar, o app chama `POST /finish-activity`. O servidor carrega os pontos, roda `validateActivity` + `finishRun` do domain, aplica RN-001/002/003/004 nas zonas (transação, `FOR UPDATE`), grava `activity_zones`, `zone_events`, notificações de invasão e devolve o resumo oficial.
4. Sem internet: o resumo aparece como **provisório** (cálculo local do mesmo domain) e é confirmado depois (UC-01 A1).
5. Quem estiver olhando o mapa recebe a troca de dono pelo Realtime; quem é do time dono e correu na zona em 30 dias recebe o alerta de invasão na central (RN-003).

Limites na ingestão (D-50): até 14.400 pontos por corrida e 3 corridas abertas nas últimas 24 h; `endedAt` entre o início e agora + 5 min.

## 5. Segurança (RNF-006, RNF-007, RNF-013)

- **Auth:** Supabase Auth (bcrypt custo 10), JWT de 1 h com refresh automático, senha ≥ 8, troca de senha com reautenticação, limite de login de 3 por 5 min por IP (só no Cloud, D-21).
- **Links de e-mail por PKCE** (D-51): o app só troca um `code` com o verificador guardado no próprio aparelho; tokens na URL são recusados; com alguém conectado, trocar de conta pede confirmação.
- **Conta ativa conferida em toda chamada** (D-50, D-53): o PostgREST roda `public.check_request` antes de cada requisição e responde 401 `ACCOUNT_INACTIVE`; policies restritivas cobrem Realtime e Storage; as functions conferem o JWT no Auth (`verify_jwt = false` no gateway, D-24) e o status do perfil. O app encerra a sessão ao receber esse erro.
- **Servidor autoritativo:** HMAC-SHA256 por aparelho em cada lote; o servidor recalcula tudo com o domain. Limite aceito: a chave é registrada pelo próprio cliente (P-38).
- Sessão no **expo-secure-store** (Keychain/Keystore), em partes (D-16); na web, `localStorage`.
- Chaves só por variáveis de ambiente (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); `.env` fora do git; `service_role` só nas Edge Functions.
- Excluir conta exige a senha atual (conferida no Auth). Exportar dados gera um JSON completo.
- Consentimentos separados (localização, notificações, termos, privacidade) com explicação antes do pedido do sistema.
- Revisão OWASP/RLS e achados em `docs/QA.md`.

## 6. Ambientes

| Ambiente | Como sobe | Uso |
|---|---|---|
| Local | `npm run db:start` + `npm run functions:serve` (Docker) e `npx expo start` | desenvolvimento, testes e apresentação (opção A) |
| Apresentação na nuvem | projeto Supabase Cloud (plano gratuito, `supabase/DEPLOY.md`) + Expo Go | apresentação (opção B); ainda não publicado (P-08) |

## 7. Limitações conhecidas do MVP

- Expo Go não grava GPS em segundo plano no iOS: em segundo plano só com *development build* (código pronto, ativado por flag).
- Push remoto no Expo Go (Android) não existe desde o SDK 53: o MVP usa a central de notificações no app + Realtime e notificações locais.
- Login Google/Apple: depende de credenciais dos provedores; o código fica pronto e só aparece se configurado.
- Escolta compartilha a localização uma vez (não é rastreamento ao vivo, D-36/P-18); SOS abre o app de mensagens.
- Mapas: `react-native-maps` (Apple Maps/Google Maps) no celular e MapLibre na web, em vez de Mapbox (D-09).
- Sem CI: as suítes rodam à mão.
