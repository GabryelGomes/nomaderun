# QA e segurança — NOMADE RUN (Fase 4)

> Dono: **A5 (QA e segurança)**. Revisão de 2026-10-21 sobre o commit `6871486` (branch `claude/dreamy-ptolemy-xnm4r7`) mais as alterações em andamento do A3 na mesma árvore.
> Achados viram tarefa para o dono indicado (o A5 não corrige código de produção). Estado de cada achado também na tabela de pendências do `PROGRESSO.md`.

## 1. Escopo

| Área | O que foi revisado e testado |
|---|---|
| Domain (`apps/mobile/src/domain`) | cobertura de linhas e ramos (RNF-008), invariantes por testes de propriedade |
| Banco (`supabase/migrations`) | RLS de cada tabela, grants por coluna, views públicas, RPCs `security definer` (search_path, quem executa), Realtime, Storage |
| Edge Functions (`supabase/functions`) | autenticação (gateway com `verify_jwt = false`), autorização, validação de entrada, HMAC, erros, CORS, regras de jogo controladas pelo cliente |
| Auth (Supabase) | senhas (bcrypt), limite de login, sessão, conta inativada |
| App | segredos no código e no bundle web, sessão no SecureStore, logs, deep links, testIDs (RNF-012), acessibilidade (RNF-011/015) |
| Requisitos | rastreabilidade RF/RNF/RN → testes; fluxos Maestro UC-01..03; ponta a ponta no navegador |

Fora do escopo: medição em aparelho (P-05, P-17, P-21, P-28), RNF-001/002/004 (carga real, fps, bateria), deploy no Cloud (P-08).

## 2. Método

- **Skills**: `sharp-edges` (APIs que deixam errar: `ghostPace`, `avatar_url`, fluxo implícito de auth), `differential-review` (o que mudou na Fase 3: privacidade, baús, rankings, M_grupo), `spec-to-code-compliance` (ERS × código, seções 4–6), `property-based-testing` (invariantes do domain e da fila), `webapp-testing` (Playwright sobre o export web), `supabase-postgres-best-practices` (RLS, `security definer`, `search_path`, grants).
- **Leitura adversarial** das migrations, das 8 functions e de `_shared/*`, depois **cada suspeita virou teste** contra a stack local: pgTAP (catálogo + tentativas de escalada), teste adversarial HTTP (functions, PostgREST, Storage, Auth) e testes Deno de entrada.
- Achados ainda abertos aparecem no teste adversarial como `ACHADO QA-xx` (não derrubam a execução; `STRICT=1` derruba — use para conferir a correção).

## 3. Como rodar

| Suíte | Comando (na raiz, salvo indicação) | Pré-requisito |
|---|---|---|
| App (unidade + estáticos) | `cd apps/mobile && npm test` | — |
| Cobertura do domain com limite | `cd apps/mobile && npx jest --coverage` (falha se `src/domain` < 90% em linhas, ramos, funções ou instruções) | — |
| pgTAP | `npm run db:test:psql` (ou `npx supabase test db` onde a imagem `pg_prove` baixar) | `npx supabase db reset` antes (07 e 10 dependem do banco limpo, QA-11) |
| Deno (functions) | `export PATH="$PATH:$(npm root -g)/.bin"; npm run functions:test` | — |
| e2e do backend | `npm run e2e` | `npm run functions:serve` rodando |
| **Segurança adversarial** | `bash supabase/tests/security/run.sh` (`STRICT=1` para falhar nos achados abertos) | stack + functions + seed |
| Integração do app | `cd apps/mobile && NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon> NOMADE_IT_DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx jest integration --forceExit` | stack + functions + seed |
| **Ponta a ponta no navegador** | `cd apps/mobile && npx expo export -p web --output-dir /tmp/nomade-web && node e2e-web/demo-flow.cjs /tmp/nomade-web` | stack + functions + seed; Playwright global (`/opt/pw-browsers`) |
| **Comparação de imagem** (RNF-012) | `cd apps/mobile && NODE_PATH="$(npm root -g)" WEB_DIST=/tmp/nomade-web node "$(npm root -g)/playwright/cli.js" test -c e2e-web/playwright.config.cjs` | `npm run db:reset` antes (imagens de referência foram geradas com o seed limpo) |
| Maestro (UC-01..03) | `cd apps/mobile && maestro test -e APP_ID=host.exp.exponent -e APP_URL=exp://<ip>:8081 .maestro/` | aparelho/emulador, ver `apps/mobile/.maestro/README.md` |

## 4. Resultados (2026-10-21)

