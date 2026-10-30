# E10 — Qualidade e plataforma · F3, onda 1 (fundação)

> **Tarefas:** T7.1.18 (modo demonstração, D-77), T7.1.19 (contrato, vazamento do Jest, capturas) e T7.1.20 (CI, D-81).
> **Branch:** `worktree-agent-a788725b38195d46b` (worktree `.claude/worktrees/agent-a788725b38195d46b`), base `d7747d8`.
> **Data:** 2026-10-23.

## Commits
`698fd77` vazamento do Jest · `7482da1` modo demonstração · `1eb8443` teste de contrato · `bf68128` mundo (roteiro do moderador) · `343f88c` capturas e "antes cheio" · este relatório e o `docs/QA.md` §15 · por último, **só** o `.github/workflows/ci.yml`.

## 1. Resumo

- **O app inteiro roda sem servidor.** Com `EXPO_PUBLIC_DEMO=1`, `getSupabase()` devolve um servidor de demonstração em memória e o app abre direto numa sessão de demonstração. Nenhum repositório, store ou tela mudou.
- **O fluxo entrar → correr (simulação) → resumo oficial** passa pelo código real do app (fila, sync assinado com HMAC, transporte, `finish-activity` calculado pelo `src/domain`) **sem nenhum `fetch`**, provado em teste.
- **Contrato:** um teste estático falha com o nome (e arquivo:linha) de qualquer tabela, RPC ou function usada pelo app sem par na demonstração.
- **Vazamento do Jest corrigido** (o aviso "A worker process has failed to exit gracefully" sumiu; `--detectOpenHandles` limpo).
- **Capturas automáticas** (`e2e-web/capturas.cjs`) e o conjunto **"antes cheio"** com as telas atuais e dados de demonstração.
- **CI** em `.github/workflows/ci.yml`, no último commit da branch, sozinho.

## 2. T7.1.18 — Modo demonstração

