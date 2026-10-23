# QA e segurança — NOMADE RUN (Fase 4)

> Dono: **A5 (QA e segurança)**. Revisão de 2026-10-21 sobre o commit `6871486` (branch `claude/dreamy-ptolemy-xnm4r7`) mais as alterações em andamento do A3 na mesma árvore.
> Achados viram tarefa para o dono indicado (o A5 não corrige código de produção). Estado de cada achado também na tabela de pendências do `PROGRESSO.md`.
> **Fase 6 (T6.5, A5, 2026-10-21):** QA visual, motion e acessibilidade em 4 resoluções — **seção 14** (achados QA-18 a QA-25, checklist do aparelho).
> **Atualização 2026-10-22 (A2):** QA-01, 02, 04, 05, 06, 07, 08, 09, 11 e 16 corrigidos no backend — status, teste que prova e riscos aceitos na **seção 12**.

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
| pgTAP | `npm run db:test:psql` (ou `npx supabase test db` onde a imagem `pg_prove` baixar) | nenhum: todos os arquivos criam os próprios dados e desfazem no rollback (QA-11 corrigido) |
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

Status das correções: seção 12. Severidade: **Alta** = quebra de confidencialidade/integridade explorável por qualquer usuário; **Média** = abuso de regra, vazamento limitado ou falha de requisito com impacto na demonstração; **Baixa** = endurecimento, higiene ou impacto pequeno. **Nenhum achado Alto.**