| Suíte | Resultado |
|---|---|
| `npm test` (app) | **341 passaram**, 23 ignorados (integrações sem `NOMADE_IT`), 40 suítes + 4 ignoradas · `typecheck` ok · `eslint src` 0 erros/0 avisos |
| Cobertura `src/domain` | **100% linhas, 99,59% ramos, 97,56% funções, 99,54% instruções** (antes 95,1% / 84,5%; P-01 fechada) |
| pgTAP (`db:test:psql`, banco recém-resetado) | **242/242** em 12 arquivos (novo `12_security_audit`: 44) |
| Deno (`functions:test`) | **51 ok**, 1 ignorado (novo `security_inputs`: 10) |
| `npm run e2e` | **54/54** |
| Segurança adversarial | **81/81** verificações; 5 achados abertos sinalizados (QA-01, 02, 04, 05, 07) |
| Integração do app (`NOMADE_IT=1`) | **23/23** em 4 suítes |
| Playwright — fluxo de demonstração | **12/12**: cadastro → Striders → corrida simulada (61 s até a zona neutra) → resumo oficial "Zona conquistada, mais 49 RP em Setor Marista 24" → zona no servidor com novo dono → folha da zona → notificação → moderador aprova (parcial, 406 RP) · sem erros de página |
| Playwright — comparação de imagem | 4 imagens de referência (mapa com zonas dominadas e sob ataque; folha da zona neutra, dominada e sob ataque), tolerância 0,2%; mapa de calor = `fixme` (RF-013 fora do MVP) |
| RNF-009 (P-11) | 2.000 zonas no bbox: `zones_in_bbox` executa em 39 ms no banco; `GET /zones` p50 28 ms / **p95 35 ms** — mas devolve só 1.000 (QA-04) |
| Bundle web (`expo export -p web`) | sem `service_role`, `sb_secret_…` (só o prefixo dentro do supabase-js), JWT secret ou senhas de demonstração; só a chave pública anon |

## 5. Achados

Severidade: **Alta** = quebra de confidencialidade/integridade explorável por qualquer usuário; **Média** = abuso de regra, vazamento limitado ou falha de requisito com impacto na demonstração; **Baixa** = endurecimento, higiene ou impacto pequeno. **Nenhum achado Alto.**