### 2.1 Arquivos
| Arquivo | Papel |
|---|---|
| `apps/mobile/src/services/api/demo/client.ts` | Monta o cliente: `from`, `rpc`, `functions.invoke`, `auth`, `channel`/`removeChannel`, `storage.from('avatars')`; roteiros e latência; `getDemoClient()`/`setDemoClient()`/`isDemoClient()` |
| `demo/db.ts` | Banco em memória: as 18 tabelas/views com as colunas do esquema real (nome errado falha com `42703`, tabela errada com `PGRST205`), visibilidade da RLS, gatilhos que o app percebe (limites de contatos e zonas de privacidade, líder e convite da crew, nome de usuário único), views de ranking e cidades |
| `demo/postgrest.ts` | `select` (com `count`/`head`), `insert`/`update`/`delete` com `.select()`, `eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`in`/`is`/`like`/`ilike`/`filter`/`match`, `order` (nulos como no Postgres), `limit`, `range`, `single`/`maybeSingle` (`PGRST116`) |
| `demo/rpc.ts` | As 11 RPCs com as regras do SQL (troca de time 1×/temporada, crew da mesma facção, baús do dia, rankings por período e escopo, `admin_set_user_status` só para admin…) |
| `demo/server.ts` + `demo/functions.ts` | As 8 Edge Functions com o formato de erro do contrato (`FunctionsHttpError` com `{ error: { code, message, details } }`): `register-device`, `ingest-points` (**confere a assinatura HMAC** e as regras de ordem/replay), `finish-activity` (idempotente, `MISSING_POINTS`, grava zonas, eventos, neblina, baús e a notificação "Zona conquistada" e emite pelo Realtime), `zones`, `zone`, `moderate-activity`, `account-export` (com `"demonstracao": true`) e `account-delete` |
| `demo/scoring.ts` | O cálculo oficial do servidor (`computeOfficialResult`) sobre o `src/domain` (sem o M_grupo) |
| `demo/auth.ts` | Sessão, `onAuthStateChange` (`INITIAL_SESSION`), entrar/cadastrar com qualquer dado, sair, recuperar senha sem e-mail; link mágico e login social respondem "Indisponível na demonstração." |
| `demo/realtime.ts` | Canais `notifications-<id>` (com o filtro `user_id=eq.`) e `zones-*` |
| `demo/scenario.ts` | Roteiros `cheio` (padrão), `vazio`, `sem-time`, `primeira-abertura`, `sob-ataque`, `erro`, `offline`, `lento`, `moderador`, lidos de `?cenario=` na web |
| `apps/mobile/src/demo/world.ts` | Mundo de Goiânia determinístico e puro (só `@/domain` e `./demo-data`): 24 corredores `*.demo`, 4 crews, as zonas do `seedZones()`, 6 corridas do corredor de demonstração, notificações, contatos e zona de privacidade "(demonstração)", corridas em revisão no roteiro do moderador |

### 2.2 Costura (o único ponto)
- `services/api/env.ts`: `EXPO_PUBLIC_DEMO` (`1` ou `true`) → `env.demo`; com ela, URL, chave e login social do Supabase são **ignorados**; `isDemoMode()`; `isBackendConfigured()` fica verdadeiro. `readEnv(vars)` aceita as variáveis por parâmetro (o Jest embute `process.env.EXPO_PUBLIC_*` na transformação).
- `services/api/supabase.ts`: `if (isDemoMode(env)) return asSupabaseClient(getDemoClient());`. Nenhum cliente real é criado no modo demonstração.
- **Sessão automática:** o Auth de demonstração já nasce com sessão (menos no roteiro `primeira-abertura`), e o `useSessionBootstrap` existente faz o resto. O botão "Ver demonstração" e o selo no `_layout` ficam para a onda 2 (E6).

### 2.3 Isolamento
| Risco | Garantia | Teste |
|---|---|---|
| Rede durante a demonstração | O cliente de demonstração não tem `fetch`; `fetch` e `XMLHttpRequest` trocados por funções que falham | `src/__tests__/demo-flow.test.ts`, `src/services/api/demo/__tests__/repos.test.ts` |
| Cache da demonstração na conta real | `zones-cache*.ts`/`profile-cache*.ts`: `nomade.demo.zones.v1`/`nomade.demo.profile.v1` (a conta real mantém as chaves de sempre) | `src/__tests__/demo-isolation.test.ts` |
| Corrida da demonstração no servidor real | `queue.ts`: `nomade-queue.demo.db`; `queue.web.ts`: fila **só em memória** (não lê nem grava o localStorage) | idem |
| Envio em nome de `demo-…` | `transport.ts`: o transporte com cliente real recusa sessão `demo-…` (`DEMO_ISOLATION`, 403, não tenta de novo); o cliente de demonstração passa | idem |
| Chave HMAC | `device-key.ts` já guarda por usuário (`nomade.device.v1.demo-corredor`) | — |

### 2.4 Superfície coberta (contrato da F1 §2.5)
| Parte | Quantidade | Onde |
|---|---|---|
| Tabelas/views (`from`) | 18 + o bucket `avatars` = 19 | `DEMO_TABLES`, `DEMO_BUCKETS` |
| RPCs | 11 | `DEMO_RPCS` |
| Edge Functions | 8 | `DEMO_FUNCTIONS` |
| Auth | `getSession`, `getUser`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`, `signInWithOAuth`, `refreshSession`, `start/stopAutoRefresh` | `demo/auth.ts` |
| Realtime | 2 canais | `demo/realtime.ts` |
| Storage | `upload`, `getPublicUrl` (avatar SVG "DEMO", a foto não sai do aparelho), `list`, `remove` | `demo/client.ts` |

## 3. T7.1.19 — Contrato, vazamento e capturas

### 3.1 Teste de contrato (`apps/mobile/src/__tests__/demo-contract.test.ts`)
- Lê `src/**` (menos `__tests__`, `services/api/demo` e `demo`) pela AST do TypeScript e extrai `from('…')`, `storage.from('…')`, `rpc('…')`, `functions.invoke('…')`, `callFunction('…')` e o tipo `FunctionName`. Resolve nomes passados por parâmetro tipado (`callRanking(fn: 'ranking_runners' | …)`, `callFunction(name: FunctionName)`) e por chamadas literais da função local (`invoke('register-device', …)` do transporte).
- **Falha** com `rpc "claim_mission" (src/services/api/missoes-repo.ts:3) não tem par no servidor de demonstração`; nome dinâmico (template) também falha; par órfão (a demonstração imita algo que o app não usa mais) também falha.
- Autoteste com uma RPC, uma tabela e uma function novas (o teste prova que pega o que deve pegar).

### 3.2 Vazamento do Jest
- **Causa:** `apps/mobile/src/services/location/__tests__/current.test.ts`. O `currentPosition` (`src/services/location/current.ts:24-27`) faz `Promise.race` com um `setTimeout` de 8 s que **nunca é cancelado**; nos testes "sem posição recente, pede uma nova" e "GPS que falha", o temporizador de 8 s ficava armado e o worker do Jest era encerrado à força.
- **Achado pela bissecção** das 54 suítes com 2 workers (27/27 → 13/14 → 7/7 → arquivo).
- **Correção mínima (no teste):** prazo de 20 ms nos três casos. O código de produção ficou igual (pedido ao dono em §7).
- **Depois:** `npx jest --maxWorkers=2` 2×, sem o aviso; `npx jest --detectOpenHandles` limpo.

