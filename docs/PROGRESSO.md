# Progresso

> Registro contínuo. **Antes de começar** qualquer tarefa, leia a última entrada e as pendências.
> **Ao terminar**, adicione uma entrada no topo do log seguindo o modelo.

## Estado atual (resumo)

- **Fase:** 1 (infraestrutura)
- **Em andamento:** —
- **Feito na fase:** T1.1–T1.3 e T3.6 (A2 Backend): banco com RLS, Edge Functions usando o domain do app, seed de Goiânia, jobs diários; T1.4–T1.6 (A3 Frontend): cliente Supabase, auth, guardas de rota, onboarding no servidor, perfil e LGPD. **Fase 1 concluída.**
- **Próximos passos:** Fase 2 (A4 GPS: T2.1–T2.5, assinando lotes com o vetor de teste do contrato) e T2.6 (A3: mapa por `/zones` + Realtime, histórico).
- **Backend local no ar:** API `http://127.0.0.1:54321` · chave anon/publishable na entrada de T1.1–T1.3 abaixo · e-mails em `http://127.0.0.1:54324`.
- **Bloqueios:** nenhum

## Pendências abertas

| # | Pendência | Dono | Origem |
|---|---|---|---|
| P-01 | Cobertura de ramos do domain em 85% (meta 90%) | A5 | Baseline |
| P-02 | Seção 6.2 do ERS descreve paleta diferente da aprovada (D-15) | A6 | Baseline |
| P-03 | Foto de perfil (RF-002): bucket `avatars` + RLS prontos (A2, e2e); falta a tela de upload | A3 | T1.6 |
| P-05 | Validar em aparelho (Expo Go / development build): SecureStore em partes, deep link `nomaderun://nova-senha`, permissão de notificações no Expo Go Android, compartilhamento do JSON exportado | A3/A5 | T1.4–T1.6 |
| P-06 | Login Google/Apple só com credenciais reais (código pronto, aparece com `EXPO_PUBLIC_AUTH_PROVIDERS`) | Coordenação | T1.5 |
| P-07 | Testes de tela (React Native Testing Library) e fluxos Maestro de cadastro/login/onboarding usando os testIDs listados no log de T1.4–T1.6 | A5 | T1.5 |
| P-08 | Deploy das functions no Supabase Cloud não testado (import do domain fora de `supabase/`); se o bundler recusar, aplicar o plano B da D-02 (D-22) | A2 | T1.2 |
| P-09 | Rate limit de login só vale no Cloud (local o Auth não tem IP do proxy); conferir após `supabase config push` e ajustar se travar a apresentação (D-21) | A2/Coordenação | T1.1 |
| P-10 | Imagens `supabase/mailpit` e `supabase/pg_prove` não baixam aqui: usar `npm run mail` e `npm run db:test:psql` (D-27); rodar `npx supabase test db` onde houver a imagem | A5 | T1.3 |
| P-11 | RNF-009: medir p95 de `/zones` com 2.000 zonas (hoje 22–28 ms com 271) | A5 | T1.2 |
| P-12 | `M_grupo` (RN-001) não aplicado; baús (`chest_opens`) sem gravação no servidor até T3.5; nomes/cidade de zonas novas ficam vazios (sem IBGE) | A2 | T1.2 |

## Modelo de entrada

```
### AAAA-MM-DD — <ID da tarefa> — <título> (<agente>)
- Feito:
- Arquivos:
- Testes executados (comando → resultado):
- Problemas encontrados:
- Pendências:
- Para o próximo agente:
```

## Log