| # | Sev. | Achado | Evidência | Arquivo | Recomendação | Dono |
|---|---|---|---|---|---|---|
| QA-01 | Média ✅ | **Código de convite de qualquer crew é legível** por qualquer usuário logado (`grant select` em todas as colunas de `crews`). Quem é da mesma facção entra em qualquer crew sem ser convidado (RN-011 só barra outra facção) | adversarial #44 (`GET /rest/v1/crews?select=invite_code` → código de crew alheia); probe SQL | `supabase/migrations/20261020120100_auth_rls.sql` (grant em `public.crews`) | `revoke select (invite_code)` e grant por coluna sem ele; RPC `my_crew_invite()` (só membros/líder); manter o `join_crew` | A2 |
| QA-02 | Média ✅ | **`ghostPace` controlado pelo cliente dá M_fantasma 1,5 e +50 XP em qualquer missão**: o servidor aceita 60–3600 s/km (o app oferece 5:00–7:00) e aplica o fantasma mesmo em missão `livre`; com 3600 s/km qualquer corrida "vence" | adversarial #42: missão `livre`, `ghostPace: 3600` → `beatGhost: true`, 62 RP em 415 m (= ×1,5) | `supabase/functions/_shared/validate.ts` (`optionalNumber(b.ghostPace, …, 60, 3600)`), `_shared/scoring.ts` (`ghostPace: input.ghostPace`), `svc_ingest_points` | Só considerar `ghostPace` quando `mission = 'fuga'`; aceitar apenas os ritmos oferecidos (300/330/360/420) ou uma faixa relativa ao ritmo-base do corredor; registrar em D-xx | A2 (regra no servidor); A1 se for no domain |
| QA-03 | Média · ✅ corrigido (A3, §13) | **Link `nomaderun://` com tokens troca a sessão atual sem confirmação** (fluxo implícito): outro app ou página pode abrir `nomaderun://nova-senha#access_token=…&refresh_token=…` e logar a vítima na conta do atacante (corridas e localização vão para ele); no Android o esquema próprio pode ser registrado por outro app e receber os tokens de recuperação | leitura: `handleAuthUrl` chama `setSession` para qualquer link com tokens, mesmo com sessão ativa; cliente sem `flowType: 'pkce'` | `apps/mobile/src/features/auth/session-controller.ts` (`handleAuthUrl`, listener de `Linking`), `apps/mobile/src/services/api/supabase.ts`, `services/auth/deep-link.ts` | `flowType: 'pkce'` no `createClient` e só `exchangeCodeForSession` (code sem o verifier local não serve); ignorar links de token quando já há sessão, salvo recuperação pedida neste aparelho; em produção, App Links/Universal Links | A3 |
| QA-04 | Média ✅ | **`/zones` devolve no máximo 1.000 zonas** (limite `max_rows` do PostgREST sobre a RPC), mas o contrato e a RNF-009 falam em até 2.000: em área densa o mapa corta zonas sem aviso | adversarial #81 (1.200 zonas na área → 1.000); benchmark P-11 | `supabase/functions/zones/index.ts`, `public.zones_in_bbox`, `supabase/config.toml` (`max_rows = 1000`) | RPC que devolve `jsonb_agg` (como `svc_load_activity`) ou paginação por `Range`; teste com 2.000 | A2 |
| QA-05 | Baixa ✅ | `profiles.avatar_url` aceita qualquer esquema/host (`javascript:`, imagem de rastreio externa) e sai em `public_profiles`; `notification_prefs` sem limite de tamanho | adversarial #46 | `20261020120000_extensions_and_schema.sql` (checks de `profiles`) | CHECK: só a URL pública do bucket `avatars/<id>/…` (ou guardar só o caminho); CHECK de tamanho em `notification_prefs` | A2 |
| QA-06 | Baixa ✅/⚠️ | Configuração do Auth: (a) limite de login local inexistente (12 tentativas erradas → 12× 400; P-09) e no Cloud `sign_in_sign_ups = 3`/5 min por IP soma cadastro+login — pode travar a apresentação numa rede com NAT; (b) `secure_password_change = false` (trocar a senha não pede a atual/reautenticação); (c) `account-delete` sem reautenticação | adversarial (seção 10); `config.toml` | `supabase/config.toml`, `supabase/functions/account-delete/index.ts` | Conferir após `config push` (P-09); avaliar 10/15 min; `secure_password_change = true`; pedir a senha (reauth) antes de excluir a conta | A2 / Coordenação |
| QA-07 | Baixa ✅ | Conta **inativada** pelo admin continua com o token já emitido válido no PostgREST/Realtime por até 1 h (as functions já recusam: o Auth bloqueia o usuário banido) | adversarial #74–#77 | `public.admin_set_user_status`, policies de escrita | Aceitar e documentar (JWT de 1 h) ou checar `status = 'active'` nas policies de escrita (`private.is_active()`) | A2 |
| QA-08 | Baixa ✅ | Sem limite de pontos por corrida nem de corridas por usuário e sem limite de chamadas nas functions; o `finish-activity` carrega todos os pontos num único `jsonb`; `readJson` lê o corpo inteiro antes de medir | leitura | `svc_ingest_points`, `svc_load_activity`, `_shared/http.ts` | Teto (ex.: 20.000 pontos/corrida, N corridas abertas por usuário); conferir `Content-Length` antes de ler | A2 |
| QA-09 | Baixa ✅ | `endedAt` do `finish-activity` sem limite superior/coerência (pode ser antes do início ou no ano 3000); vai para `activities.ended_at` (só exibição; `finished_at` usa `now()`) | leitura + `security_inputs.test.ts` | `_shared/validate.ts` (`parseFinish`) | Limitar a [último ponto, agora + 5 min] | A2 |
| QA-10 | Baixa (risco aceito) | O HMAC garante integridade e anti-replay, **não** que o cliente é o app: a chave é gerada e registrada pelo próprio cliente, então um script com login válido envia corridas assinadas (inclusive `mocked: false`). `startedAt`, `mission` e `ghostPace` ficam fora da assinatura (agrava QA-02). A defesa real é antifraude + Índice de Confiança + moderação | leitura; adversarial #15–#20 confirmam o que o HMAC cobre | D-04, `_shared/hmac.ts`, `API_CONTRATO.md` | Registrar como risco aceito do MVP; pós-MVP: Play Integrity/App Attest e campos de criação no canonical | Coordenação / A2 |
| QA-11 | Baixa ✅ | pgTAP `07_jobs_rankings` e `10_rankings_zone_names` falham se o banco não estiver limpo (após e2e/integrações/adversarial: ranking por facção inclui `suspeito_demo` aprovado; "Zona 1" vira "Zona 5") | `db:test:psql` antes/depois do `db reset` | `supabase/tests/database/07_*.sql`, `10_*.sql` | Filtrar pelos fixtures do próprio teste / ids determinísticos | A2 (ou A5 numa próxima rodada) |
| QA-12 | Baixa · ✅ corrigido (A3, §13; traços de giz ficam pelo D-15) | RNF-011/"Retorno visual": `Button`/`IconButton` (escala 0,97) e o anel do `HoldButton` animam mesmo com "Reduzir movimento"; faixa "Defendendo" é verde (ERS: amarela); conquista desenha um anel (ERS: 6 traços de giz a 60 ms; visual aprovado D-15); filtros de camada do mapa com 36 pt de altura e sem `hitSlop` (< 44 pt); métricas da corrida com `minimumFontScale 0.8` podem cair para 38 pt (< 48 pt, RNF-015) | `src/__tests__/reduced-motion.test.ts` (BASELINE), leitura | `src/components/button.tsx`, `hold-button.tsx`, `features/screens/map-screen.tsx`, `run-screen.tsx` | `useReducedMotion` no Button/IconButton/HoldButton (só opacidade); `hitSlop` nos chips (sem mudança visual); decidir com a coordenação cor da faixa/traços (D-15) | A3 (telas/components), A4 (run-screen) |
| QA-13 | Baixa · ✅ corrigido (A3, §13) | RNF-012: 8 elementos interativos sem `testID` — `Correr` do mapa, `Correr agora` (Arena), botão do Clube, `Switch` do Perfil, `Pressable` da Arena, filtros de camada, `HoldButton` (Segure para encerrar) e o `Pressable` interno dele; filtros de camada sem `accessibilityLabel` | `src/__tests__/testids.test.ts` (`NOMADE_TESTID_REPORT=1` lista arquivo:linha) | `map-screen.tsx`, `arena-screen.tsx`, `club-screen.tsx`, `profile-screen.tsx`, `components/hold-button.tsx`, `run-screen.tsx` | Dar `testID` (ex.: `mapa-correr`, `mapa-camada-<id>`, `corrida-encerrar`) e apagar a entrada da BASELINE do teste | A3 / A4 |
| QA-14 | Baixa | `apps/mobile/coverage/` (25 arquivos gerados) está versionada: rodar a cobertura com `lcov` altera arquivos rastreados (o Jest agora usa só reporters de texto) | `git ls-files apps/mobile/coverage` | `.gitignore` | `git rm -r --cached apps/mobile/coverage` + `coverage/` no `.gitignore` | Coordenação |
| QA-15 | Baixa | `npm audit --omit=dev`: 27 altas/17 moderadas, quase todas em ferramentas de build (expo cli, metro, jest: `node-forge`, `braces`); em tempo de execução só `decode-uri-component` (via `query-string` do expo-router: DoS com URL malformada) | `npm audit` | `apps/mobile/package.json` | Acompanhar os patches do SDK 57 (`npx expo install --fix`) antes da entrega | Coordenação |
| QA-16 | Baixa ✅ | Moderador lê o perfil completo de qualquer usuário (inclui data de nascimento) e o corredor vê o `moderator_id` da decisão — minimização (LGPD) | leitura das policies `profiles_read_own`, `moderation_reviews_read` | `20261020120100_auth_rls.sql` | Staff lê por view sem `birthdate`; esconder `moderator_id` do corredor | A2 |
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
| Deep links | leitura + `deep-link.test.ts`, `session-link.test.ts`, `auth-repo.test.ts`, `integration.local` (PKCE), `e2e-web/auth-flow.cjs` | ✅ QA-03 corrigido (A3, §13) |
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
| Botão encolhe 0,97 em 120 ms | `components/button.tsx` + `press-feedback.ts` (`motion.press`) | ✅ com "Reduzir movimento" só opacidade 0,7 (QA-12 corrigido) |
| Contagem 3-2-1 com vibração, 0,8 s cada | `use-run-session.ts` (800 ms, `Haptics.impactAsync`) + `Countdown` (só opacidade com movimento reduzido) | ✅ |
| Faixa "Território dos {facção}" ≤ 3 s, vibração e voz | `run-screen.tsx` (banner + `Haptics` no mesmo efeito) + `voice-guide.ts` (`voice-history.test.ts`) | ✅ (sem medição dos 3 s) |
| Faixa amarela "Defendendo seu território: pontos em dobro" | `run-screen.tsx` | ✅ amarela (`palette.warning`, texto `palette.ink` para contraste); texto continua em duas linhas (D-15) |
| Zona conquistada: 6 traços de giz a 60 ms, vibração, "Zona conquistada, +{RP} RP em {zona}" ≤ 1 s | `capture-celebration.tsx` (anel que fecha) + `summary-screen.tsx` | 🟡 anel no lugar dos 6 traços (visual aprovado D-15); texto e vibração ✅ (Playwright confere o texto) |
| Encerrar: anel de progresso, só após 600 ms | `hold-button.tsx` (`motion.holdToConfirm = 600`) | ✅ (sem teste automatizado do tempo; com movimento reduzido o anel aparece inteiro e só ganha opacidade em 600 ms) |
| "Reduzir movimento": só opacidade e cor, verificado em teste | `useReducedMotion` em contagem, faixa, conquista e resumo; `reduced-motion.test.ts` (estático) | 🟡 Button/IconButton/HoldButton fora (BASELINE) |
| RNF-011 área de toque ≥ 44 pt | Button 48/60 pt + `hitSlop 8`, IconButton ≥ 44 | ✅ chips de camada: desenho de 36 pt com `hitSlop` 4 → 44 pt de toque (QA-12) |
| RNF-011 leitor de tela | `accessibilityLabel` em todo interativo (chips com rótulo e dica desde QA-13) | ✅ |
| RNF-011 contraste 4,5:1 | não medido nesta rodada | ⬜ lacuna |
| RNF-015 3 métricas ≥ 48 pt, tempo ≥ 72 pt, tabulares; controles ≥ 56 pt; segurar 600 ms | `run-screen.tsx`: `hero` 72, métricas 48 fixas (sem `adjustsFontSizeToFit` desde QA-12), tempo `hero` 96, SOS/voz/pausa 56, HoldButton 76 | ✅ (redução automática pode ir a 38 pt: QA-12) |

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
| RF-010 Defesa e fortificação | app: `territory`, `run-engine` (defesa encerra ataque), `branches` (`defended`); pg: `07` (escudo) | ✅ (faixa amarela desde QA-12) |
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
| RNF-011 acessibilidade | app: `testids` (descrição), `reduced-motion` (BASELINE vazia), `press-feedback`; web `auth-flow` (botão sem escala) | ✅ QA-12; contraste não medido |
| RNF-012 testIDs, Maestro, Playwright com imagem | app: `testids` (BASELINE vazia); mae: 5 fluxos (por id); web; vis | ✅ QA-13; Maestro não executado em aparelho; mapa de calor fora |
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