### 3.3 `apps/mobile/e2e-web/capturas.cjs`
- Rota × estado × 360/390/430 sobre o export do modo demonstração; cada estado é um roteiro (`?cenario=`).
- Confere que o export é mesmo o da demonstração (sem `--clear` o Metro reaproveita o bundle antigo e o script recusa).
- Relógio fixo (2026-10-23 09:00, Brasília), "Reduzir movimento", WebGL por software, mapa-base trocado por um estilo vazio (as regiões aparecem sem internet). Copia o worker do MapLibre para o export quando falta `public/` (worktree sem `npm install`).
- Selo "Demonstração" em toda captura (do app, quando a E6 puser o `DemoBadge` com `testID` contendo `demonstracao`; senão, do script).
- `pngquant --quality=85-98` e `relatorio.json` com FCP, telas (`tela-*`), palavras visíveis, alvos < 44 px, interativos sem nome, erros da página e pedidos ao servidor (tem de ser 0; o script sai com erro se não for).

### 3.4 "Antes cheio" (`docs/melhoria/capturas/antes-cheio/`)
Gerado com o código atual desta worktree (telas antigas, dados de demonstração), no export `EXPO_PUBLIC_DEMO=1 --clear`:
- **123 capturas** = 41 pares rota × estado × 3 larguras (360, 390, 430), em **7,2 min**; PNG de 10,5 MB → **3,3 MB** com o pngquant;
- **0 erros de página e 0 pedidos ao servidor** (o único pedido externo, o estilo do mapa-base, é respondido com um estilo vazio);
- estados: `cheio` (17 rotas), `vazio` (8), `carregando` (3, roteiro `lento`), `erro` (3), `offline` (2), `sob-ataque` (2: o alerta chega pelo Realtime e o sino vai de 2 para 3), `sem-time` (onboarding), `primeira-abertura` (Entrar, Cadastro, Recuperar senha) e `moderador` (fila e detalhe);
- FCP de 524 a 1.488 ms (mediana 864 ms); palavras, alvos < 44 px e interativos sem nome por captura no `relatorio.json`.

Isso fecha a lacuna da F1 (§14: "a comparação justa antes/depois dos estados cheios só vai existir com o modo demonstração rodando sobre o código antigo").

## 4. T7.1.20 — CI

`.github/workflows/ci.yml`, sozinho no último commit da branch:
- **app:** `npm ci` → `typecheck` → `eslint src --max-warnings 0` → `jest --ci --maxWorkers=2` (inclui contrato e fluxo sem rede) → cobertura do domain ≥ 90% → contraste dos tokens como relatório no resumo do job (o `--strict` liga depois da D-75).
- **web:** export do **modo demonstração** com `--clear`, confere que é o da demonstração e aplica o orçamento do bundle (`entry` ≤ 980.000 B gzip).
- **functions:** `deno test`, `deno check` das functions, `deno check` do `gen-seed.ts` (garante `src/demo` puro) e `domain-copy.mjs --check`.
- YAML validado (`yaml.safe_load`: 3 jobs, 8/6/6 passos); todos os comandos rodados aqui (§5).

## 5. Testes (números)

| Verificação | Antes (`d7747d8`) | Depois |
|---|---|---|
| `npm run typecheck` | 0 erros | **0 erros** |
| `./node_modules/.bin/eslint src` | 0/0 | **0/0** |
| `npx jest --maxWorkers=2` | 417 passaram, 26 pulados (443); 50 suítes + 4 puladas; **aviso de worker preso** | **462 passaram, 26 pulados (488); 57 suítes + 4 puladas; sem aviso** |
| `npx jest --detectOpenHandles` | — | **limpo** (462/26) |
| Cobertura do domain (limite 90%) | passa | **passa** (104 testes) |
| Deno (functions) | 58/0/1 | **58 passaram, 0 falharam, 1 ignorado** (nada mudou nas functions) |
| `deno check gen-seed.ts` | — | **ok** |
| Export web com `EXPO_PUBLIC_DEMO=1 --clear` | — | ok; `entry` 3.526.895 B (**909.056 B gzip**, orçamento 980.000) |

**45 testes novos em 7 suítes:** `demo-flow` (4), `demo-contract` (5), `demo-isolation` (9), `services/api/demo/__tests__/repos` (10), `scoring-parity` (6), `postgrest` (6), `demo/__tests__/world` (5).