### 2026-10-20 — T1.1, T1.2, T1.3, T3.6 — Banco, RLS, Edge Functions, seed, testes e jobs (A2 Backend)
- **Feito:**
  - **T1.1 (banco):** `supabase init` (project_id `nomaderun`, CLI fixo `supabase@2.121.0` no `package.json` da raiz). `config.toml`: JWT 3600 s, rotação de refresh, senha ≥ 8, `site_url = nomaderun://` + redirecionamentos `nomaderun://**`, `exp://**`, `http://localhost:8081/**`, confirmação de e-mail desligada, rate limit `sign_in_sign_ups = 3`/5 min (≈ RNF-007), Google/Apple prontos e desligados, e-mail de recuperação em pt-BR (D-21). Extensões postgis, pgcrypto, pg_cron. 15 tabelas do modelo (profiles, devices, activities, activity_points, activity_zones, zones com GiST, zone_events, safety_contacts, notifications, fog_cells, chest_opens, crews, crew_members, moderation_reviews, seasons), trigger de perfil no cadastro (recusa < 16, sem aceites, nome inválido/repetido), RLS em todas, `is_staff()`/`is_admin()` security definer, colunas sensíveis sem grant, contatos ≤ 5, RN-011 nas crews (mesma facção, 1 por pessoa, máx. 30, sucessão do líder), cidade 1×/temporada (RN-013). RPCs `choose_faction`, `join_crew`, `leave_crew`, `mark_notifications_read`, `admin_set_user_status`, `zones_in_bbox`, `username_available`, `is_staff`/`is_admin`. Views `public_profiles` e `leaderboard_individual|crews|factions|cities` (RN-013). Realtime em `zones`. Bucket `avatars` com RLS por pasta (P-03, lado servidor).
  - **T1.2 (functions):** `register-device`, `ingest-points`, `finish-activity`, `zones`, `zone`, `moderate-activity`, `account-export`, `account-delete`, exatamente no formato do contrato (atualizado). **D-02 testada de verdade:** o domain do app é importado por caminho relativo e roda no edge-runtime, sem plano B (ponte `_shared/domain.ts` + remapeamento no `deno.json` + h3-js vendorizado idêntico ao do app; ver D-22). HMAC-SHA256 com JSON canônico e comparação em tempo constante, **vetor de teste no `API_CONTRATO.md`** (conferido com Python). Idempotência `(activity_id, seq)`: duplicado aceito, `REPLAY_MISMATCH`, `OUT_OF_ORDER` com `details.lastSeq`. `finish-activity`: ritmo-base (mediana das últimas 10), sequência semanal, limite diário, zonas atuais com `FOR UPDATE` + versão numa RPC transacional (concorrência otimista, D-23), zonas novas com o polígono de `cellBoundary` (RF-020), activity_zones, zone_events, XP, trust (RN-009: < 40 revisão sem pontuar, < 10 suspenso), neblina, notificações de invasão com os limites da RN-003, "Território perdido" e "Zona conquistada"; resposta com `invalidSegments` explicados (`FLAG_EXPLANATION`) e `review`. Erros sempre `{ error: { code, message } }` em pt-BR; entradas validadas (≤ 500 pontos, lat/lng, ordem de `t`, bbox ≤ 1 grau etc.); CORS liberado.
  - **T1.3 (seed e testes):** `supabase/seed.sql` gerado por `supabase/scripts/gen-seed.ts` a partir de `seedZones()`/`zoneName()`/`demoRoute()` do app: 271 zonas de demonstração ao redor do Parque Flamboyant (parque sob ataque dos Coyotes), 4 contas de demonstração e uma corrida em revisão (trecho de carro) para o painel de moderação. pgTAP (7 arquivos, 124 testes), Deno (27 testes) e e2e (33 verificações).
  - **T3.6 (jobs, pg_cron):** `job_fortify_zones` (00:05 BRT, RN-004 sobe/desce escudo), `job_decay_zones` (03:00 BRT, RN-005), `job_close_week` (segunda, RN-014) e `job_season_rollover` (dia 1, RN-006) — funções SQL testáveis com as constantes do domain (D-25).