## 12. Correções do backend (A2, 2026-10-22)

Migration `supabase/migrations/20261022120000_qa_hardening.sql`, functions `_shared/{validate,scoring,finish,http,account}.ts`, `account-delete`, `finish-activity`, `ingest-points`, `zones`, `config.toml`. Decisão: D-50. Contrato atualizado (`API_CONTRATO.md`). Cada correção tem teste que falhava antes e passa depois (os novos `13_qa_fixes.test.sql` e `qa_fixes.test.ts` não compilavam/falhavam antes da migration; no adversarial, `STRICT=1` falhava com 5 achados e agora passa com 0).

| # | Status | O que mudou | Teste que prova |
|---|---|---|---|
| QA-01 | ✅ corrigido | A linha de `crews` (com `invite_code`) só é legível pelo líder e pelos membros (`crews_read_members` + `private.is_crew_member`); a view nova **`public_crews`** (`id, name, tag, faction, leader_id, created_at, members`) mostra todas as crews sem o código. `join_crew(code)` não mudou | pg `13` (não-membro lê 0 linhas, view sem a coluna, entra pelo código e depois vê o código), pg `12` ajustado; sec "código de convite de crew alheia não é legível" |
| QA-02 | ✅ corrigido | `ghostPace` aceito de **150 a 900 s/km** (2:30 a 15:00; o app oferece 5:00–7:00) e **ignorado fora da missão `fuga`** em três camadas: validação (`parseIngestBody`), gravação (`svc_ingest_points` só grava com `fuga` e na faixa) e cálculo (`officialGhostPace` no `computeOfficialResult`, cobre valores antigos já gravados) | deno `qa_fixes` (3 testes); pg `13` (3); sec "ghostPace fora de 150–900 é recusado" e "missão livre com 900 s/km não ganha M_fantasma" |
| QA-04 | ✅ corrigido | `/zones` usa a RPC nova **`zones_in_bbox_json`** (um único JSON, até 2.000 zonas) e `max_rows = 2000` no `config.toml` (a RPC em linhas também chega a 2.000) | pg `13` (2.100 zonas → 2.000 no JSON); sec com 2.100 zonas na área → `/zones` devolve 2.000 |
| QA-05 | ✅ corrigido | CHECK `profiles_avatar_url_bucket`: só `http(s)://<host>/storage/v1/object/public/avatars/<id do próprio perfil>/<arquivo>` (host `*.supabase.co` com ref de 20 letras, `localhost`, `127.0.0.1` ou IP de rede local); CHECK de 512 bytes em `notification_prefs` | pg `13` (recusa `javascript:`, outro host, outra pasta, outro bucket, preferências grandes; aceita local, Cloud e `null`); sec "avatar_url só aceita a URL pública do bucket" |
| QA-06 | ✅ corrigido (b, c) · ⚠️ (a) risco aceito/operacional | (b) `secure_password_change = true`; (c) `account-delete` exige **`{ confirm: "EXCLUIR", password }`** e confere a senha no Auth (`grant_type=password` com o e-mail da conta): `INVALID_PASSWORD` 403, `RATE_LIMITED` 429, `REAUTH_UNAVAILABLE` 409 (conta sem senha). (a) rate limit: segue só no Cloud; passo a passo para subir a 30 na apresentação e voltar a 3 em `supabase/DEPLOY.md` (P-09) | deno `qa_fixes` (2 testes); e2e (sem senha → 400, senha errada → 403, certa → exclui); sec "exclusão com a senha errada é recusada" |
| QA-07 | ✅ corrigido | Conta **inativa** perde o acesso na hora: pre-request do PostgREST (`public.check_request`, `pgrst.db_pre_request` no papel `authenticator`) responde **401 `ACCOUNT_INACTIVE`** em toda chamada REST/RPC; policies **restritivas** `*_active_account` (`private.is_active()`) nas 13 tabelas privadas, no delete de `crew_members` e no bucket `avatars` (cobre Realtime e Storage); RPCs `security definer` do cliente chamam `private.require_active()`. `suspended` (suspensão de competição, RN-009) mantém o acesso, como nas functions | pg `13` (inativa não lê nem grava, RPC recusa, pre-request recusa; suspensa continua lendo; config do PostgREST); sec "token já emitido de B deixa de valer no PostgREST na hora" (401) |
| QA-08 | ✅ corrigido | Teto de **14.400 pontos por corrida** (4 h a 1 ponto/s; `POINTS_LIMIT` 409), no máximo **3 corridas abertas** criadas nas últimas 24 h por usuário (`TOO_MANY_OPEN_RUNS` 409; abertas há mais de 24 h contam como abandonadas e não bloqueiam) e `readJson` recusa pelo `Content-Length` antes de ler o corpo (413) | pg `13` (4ª corrida aberta recusada, a aberta continua recebendo, abandonada não conta, seq 14399 aceito e 14400 recusado); deno `qa_fixes` (corpo não é lido) |
| QA-09 | ✅ corrigido | `endedAt` do `finish-activity` precisa estar entre o início da corrida e agora + 5 min (`checkEndedAt`), senão `VALIDATION` | deno `qa_fixes`; sec "endedAt no ano 3000" e "antes do início" → 400 |
| QA-11 | ✅ corrigido | pgTAP `07` apaga `activity_zones`/`zones` dentro da transação e usa cidade própria (`Cidade Jobs QA`); `10` limpa os nomes `Zona N` deixados por outras suítes antes de conferir `"Zona 1"` | rodando a versão antiga e a nova sobre o mesmo banco "sujo" (zona `Zona 4` e corredor de Goiânia com RP): a antiga falha (`07` nº 16, `10` nº 26), a nova passa; `db:test:psql` verde depois de e2e + adversarial |
| QA-16 | ✅ corrigido | `profiles` só o próprio (inclusive staff); staff lê outros pela view **`staff_profiles`** (sem nascimento, aceites e preferências; corredor comum vê lista vazia); `moderator_id` sem grant de leitura em `moderation_reviews` | pg `13` (5 testes); sec (moderador não lê `birthdate`, lê `staff_profiles`, a view não tem `birthdate`, corredor não lê a view) |
| Cadastro | ✅ | `handle_new_user` grava `city` dos metadados sem espaços nas pontas e recusa 1 ou mais de 80 caracteres com `CITY_INVALID` | pg `13` (2 testes) |