| # | Sev. | Achado | Evidência | Arquivo | Recomendação | Dono |
|---|---|---|---|---|---|---|
| QA-01 | Média | **Código de convite de qualquer crew é legível** por qualquer usuário logado (`grant select` em todas as colunas de `crews`). Quem é da mesma facção entra em qualquer crew sem ser convidado (RN-011 só barra outra facção) | adversarial #44 (`GET /rest/v1/crews?select=invite_code` → código de crew alheia); probe SQL | `supabase/migrations/20261020120100_auth_rls.sql` (grant em `public.crews`) | `revoke select (invite_code)` e grant por coluna sem ele; RPC `my_crew_invite()` (só membros/líder); manter o `join_crew` | A2 |
| QA-02 | Média | **`ghostPace` controlado pelo cliente dá M_fantasma 1,5 e +50 XP em qualquer missão**: o servidor aceita 60–3600 s/km (o app oferece 5:00–7:00) e aplica o fantasma mesmo em missão `livre`; com 3600 s/km qualquer corrida "vence" | adversarial #42: missão `livre`, `ghostPace: 3600` → `beatGhost: true`, 62 RP em 415 m (= ×1,5) | `supabase/functions/_shared/validate.ts` (`optionalNumber(b.ghostPace, …, 60, 3600)`), `_shared/scoring.ts` (`ghostPace: input.ghostPace`), `svc_ingest_points` | Só considerar `ghostPace` quando `mission = 'fuga'`; aceitar apenas os ritmos oferecidos (300/330/360/420) ou uma faixa relativa ao ritmo-base do corredor; registrar em D-xx | A2 (regra no servidor); A1 se for no domain |
| QA-03 | Média | **Link `nomaderun://` com tokens troca a sessão atual sem confirmação** (fluxo implícito): outro app ou página pode abrir `nomaderun://nova-senha#access_token=…&refresh_token=…` e logar a vítima na conta do atacante (corridas e localização vão para ele); no Android o esquema próprio pode ser registrado por outro app e receber os tokens de recuperação | leitura: `handleAuthUrl` chama `setSession` para qualquer link com tokens, mesmo com sessão ativa; cliente sem `flowType: 'pkce'` | `apps/mobile/src/features/auth/session-controller.ts` (`handleAuthUrl`, listener de `Linking`), `apps/mobile/src/services/api/supabase.ts`, `services/auth/deep-link.ts` | `flowType: 'pkce'` no `createClient` e só `exchangeCodeForSession` (code sem o verifier local não serve); ignorar links de token quando já há sessão, salvo recuperação pedida neste aparelho; em produção, App Links/Universal Links | A3 |
| QA-04 | Média | **`/zones` devolve no máximo 1.000 zonas** (limite `max_rows` do PostgREST sobre a RPC), mas o contrato e a RNF-009 falam em até 2.000: em área densa o mapa corta zonas sem aviso | adversarial #81 (1.200 zonas na área → 1.000); benchmark P-11 | `supabase/functions/zones/index.ts`, `public.zones_in_bbox`, `supabase/config.toml` (`max_rows = 1000`) | RPC que devolve `jsonb_agg` (como `svc_load_activity`) ou paginação por `Range`; teste com 2.000 | A2 |
| QA-05 | Baixa | `profiles.avatar_url` aceita qualquer esquema/host (`javascript:`, imagem de rastreio externa) e sai em `public_profiles`; `notification_prefs` sem limite de tamanho | adversarial #46 | `20261020120000_extensions_and_schema.sql` (checks de `profiles`) | CHECK: só a URL pública do bucket `avatars/<id>/…` (ou guardar só o caminho); CHECK de tamanho em `notification_prefs` | A2 |
| QA-06 | Baixa | Configuração do Auth: (a) limite de login local inexistente (12 tentativas erradas → 12× 400; P-09) e no Cloud `sign_in_sign_ups = 3`/5 min por IP soma cadastro+login — pode travar a apresentação numa rede com NAT; (b) `secure_password_change = false` (trocar a senha não pede a atual/reautenticação); (c) `account-delete` sem reautenticação | adversarial (seção 10); `config.toml` | `supabase/config.toml`, `supabase/functions/account-delete/index.ts` | Conferir após `config push` (P-09); avaliar 10/15 min; `secure_password_change = true`; pedir a senha (reauth) antes de excluir a conta | A2 / Coordenação |
| QA-07 | Baixa | Conta **inativada** pelo admin continua com o token já emitido válido no PostgREST/Realtime por até 1 h (as functions já recusam: o Auth bloqueia o usuário banido) | adversarial #74–#77 | `public.admin_set_user_status`, policies de escrita | Aceitar e documentar (JWT de 1 h) ou checar `status = 'active'` nas policies de escrita (`private.is_active()`) | A2 |
| QA-08 | Baixa | Sem limite de pontos por corrida nem de corridas por usuário e sem limite de chamadas nas functions; o `finish-activity` carrega todos os pontos num único `jsonb`; `readJson` lê o corpo inteiro antes de medir | leitura | `svc_ingest_points`, `svc_load_activity`, `_shared/http.ts` | Teto (ex.: 20.000 pontos/corrida, N corridas abertas por usuário); conferir `Content-Length` antes de ler | A2 |
| QA-09 | Baixa | `endedAt` do `finish-activity` sem limite superior/coerência (pode ser antes do início ou no ano 3000); vai para `activities.ended_at` (só exibição; `finished_at` usa `now()`) | leitura + `security_inputs.test.ts` | `_shared/validate.ts` (`parseFinish`) | Limitar a [último ponto, agora + 5 min] | A2 |
| QA-10 | Baixa (risco aceito) | O HMAC garante integridade e anti-replay, **não** que o cliente é o app: a chave é gerada e registrada pelo próprio cliente, então um script com login válido envia corridas assinadas (inclusive `mocked: false`). `startedAt`, `mission` e `ghostPace` ficam fora da assinatura (agrava QA-02). A defesa real é antifraude + Índice de Confiança + moderação | leitura; adversarial #15–#20 confirmam o que o HMAC cobre | D-04, `_shared/hmac.ts`, `API_CONTRATO.md` | Registrar como risco aceito do MVP; pós-MVP: Play Integrity/App Attest e campos de criação no canonical | Coordenação / A2 |
| QA-11 | Baixa | pgTAP `07_jobs_rankings` e `10_rankings_zone_names` falham se o banco não estiver limpo (após e2e/integrações/adversarial: ranking por facção inclui `suspeito_demo` aprovado; "Zona 1" vira "Zona 5") | `db:test:psql` antes/depois do `db reset` | `supabase/tests/database/07_*.sql`, `10_*.sql` | Filtrar pelos fixtures do próprio teste / ids determinísticos | A2 (ou A5 numa próxima rodada) |
| QA-12 | Baixa | RNF-011/"Retorno visual": `Button`/`IconButton` (escala 0,97) e o anel do `HoldButton` animam mesmo com "Reduzir movimento"; faixa "Defendendo" é verde (ERS: amarela); conquista desenha um anel (ERS: 6 traços de giz a 60 ms; visual aprovado D-15); filtros de camada do mapa com 36 pt de altura e sem `hitSlop` (< 44 pt); métricas da corrida com `minimumFontScale 0.8` podem cair para 38 pt (< 48 pt, RNF-015) | `src/__tests__/reduced-motion.test.ts` (BASELINE), leitura | `src/components/button.tsx`, `hold-button.tsx`, `features/screens/map-screen.tsx`, `run-screen.tsx` | `useReducedMotion` no Button/IconButton/HoldButton (só opacidade); `hitSlop` nos chips (sem mudança visual); decidir com a coordenação cor da faixa/traços (D-15) | A3 (telas/components), A4 (run-screen) |
| QA-13 | Baixa | RNF-012: 8 elementos interativos sem `testID` — `Correr` do mapa, `Correr agora` (Arena), botão do Clube, `Switch` do Perfil, `Pressable` da Arena, filtros de camada, `HoldButton` (Segure para encerrar) e o `Pressable` interno dele; filtros de camada sem `accessibilityLabel` | `src/__tests__/testids.test.ts` (`NOMADE_TESTID_REPORT=1` lista arquivo:linha) | `map-screen.tsx`, `arena-screen.tsx`, `club-screen.tsx`, `profile-screen.tsx`, `components/hold-button.tsx`, `run-screen.tsx` | Dar `testID` (ex.: `mapa-correr`, `mapa-camada-<id>`, `corrida-encerrar`) e apagar a entrada da BASELINE do teste | A3 / A4 |
| QA-14 | Baixa | `apps/mobile/coverage/` (25 arquivos gerados) está versionada: rodar a cobertura com `lcov` altera arquivos rastreados (o Jest agora usa só reporters de texto) | `git ls-files apps/mobile/coverage` | `.gitignore` | `git rm -r --cached apps/mobile/coverage` + `coverage/` no `.gitignore` | Coordenação |
| QA-15 | Baixa | `npm audit --omit=dev`: 27 altas/17 moderadas, quase todas em ferramentas de build (expo cli, metro, jest: `node-forge`, `braces`); em tempo de execução só `decode-uri-component` (via `query-string` do expo-router: DoS com URL malformada) | `npm audit` | `apps/mobile/package.json` | Acompanhar os patches do SDK 57 (`npx expo install --fix`) antes da entrega | Coordenação |
| QA-16 | Baixa | Moderador lê o perfil completo de qualquer usuário (inclui data de nascimento) e o corredor vê o `moderator_id` da decisão — minimização (LGPD) | leitura das policies `profiles_read_own`, `moderation_reviews_read` | `20261020120100_auth_rls.sql` | Staff lê por view sem `birthdate`; esconder `moderator_id` do corredor | A2 |
| QA-17 | Info | `username_available` é público (enumeração de nomes) e o cadastro informa e-mail já usado — aceitos no MVP (necessários para a UX do cadastro) | adversarial #69 | `20261020120100_auth_rls.sql` | Manter; o limite de cadastro do Auth reduz a enumeração em massa | — |