- **Arquivos:** `package.json`/`package-lock.json` (raiz, só CLI e scripts); `supabase/config.toml`; `supabase/migrations/2026102012{0000_extensions_and_schema,0100_auth_rls,0200_rpcs,0300_views_and_jobs,0400_storage_avatars}.sql`; `supabase/functions/{register-device,ingest-points,finish-activity,zones,zone,moderate-activity,account-export,account-delete}/index.ts`; `supabase/functions/_shared/{domain,http,supabase,hmac,validate,scoring,finish}.ts` e `_shared/vendor/h3-js/`; `supabase/functions/deno.json`; `supabase/functions/tests/{fixtures,hmac,validate,scoring,domain_bridge}.test.ts`; `supabase/tests/database/0{1..7}_*.test.sql`; `supabase/seed.sql`; `supabase/scripts/{gen-seed.ts,deno.json,e2e.ts,e2e.sh,test-db.sh,mail-sink.mjs,mail-sink.sh,vendor-h3.sh}`; `supabase/templates/recovery.html`; docs: `API_CONTRATO.md` (reescrito), `DECISOES_TECNICAS.md` (D-21..D-27 + resultado na D-02), `REQUISITOS.md`, `PLANO_DESENVOLVIMENTO.md`, este arquivo.
- **Testes executados (na raiz do repo):**
  - `npx supabase db reset` → 5 migrations + seed aplicados do zero, sem erro.
  - `npx supabase test db` → **não roda aqui** (a imagem `supabase/pg_prove` não baixa: limite dos registros Docker). Os mesmos arquivos via `npm run db:test:psql` (`supabase/scripts/test-db.sh`, psql no container) → **124/124 ok** em 7 arquivos (RLS em todas as tabelas, A não lê dados de B, cliente não escreve em zones/activities/pontos/notificações, colunas protegidas do perfil, trigger de idade/termos, 5 contatos, RN-011 e limite de 30, facção 1×/temporada, ingestão idempotente, conflito de versão, limites da RN-003, moderação, admin, jobs e rankings).
  - `npm run functions:test` (Deno 2.5.6 instalado com `npm i -g deno@2.5.6`, só `node:assert`, sem rede) → **27/27 ok** (vetor HMAC, canonical, validações, cálculo oficial = `finishRun`, trust/revisão/suspensão, trechos inválidos, aprovação, ponte do domain e h3-js vendorizado idêntico ao do app).
  - `npm run functions:check` → tipos ok nas 8 functions.
  - `npm run e2e` (contra a stack local, `supabase functions serve` rodando) → **33/33 ok**: menor de 16 recusado → cadastro → login (JWT 3600 s) → facção → aparelho (idempotente) → lote 1 → reenvio duplicado → lote fora de ordem (`OUT_OF_ORDER`) → reenvio adulterado (`REPLAY_MISMATCH`) → assinatura errada (`INVALID_SIGNATURE`) → finalizar antes do lote 2 (`MISSING_POINTS`) → lote 2 → `finish-activity` válido com a zona conquistada → finalizar de novo (mesmo resultado) → `/zones` e `/zone` mostram o novo dono e o corredor no topo → notificação "Zona conquistada" → cliente não altera `zones` → foto no bucket (própria pasta ok, alheia recusada) → export → exclusão (token deixa de valer, foto apagada).
  - `npx supabase db advisors --local` → "No issues found" (segurança e desempenho).
  - Manual: moderador de demonstração aprovou a corrida em revisão do seed via `moderate-activity` (status `partial`, 419 RP, 4 zonas, notificação "Corrida aprovada"); recuperação de senha gerou o e-mail com link `nomaderun://` na caixa local; `/zones` com as 271 zonas do seed em 22–28 ms.
- **Problemas encontrados:**
  - Edge-runtime local (Deno 2.1.4) não aceita imports sem extensão (`sloppy-imports`) e só monta no container os arquivos achados com caminho explícito; o container também não alcança o npm (certificado do proxy). Resolvido sem copiar o domain (D-22).
  - As imagens `supabase/mailpit` e `supabase/pg_prove` não baixam (Docker Hub 429 / "Data limit exceeded"). A stack sobe com `-x ...,mailpit` e uma caixa SMTP própria (`npm run mail`, `http://127.0.0.1:54324`); pgTAP via psql (D-27).
  - O rate limit por IP do Auth **não age localmente** (sem cabeçalho de IP); só no Cloud (P-09). Ao contrário do que diz a entrada do A3, testes locais de login não esbarram nele.
  - Quando o trigger recusa o cadastro o Auth devolve só "Database error saving new user" (já tratado pelo A3 com `username_available` + validação no app).