**Riscos aceitos / pendentes no backend:**
- **QA-06 (a)**: rate limit por IP só no Cloud e `3`/5 min por IP soma cadastro + login + reautenticação da exclusão; ajuste para a apresentação documentado (P-09, coordenação).
- **QA-05**: o host aceito inclui qualquer `<ref>.supabase.co` (outro projeto Supabase poderia hospedar a imagem) e IPs de rede local; domínio próprio exige acrescentar o host em `private.valid_avatar_url`.
- **QA-07**: `suspended` mantém acesso por decisão (é suspensão de competição); o pre-request faz uma leitura por PK em `profiles` por requisição autenticada.
- **QA-08**: os limites valem na ingestão; o `finish` continua carregando a corrida inteira num `jsonb` (até 14.400 pontos ≈ 2 MB); não há limite de chamadas por minuto nas functions (fica para o gateway do Cloud).
- **QA-06 (c)**: conta só com login social (P-06) recebe `REAUTH_UNAVAILABLE` até haver reautenticação por OTP.
- **QA-02**: o fantasma "do dono da zona / de um amigo" (RN-019 completo) segue pendente; hoje o ritmo vem do cliente dentro da faixa.
- **QA-10**: continua risco aceito (P-38).

**Mudanças que o app precisa acompanhar (A3/A4):** `account-delete` com `password`; `city` no `signUp`; painel de moderação/admin lê perfis de outros em `staff_profiles` (não em `profiles`); crews de outros em `public_crews`; tratar `401 ACCOUNT_INACTIVE` como sessão encerrada; fila tratar `TOO_MANY_OPEN_RUNS` e `POINTS_LIMIT` (ver `API_CONTRATO.md`).

Resultados após as correções (banco recém-resetado): pgTAP **285/285** (13 arquivos; de novo verde depois de e2e + adversarial) · Deno **58 ok**, 1 ignorado · `functions:check` ok · e2e **56/56** · adversarial `STRICT=1` **89/89, 0 achados**.

## 13. Correções do app (A3, 2026-10-22)

| # | Status | O que mudou | Teste que prova |
|---|---|---|---|
| QA-03 | ✅ corrigido | Cliente Supabase com `flowType: 'pkce'`; `auth-repo.sessionFromCallback` só aceita o `code` (troca por `exchangeCodeForSession`, que exige o verificador guardado neste aparelho) e **recusa tokens na URL** (`IMPLICIT_TOKENS`, nunca chama `setSession`); com alguém conectado, um link de acesso fica pendente e o diálogo "Trocar de conta?" (`link-confirm-dialog.tsx`, mostra o e-mail atual) decide; links de erro/tokens são ignorados para quem está conectado; troca para outra conta limpa o progresso local. Link aberto em outro aparelho → mensagem própria (`linkOtherDevice`). Em produção continua valendo App Links/Universal Links | `auth-repo.test` (tokens recusados, verificador ausente, code inválido), `session-link.test` (7 casos), `integration.local` (e-mail real na caixa local → Auth devolve só `?code=` → o mesmo code em outro cliente não serve → sessão de recuperação → senha nova vale), `e2e-web/auth-flow.cjs` (diálogo, cancelar, code inválido, tokens ignorados, recuperação completa no navegador) |
| QA-06 (app) | ✅ | Excluir conta pede **senha atual + EXCLUIR** e envia `{ confirm, password }`; `INVALID_PASSWORD` vira "Senha incorreta. Confira e tente de novo." no próprio campo; `REAUTH_UNAVAILABLE`/`RATE_LIMITED` mostram a mensagem do servidor | `auth-repo.test`, `integration.local` (senha errada recusada; certa exclui), `auth-flow.cjs` |
| QA-12 | ✅ corrigido (exceto traços de giz, D-15) | `Button`/`IconButton`: com "Reduzir movimento" sem escala, opacidade 0,7 ao pressionar (`press-feedback.ts`); `HoldButton`: anel inteiro que só ganha opacidade em 600 ms; chips de camada com `hitSlop` (44 pt de toque, mesmo desenho); faixa "Defendendo" em `palette.warning` com texto escuro; métricas da corrida fixas em 48 pt (sem encolher), tempo 96 pt | `reduced-motion.test` (BASELINE vazia), `press-feedback.test`, `auth-flow.cjs` (botão pressionado: `transform none`, opacidade 0,7); capturas da corrida: métricas cabem em 390 pt |
| QA-13 | ✅ corrigido | `mapa-correr`, `mapa-camada-<todos\|meu-time\|explorado>` (com rótulo e dica), `arena-modo-<id>`, `arena-correr`, `clube-encontro-presenca`, `perfil-escolta`/`perfil-alerta-parada`, `corrida-encerrar` (prop `testID` do `HoldButton`); fluxos Maestro 03 e 05 usam os ids | `testids.test` (BASELINEs vazias; ids dos fluxos existem) |
| P-39 | ✅ | Cidade natal opcional no cadastro (`options.data.city`); painel lê `staff_profiles`; crews de outros: o app só lê a própria crew (permitido a membros), sem mudança; `401 ACCOUNT_INACTIVE` (PostgREST `PT401` e functions) encerra a sessão e mostra "Conta inativada" na tela Entrar; fila: `POINTS_LIMIT`/`TOO_MANY_OPEN_RUNS` = falha definitiva com mensagem clara, pontos locais mantidos; `endedAt` limitado a "agora" (a simulação 10× gerava fim no futuro e o servidor novo recusava, deixando o resumo provisório) | `errors.test`, `sync-engine.test` (3 novos), `session-link.test`, `integration.phase2` (token de conta inativada → `ACCOUNT_INACTIVE`, reativada volta), `demo-flow.cjs` (nome no painel, cidade gravada), `auth-flow.cjs` (conta inativada) |