## 6. Controles verificados

| Controle (requisito / OWASP) | Como foi verificado | Resultado |
|---|---|---|
| RLS ligada em toda tabela do `public` (RNF-007, A01) | pgTAP `12` (catálogo) | ✅ 17 tabelas |
| Toda função `security definer` com `search_path` fixo | pgTAP `12` | ✅ |
| Funções `svc_*`/`job_*` só para o service role; anon só executa `username_available` | pgTAP `12` + adversarial #57, #58 | ✅ |
| Anon sem privilégio em tabelas/views; GraphQL anônimo não expõe tabelas | pgTAP `12`, adversarial #66–#68 | ✅ |
| Cliente não escreve corridas, pontos, zonas, notificações, perfis protegidos, não se aprova | pgTAP `04`, `12`; adversarial #47–#62 | ✅ |
| Perfil: só username, cidade, foto, unidade e preferências editáveis; `role`/`trust`/`xp`/`status`/`is_demo`/`birthdate` não | pgTAP `04`, `12`; adversarial #47–#52 | ✅ |
| Um usuário não lê/altera dados de outro (corridas, pontos, contatos, notificações, neblina, baús, aparelhos, zonas de privacidade) | pgTAP `03`, `08`, `09`, `12`; adversarial #53, #54, #63, #64 | ✅ |
| `devices.secret` ilegível (nem o dono) | pgTAP `03`, `12`; adversarial #56; exportação sem a chave (#39) | ✅ |
| Views públicas sem nascimento, e-mail, papel, confiança, status, convite ou coordenadas | pgTAP `12`; adversarial #55 | ✅ |
| Crew: outra facção não entra; líder não troca sigla/facção/código/líder; não-líder não renomeia/apaga/expulsa | pgTAP `05`, `12`; adversarial #45 | ✅ (código legível: QA-01) |
| Moderação: só staff ativo; não modera a própria corrida; uma decisão só; justificativa 10–1000 | adversarial #34–#38; Deno `validate`/`security_inputs`; app `moderation.test.ts` | ✅ |
| Admin: só admin inativa; não altera o próprio status; ninguém muda papéis pela API | pgTAP `06`, `12`; adversarial #65 | ✅ |
| Autenticação em todas as 8 functions (`verify_jwt = false` no gateway): sem token, lixo, chave anon/service como token, JWT forjado com outro segredo, de usuário inexistente, expirado, `alg=none` → 401 | adversarial #2–#9 | ✅ |
| Método errado → 405; CORS `*` sem credenciais (auth por header, não cookie) | adversarial #10–#13 | ✅ (aceitável) |
| HMAC: comparação em tempo constante; assinatura de outro aparelho/corrida não vale; deviceId alheio → `UNKNOWN_DEVICE`; sequestro de deviceId → `DEVICE_TAKEN`; injeção em corrida alheia → `NOT_OWNER`; replay idêntico = duplicado; replay alterado = `REPLAY_MISMATCH` | Deno `hmac`, `security_inputs`; adversarial #15–#20; e2e | ✅ (limite do modelo: QA-10) |
| Validação de entrada: lote > 500, tipos trocados, NaN/Infinity/1e400, coordenadas fora da faixa, seq negativo, horário no futuro, corpo > 1 MB (413), JSON inválido, bbox gigante, id não-H3 | Deno `validate`, `security_inputs`; adversarial #21–#32 | ✅ |
| Finalizar corrida alheia → `NOT_OWNER` | adversarial #33 | ✅ |
| Erros sem detalhes internos (stack, SQL, tabelas, chaves) | Deno `security_inputs` (handler → 500 genérico); adversarial #79 varre todas as respostas | ✅ |
| Conta inativada: login e functions recusados | adversarial #74–#77 | ✅ (PostgREST até 1 h: QA-07) |
| Storage `avatars`: 2 MB, só JPEG/PNG/WebP (sem HTML/SVG), pasta do próprio usuário | pgTAP `12`; adversarial #70–#72; e2e | ✅ |
| Realtime: só `zones` e `notifications` publicadas; notificação alheia não chega | pgTAP `08`, `12`; e2e (P-13) | ✅ |
| Senhas com bcrypt custo 10 (RNF-007) | `auth.users.encrypted_password` = `$2a$10$…` (seed e usuário criado pelo Auth) | ✅ (plataforma) |
| Senha mínima de 8 | adversarial #78; app `validation.test.ts` | ✅ |
| Limite de login por IP (RNF-007) | adversarial seção 10 | ⚠️ só no Cloud (P-09, QA-06) |
| HTTPS/TLS 1.2+ | Supabase Cloud só aceita HTTPS (plataforma); local é http | ⚠️ conferir a URL `https://` no `.env` da build |
| Nenhum segredo no código/bundle (RNF-007, A02/A05) | `git grep` + varredura do export web | ✅ (senhas de demonstração só em seed/testes/docs; seed não vai para produção, `DEPLOY.md`) |
| Sessão no SecureStore (Keychain/Keystore, `AFTER_FIRST_UNLOCK`, em partes de 1,8 KB) | leitura + `secure-storage.test.ts` | ✅ (web: `localStorage`, só painel) |
| Logs sem dados sensíveis | `grep console.*` em `src/` (0 ocorrências fora de testes); functions só `console.error(e)` no 500 | ✅ |
| Deep links | leitura + `deep-link.test.ts` | ⚠️ QA-03 |
| Dependências (A06) | `npm audit --omit=dev` | ⚠️ QA-15 |
| Regras do jogo recalculadas no servidor (RNF-006) | Deno `scoring`, app `provisional-vs-official` (servidor real importado), e2e | ✅ (entrada `ghostPace`: QA-02) |