- **Pendências:** P-08 a P-12 (tabela acima). P-04 resolvida (contrato atualizado; os nomes que o A3 usou batem com o backend: `choose_faction(p_faction)`, `username_available(p_username)`, `units`, `notification_prefs` = `invasion, conquest, moderation, missions`, metadados `accepted_terms`/`accepted_privacy`).
- **Backend local (deixado rodando):**
  - API: `http://127.0.0.1:54321` · Functions: `http://127.0.0.1:54321/functions/v1/<nome>` · Banco: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` · E-mails: `http://127.0.0.1:54324`.
  - Chave publishable: `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` · chave anon (JWT legado, também aceita): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0` (chaves fixas de desenvolvimento do CLI; não servem fora da máquina local). Em aparelho físico, troque `127.0.0.1` pelo IP da máquina na rede.
  - Subir de novo: `npm run db:start` (stack sem studio/mailpit + caixa de e-mail) e, em outro terminal, `npm run functions:serve`. Recriar os dados: `npm run db:reset`. O `functions serve` atual foi iniciado em segundo plano (`setsid nohup`), log em `/tmp/claude-0/.../scratchpad/serve.log`.
  - **Contas de demonstração (só uso local/apresentação; `is_demo = true`):** corredor `corredor.demo@nomaderun.app` / `Corrida@2026` (Neon Striders) · moderador `moderador.demo@nomaderun.app` / `Moderacao@2026` (Night Owls) · admin `admin.demo@nomaderun.app` / `Admin@2026demo` (Volt Runners) · corredor suspeito `suspeito.demo@nomaderun.app` / `Suspeito@2026` (Urban Coyotes, trust 30, uma corrida em revisão).
- **Para o A4 (GPS e integrações):**
  - Gere a chave do aparelho (32 bytes), registre em `register-device` e assine cada lote com o canonical do contrato. **Confira sua implementação com o vetor de teste** do `API_CONTRATO.md` (mesma entrada → mesma assinatura hex). Use `JSON.stringify` sobre um objeto montado na ordem exata (não reordene números: o servidor refaz o canonical a partir dos valores recebidos).
  - Lotes de até 500 pontos, `seq` contínuo a partir de 0, `t` em ms. `steps` = passos desde o ponto anterior; **não envie `steps` em aparelho sem pedômetro** (ausente/`null` = sem sensor → `NO_PEDOMETER`). `mocked` vem de `location.mocked`.
  - Respostas: 202 = gravado (apague da fila até `lastSeq`); `OUT_OF_ORDER` → reenvie de `details.lastSeq + 1`; `ACTIVITY_CLOSED` → descarte; `UNKNOWN_DEVICE` → registre de novo; erro de rede/5xx → mantenha na fila. No fim, `finish-activity` com o último `seq`; `MISSING_POINTS` → reenvie a fila e repita. O resultado oficial pode vir `review` (mostre `review.message`) ou `rejected`.
  - Contatos da Corrida Segura: `from('safety_contacts')` (CRUD; o 6º dá `CONTACTS_LIMIT`). Neblina persistida: `from('fog_cells')`. Baús ainda não têm gravação no servidor (T3.5, peça a function quando chegar lá).
- **Para o A3 (Frontend):**
  - Mapa (T2.6): `GET /zones?bbox=` (caixa ≤ 1 grau) ou `rpc('zones_in_bbox')`; Realtime: `channel('zones').on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, ...)`. Folha da zona: `GET /zone?id=`. `name` nunca vem nulo nas functions.
  - Histórico: `from('activities').select('id,status,started_at,meters,moving_seconds,avg_pace,rp_total,xp,flags,result')` filtrando `started_at`; o resumo oficial completo está em `result`.
  - Rankings (T3.2): views `leaderboard_*` (colunas no contrato). Central (T3.1): `from('notifications')` + `rpc('mark_notifications_read', { ids })`; `data.zoneId/lat/lng` para abrir o mapa. Crews (T3.4): `insert` em `crews` com `{ name, tag }`, `rpc('join_crew', { p_code })`, `rpc('leave_crew')`.
  - Moderação (T3.3): `rpc('is_staff')`, lista `activities` com `status = 'review'` (+ `activity_points` para o percurso e `flags`/`invalid_segments`), decisão em `POST /moderate-activity`; admin: `rpc('admin_set_user_status', { p_user_id, p_status })`. Faça login com a conta de moderador de demonstração.
  - Foto (P-03): upload em `avatars/<user id>/avatar.jpg` (`upsert: true`) e grave a URL pública em `profiles.avatar_url`.
  - Recuperação de senha local: o e-mail aparece em `http://127.0.0.1:54324` com o link de verificação que redireciona para o `redirectTo`.