## 14. Fase 6 — QA visual, motion e acessibilidade (T6.5, A5, 2026-10-21)

> Escopo: as telas mudadas na Fase 6 (D-54 a D-57) pelos agentes A7 (fundação), A3 (conta e perfil), A8 (jogo) e A4 (corrida). O A5 não corrigiu código de produção. Os achados abaixo têm dono e também estão na tabela de pendências do `PROGRESSO.md` (P-42 a P-44).

### 14.1 Método

- **Onde:** export web (`npx expo export -p web`) servido por `e2e-web/serve.cjs`, Chromium do Playwright (`/opt/pw-browsers`), backend local com o seed, `deviceScaleFactor 1`, `pt-BR`, geolocalização do Parque Flamboyant. Os blocos do mapa-base são bloqueados (proxy), como nas outras suítes.
- **Matriz:** 360×640, 375×667, 390×844 e 430×932, cada uma com `reducedMotion: 'no-preference'` e `'reduce'` (8 combinações). São 31 telas por combinação: entrar, cadastro, recuperar senha, nova senha, termos, privacidade, onboarding (4 etapas), mapa, folha da zona (neutra, dominada, sob ataque), arena, clube, ranking (pódio), crew, notificações, perfil, editar, conta, contatos, zonas de privacidade, nova corrida, contagem, corrida, resumo oficial, resumo provisório (terminado sem internet) e atividades. A moderação (fila, detalhe e contas) foi medida em 375×667 e 1280×800, com e sem reduzir. Extras: modo escuro em 375×667 (24 telas) e resumo **com conquista** com e sem reduzir.
- **Script por tela** (estilos e caixas calculados no DOM; scripts em `scratchpad`, fora do repositório):
  - rolagem horizontal da página;
  - textos e interativos fora da tela na horizontal (ignorando rolagens horizontais de propósito, como o `ChipRow`);
  - interativos abaixo da tela sem rolagem possível;
  - interativos cobertos por barra fixa ou abas: rola todos os contêineres até o fim e testa `elementFromPoint` na metade de baixo;
  - textos cortados (reticências e `line-clamp`) e textos sobrepostos;
  - alvos < 44 pt;
  - quantidade de tamanhos de fonte;
  - contraste de cada texto (cor efetiva com a opacidade dos ancestrais sobre o fundo opaco mais próximo; 4,5:1, ou 3:1 para texto grande);
  - títulos (`role=heading` + `aria-label` com palavras `aria-hidden`);
  - console (erros e avisos).
- **Motion por tela:**
  - `document.getAnimations()` na montagem e a cada 100 ms até as animações finitas terminarem. Isso dá a duração percebida da entrada, as animações infinitas, os quadros-chave com transformação e as animações de opacidade que se repetem (pisca/pulsa);
  - transformações inline nos primeiros 500 ms;
  - posição e tamanho de todos os `testID` em 4 quadros comparados com o quadro final (com reduzir);
  - elementos com opacidade < 0,6 ou palavras do `RevealText` ainda deslocadas depois de tudo parar;
  - interativos sem receber o toque na montagem que passam a receber depois.
- **Toque durante a entrada:** clique por coordenada (sem esperar a estabilidade que o Playwright exige) em 8 CTAs entre 18 e 50 ms após a tela montar, com navegação dentro do app (aba ou botão). Isso evita clicar no HTML estático antes da hidratação.
- **CountUp:** rótulo acessível no 1º quadro × no fim e o texto a cada 50 ms até estabilizar.

### 14.2 Resultados por resolução

| Combinação | Telas | Rolagem horizontal | Fora da tela | Sob barra fixa (no fim da rolagem) | Erros de console | Textos cortados | Telas com > 4 tamanhos de fonte | Entrada mais longa |
|---|---|---|---|---|---|---|---|---|
| 360×640 | 30 | 0 | 0 | 0 | 0 | 1 (alerta do mapa) | 21 | 2,2 s (contagem) |
| 360×640 reduzir | 30 | 0 | 0 | 0 | 0 | 2 (alerta do mapa; nome no ranking) | 20 | 0,5 s |
| 375×667 | 33 | 0 | 0 | 0 | 0 | 1 | 24 | 2,2 s |
| 375×667 reduzir | 33 | 0 | 0 | 0 | 0 | 1 | 23 | 0,6 s |
| 390×844 | 30 | 0 | 0 | 0 | 0 | 1 | 21 | 2,2 s |
| 390×844 reduzir | 30 | 0 | 0 | 0 | 0 | 1 | 20 | 0,7 s |
| 430×932 | 30 | 0 | 0 | 0 | 0 | 1 | 21 | 2,2 s |
| 430×932 reduzir | 30 | 0 | 0 | 0 | 0 | 1 | 20 | 0,6 s |
| 1280×800 (moderação), com e sem reduzir | 3 + 3 | 0 | 0 | 0 | 0 | 0 | 3 | 0,8 s |
| 375×667 modo escuro | 24 | 0 | 0 | 0 | 0 | 1 | 19 | 2,2 s |

- **Console:** só avisos do próprio Chromium sem GPU ("Automatic fallback to software WebGL", "GPU stall due to ReadPixels") no mapa e nos 3 erros de rede dos blocos do mapa-base. Nenhum erro ou aviso do app, inclusive "button dentro de button" (corrigido pelo A8).
- **Sobreposições:** as encontradas (editar perfil em 360 e 430) são conteúdo passando por baixo da `BottomBar` opaca antes de rolar. No fim da rolagem nada fica coberto. Não é bug.
- **Alvos < 44 pt no web:**
  - chips de camada e dos filtros (36–40 pt), Escolta da corrida (32 pt) e `Switch` (40×20). No aparelho valem o `hitSlop` (4 a 12 pt; chips e Escolta chegam a 44) e o `Switch` nativo. No web o `hitSlop` não existe (limitação do RN Web).
  - os links "Termos de Uso"/"Política de Privacidade" no meio da frase do cadastro (20 pt) já estão registrados pelo A3 (ver QA-25).
- **Marca:** comparando `t65-depois-*.png` com `2026-10-antes-iphone-se.png`, a paleta "Pista", Inter/Inter Tight, as cores e formas dos times e os chips continuam os mesmos. Mudaram o layout e o motion, como a D-54 pede.

### 14.3 Motion

