# Arquitetura — NOMADE RUN (MVP)

> Dono: **Arquiteto de software**. Mudanças de arquitetura entram aqui e em `DECISOES_TECNICAS.md` (com ID `D-xx`).
> Última revisão: 2026-10-20.

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
│  migrations/     esquema, RLS, funções SQL, índices GiST, jobs (pg_cron)                         │
│  functions/      ingest-points · finish-activity · zones · zone · register-device ·             │
│                  moderate-activity · account-export · account-delete                             │
│                  → importam o MESMO src/domain do app (fonte única das regras, D-02)             │
│  tests/          pgTAP (RLS e funções SQL)                                                       │
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

```
auth.users 1─1 profiles ─┬─< devices                (chave HMAC por aparelho, RNF-006)
                         ├─< activities ─< activity_points   (único: activity_id+seq)
                         │        └─< activity_zones          (RP por zona, resultado)
                         ├─< safety_contacts         (≤ 5, RF-024)
                         ├─< notifications           (RF-009, RF-019)
                         ├─< fog_cells               (RF-022)
                         ├─< chest_opens             (RF-023)
                         ├── crew_members >─ crews   (RF-011, RN-011)
                         └─< moderation_reviews      (RF-018, feitas por staff)
zones (h3 text PK, geom PostGIS, influence jsonb, owner, shield, attack_*, blocked, city)
zone_events (captured / under_attack / defended / neutralized)
seasons (mensal, RN-006)
```

- `profiles.role`: `runner | moderator | admin`. Funções `is_staff()` / `is_admin()` (security definer) usadas nas policies.
- **RLS em todas as tabelas**. Dados privados (activities, points, contacts, notifications, devices) só do dono; zonas e eventos são públicos para leitura; escrita em zonas/atividades **só** pelo service role (Edge Functions).
- `devices.secret` nunca é exposto ao cliente após o registro (coluna sem grant de select).

## 4. Fluxo principal (UC-01: correr e conquistar)

1. App cria `activity_id` (UUID v4) localmente e grava cada ponto GPS no SQLite com `seq` crescente.
2. A cada 5 s (ou ao voltar a internet), o sync envia lotes `POST /ingest-points` assinados com HMAC-SHA256 da chave do aparelho. O servidor verifica assinatura, ordem (`seq`) e duplicidade, grava e responde rápido (RNF-009). Reenvio do mesmo lote é idempotente (RF-005).
3. Ao finalizar, o app chama `POST /finish-activity`. O servidor carrega os pontos, roda `validateActivity` + `finishRun` do domain, aplica RN-001/002/003/004 nas zonas (transação, `FOR UPDATE`), grava `activity_zones`, `zone_events`, notificações de invasão e devolve o resumo oficial.
4. Sem internet: o resumo aparece como **provisório** (cálculo local do mesmo domain) e é confirmado depois (UC-01 A1).

## 5. Segurança (RNF-006, RNF-007, RNF-013)

- Auth: Supabase Auth (bcrypt), JWT de 1 h com refresh automático, recuperação de senha por e-mail, rate limit de login.
- Sessão guardada no **expo-secure-store** (Keychain/Keystore), nunca em texto puro.
- Chaves só por variáveis de ambiente (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); `.env` fora do git; `service_role` só nas Edge Functions.
- Consentimentos separados (localização, notificações, termos) com explicação antes do pedido do sistema.
- LGPD: exportar dados (JSON) e excluir conta pelo app.

## 6. Ambientes

| Ambiente | Como sobe | Uso |
|---|---|---|
| Local | `npx supabase start` (Docker) + `npx expo start` | desenvolvimento e testes |
| Apresentação | projeto Supabase Cloud (plano gratuito) + Expo Go | MVP na faculdade |

## 7. Limitações conhecidas do MVP

- Expo Go não grava GPS em segundo plano no iOS: em segundo plano só com *development build* (código pronto, ativado por flag).
- Push remoto no Expo Go (Android) não existe desde o SDK 53: o MVP usa a central de notificações no app + Realtime e notificações locais.
- Login Google/Apple: depende de credenciais dos provedores; o código fica pronto e só aparece se configurado.