### 2026-10-20 — T1.4, T1.5, T1.6 — Infra do app, autenticação, onboarding, perfil e LGPD (A3 Frontend)
- **Feito:**
  - **T1.4 (infra):** dependências da fase atual e da próxima instaladas de uma vez; plugins no `app.json`; `app.config.js` com a flag de GPS em segundo plano; cliente Supabase com sessão no SecureStore dividida em partes (D-06) e `localStorage` no web; auto-refresh parado em segundo plano (AppState); tela "Backend não configurado" quando faltam as variáveis; `AppError` (NETWORK, UNAUTHORIZED, VALIDATION, NOT_FOUND, CONFLICT, RATE_LIMITED, SERVER, UNKNOWN) + `Result<T>` + mapeador de erros Auth/PostgREST/Functions/HTTP para pt-BR (inclui as mensagens `CODIGO: texto` do backend); repositórios `auth-repo`, `profile-repo`, `account-repo`, `functions` (Edge Functions com JWT), cache do perfil para abrir sem internet.
  - **T1.5 (auth):** rotas `/entrar`, `/cadastro`, `/recuperar-senha`, `/nova-senha` (deep link `nomaderun://nova-senha`, fluxo implícito e PKCE), `/termos`, `/privacidade` (modais), `/indisponivel`. Cadastro com e-mail, senha (mín. 8 + medidor de força), nome de usuário (3–20, conferido no RPC `username_available` antes do `signUp` e erro do banco tratado), nascimento DD/MM/AAAA com 16+, dois aceites separados; metadados em `options.data`. Botões Google/Apple só com `EXPO_PUBLIC_AUTH_PROVIDERS`. Guardas com `Stack.Protected` no `_layout.tsx` via função pura `resolveRouteGroup` (sem sessão → auth; recuperação → nova senha; sem facção → onboarding; com facção → abas); splash até restaurar a sessão e carregar o perfil. Rotas e opções de apresentação existentes mantidas. `session-store` novo; `game-store` recebe `name`/`faction`/`xp`/`trust` do perfil (`applyProfile`) e zera no logout (`resetForSignOut`), API usada pela corrida intacta.
  - **T1.6 (onboarding/perfil/LGPD):** onboarding com o mesmo visual; nome pré-preenchido com o nome de usuário (se mudar, salva no perfil); facção gravada pelo RPC `choose_faction`; explicação da localização mantida; **etapa nova e separada de notificações** com explicação própria (RNF-013). Aba Perfil ganhou a seção "Conta" (mesmo estilo de `Surface`) → `/perfil/editar` (nome, cidade natal, km/milhas, preferências de invasões/conquistas/missões/moderação; foto = iniciais) e `/perfil/conta` (exportar JSON via `account-export` + expo-file-system + expo-sharing; excluir conta digitando EXCLUIR → `account-delete` → logout; Sair; termos e privacidade).
- **Dependências instaladas** (`EXPO_OFFLINE=1 npx expo install ...`, versões do SDK 57): `@supabase/supabase-js@^2.118.0`, `expo-secure-store@~57.0.4`, `expo-sqlite@~57.0.4`, `expo-crypto@~57.0.3`, `expo-sensors@~57.0.3`, `expo-task-manager@~57.0.21`, `expo-keep-awake@~57.0.2`, `expo-network@~57.0.2`, `expo-notifications@~57.0.22`, `expo-file-system@~57.0.7`, `expo-sharing@~57.0.22`. **Não** instalado: `react-native-url-polyfill` (o runtime do Expo 57 já instala `URL`/`URLSearchParams`, ver D-16).
- **Plugins no `app.json`:** `expo-location` (textos pt-BR de uso, "sempre", movimento; `isAndroidMotionActivityEnabled: true`; segundo plano desligado), `expo-sensors` (`NSMotionUsageDescription`), `expo-secure-store` (sem Face ID), `expo-sqlite`, `expo-notifications` (cor laranja), `expo-task-manager`, `expo-sharing`; `ios.infoPlist.NSMotionUsageDescription`; `extra.backgroundLocation`.
- **Arquivos:**
  - Compartilhados: `apps/mobile/package.json`, `package-lock.json`, `app.json`, `app.config.js` (novo), `.env.example` (novo), `src/app/_layout.tsx`.
  - Serviços: `src/services/api/{env,errors,secure-storage,supabase,functions,types,auth-repo,profile-repo,account-repo,profile-cache,profile-cache.web}.ts`, `src/services/auth/deep-link.ts`, `src/lib/share-json{,.web}.ts`.
  - Store: `src/store/session-store.ts` (novo), `src/store/game-store.ts` (+`applyProfile`, `resetForSignOut`, `ProfileSnapshot`).
  - Auth: `src/features/auth/{route-guard,validation,session-controller,oauth}.ts`, `form-ui.tsx`, `sign-in-screen.tsx`, `sign-up-screen.tsx`, `forgot-password-screen.tsx`, `new-password-screen.tsx`, `legal-screen.tsx`, `unavailable-screen.tsx`.
  - Telas: `src/features/screens/{edit-profile-screen,account-screen}.tsx` (novas), `onboarding-screen.tsx` e `profile-screen.tsx` (mudança mínima).
  - Rotas: `src/app/(auth)/{_layout,entrar,cadastro,recuperar-senha}.tsx`, `src/app/{nova-senha,termos,privacidade,indisponivel}.tsx`, `src/app/(tabs)/perfil/{editar,conta}.tsx`.
  - Componentes (aditivo, sem mudança visual): `icon.tsx` (+`chevron`, `mail`, `eye`, `eyeOff`), `button.tsx` (`IconButton` aceita `testID`).
  - Testes: `src/services/api/__tests__/{errors,secure-storage,types,auth-repo,integration.local}.test.ts`, `src/services/auth/__tests__/deep-link.test.ts`, `src/features/auth/__tests__/{validation,route-guard}.test.ts`, `src/store/__tests__/session-store.test.ts`.