| Verificação | Resultado |
|---|---|
| Estado final das entradas | ✅ Em todas as 236 medições: nenhum elemento com opacidade < 0,6 depois de parar, nenhuma palavra de `RevealText` deslocada e nenhuma animação finita rodando após 2,5 s. A única exceção é a faixa de território da corrida, escondida de propósito (opacidade 0) quando não há zona; ela tem outro problema (QA-18). Resumo com conquista: anel de 6 traços completo, marca do time e "Zona conquistada" no fim, com e sem reduzir. |
| Toque durante a entrada | ✅ 16/16 (8 CTAs × 2 modos): entrar → criar conta, mapa → Correr, arena → Correr agora, folha da zona → Correr aqui, perfil → Editar perfil, clube → Criar ou entrar, nova corrida → Simulação. Todos foram tocados entre 18 e 50 ms após montar e funcionaram, mesmo com o alvo ainda em opacidade 0 (perfil) ou 0,58 (reduzir). Nenhuma camada de entrada captura o toque. |
| Reduzir movimento sem deslocar nem escalar | ✅ Nenhum quadro-chave de entrada com `transform`/`translate`/`scale` e nenhuma transformação inline durante a entrada. As mudanças de posição entre quadros vêm da fonte web chegando (larguras de texto) e de dados carregando, não de animação. Rotações só nos indicadores de carregamento do sistema (`ActivityIndicator`). Pódio: altura constante (205 pt) com reduzir; cresce de 125 a 199 pt sem reduzir. `CountUp` mostra o valor final direto. |
| Nada pisca ou pulsa com reduzir | ✅ Nenhuma animação de opacidade repetida ou alternada; as únicas infinitas são os indicadores de carregamento. |
| Contagem 3-2-1 | ✅ O número sobe da máscara (expo.out), a barra enche em 0,8 s por número e some aos 2,4 s. Cabe nas 4 larguras (223–267 pt). Com reduzir, só troca. |

**Duração percebida das entradas** (do fim do carregamento até a última animação finita; com reduzir ficam entre 0,2 e 0,3 s, só fade):

| Tela | Duração |
|---|---|
| Entrar (herói "NOMADE RUN") | 1,7–1,8 s |
| Onboarding boas-vindas | 1,65 s; etapas 1,0 s |
| Contagem 3-2-1 | 2,2 s (por desenho, 3 × 0,8 s) |
| Pódio do ranking | ~1,5–1,9 s (pedestais 1,5 s) |
| Mapa | 0,8–1,0 s |
| Folha da zona, arena, clube, perfil, conta, contatos, nova corrida, termos | 0,8–1,0 s |
| Editar perfil, crew | ~1,0 s |
| Notificações | 0,5–0,6 s |
| Resumo | 0,5–1,0 s (anel termina em 720 ms) |
| Corrida | 0,2 s (controles sem entrada, como pede o guia) |
| `CountUp` | XP do perfil 0,77 s; dano do raid 1,07 s; km das atividades 0,58 s |

### 14.4 Acessibilidade

| Verificação | Resultado |
|---|---|
| Títulos revelados (`RevealText`/`HeroWordmark`) como frase única | ✅ Em todas as telas o título tem `role=heading` + `aria-label` com a frase inteira ("Crie uma senha nova", "Nova corrida", "Corrida concluída", "Escolha seu time", "NOMADE RUN"…) e as palavras animadas ficam `aria-hidden`. Nenhum título dividido sem rótulo. A celebração é um bloco acessível só ("Zona conquistada, mais 33 RP em Setor Pedro Ludovico 36"). |
| `CountUp` com o valor final | ✅ O rótulo já é o final no 1º quadro, enquanto o texto ainda mostra 0: "45 de 100 XP para o nível 2.", "2.312 quilômetros de dano", "0,7 quilômetros no período". O pódio lê "Pódio: 1º Neon Striders, 150 RP; 2º …". |
| Faixa amarela "Defendendo" | ✅ tinta `ink` sobre `warning`: **7,13:1** |
| Pódio | ✅ 1º lugar (branco sobre tinta) 15,46:1; demais 15,46:1; nomes `ink2` sobre fundo 5,94:1 |
| Alertas | ✅ alerta do mapa (tinta sobre branco), erro (`danger` 4,83:1). ⚠️ **Card "Sob ataque" da folha da zona**: branco sobre laranja 3,12:1 (QA-22). ⚠️ **Faixa de território rival na corrida**: branco sobre Volt 3,42:1 e sobre Owls 4,19:1 (QA-19) |
| Botões laranja e aba ativa | ⚠️ 3,12:1 (2,84:1 no escuro), abaixo de 4,5:1 para rótulo de 16–18 pt negrito. Já existia antes da Fase 6 (marca, D-15): QA-22 |

### 14.5 Achados

| # | Severidade | Tela | Achado | Como reproduzir | Arquivo provável | Resolução sugerida | Dono |
|---|---|---|---|---|---|---|---|
| QA-18 | Média | Corrida | A faixa de território escondida (opacidade 0, fora da tela) continua na árvore de acessibilidade, sem `aria-hidden`, e com `accessibilityLiveRegion="polite"`. VoiceOver/TalkBack pode ler "Corra aqui para conquistar" sem faixa nenhuma, e a região viva anuncia mudanças invisíveis | Nova corrida → Simulação → Começar. No DOM, `[data-testid=corrida-faixa-territorio]` tem opacidade 0, sem `aria-hidden` e com `aria-live=polite` (nas 8 combinações). No aparelho: VoiceOver ligado, deslizar pelos elementos | `src/features/screens/run-screen.tsx` (`Animated.View` da faixa) | Com `bannerOn` falso: `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` (e `aria-hidden` no web); a região viva só com a faixa visível | A4 |
| QA-19 | Média | Corrida | Contraste da faixa "Território dos {time}": texto branco (16 pt negrito + legenda 12 pt) sobre Volt `#009E73` = 3,42:1 e sobre Owls `#C0559A` = 4,19:1 (precisa de 4,5:1). Striders 5,19:1 e Coyotes 7,60:1 passam | Correr numa zona dos Volt ou dos Owls (GPS real ou simulação que passe por uma); calculado dos tokens | `run-screen.tsx` (`bannerInk`) e `theme/tokens.ts` (`onColor` dos times) | Sem mudar a cor do time: faixa em `surface` com badge/borda do time e texto `ink`. Outra opção: `onColor` escuro para Volt (`ink` = 4,52:1). Owls não passa nem com `ink` (3,69:1), então precisa da faixa em superfície | A4 (com A7 para o token) |
| QA-20 | Baixa | Mapa | O alerta compacto corta a 2ª linha nas 4 larguras (até em 430): "Sob ataque dos Urban Coyotes · defend…". A parte "pontos em dobro", que é o motivo para defender, some | Entrar como `corredor_demo` → mapa | `src/features/screens/map-screen.tsx` (alerta, `numberOfLines`) | Texto mais curto ("Sob ataque · defesa vale 2×") ou 2 linhas no subtítulo | A8 |
| QA-21 | Baixa | Várias | Mais de 4 tamanhos de fonte em 21 de 28 telas (checklist §4 do `DESIGN_MOBILE_MOTION.md`). Arena e nova corrida têm 9; clube, perfil, atividades e corrida, 8; mapa, 7. Exemplo na nova corrida: 12, 14, 16, 18, 18,48, 20, 22, 24, 32 | Script: estilos calculados dos textos visíveis | `src/theme/tokens.ts`/`components/text.tsx` e as telas | A7 define a escala por tipo de tela (ex.: headline, title, body, caption + número), e os donos trocam as variantes que sobram. Não bloqueia a apresentação | A7 (A4, A8, A3) |
| QA-22 | Baixa (marca) | Botões, aba ativa, card "Sob ataque" | Texto branco sobre laranja `#FF5A1F` = 3,12:1 (2,84:1 no escuro). O rótulo de 16–18 pt negrito não conta como "texto grande", então precisa de 4,5:1. Inclui o card de ataque da folha da zona (texto de 12–16 pt), o contador do sino e "Prepare-se". Já existia antes da Fase 6 (visual aprovado, D-15) | Qualquer CTA laranja | `theme/tokens.ts`, `components/button.tsx`, `zone-sheet.tsx` | Decisão dos autores. Opções sem mudar a cor: rótulo ≥ 19 pt negrito (vale 3:1), texto `ink` sobre laranja (4,96:1) ou `orangeText` `#C93F00` como fundo do card de ataque (5,01:1) | Autores + A7 |
| QA-23 | Baixa | Notificações (360) | "2 não lidas" quebra em 2 linhas, apertado pelo botão "Marcar todas como lidas" | 360×640 → Notificações com 2 não lidas | `src/features/notifications/notifications-screen.tsx` | `flexShrink`/`numberOfLines={1}` no contador ou botão mais curto ("Marcar lidas") | A3 |
| QA-24 | Baixa | Ranking (360) | O nome "corredor_demo (você)" é cortado com reticências na 1ª linha do ranking | 360×640 → Clube → Corredores | `club-screen.tsx` (`ranking-linha-*`) | Deixar o "(você)" numa 2ª linha ou trocar pelo destaque visual já existente | A8 |
| QA-25 | Baixa (já conhecido) | Cadastro | Links "Termos de Uso"/"Política de Privacidade" dentro da frase têm 20 pt de altura (o aceite ao lado tem 44 pt) | Cadastro | `sign-up-screen.tsx` | Os links também estão nas telas de termos/privacidade via aceite; aumentar a área (`hitSlop` vertical) | A3 |