### Garantido pela plataforma (Supabase)
- **Hash de senha**: GoTrue usa bcrypt custo 10 (conferido no banco). **Rate limit**: por IP, configurado em `config.toml` (`[auth.rate_limit]`), só tem efeito no Cloud (o Auth local não vê o IP do cliente). **TLS**: o Cloud só serve HTTPS. **JWT**: assinado pelo projeto, 1 h, rotação de refresh token com janela de reuso de 10 s. **Banimento**: `banned_until` faz o Auth recusar login, refresh e `/auth/v1/user` (por isso as functions já recusam o inativo).

## 7. Cobertura e testes de propriedade (T4.1)

`apps/mobile/package.json` (seção `jest`): `collectCoverageFrom` = todo `src/` (sem testes) e `coverageThreshold["./src/domain/"]` = 90% em linhas, ramos, funções e instruções. O limite vale nas execuções com `--coverage` (`npx jest --coverage`), para não atrapalhar quem roda um arquivo só.

| Arquivo | Linhas | Ramos |
|---|---|---|
| anti-cheat.ts | 100 | 97,67 |
| games.ts, geo.ts, h3-runtime.ts, regions.ts, run-engine.ts, scoring.ts, trust.ts, types.ts | 100 | 100 |
| grid.ts, territory.ts | 100 | 100 |
| **Total do domain** | **100** | **99,59** |