- **Testes executados (em `apps/mobile`):**
  - `npm run typecheck` → ok · `./node_modules/.bin/eslint src` → 0 erros, 0 avisos.
  - `npm test` → **157 passaram**, 7 ignorados (integração, só com `NOMADE_IT=1`); 15 suítes (60 do domain + 97 novos).
  - Integração real contra o Supabase local (`NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon> npx jest integration.local`) → **7/7**: nome livre, cadastro 16+ cria sessão e perfil sem facção, menor de 16 recusado pelo banco, editar perfil (cidade/unidade/preferências) e cidade inválida recusada, `choose_faction`, senha errada amigável, exportar e excluir conta (login depois falha).
  - `npx expo export -p web` → compila (com e sem `.env`; sem `.env` o app abre "Backend não configurado").
  - Fluxo no navegador (Playwright + Chromium local sobre o export web, 390×844): entrar com senha errada → "E-mail ou senha incorretos."; cadastro com erros de validação; idade 12 anos recusada; cadastro ok → onboarding com nome pré-preenchido → time → localização → notificações → abas; perfil → editar (cidade, milhas) salvo; conta → excluir com EXCLUIR → volta para Entrar.
- **Problemas encontrados:**
  - `npx expo install` falha aqui porque o proxy bloqueia a API do Expo; use `EXPO_OFFLINE=1 npx expo install <pacotes>` (usa o mapa de versões embutido no SDK). Docs web do Expo/Supabase também bloqueadas: APIs conferidas nos tipos instalados em `node_modules`.
  - O preset `jest-expo` troca o `fetch` global pelo do Expo (não funciona em Node): o teste de integração usa `node-fetch` (dependência transitiva) via `global.fetch` do cliente.
  - O Auth devolve só "Database error saving new user" quando o trigger recusa: por isso o app chama `username_available` antes do `signUp` e mapeia esse erro para uma mensagem amigável.
  - Diferenças do contrato escrito × backend real (já tratadas no app, ver P-04): `choose_faction(p_faction)`, coluna `units`, chaves `invasion`/`conquest` no jsonb.
  - Export web reaproveita cache do Metro: depois de criar/alterar o `.env`, rode com `--clear`.
- **Decisões novas:** D-16 a D-20 em `DECISOES_TECNICAS.md`.
- **Pendências:** P-03 a P-07 (tabela acima). Os dados de corridas, zonas, histórico e conquistas continuam locais/demonstração até a Fase 2 (A4) e T2.6 (A3). Os contatos da Corrida Segura no perfil ainda são os de demonstração (T2.5).
- **Para o A4 (GPS e integrações):**
  - Todas as dependências da Fase 2 já estão no `package.json` e os plugins no `app.json`: não precisa mexer neles. GPS em segundo plano: `NOMADE_BACKGROUND_LOCATION=1 npx expo run:android|ios` liga os flags do `expo-location`; leia em runtime `Constants.expoConfig?.extra?.backgroundLocation`.
  - Edge Functions: `callFunction<T>(name, { method, body, query })` em `src/services/api/functions.ts` já manda o JWT e devolve `Result<T>` com o erro do contrato (`error.detail` = `MISSING_POINTS`, `OUT_OF_ORDER` etc.). Para `ingest-points`, monte o corpo assinado no seu serviço e passe em `body`. Erros de rede → `code: 'NETWORK'` (sinal para manter na fila).
  - Usuário logado: `useSession.getState().session?.userId`; perfil: `useSession.getState().profile` (tem `unit` km/mi para formatar distâncias). O `game-store` manteve toda a API usada por `use-run-session.ts`; novos: `applyProfile` e `resetForSignOut` (chamado no logout — **não apague a fila offline de corridas não enviadas no logout sem decidir isso**; o reset do game-store não toca no SQLite).
  - O cache do perfil usa `expo-sqlite/kv-store` (chave `nomade.profile.v1`); use outro arquivo de banco para a fila.
  - A permissão de notificações já é pedida no onboarding (etapa própria). A de localização continua sendo pedida no onboarding e de novo na tela de corrida se faltar.