Sem achados de severidade Alta. Informativo (não é bug): no web a fonte Inter chega depois do 1º quadro e muda a largura dos textos; no aparelho a fonte vem embutida.

### 14.6 Regressão (2026-10-21)

| Suíte | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 problemas |
| `npx jest --coverage` | **398 passaram**, 26 ignorados (46 suítes + 4). Domain 99,54% instruções, 99,59% ramos, 97,56% funções, 100% linhas (limite de 90% ok) |
| `src/__tests__/testids.test.ts` (inclui os ids dos fluxos Maestro) | ok. Fluxos `01`–`05` conferidos: os seletores são por `id`; os textos usados ("E-mail ou senha incorretos.", ".*zonas em .*", "Conquista garantida ao terminar") continuam no código e não são títulos divididos em palavras |
| `e2e-web/demo-flow.cjs` | **14/14** (banco resetado antes: "Zona conquistada, mais 51 RP em Estádio Serra Dourada", moderador aprova "parcial, 419 RP") |
| `e2e-web/auth-flow.cjs` | **17/17** |
| `e2e-web/visual.spec.cjs` | Contra as referências antigas: 4 falhas, esperadas pela D-54. **Regeneradas de propósito** com o seed limpo (`--update-snapshots`) e confirmadas em 2 execuções: **4/4** (+1 `fixme`) |
| Integração (`NOMADE_IT=1 … npx jest integration --forceExit`) | **26/26** em 4 suítes |
| Maestro em aparelho | não executado (sem aparelho; P-07) |

Capturas "depois": `docs/ui-audit/t65-depois-{360x640,375x667,390x844,430x932}.png` (folha de contato por resolução, sem reduzir movimento; a de 375 inclui a moderação).

### 14.7 Checklist do aparelho (só o celular valida)

Faça em um iPhone (de preferência SE ou 13 mini) e em um Android médio, com o backend da apresentação. Use a conta `corredor.demo@nomaderun.app`. Marque ✅/❌ e anote o aparelho.

1. **Folha da zona nos detents 0,55/0,9 (iOS):** no mapa, toque numa zona. Na altura menor, o nome, o dono, o card de ataque e o botão "Defender/Correr aqui" aparecem sem rolar. Arraste para cima: a influência e os maiores corredores rolam. No Android a folha abre e o botão aparece.
2. **Teclado:**
   - Entrar: toque em E-mail, digite e use "próximo" até Senha. O botão "Entrar" continua visível com o teclado aberto.
   - Cadastro: os campos encadeados e o último campo visível acima do teclado.
   - Contatos de segurança → Adicionar: o campo aparece acima do teclado. No Android (edge-to-edge) confira se nada fica atrás do teclado.
3. **Barra fixa acima das abas nativas:** Perfil → Editar perfil. "Salvar alterações" fica acima da barra de abas (iOS 26 com abas flutuantes também). Role até o fim: a última seção fica acima do botão. Faça o mesmo em Contatos e Zonas de privacidade ("Adicionar…").
4. **60 fps** (iOS: Perf Monitor do menu de desenvolvimento; Android: "Profile GPU rendering"):
   - abra o mapa e arraste/aproxime com o alerta aberto;
   - Clube → quadro Times (pódio crescendo);
   - Perfil e Atividades (cascatas e contadores);
   - corrida com **GPS real**, que troca os algarismos do tempo (na Simulação a troca é sem animação, D-56).
   Não pode haver travadas visíveis nem quadros abaixo de ~55 fps.
5. **Vibração:** na contagem 3-2-1, uma vibração leve por número. No resumo com zona conquistada, uma única vibração (antes vinha em dobro). Segurar "encerrar" dá retorno ao confirmar.
6. **VoiceOver (iOS) / TalkBack (Android):**
   - títulos ("Nova corrida", "Corrida concluída", "NOMADE RUN") lidos uma vez e como cabeçalho;
   - XP e dano do raid lidos com o valor final;
   - pódio lido numa frase;
   - na corrida, o tempo e as métricas pelo rótulo, e **nada lido sobre território quando a faixa não aparece** (hoje deve falhar: QA-18).