Testes de propriedade sem dependência nova (`src/domain/__tests__/prop.ts`: mulberry32 com semente fixa, 200 casos; `NOMADE_PROP_SEED`/`NOMADE_PROP_RUNS` mudam a exploração):
- **RN-001**: RP sempre inteiro, ≥ 0 e ≤ 300 − já ganho; várias corridas no mesmo dia somam ≤ 300; no `finishRun` cada zona fica em 0..300 − ganho, total = soma, XP ≥ 0 (trajetos com 0–130 km/h, saltos, timestamps repetidos/fora de ordem, precisão ruim).
- **RN-002/003**: rival < 110% (ou < 30) nunca toma; ≥ ambos sempre toma; somar RP nunca reduz influência e o dono só muda para quem somou; resolver de novo não oscila; ataque só termina abaixo de 40%; zona bloqueada nunca tem dono.
- **RN-005**: decaimento nunca aumenta, nunca negativo, nunca entre 0 e o piso, dono nunca passa a outra facção; em 60 dias tudo zera; escudo sempre 0–3 e muda no máximo 1 por dia.
- **RN-007**: nenhum trecho válido > 40 km/h nem salto > 50 m em ≤ 1 s; válidos + inválidos = soma; ponto simulado rejeita tudo com 0 RP e 0 XP. **RN-009**: confiança sempre 0–100.
- **Fila (RNF-005)**: `queue-properties.test.ts` — gravações simultâneas de lotes aleatórios (primeiro plano + tarefa de segundo plano) com pausas, leituras e limpeza: `seq` nunca repete, nunca pula, nunca volta (memória e SQLite real via `node:sqlite`).

## 8. RNF-012 — testIDs, Maestro e Playwright (T4.3)

- `src/__tests__/testids.test.ts` lê o AST de todo `src/**/*.tsx`: 113 elementos interativos, 8 sem `testID` (BASELINE, QA-13), 1 sem descrição fixa para leitor de tela. Elemento novo sem `testID` derruba o `npm test`. Também confere que **todo `id` e texto obrigatório dos fluxos Maestro existe no código** (ids dinâmicos como `notificacao-<id>` casam com os templates).
- Fluxos em `apps/mobile/.maestro/` (ver o README da pasta): `01-cadastro-onboarding`, `02-login`, `03-uc03-mapa-camadas-zona`, `04-uc02-alerta-invasao`, `05-uc01-corrida-simulada`. **Não executados em aparelho aqui** (sem dispositivo; validação estática acima).
- Playwright: `apps/mobile/e2e-web/demo-flow.cjs` (fluxo completo de demonstração) e `visual.spec.cjs` (comparação de imagem 0,2%; referências em `e2e-web/__screenshots__/`). Mapa de calor: RF-013 não implementado → `fixme`.

## 9. Retorno visual obrigatório, RNF-011 e RNF-015 (leitura de código + testes)

| Item do ERS | Implementação | Situação |
|---|---|---|
| Botão encolhe 0,97 em 120 ms | `components/button.tsx` (`motion.press`) | ✅ (ignora "Reduzir movimento": QA-12) |
| Contagem 3-2-1 com vibração, 0,8 s cada | `use-run-session.ts` (800 ms, `Haptics.impactAsync`) + `Countdown` (só opacidade com movimento reduzido) | ✅ |
| Faixa "Território dos {facção}" ≤ 3 s, vibração e voz | `run-screen.tsx` (banner + `Haptics` no mesmo efeito) + `voice-guide.ts` (`voice-history.test.ts`) | ✅ (sem medição dos 3 s) |
| Faixa amarela "Defendendo seu território: pontos em dobro" | `run-screen.tsx` | 🟡 cor verde (`palette.success`), texto em duas linhas (QA-12) |
| Zona conquistada: 6 traços de giz a 60 ms, vibração, "Zona conquistada, +{RP} RP em {zona}" ≤ 1 s | `capture-celebration.tsx` (anel que fecha) + `summary-screen.tsx` | 🟡 anel no lugar dos 6 traços (visual aprovado D-15); texto e vibração ✅ (Playwright confere o texto) |
| Encerrar: anel de progresso, só após 600 ms | `hold-button.tsx` (`motion.holdToConfirm = 600`) | ✅ (sem teste automatizado do tempo; anel anima com movimento reduzido: QA-12) |
| "Reduzir movimento": só opacidade e cor, verificado em teste | `useReducedMotion` em contagem, faixa, conquista e resumo; `reduced-motion.test.ts` (estático) | 🟡 Button/IconButton/HoldButton fora (BASELINE) |
| RNF-011 área de toque ≥ 44 pt | Button 48/60 pt + `hitSlop 8`, IconButton ≥ 44 | 🟡 chips de camada 36 pt (QA-12) |
| RNF-011 leitor de tela | `accessibilityLabel` em todo interativo exceto os chips (texto filho é lido) | ✅/🟡 |
| RNF-011 contraste 4,5:1 | não medido nesta rodada | ⬜ lacuna |
| RNF-015 3 métricas ≥ 48 pt, tempo ≥ 72 pt, tabulares; controles ≥ 56 pt; segurar 600 ms | `run-screen.tsx`: `hero` 72, métricas 48 (`minimumFontScale 0.8`), SOS/voz/pausa 56, HoldButton 76 | ✅ (redução automática pode ir a 38 pt: QA-12) |

## 10. Matriz de rastreabilidade (T4.3)