- **Para o A5 (QA):**
  - testIDs novos: `tela-entrar`, `entrar-email`, `entrar-senha`, `entrar-senha-mostrar`, `entrar-botao`, `entrar-erro`, `entrar-esqueci`, `entrar-criar-conta`, `entrar-google|apple`; `tela-cadastro`, `cadastro-email|senha|usuario|nascimento`, `cadastro-aceite-termos`, `cadastro-aceite-privacidade`, `cadastro-abrir-termos|privacidade`, `cadastro-botao`, `cadastro-erro`, `cadastro-ja-tenho-conta`, `tela-cadastro-confirmar`; `tela-recuperar-senha`, `recuperar-email|botao|enviado|erro|voltar`; `tela-nova-senha`, `nova-senha-senha|confirmar|botao|erro|erro-link|pedir-link|entrar`; `tela-termos`, `tela-privacidade`, `legal-fechar`; `tela-backend-nao-configurado`, `tela-perfil-indisponivel`, `indisponivel-tentar|sair`; onboarding: `onboarding-nome`, `onboarding-escolher-time`, `onboarding-faccao-<id>`, `onboarding-faccao-continuar`, `onboarding-localizacao-continuar`, `onboarding-notificacoes-continuar`, `onboarding-erro`; perfil: `perfil-editar`, `perfil-conta`, `perfil-sair`, `tela-editar-perfil`, `perfil-usuario`, `perfil-cidade`, `perfil-unidade-km|mi`, `perfil-notificacao-<invasions|conquests|missions|moderation>`, `perfil-salvar`, `perfil-erro`; conta: `tela-conta`, `conta-exportar`, `conta-termos`, `conta-privacidade`, `conta-sair`, `conta-excluir`, `conta-excluir-confirmacao`, `conta-excluir-confirmar`, `conta-excluir-cancelar`.
  - Rate limit local do Auth é baixo (`sign_in_sign_ups`): espalhe os testes de login/cadastro ou use usuários do seed. No Playwright conceda `permissions: ['geolocation','notifications']` ao contexto, senão o onboarding espera o prompt do navegador.
  - Sugestão: testes de tela com React Native Testing Library para cadastro/onboarding (P-07) e o teste `integration.local` no roteiro do T4.4.

### 2026-10-20 — T0.1–T0.3 — Análise, skills e base da documentação (A1 Arquiteto)
- **Feito:** leitura completa do ERS (27 RF, 15 RNF, 19 RN, UC-01..03) e do código; baseline medido; Docker e Supabase local validados no ambiente; skills instaladas; arquitetura, decisões D-01..D-15, contrato da API, plano e checklist criados.
- **Arquivos:** `docs/ARQUITETURA.md`, `docs/DECISOES_TECNICAS.md`, `docs/API_CONTRATO.md`, `docs/PLANO_DESENVOLVIMENTO.md`, `docs/REQUISITOS.md`, `docs/PROGRESSO.md`, `CLAUDE.md`, `.claude/skills/*`, `skills-lock.json`.
- **Testes:** `npm test` → 60/60; `npm run typecheck` → ok; `eslint src` → ok; cobertura do domain 94,1% linhas / 84,8% ramos.
- **Problemas:** a busca do `find-skills` (`npx skills find`) não funciona aqui porque o proxy bloqueia a API do skills.sh. Skills instaladas direto dos repositórios oficiais no GitHub (`npx skills add <repo> --skill ...`). O filtro de lint do rtk mostra "JSON parse failed" quando o ESLint não tem saída: rode `./node_modules/.bin/eslint src` direto.
- **Pendências:** P-01, P-02.
- **Para o próximo agente:** comece pela Fase 1. O backend sobe com `npx supabase start` na raiz (o Docker precisa estar rodando: `dockerd &`). O contrato está em `docs/API_CONTRATO.md`.