7. **Reduzir movimento do sistema** (iOS: Ajustes → Acessibilidade → Movimento → Reduzir movimento; Android: Acessibilidade → Remover animações): abra entrar, mapa, clube, resumo e troque de aba. Só aparecem fades: nada sobe, escala ou desliza; o pódio já aparece com a altura final; os números já aparecem com o valor final.
8. **Tela bloqueada:** comece uma corrida com GPS real, bloqueie o aparelho por 2 min e desbloqueie. A corrida continua (tempo e distância avançaram) e a faixa de território aparece em até 3 s ao entrar numa zona (ERS §6.2). Com development build e `NOMADE_BACKGROUND_LOCATION=1`, confira também a notificação do serviço (P-17/P-21).
9. **Área segura:** em aparelho com notch/ilha dinâmica, nada encosta no topo (pílula do mapa, faixa da corrida, título dos modais Termos/Privacidade no Android) nem no indicador de início (controles da corrida, "Concluir" do resumo).

### 14.8 Correções após a T6.5 (A1, 2026-10-21)
| Achado | Status | Como foi resolvido | Teste |
|---|---|---|---|
| QA-18 (Média) | ✅ corrigido | A faixa de território escondida recebe `aria-hidden` e sai da região viva (`accessibilityLiveRegion='none'`); o texto fica vazio quando não há faixa | Conferir no aparelho com VoiceOver/TalkBack (§14.7) |
| QA-19 (Média) | ✅ corrigido | `readableBackground` (`src/features/run/banner-color.ts`) escurece só o necessário o fundo da faixa: Volt −16% (4,64:1), Owls −6% (4,67:1); Striders e Coyotes inalterados | `src/features/run/__tests__/banner-color.test.ts` (4 times ≥ 4,5:1) |
| QA-20, QA-23, QA-24, QA-25 (Baixa) | ⬜ abertos | Textos cortados/quebrados em 360 pt e links de 20 pt | P-42 a P-45 |
| QA-21, QA-22 (Baixa) | ⬜ decisão | Mais de 4 tamanhos de fonte; branco sobre o laranja da marca 3,12:1 (já existia, D-15) | Decisão dos autores |

## 15. Fase 7 — modo demonstração, contrato, capturas e CI (E10, onda 1, 2026-10-23)

Relatório completo: `docs/melhoria/relatorios/E10-onda1.md`. Decisões: D-77 (modo demonstração) e D-81 (CI).

### 15.1 Modo demonstração (T7.1.18)
- **O que é:** um servidor em memória (`apps/mobile/src/services/api/demo/`) atrás de `getSupabase()`. Imita as 18 tabelas/views do PostgREST e o bucket `avatars`, as 11 RPCs, as 8 Edge Functions (o `finish-activity` calcula com o próprio `src/domain` e confere a assinatura HMAC do sync), o Auth, os 2 canais Realtime e o Storage. O mundo (Goiânia, corredores `*.demo`, crews, zonas, histórico, notificações) vem de `src/demo/world.ts`.
- **Ligar:** `EXPO_PUBLIC_DEMO=1`. Com ela, a URL e a chave do Supabase são ignoradas e o app abre direto na sessão de demonstração.
  - web: `cd apps/mobile && EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo` (o `--clear` é obrigatório: o cache do Metro ignora mudança de `EXPO_PUBLIC_*`) e `node e2e-web/serve.cjs /tmp/nomade-demo 8098`;
  - desenvolvimento: `EXPO_PUBLIC_DEMO=1 npx expo start --clear`.
- **Roteiros (só na web, `?cenario=`):** `cheio` (padrão), `vazio`, `sem-time`, `primeira-abertura`, `sob-ataque`, `erro`, `offline`, `lento`, `moderador`. Exemplo: `http://127.0.0.1:8098/notificacoes?cenario=sob-ataque`.
- **Isolamento:** caches de zonas e perfil com chave `nomade.demo.*`; fila offline em `nomade-queue.demo.db` (na web, só em memória); o transporte real recusa sessão `demo-…` (`DEMO_ISOLATION`); nenhum `fetch` (testado).
- **Ainda não (onda 2, com a E6):** botão "Ver demonstração" e o selo "Demonstração" no `_layout`. Até lá, as capturas recebem o selo do próprio script.

### 15.2 Testes novos
| Teste | O que garante |
|---|---|
| `src/__tests__/demo-flow.test.ts` | Entrar → correr com a simulação → resumo oficial pelo código do app (session-controller, run-controller, fila, sync com HMAC, transporte), sem nenhum `fetch`/`XMLHttpRequest`; provisório = oficial |
| `src/__tests__/demo-contract.test.ts` | Toda tabela, bucket, RPC e function usada no app tem par na demonstração (falha com o nome e arquivo:linha); nome dinâmico falha; par órfão falha |
| `src/__tests__/demo-isolation.test.ts` | Chaves e arquivos separados, fila da web só em memória, transporte real recusa `demo-…`, variável ignora URL/chave |
| `src/services/api/demo/__tests__/repos.test.ts` | Cada função dos repositórios (contrato da F1 §2.5) responde pela costura real |
| `src/services/api/demo/__tests__/scoring-parity.test.ts` | O `finish-activity` da demonstração = `computeOfficialResult` das Edge Functions (válida, parcial, rejeitada, revisão, aprovação, Fuga, Caça) |
| `src/services/api/demo/__tests__/postgrest.test.ts` | Erros e semântica do PostgREST (PGRST205, 42703, PGRST116, RLS, roteiros `erro`/`offline`) |
| `src/demo/__tests__/world.test.ts` | Mundo determinístico, tudo marcado como demonstração, `src/demo` sem React/Expo |

**Vazamento do Jest corrigido:** `src/services/location/__tests__/current.test.ts` deixava o temporizador de 8 s do `currentPosition` armado; o worker era encerrado à força. Agora os testes usam prazo de 20 ms e o aviso "A worker process has failed to exit gracefully" sumiu.

### 15.3 Capturas automáticas (T7.1.19)
`apps/mobile/e2e-web/capturas.cjs`: rota × estado × 360/390/430, sobre o export do modo demonstração, com relógio fixo (2026-10-23 09:00), "Reduzir movimento", mapa-base trocado por um estilo vazio e WebGL por software. Saída comprimida com `pngquant --quality=85-98` em `docs/melhoria/capturas/<pasta>/` e `relatorio.json` (FCP, palavras, alvos < 44 px, interativos sem nome, erros e pedidos ao servidor, que devem ser zero).
```bash
cd apps/mobile
EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
NODE_PATH=$(npm root -g) node e2e-web/capturas.cjs /tmp/nomade-demo depois-onda2   # --rotas=, --estados=, --larguras=
```
"Antes cheio" (telas atuais com dados de demonstração): `docs/melhoria/capturas/antes-cheio/`.

### 15.4 CI (T7.1.20)
`.github/workflows/ci.yml`: jobs `app` (tipos, lint, Jest, cobertura do domain ≥ 90%, contraste como relatório), `web` (export do modo demonstração com `--clear` e orçamento de 980.000 B gzip) e `functions` (Deno test/check, `gen-seed.ts` e `domain-copy --check`). O contraste estrito liga depois da D-75.