## 6. Achados nas capturas "antes cheio" (para as próximas ondas)
Evidências: `docs/melhoria/capturas/antes-cheio/` (arquivo citado) e `relatorio.json` (390 px).

| # | Gravidade | Achado | Evidência | Dono sugerido |
|---|---|---|---|---|
| 1 | Média | **"Carregando" é uma tela branca**, sem fundo escuro nem indicador (a F1 já tinha medido 8 s em branco sem rede, D9) | `inicio__carregando__390.png` (0 palavras), `atividades__…`, `notificacoes__…` | E6 (`+html.tsx` com fundo `#070708` e esqueleto) |
| 2 | Média | **Perfil aberto direto mostra "0 zonas conquistadas" e "Primeiros passos" bloqueado** com 6 corridas no servidor: a tela conta `serverRuns`, que só é carregado pela aba Atividades | `perfil__cheio__390.png`; `src/features/screens/profile-screen.tsx:33-34` | E6/E7 (carregar o histórico no bootstrap ou na própria tela) |
| 3 | Média | **19 alvos de toque abaixo de 44 px** (chips de 36–40 px no Mapa, Atividades e Clube; links de Termos/Privacidade com 20 px; Switch de 40×20) | `relatorio.json` → `audit.small` | E6 |
| 4 | Média | **Muito texto nas telas de jogo:** Clube 290 palavras, Arena 227, Perfil 177 (meta D-74: ≤ 40 por tela de jogo) | `relatorio.json` → `audit.words` | E6 |
| 5 | Baixa | O Mapa não tem `testID` de tela (`tela-*`): as capturas e o Maestro esperam pelo tempo | `relatorio.json` → `screens` vazio em `inicio__*` | E6 |
| 6 | Baixa | "17 confirmados" e "Confirmar presença" no Clube continuam como ação principal (aqui é dado de demonstração, rotulado; na conta real é o achado R-3 da F1) | `clube__cheio__390.png` | E6 (T7.1.16) |

## 7. Pendências e pedidos

- **E6 (onda 2):**
  - botão "Ver demonstração" (Entrar e "indisponível") e o selo "Demonstração" no `_layout` (`testID` com `demonstracao`, para o `capturas.cjs` não pôr o selo dele);
  - ligar o modo em tempo de execução: hoje só pelo build. Para o botão, o `env.ts` precisa de um interruptor em tempo de execução e a troca precisa zerar `setQueueStore(null)`, `setSyncEngine(null)`, as stores (`resetForSignOut`) e `setDemoClient(null)` ao sair. Eu faço a parte de `services/` junto com a E6.
- **E9 (onda 2):** cada RPC/tabela/function nova dos repositórios entra com o par aqui, ou o `demo-contract` falha com o nome:
  - tabela: coluna em `DEMO_TABLE_COLUMNS` (`demo/db.ts`) e as regras em `read`/`visible`/`insert`;
  - RPC: entrada em `DEMO_RPC_HANDLERS` (`demo/rpc.ts`);
  - function: `FunctionName` + `DEMO_FUNCTION_HANDLERS` (`demo/functions.ts`).
- **E3 / E9:** se o `computeOfficialResult` mudar (gravação v2), o `demo/scoring.ts` acompanha; o `scoring-parity.test.ts` acusa a diferença.
- **Dono de `src/services/location/current.ts`:** cancelar o temporizador do `Promise.race` (`clearTimeout`) quando o GPS responde; o teste já não depende disso.
- **Coordenador:** o commit da CI é o último e só tem o `ci.yml`; enviar separado (risco da permissão `workflow`, plano B no `docs/melhoria/ci/README.md`).

## 8. Riscos
- **O código da demonstração vai em todo build** (import estático em `supabase.ts`; o Metro resolve até `require` condicional): `entry` de 889.454 → 909.056 B gzip (+19,6 KB; +62,8 KB bruto), dentro do orçamento de 980.000. Entre o commit da linha de base da F1 (`1a82415`) e `d7747d8` o app não mudou, então a diferença é toda da demonstração. Criar o mundo custa ~0,4 s no primeiro `getSupabase()` do modo demonstração (6 corridas recalculadas pelo domain).
- **Paridade:** o `finish-activity` da demonstração não faz o M_grupo (depende de outras pessoas correndo junto).
- **Roteiros só na web:** no Expo Go o modo demonstração usa sempre o roteiro `cheio`.
- **Worktrees sem `apps/mobile/public/`:** o export web sai sem o worker do MapLibre e o mapa fica vazio; o `capturas.cjs` corrige no export, mas a prévia web precisa do `postinstall`.