Legenda dos caminhos: `app:` = `apps/mobile/src/…/__tests__/`, `pg:` = `supabase/tests/database/`, `deno:` = `supabase/functions/tests/`, `e2e` = `supabase/scripts/e2e.ts`, `sec` = `supabase/tests/security/edge-security.ts`, `web` = `apps/mobile/e2e-web/demo-flow.cjs`, `vis` = `e2e-web/visual.spec.cjs`, `mae:` = `apps/mobile/.maestro/`. **Lacuna** = sem teste automatizado.

### Requisitos funcionais
| ID | Testes | Situação |
|---|---|---|
| RF-001 Autenticação | app: `validation`, `auth-repo`, `route-guard`, `errors`, `deep-link`, `integration.local` (cadastro 16+, menor recusado, senha errada); pg: `02_signup_trigger`; e2e (JWT 1 h); sec (401 em todas as functions, senha < 8); web (cadastro); mae: `01`, `02` | ✅ |
| RF-002 Gestão de usuários | app: `integration.local` (editar, exportar, excluir), `integration.phase2` (admin inativa), `avatar-repo`, `moderation` (guarda); pg: `04`, `06`, `12`; e2e (export/exclusão); sec (#39, #40, #73–#77) | ✅ |
| RF-003 Facção | app: `auth-repo`, `route-guard`; pg: `05`, `07` (zera contribuição); web; mae: `01` | ✅ (tela de troca depois do onboarding: lacuna de produto) |
| RF-004 Registro de corrida | app: `run-engine`, `branches` (auto-pausa), `location`, `step-counter`, `voice-history` (simulação); mae: `05` | ✅ (GPS real: P-17) |
| RF-005 Sem internet | app: `sqlite-store`, `queue-properties`, `sync-engine`, `sync/integration.local` (queda de rede); pg: `06`; e2e | ✅ |
| RF-006 Resumo e histórico | app: `provisional-vs-official`, `voice-history` (histórico com período), `rankings-privacy-track` (trechos inválidos); web (resumo oficial); mae: `05` | ✅ |
| RF-007 Mapa | app: `zones-repo`, `zones-store`, `territory-map-layers`, `regions`; e2e (`/zones`, `/zone`); web; vis; mae: `03` | ✅ (limite 1.000: QA-04) |
| RF-008 Conquista no servidor | deno: `scoring`, `domain_bridge`; app: `provisional-vs-official`, `sync/integration.local`; e2e; web | ✅ |
| RF-009 Alerta de invasão | pg: `06`, `11`; app: `notifications`, `realtime-fallback`; mae: `04`; vis (zona sob ataque) | ✅ |
| RF-010 Defesa e fortificação | app: `territory`, `run-engine` (defesa encerra ataque), `branches` (`defended`); pg: `07` (escudo) | ✅ (faixa amarela: QA-12) |
| RF-011 Crews | app: `crews-leaderboard`, `integration.phase2`; pg: `05`, `12`; sec (#43–#45) | ✅ (QA-01) |
| RF-012 Fuga | app: `games`, `run-engine`, `voice-history`; sec (#42) | ✅ (QA-02) |
| RF-013 Mapa de calor | vis (`fixme`) | ⬜ não implementado |
| RF-014 Feed social | — | ⬜ não implementado |
| RF-015 Rankings | pg: `07`, `10`; app: `crews-leaderboard`, `rankings-privacy-track`, `integration.phase2/3`; e2e | ✅ |
| RF-016 Missões/medalhas/temporadas | pg: `07` (virada de temporada) | ⬜ parcial (lacuna) |
| RF-017 Compartilhar corrida | — | **lacuna** (botão `resumo-compartilhar` sem teste) |
| RF-018 Moderação | app: `moderation`, `integration.phase2`; e2e; sec (#34–#38); web (moderador aprova) | ✅ |
| RF-019 Notificações | app: `notifications`, `realtime-fallback`, `integration.phase3` (Realtime); pg: `08`; e2e (Realtime só para o dono); web; mae: `04` | ✅ |
| RF-020 Cidades | app: `games` (CT-14); pg: `07` (`leaderboard_cities`) | ✅ |
| RF-021 Arena | — | **lacuna** (tela sem teste; modos cobertos pelas regras) |
| RF-022 Neblina | app: `games`, `run-engine`; pg: `06`; e2e | ✅ |
| RF-023 Caça | app: `games`, `hunt-chests`, `chests-repo`; deno: `chests`; pg: `09`; e2e | ✅ |
| RF-024 Corrida Segura | app: `safety`, `sync/integration.local` (5 contatos); pg: `05`; sec (#63) | ✅ (SMS/compartilhar em aparelho: P-17) |
| RF-025 Guia por voz | app: `voice-history` | ✅ |
| RF-026 Raid | — | ⬜ demonstração rotulada (lacuna) |
| RF-027 Liga do Bairro | app: `games` | 🟡 regra testada |

### Requisitos não funcionais
| ID | Testes | Situação |
|---|---|---|
| RNF-001 5.000 usuários | — | ➖ fora do MVP |
| RNF-002 mapa < 2,5 s | — | **lacuna** (aparelho) |
| RNF-003 troca de dono ≤ 3 s | app: `integration.phase2` (0,22–0,71 s) | ✅ |
| RNF-004 bateria | — | ➖ |
| RNF-005 nenhum ponto perdido | app: `sqlite-store` (arquivo reaberto), `queue-properties`, `sync-engine`, `sync/integration.local` | ✅ |
| RNF-006 HMAC, servidor recalcula | app: `hmac`, `device-key`, `sync-engine`; deno: `hmac`, `security_inputs`, `scoring`; pg: `06`; e2e; sec (#15–#20) | ✅ (QA-02, QA-10) |
| RNF-007 bcrypt, HTTPS, RLS, rate limit, sem segredos, OWASP | pg: `03`, `04`, `08`, `12`; sec (81 verificações); varredura do bundle; bcrypt conferido | 🟡 rate limit só no Cloud (QA-06); achados QA-01, 03, 05, 07 |
| RNF-008 domain isolado, ≥ 90%, análise estática | `npx jest --coverage` com limite (100% linhas, 99,59% ramos); `eslint` + `tsc` | ✅ (CI automática: lacuna, não há pipeline) |
| RNF-009 ingestão assíncrona, zonas < 150 ms | benchmark P-11 (p95 35 ms); sec (#81) | 🟡 QA-04 |
| RNF-010 2 toques, tema, pt-BR | mae: `05` (Correr → Começar) | 🟡 tema claro/escuro sem teste |
| RNF-011 acessibilidade | app: `testids` (descrição), `reduced-motion` | 🟡 QA-12; contraste não medido |
| RNF-012 testIDs, Maestro, Playwright com imagem | app: `testids`; mae: 5 fluxos; web; vis | 🟡 QA-13; Maestro não executado em aparelho; mapa de calor fora |
| RNF-013 consentimentos, LGPD, privacidade de percurso | app: `location` (explicação antes), `integration.local` (export/exclusão); pg: `08` (zona de privacidade); e2e; mae: `01` | ✅ |
| RNF-014 Android 8+/iOS 15+ | — | **lacuna** (aparelho) |
| RNF-015 tela de corrida | leitura (seção 9) | 🟡 sem teste automatizado de tamanhos |

### Regras de negócio
| ID | Testes | Situação |
|---|---|---|
| RN-001 | app: `scoring`, `run-engine` (M_grupo), `properties`; deno: `scoring`, `group`; e2e (M_grupo) | ✅ |
| RN-002 | app: `territory` (CT-06/07), `properties` | ✅ |
| RN-003 | app: `territory` (CT-11), `properties`; pg: `06`, `11` | ✅ |
| RN-004 | app: `territory`, `properties`; pg: `07` | ✅ |
| RN-005 | app: `territory`, `properties`; pg: `07` | ✅ |
| RN-006 | app: `territory` (seasonReset); pg: `07` | 🟡 arquivar rankings/medalhas sem teste |
| RN-007 | app: `anti-cheat` (CT-01..04), `branches`, `properties`; deno: `scoring` | ✅ |
| RN-008 | app: `anti-cheat` (CT-05), `step-counter`, `provisional-vs-official` | ✅ (acelerômetro/vibração da passada: lacuna de produto) |
| RN-009 | app: `branches`, `properties`, `provisional-vs-official`; deno: `scoring`; sec (#35) | ✅ |
| RN-010 | pg: `08`; app: `rankings-privacy-track`, `integration.phase3`; e2e | ✅ |
| RN-011 | pg: `05`, `12`; app: `integration.phase2`; sec (#45) | ✅ (QA-01) |
| RN-012 Prefeito | — | ⬜ |
| RN-013 | app: `games`; pg: `04`, `07` | ✅ |
| RN-014 | app: `games`; pg: `07` | ✅ |
| RN-015 | app: `games` | 🟡 |
| RN-016 | app: `games`, `run-engine`; pg: `06` | ✅ |
| RN-017 | app: `games`, `hunt-chests`; deno: `chests`; pg: `09`; e2e | ✅ |
| RN-018 Raid | — | ⬜ |
| RN-019 Fuga | app: `games`, `run-engine`, `voice-history` | 🟡 (QA-02) |

## 11. Lacunas principais
1. Maestro não rodou em aparelho (sem dispositivo neste ambiente); P-05, P-17, P-21, P-28 seguem para validação manual.
2. Sem pipeline de CI: `npm test`, `eslint`, `tsc`, `--coverage` e os testes Deno/pgTAP rodam à mão (RNF-008 pede análise estática "a cada alteração").
3. RF-017, RF-021, RNF-002, RNF-014, contraste (RNF-011) e tamanhos da tela de corrida (RNF-015) sem teste automatizado.
4. RF-013/014/016, RN-012/018 não implementados (fora do MVP ou demonstração rotulada).
