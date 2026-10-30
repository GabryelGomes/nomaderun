# F1 — E10 Qualidade e plataforma: linha de base, modo demonstração, capturas e auditorias

> **Equipe:** E10 (Qualidade e plataforma). **Fase:** F1, descoberta. **Data:** 2026-10-23.
> **Escopo:** só leitura do código. Nada foi alterado em `apps/mobile/**`, `supabase/**` ou `package.json`.
> **Regra deste relatório:** todo achado traz uma evidência (arquivo:linha, captura ou comando com a saída).

## Sumário

1. Linha de base (a régua de "não piorou")
2. Modo demonstração (X3): arquitetura e contrato completo
3. Plano de capturas e o "antes"
4. Teste de 5 segundos (protocolo e notas "antes")
5. Auditoria de acessibilidade
6. Auditoria de desempenho
7. CI no GitHub (X5)
8. Checklist de ética (seção 5.4)
9. Mapa de riscos de regressão
10. As 10 piores falhas (resumo)
11. Decisões para o coordenador
12. Tarefas propostas para F3/F4/F5
13. Pedidos às outras equipes
14. Riscos e bloqueios
15. Arquivos desta entrega

---

## 1. Linha de base

Medida em 2026-10-23, no commit `1a82415`, sem alterações locais. Rodei cada verificação **uma vez**, em sequência, numa máquina de 4 núcleos dividida com as outras equipes. Os logs ficaram na pasta temporária da E10.

| Verificação | Comando (em `apps/mobile`, salvo indicação) | Resultado | Tempo |
|---|---|---|---|
| Tipos | `npm run typecheck` (`tsc --noEmit`) | **0 erros** | 10 s |
| Lint | `./node_modules/.bin/eslint src` | **0 erros, 0 avisos** | 33 s |
| Testes do app | `npx jest` | **417 passaram, 26 pulados, 443 no total; 50 suítes passaram, 4 puladas (54)** | 10 s (8,5 s do Jest) |
| Cobertura do domain | `npx jest --coverage src/domain` | **104 testes; domain: 99,55% instruções, 99,6% ramos, 97,67% funções, 100% linhas** | 17 s |
| Functions (Deno 2.9.6) | na raiz: `npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests` | **58 passaram, 0 falharam, 1 ignorado** | 3 s |
| Tipos das functions | na raiz: `npx -y deno check --config supabase/functions/deno.json supabase/functions/*/index.ts` | **0 erros** | — |
| Cópia do domain | na raiz: `node supabase/scripts/domain-copy.mjs --check` | `sem cópia (plano A em uso)`, código 0 | — |
| Export web | `npx expo export -p web --output-dir <tmp>/web` | **ok, 40 páginas HTML, 8,6 MB no total** | 28 s |

**Cobertura do domain por arquivo:** os pontos abaixo de 100% são:
- `anti-cheat.ts`: ramo na linha 123 (97,67%);
- `grid.ts`: funções 85,71%;
- `territory.ts`: funções 90,9%.

O resto está em 100%.

**Bundle web (régua de tamanho):**

| Arquivo | Bruto | gzip -9 |
|---|---|---|
| `entry-*.js` (app inteiro) | **3.464.108 B** | **889.454 B** |
| `maplibre-gl-*.js` (carregado sob demanda) | 1.080.351 B | 284.017 B |
| `index-*.js` (expo-notifications) | 61.871 B | 14.676 B |
| Fontes (`assets/`) | 2.640.597 B em 24 arquivos | — |

O maior arquivo de fonte é o `MaterialSymbols_400Regular.ttf`, com **970.528 B**. Ele carrega o conjunto inteiro, mas o app usa só 43 ícones (`src/components/icon.tsx:7-47`).

**Composição do `entry` (fonte, pelo source map do export com `--source-maps`):**

| Pacote | Tamanho | Parte |
|---|---|---|
| expo-router | 1.202 KiB | 17,5% |
| react-native-reanimated | 741 KiB | 10,8% |
| react-native-web | 711 KiB | 10,4% |
| h3-js | 534 KiB | 7,8% |
| react-dom | 533 KiB | 7,8% |
| @supabase/* (auth, storage, postgrest, realtime, phoenix) | 803 KiB | 11,7% |
| react-native-gesture-handler | 365 KiB | 5,3% |
| código do app (`features` 350, `services` 144, `components` 80) | 574 KiB | 8,4% |

**Desempenho web medido (Chromium, 390×844, export servido localmente, sem mapa-base):**
- primeira pintura (FCP) entre **448 e 584 ms** em todas as rotas;
- carregamento até o "load" mais 2,5 s de espera: 2,8 a 4,3 s.
- Os números por rota estão em `docs/melhoria/capturas/antes/relatorio.json`.

**Sinais de saúde que já aparecem na linha de base:**
- **Vazamento de recurso nos testes do Jest.** O `npx jest` termina com `A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown.` Algum teste deixa um temporizador ou um handle aberto. Ele não falha hoje, mas é um teste instável em potencial na CI (tarefa T7.E10.7).
- **O cache do Metro ignora mudança de `EXPO_PUBLIC_*`.**
  - Um segundo export com `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399` gerou o **mesmo** `entry-3690ad08….js`, e `grep -c 54399` deu 0.
  - Com `--clear`, a URL entrou no bundle (`grep -c` = 1).
  - Consequência: qualquer build do modo demonstração por variável (`EXPO_PUBLIC_DEMO=1`) precisa de `--clear`, senão sai o app sem o modo, sem nenhum aviso.

**Régua para as próximas fases:**
- typecheck 0;
- eslint 0/0;
- jest ≥ 417 passando, 0 falhando, pulados só os `*.local.test.ts`;
- cobertura do domain ≥ 90% em todas as métricas (hoje 97,67% no pior caso);
- Deno 58 ou mais passando;
- `entry` ≤ 980.000 B gzip (+10%), justificando qualquer subida.

---

## 2. Modo demonstração (X3)

### 2.1 Objetivo
Com o modo demonstração, o app inteiro fica navegável **sem servidor**. Isso serve para:
- apresentar o TCC;
- gerar capturas de todas as telas e estados;
- rodar o fluxo completo no Playwright e na CI;
- montar a prévia web (X4).

Nesse modo o app fica **sempre** rotulado "Demonstração" e nunca se mistura com uma conta real.

### 2.2 Onde o app decide hoje que "não há servidor"
- `src/services/api/env.ts:40`: `isBackendConfigured` exige a URL e a chave anônima.
- `src/services/api/supabase.ts:44-47`: `getSupabase()` devolve `null` sem a configuração.
- `supabase.ts:63-66`: `requireSupabase()` lança `AppError('SERVER', …, NOT_CONFIGURED)`.
- `src/features/auth/session-controller.ts:160-163`: sem a configuração, chama `setUnconfigured()`. A rota vira `unavailable` (`src/features/auth/route-guard.ts:28`).
- Resultado: a tela "Backend não configurado" (`src/features/auth/unavailable-screen.tsx:26-43`), com instruções de desenvolvedor (ver a captura `inicio__sem-servidor__390.png`).

### 2.3 Todos os pontos de acesso ao servidor (levantamento completo)
Rodei `grep` por `requireSupabase|getSupabase|callFunction|@supabase` fora dos testes. **Todo** acesso ao servidor passa por um único funil: `getSupabase()` / `requireSupabase()`, em `src/services/api/supabase.ts`. Quem usa esse funil:
- os 13 repositórios de `src/services/api/*-repo.ts`;
- `functions.ts`;
- `src/services/safety/contacts-repo.ts`;
- `src/services/sync/transport.ts:39` (`createSupabaseTransport(get = getSupabase)`).

Nenhuma tela e nenhuma store importam o supabase-js. A regra de camadas da ARQUITETURA está cumprida, e é ela que torna a costura barata.

**Superfície do supabase-js que o app usa:**

| Parte | O que é usado | Contagem |
|---|---|---|
| Tabelas (`from`) | `activities`, `activity_points`, `activity_zones`, `avatars` (storage), `chest_opens`, `crew_members`, `crews`, `fog_cells`, `leaderboard_cities`, `leaderboard_crews`, `leaderboard_factions`, `leaderboard_individual`, `moderation_reviews`, `notifications`, `privacy_zones`, `profiles`, `public_profiles`, `safety_contacts`, `staff_profiles` | 19 |
| Encadeamento PostgREST | `select`, `eq`, `in`, `gt`, `gte`, `lt`, `lte`, `ilike`, `filter`, `order`, `limit`, `range`, `single`, `maybeSingle`, `insert`, `update`, `delete({count})` | 40 `from(` |
| RPC | `admin_set_user_status`, `choose_faction`, `daily_chests`, `district_label`, `join_crew`, `leave_crew`, `mark_notifications_read`, `username_available`, `ranking_runners`, `ranking_crews`, `ranking_factions` | 11 |
| Edge Functions | `zones`, `zone`, `account-export`, `account-delete`, `moderate-activity` (via `callFunction`), `register-device`, `ingest-points`, `finish-activity` (via o transporte do sync) | 8 |
| Auth | `getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`, `signInWithOAuth`, `refreshSession`, `startAutoRefresh`/`stopAutoRefresh` | 11 |
| Realtime | `channel().on('postgres_changes').subscribe()`, `removeChannel` (`notifications`, `zones`) | 2 canais |
| Storage | `storage.from('avatars').upload` / `getPublicUrl` | 1 |

### 2.4 Costura recomendada: um "servidor de demonstração" atrás de `getSupabase()`

**Proposta:** quando o modo está ligado, `getSupabase()` devolve um **cliente de demonstração em memória**. Ele implementa exatamente a superfície da tabela acima sobre um banco em memória semeado. Nenhum repositório e nenhuma tela mudam.

```ts
// src/services/api/supabase.ts (única mudança de comportamento: 3 linhas)
export function getSupabase(): SupabaseClient | null {
  if (isDemoActive()) return getDemoClient();          // ← costura
  if (client) return client;
  ...
}
```

**Por que esta e não as alternativas:**

| Opção | Onde entra | Prós | Contras | Veredito |
|---|---|---|---|---|
| **A. Cliente de demonstração em `getSupabase()`** | 1 função (`supabase.ts`) + flag em `env.ts` | um ponto só; repos e telas intactos; o mapeamento dos repos (`toProfile`, `toActivity`…) e o **sync assinado** (HMAC, `ingest-points`, `finish-activity`) rodam de verdade; repo novo da E9 funciona se a tabela/RPC existir no servidor de demonstração | é preciso imitar a semântica do PostgREST (filtros e ordenação); o tipo `SupabaseClient` exige um *cast* | **Recomendada** |
| B. `if (demo)` dentro de cada função de repo | ~75 funções em 15 arquivos | tipado por função | espalha `if`; conflita com a E9 em todos os repos | Rejeitada |
| C. Alias do Metro (`*-repo` → `demo/*-repo`) | `metro.config.js` | zero `if` | só liga em build; sem botão "Ver demonstração" em tempo de execução; Jest precisa de outro mapeamento | Rejeitada |

**Garantia contra divergência:** um **teste de contrato estático** (T7.E10.2). Ele lê `src/services/**` (AST do TypeScript, como o `testids.test.ts` já faz) e extrai cada `from('x')`, `rpc('x')`, `callFunction('x')` e `invoke('x')`. Depois confirma que o servidor de demonstração tem um tratador para cada nome.
- Quando a E9 criar uma RPC nova sem o par de demonstração, o `npm test` falha com o nome dela.
- Um segundo teste chama **cada função exportada dos repos** contra o cliente de demonstração e exige `ok: true`.

### 2.5 Contrato: as funções a imitar (assinaturas atuais)

Todas devolvem `Promise<Result<T>>` (`src/services/api/errors.ts:62`), salvo indicação. Ao lado de cada uma, o que o servidor de demonstração responde.

**auth-repo.ts** (sessão de demonstração fixa, `userId = 'demo-…'`)
- `getCurrentSession(): Result<SessionInfo | null>` (`:49`): a sessão de demonstração.
- `onAuthChange(listener): Subscription | null` (`:57`): emite `INITIAL_SESSION`.
- `signIn(email, password): Result<SessionInfo>` (`:64`): aceita qualquer coisa e entra como o corredor de demonstração.
- `signUp(input: SignUpInput): Result<{ session; needsConfirmation }>` (`:75`): cria o perfil sem time, com `needsConfirmation: false`.
- `signOut(): Result<void>` (`:92`): sai da demonstração e limpa os dados dela (2.8).
- `sendPasswordReset(email, redirectTo)` (`:101`), `updatePassword(password)` (`:108`): `ok`, com o aviso "Na demonstração nenhum e-mail é enviado".
- `sessionFromCallback(cb)` (`:122`), `oauthUrl(provider, redirectTo)` (`:135`): erro `VALIDATION` "Indisponível na demonstração".

**profile-repo.ts**
- `getMyProfile(userId): Result<Profile>` (`:8`)
- `updateMyProfile(userId, patch: ProfilePatch): Result<Profile>` (`:16`)
- `chooseFaction(faction: FactionId): Result<void>` (`:25`): aplica a regra de 1 troca por temporada.
- `isUsernameAvailable(username): Result<boolean>` (`:36`)

**avatar-repo.ts:** `uploadAvatar(userId, file: AvatarFile): Result<Profile>` (`:25`). Guarda um `data:`/`blob:` URL só na memória.

**activities-repo.ts**
- `listMyActivities(opts?: { from?; to?; limit? }): Result<ActivitySummary[]>` (`:65`)
- `getActivity(id): Result<ActivitySummary | null>` (`:76`)
- `getActivityResult(id): Result<OfficialResult | null>` (`:85`)
- `getActivityPath(id, max = 2000): Result<{lat,lng}[]>` (`:92`)
- `listMyFogCells(): Result<string[]>` (`:101`)
- `listMyChestOpens(): Result<string[]>` (`:110`)
- `getMyProgress(userId): Result<ServerProgress>` (`:124`)

**chests-repo.ts:** `fetchDailyChests(near?: LatLng): Result<DailyChests>` (`:36`), a partir de `seedChests` (`src/demo/demo-data.ts:157`).

**crews-repo.ts**
- `getMyCrew(userId): Result<MyCrew | null>` (`:54`)
- `createCrew(name, tag): Result<Crew>` (`:93`)
- `joinCrew(code): Result<{crewId,name,tag}>` (`:105`)
- `leaveCrew(): Result<boolean>` (`:114`)
- `removeCrewMember(crewId, userId): Result<void>` (`:123`)

**leaderboard-repo.ts**
- `getIndividualRanking(filter?: IndividualFilter)` (`:50`), `getCrewRanking(limit = 50)` (`:62`), `getFactionRanking()` (`:70`), `getCityRanking(limit = 30)` (`:80`)
- `rankRunners(q: RankingQuery)` (`:110`), `rankCrews(q)` (`:114`), `rankFactions(q)` (`:119`)
- `getDistrictLabel(district): Result<string>` (`:130`), `getMyRecentZoneId(userId): Result<string | null>` (`:139`)

**notifications-repo.ts**
- `listNotifications(limit = 50): Result<AppNotification[]>` (`:50`)
- `markNotificationsRead(ids: string[] | null): Result<number>` (`:63`)
- `subscribeNotifications(userId, onNew, onStatus?): Result<NotificationsSubscription>` (`:78`): síncrona; emite `SUBSCRIBED` e os eventos dos roteiros (2.9).

**zones-repo.ts**
- `fetchZonesInBbox(bbox: Bbox): Result<ServerZone[]>` (`:117`), a partir de `seedZones()` (`demo-data.ts:92`).
- `fetchZoneDetail(id): Result<ZoneDetail>` (`:123`)
- `subscribeZones(onZone, onStatus?): Result<ZonesSubscription>` (`:133`): síncrona; emite as zonas alteradas pelo `finish-activity` de demonstração.

**privacy-zones-repo.ts:** `listPrivacyZones()` (`:44`), `addPrivacyZone(z: NewPrivacyZone)` (`:52`, limite 3), `removePrivacyZone(id)` (`:67`).

**track-repo.ts:** `getInvalidStretches(activityId, segments: SeqRange[]): Result<LatLngPoint[][]>` (`:35`).

**account-repo.ts:** `exportMyData(): Result<unknown>` (`:8`, JSON com `"demonstracao": true`), `deleteMyAccount(password): Result<unknown>` (`:25`, equivale a sair da demonstração).

**moderation-repo.ts** (a demonstração tem o papel `moderator` num roteiro próprio)
- `listActivitiesInReview()` (`:79`), `getReviewDetail(activityId)` (`:108`)
- `moderateActivity(activityId, decision, justification)` (`:144`)
- `listUsers(search, limit = 50)` (`:149`), `setUserStatus(userId, status)` (`:170`)

**services/safety/contacts-repo.ts:** `listContacts()` (`:23`), `addContact(name, phone)` (`:31`, limite 5), `updateContact(id, name, phone)` (`:41`), `removeContact(id)` (`:51`). **O SOS e a Escolta na demonstração não enviam nada:** mostram "Na demonstração nenhum contato é avisado".

**services/sync/transport.ts** (Edge Functions do sync; corrida simulada de ponta a ponta)
- `registerDevice(body)` → `register-device`: aceita a chave.
- `ingest(body)` → `ingest-points`: guarda os pontos e confere a sequência.
- `finish(body)` → `finish-activity`: **calcula o resultado oficial com o próprio `src/domain`** (run-engine + scoring + territory), atualiza as zonas em memória, insere a notificação "Zona conquistada" e emite pelo canal `zones`.
- `refreshSession()`: `true`.
- `fetchResult(activityId)`: o que o `finish` calculou.

**Funções de mapeamento puras:** `toProfile`, `toActivity`, `toServerZone`, `toZoneDetail`, `toNotification`, `parseDailyChests` e as `validate*` não mudam. O servidor de demonstração devolve **linhas no formato do banco**, então esse código também é exercitado.

**Contrato aberto (E9):** cada RPC ou function nova da Fase 7 entra no servidor de demonstração na **mesma** onda, com o par de teste. O teste de contrato (2.4) obriga isso. Exemplos esperados: missões, baú do dia, raid real, liga, aplausos e feed, card de compartilhamento.

### 2.6 Dados: de onde vêm
- **Mundo:** `src/demo/demo-data.ts`. Ele já é a fonte do `supabase/seed.sql` (via `supabase/scripts/gen-seed.ts:10`). Traz `seedZones()` (zonas em Goiânia, com o Parque Flamboyant sob ataque), `demoRoute()`, `seedChests()`, `DEMO_RAID`, `demoLeague()`, `demoCityWar()` e `DEMO_CREW`.
- **Restrição:** `src/demo/**` é importado pelo Deno (`gen-seed.ts`). Por isso precisa continuar **puro**, sem React, Expo ou RN. O selo visual "Demonstração" fica fora de `src/demo` (2.7).
- **Determinismo:** `seedZones()` usa `Date.now()` no início do ataque (`demo-data.ts:127`), e `seedChests(near, seed = Date.now())` também. As capturas mudam a cada execução (contagens regressivas e posições). Proposta: o servidor de demonstração recebe um **relógio fixo** (`demoClock`), usado nas capturas e nos testes.
- **Corredores, crews e rankings:** gerador determinístico novo, `src/demo/world.ts` (puro, semente fixa). Os nomes são claramente fictícios e marcados, por exemplo `Ana (demo)`.
- **Atividades anteriores:** 6 corridas geradas com `demoRoute()` e o domain. Assim Atividades, Perfil e Resumo nascem "cheios".

### 2.7 Como liga e como aparece
1. **Build** (export web, Playwright, CI, prévia Vercel):
   - `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear`;
   - com o flag ligado, o app **ignora** `EXPO_PUBLIC_SUPABASE_URL` (não há como misturar);
   - **sempre com `--clear`** (seção 1).
2. **Tempo de execução:**
   - botão **"Ver demonstração"** na tela Entrar;
   - a tela "Backend não configurado" deixa de mostrar instruções de desenvolvedor e passa a ter só o botão "Ver demonstração";
   - o app publicado no Expo Go (com servidor real) também ganha o botão. Assim o dono apresenta sem usar as contas de demonstração do Cloud (achado A-1 da `docs/REVISAO.md`: senhas públicas).
3. **Roteiros por URL, só na web e só com o flag de build:**
   - `?cenario=` com os valores `cheio` (padrão), `vazio`, `sob-ataque`, `erro`, `offline`, `lento`, `moderador`, `primeira-abertura`, mais `?relogio=2026-10-23T09:00`;
   - é por aqui que as capturas chegam a cada estado.
4. **Rótulo sempre visível:**
   - pílula fixa **"Demonstração"** no topo de toda tela, por cima da navegação, montada no `src/app/_layout.tsx` (arquivo compartilhado; o coordenador libera a onda);
   - toque na pílula → folha com "Você está numa demonstração. Nada aqui é real nem é enviado." e o botão **"Sair da demonstração"**;
   - o card de compartilhamento ganha a marca d'água "Demonstração";
   - a exportação de dados leva `"demonstracao": true`.

### 2.8 Isolamento: nunca misturar com conta real
| Risco | Garantia | Evidência de que é necessário |
|---|---|---|
| Chamada de rede real durante a demonstração | O cliente de demonstração não tem `fetch`. Teste: com o modo ligado, o `global.fetch` é trocado por uma função que **falha** o teste se for chamada, e o fluxo completo (entrar → correr → resumo) passa. | — |
| Cache de zonas da demonstração aparecer na conta real | Chaves separadas na demonstração: `nomade.zones.v1` → `nomade.demo.zones.v1`; idem perfil | `src/services/api/zones-cache.ts:11` e `profile-cache.ts:9` usam chave **fixa**, não por usuário |
| Corrida da demonstração ir para o servidor real | A fila offline usa outro banco na demonstração (`nomade-queue.demo.db` / `nomade.demo.queue.v1`). Defesa extra: o transporte real recusa `userId` que começa com `demo-` | `src/services/offline/queue.ts:6`, `queue.web.ts:8` |
| Chave HMAC do aparelho | `storageKey(userId)` já é por usuário (`src/services/signing/device-key.ts:32`); o id `demo-…` fica isolado | ok |
| Sessão real ativa ao entrar na demonstração | "Ver demonstração" só aparece deslogado. Com sessão real, o botão fica em Perfil › Conta e pede "Sair da conta para ver a demonstração?" | — |
| Sair da demonstração | `exitDemo()` limpa as três chaves `demo`, a fila de demonstração e as stores (`resetForSignOut`) | — |

### 2.9 Como o modo cobre cada fluxo
- **Corrida simulada:** já existe (`src/features/run/simulation.ts` + `demoRoute`). Com o servidor de demonstração, o sync roda de verdade: `register-device` → `ingest-points` a cada 5 s (`use-run-session.ts:254-260`) → `finish-activity`, que calcula o resultado com o domain.
- **Resumo:** o resultado oficial vem do `finish` de demonstração. As zonas conquistadas aparecem no mapa pelo canal `zones`.
- **Arena:** Raid e Liga hoje leem `DEMO_RAID`/`demoLeague` **direto na tela**, mesmo em conta real (`src/features/screens/arena-screen.tsx:13,39,62-80`). No modo demonstração esses dados vêm do servidor de demonstração. Na conta real, a tela deve usar o servidor da E9 ou ficar atrás de flag (ver 8, item E-3).
- **Notificações:**
  - o roteiro `sob-ataque` insere "Alerta de invasão" depois de 20 s (relógio da demonstração) e emite pelo canal `notifications`;
  - a central, o selo e o toque que leva à zona ficam exercitados;
  - nada de notificação do sistema na demonstração (só a central dentro do app).
- **Moderação (web):** o roteiro `moderador` dá o papel `moderator` e semeia 3 corridas em revisão e 5 contas. `moderate-activity` e `admin_set_user_status` mudam o estado em memória.
- **Primeira abertura:** o roteiro `primeira-abertura` começa sem perfil → cadastro → escolha de time → missão de boas-vindas (E7). É o FTUE completo para o teste de 5 segundos e para a apresentação.

### 2.10 Arquivos que a costura toca (para o coordenador ordenar a onda)
| Arquivo | Dono | Mudança | Conflito provável |
|---|---|---|---|
| `src/services/api/supabase.ts` | E9/compartilhado | 3 linhas em `getSupabase()` | baixo |
| `src/services/api/env.ts` | E9/compartilhado | `demo` em `AppEnv`; `isDemoActive()`; `isBackendConfigured` verdadeiro na demonstração | baixo |
| `src/services/api/zones-cache.ts` + `.web.ts`, `profile-cache.ts` + `.web.ts` | E9/compartilhado | sufixo `demo` na chave | baixo |
| `src/services/offline/queue.ts` + `.web.ts` | sem dono na seção 18 (E9 ou E10) | nome do banco/chave na demonstração | baixo |
| `src/services/sync/transport.ts` | E9/compartilhado | recusa `demo-` no transporte real | baixo |
| `src/features/auth/session-controller.ts` | E6 (UI de auth) + E10 | `enterDemo()`/`exitDemo()`; o bootstrap trata a demonstração | **médio** (E6 mexe em auth) |
| `src/features/auth/sign-in-screen.tsx`, `unavailable-screen.tsx` | E6 | botão "Ver demonstração" | médio |
| `src/app/_layout.tsx` | compartilhado (coordenador) | `<DemoBadge/>` | médio |
| **Novos (E10):** `src/services/api/demo/{client,db,postgrest,rpc,functions,auth,realtime,storage,scenarios,clock}.ts`, `src/demo/world.ts`, `src/components/demo-badge.tsx` (ou `src/demo/ui/`), testes em `src/services/api/demo/__tests__/` e `src/__tests__/demo-contract.test.ts` | E10 | — | nenhum |

**Ordem sugerida:**
1. **F3, onda 1:** os arquivos novos da E10 e a costura em `supabase.ts`/`env.ts`/caches/fila, num commit pequeno, antes da E9 criar repos novos;
2. **F4:** os botões e o selo, junto da E6.

---

## 3. Plano de capturas e o "antes"

### 3.1 Script `apps/mobile/e2e-web/capturas.cjs` (especificação para a F3)

O protótipo funcional desta especificação está em `docs/melhoria/F1/qa/capturas-antes.cjs`.

- **Entrada:** pasta do export **com `EXPO_PUBLIC_DEMO=1 --clear`**, a fase (`antes`/`depois`) e um filtro opcional de rotas.
- **Para cada rota × estado × resolução:** contexto novo do Chromium e `?cenario=<estado>&relogio=2026-10-23T09:00`. Depois espera o `testID` da tela (`tela-*`) ou 2,5 s, e salva `docs/melhoria/capturas/<fase>/<rota>__<estado>__<largura>.png`.
- **Resoluções:** 360×800, 390×844, 430×932, com `deviceScaleFactor: 1` (repositório leve: 69 capturas = 6,8 MB) e 2 só nas capturas de apresentação.
- **Determinismo:**
  - relógio fixo;
  - rede externa bloqueada (o mapa-base vira um fundo liso, como já faz `visual.spec.cjs`);
  - `reducedMotion` nas capturas "estáticas" e capturas animadas separadas.
- **Medições na mesma passada** (já funcionam no protótipo):
  - interativos com caixa < 44×44 no DOM do react-native-web;
  - interativos sem nome acessível;
  - **contagem de palavras visíveis por tela** (régua do R1);
  - FCP;
  - erros de página.
  Tudo vai para o `relatorio.json` da fase.
- **Comparação:** gera `docs/melhoria/capturas/comparacao.md` com antes/depois lado a lado e a variação de palavras, toque e rótulos.

### 3.2 Matriz rota × estado (alvo da F5)

| Rota | carregando | vazio | cheio | erro | offline | sob ataque | primeira abertura |
|---|---|---|---|---|---|---|---|
| `/` Mapa | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/corrida` (nova, contagem, correndo, pausada, entrando em zona rival, conquista) | — | — | ✓ | ✓ (GPS) | ✓ | ✓ | ✓ |
| `/resumo` (oficial, provisório, revisão, não encontrada) | ✓ | — | ✓ | ✓ | ✓ | — | ✓ |
| `/zona/[id]` (neutra, dominada, sob ataque, bloqueada) | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `/arena` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `/atividades` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `/clube`, `/clube/crew` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `/perfil`, `/perfil/editar`, `/perfil/conta`, `/perfil/time` | ✓ | — | ✓ | ✓ | ✓ | — | — |
| `/notificacoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `/contatos-seguranca`, `/zonas-privacidade` | ✓ | ✓ | ✓ | ✓ (limite) | ✓ | — | — |
| `/entrar`, `/cadastro`, `/recuperar-senha`, `/nova-senha` | — | ✓ | ✓ (erros de validação) | ✓ | ✓ | — | ✓ |
| `/onboarding` (cada passo) | — | — | ✓ | ✓ | — | — | ✓ |
| `/indisponivel`, `/termos`, `/privacidade` | — | ✓ | — | — | — | — | — |
| `/moderacao`, `/moderacao/[id]`, `/moderacao/contas` (1280 px) | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Rotas novas da Fase 7 (escolha de time, missões, baú, chefão, compartilhar, feed) | entram na matriz quando a E6/E7/E8 criarem | | | | | | |

### 3.3 O "antes" já capturado (`docs/melhoria/capturas/antes/`)
Gerado **sem servidor real**, por dois caminhos:
1. **Export sem `.env`:** o app cai em `/indisponivel`, nas 3 resoluções e com "Reduzir movimento".
2. **Export apontando para uma porta onde nada escuta,** com o Playwright **interceptando** cada chamada do supabase-js (Auth, PostgREST, RPC, functions) e respondendo com dados vazios. O perfil se chama `demonstracao` e a conta, `demonstracao@exemplo.invalid`, identificados como demonstração.
   - É a mesma lista de chamadas do contrato 2.5, o que prova a costura: o app inteiro navegou sem servidor.
   - O código de produção não foi alterado.

**72 arquivos (69 PNG + `relatorio.json` + 2 capturas do estado de erro):**
- `/indisponivel` (3 + reduzir movimento);
- `/entrar`, `/cadastro`, `/recuperar-senha` (3 cada);
- `/onboarding` (3);
- erro do perfil (em branco aos 2,8 s, e a tela de erro com 503 e offline aos 8 s);
- as 17 rotas logadas no estado **vazio**, nas 3 resoluções: Mapa, Arena, Atividades, Clube, Crew, Perfil, Editar, Conta, Meu time, Notificações, Contatos, Zonas de privacidade, Nova corrida, Resumo (não encontrado), Zona (sem dados), Termos, Privacidade;
- Mapa com "Reduzir movimento".

**Estados "cheios" do antes:** só o modo demonstração vai produzir esses estados. Até lá valem as capturas que já existem em `docs/ui-audit/`:
- `d59-app-neon-390.png` (12 telas neon com dados, inclusive o mapa com zonas);
- `d58-*` (entrar/cadastro neon);
- `t62-*`, `t63-*`, `t64-*` (onboarding, mapa, zona, corrida, resumo, **ainda no tema claro**, antes da D-59);
- `t65-depois-*` (4 resoluções).

---

## 4. Teste de 5 segundos

### 4.1 Protocolo com pessoas (F5)
- **Quem:** 5 a 8 pessoas que nunca viram o app, metade corredores.
- **Como:**
  - celular de verdade ou o export web em 390×844;
  - tela mostrada por **5 s** e escondida;
  - duas perguntas, sempre iguais: **"O que esta tela mostra?"** e **"O que você faria agora?"**.
- **Nota por pergunta:** 1 (acertou o essencial), 0,5 (parcial ou com hesitação), 0 (errou ou não sabe). A nota da tela é a média das duas.
- **Meta (seção 3 do prompt):**
  - ≥ 80% das respostas certas nas telas principais (Mapa, Corrida, Resumo, Arena, Atividades, Clube, Perfil, Escolha de time);
  - nenhuma tela principal abaixo de 0,75.
- **Registro:** planilha com tela, pessoa, resposta literal e nota, em `docs/melhoria/F5/5-segundos.md`.
- **Gabarito:** escrito **antes** do teste pela E6 (o que a tela deve comunicar e qual é a ação primária).

### 4.2 Versão automática (avaliação heurística, não substitui pessoas)
- **Roteiro:**
  - o avaliador recebe só a imagem, sem contexto do projeto, e responde às duas perguntas em até 2 frases;
  - depois compara com o gabarito da E6 e dá a nota de 0 / 0,5 / 1 a cada pergunta;
  - registra **por que** errou (falta de herói visual, jargão, duas ações primárias, tela vazia).
- **Na F5:** o roteiro roda em toda captura "depois", pelo mesmo avaliador e com o mesmo gabarito.
- **Notas "antes":** o avaliador fui eu, olhando cada captura como alguém que nunca viu o app. O gabarito foi o que o prompt mestre espera de cada tela.

### 4.3 Notas "antes" (heurística)
| # | Tela (captura) | "O que mostra?" (resposta como novato) | Nota | "O que faria?" | Nota | Tela |
|---|---|---|---|---|---|---|
| 1 | Sem servidor (`inicio__sem-servidor__390`) | "Um erro técnico, o app não funciona" | 0,5 | "Nada, não entendo as instruções" | 0 | **0,25** |
| 2 | Entrar (`entrar__deslogado__390`) | "Login do app de corrida NOMADE RUN" | 1 | "Digitar e-mail e senha ou criar conta" | 1 | 1 |
| 3 | Cadastro (`cadastro__deslogado__390`) | "Formulário de cadastro" | 1 | "Preencher" (5 campos, 92 palavras, termos fora da dobra) | 1 | 1 |
| 4 | Recuperar senha | "Pedir link de senha" | 1 | "Digitar o e-mail e enviar" | 1 | 1 |
| 5 | Onboarding 1 (`onboarding__sem-time__390`) | "Algo sobre correr e times, muito texto" | 0,5 | "Escolher meu time" | 1 | 0,75 |
| 6 | Escolha de time (`ui-audit/t62-onboarding-360`, tema antigo) | "Escolher um de 4 times" | 1 | "Tocar num time e continuar" (sem saber a diferença entre eles) | 1 | 1 |
| 7 | Mapa cheio (`ui-audit/d59-app-neon-390`, 2º quadro) | "Mapa com manchas coloridas; não sei o que é meu" | 0,5 | "Correr" (botão enorme) | 1 | 0,75 |
| 8 | Mapa vazio (`inicio__vazio__390`) | "Tela preta com botões" | 0 | "Correr" | 1 | **0,5** |
| 9 | Arena (`arena__vazio__390`) | "Um número 2.312 km e uma lista de modos" | 0,5 | "Não sei; ler a lista?" (sem ação) | 0 | **0,25** |
| 10 | Atividades vazia | "Histórico vazio" | 1 | "Correr" | 1 | 1 |
| 11 | Clube (`clube__vazio__390`) | "Crew, encontro e ranking ao mesmo tempo" | 0,5 | "Confirmar presença? Criar crew?" (2 botões fortes) | 0,5 | **0,5** |
| 12 | Perfil (`perfil__vazio__390`) | "Meu perfil e nível" | 1 | "Nada claro" | 0 | **0,5** |
| 13 | Nova corrida (`corrida__vazio__390`) | "Configurar a corrida" | 1 | "Começar", mas **cai em Simulação** sem perceber | 0,5 | 0,75 |
| 14 | Corrida em andamento (`ui-audit/t64-corrida-375`, tema antigo) | "Tempo, distância e ritmo" | 1 | "Pausar/encerrar; o que é '+2 RP'?" | 0,5 | 0,75 |
| 15 | Resumo (`ui-audit/t64-resumo-fim-375`) | "Lista de bairros com +39, +34… de quê?" | 0,5 | "Concluir ou compartilhar" | 1 | 0,75 |
| 16 | Zona sob ataque (`ui-audit/t63-zona-375`) | "Zona atacada pelos Coyotes" | 1 | "Defender esta zona" | 1 | 1 |
| 17 | Notificações vazia | "Lista vazia" | 1 | "Voltar" (sem botão de voltar visível na web) | 0,5 | 0,75 |
| 18 | Crew (`clube_crew__vazio__390`) | "Entrar ou criar crew" | 1 | "Qual dos dois botões laranja?" | 0,5 | 0,75 |
| 19 | Meu time | "Meu time e outros times" | 1 | "Trocar de time" | 1 | 1 |
| 20 | Conta | "Configurações da conta" | 1 | "Exportar? Sair?" (tela de ajustes) | 0,5 | 0,75 |
| 21 | Editar perfil | "Editar meus dados" | 1 | "Salvar" | 1 | 1 |
| 22 | Contatos de segurança | "Contatos para SOS" | 1 | "Adicionar contato" | 1 | 1 |
| 23 | Zonas de privacidade | "Endereços escondidos; um quadro cinza vazio" | 0,5 | "Adicionar endereço" | 1 | 0,75 |
| 24 | Erro do perfil (`inicio__erro-perfil__390` aos 2,8 s / `-offline-20s` aos 8 s) | "Tela branca" e depois "Não carregou" | 0,5 | "Esperar?" e depois "Tentar de novo" | 0,5 | **0,5** |
| 25 | Resumo não encontrado | "Corrida não encontrada" | 1 | "Ver atividades" | 1 | 1 |

**Resultado "antes" (heurístico):**
- média geral **0,77**;
- telas com nota 1: **10/25 (40%)**;
- **telas de jogo** (Mapa, Arena, Clube, Perfil, Nova corrida, Corrida, Resumo): média **0,61**, **nenhuma** com nota 1.

Os formulários passam; o que é jogo não passa. Isso confirma o diagnóstico do dono ("muito texto, abas sem imagem") com números:
- **palavras visíveis por tela** (na largura de 390, primeira dobra mais o resto da página): Arena 227, Perfil 177, Clube 143, Editar 104, Cadastro 92, Nova corrida 68, Atividades 65, Crew 61;
- Termos e Privacidade (234 e 305 palavras) são texto legal e ficam fora da meta.

**Falha principal por tela:**
- Arena e Perfil: sem ação primária;
- Clube e Crew: duas ações primárias (P2);
- Mapa: sem legenda "isto é seu";
- Corrida e Resumo: jargão "RP" e números sem unidade (P3/P12);
- Sem servidor: tela de desenvolvedor.

---

## 5. Auditoria de acessibilidade

### 5.1 Contraste (script `docs/melhoria/F1/qa/contraste.cjs`)
O script transpila `src/theme/tokens.ts` e `neon.ts` com o TypeScript do app (sem copiar valores à mão) e calcula a razão WCAG de **63 pares** de cor usados de verdade. O resultado completo está em `docs/melhoria/F1/qa/contraste-resultado.md` e o JSON sai com `--json`. Com `--strict`, o script vira verificação de CI.

**10 pares abaixo do mínimo (8 no tema escuro em uso, 2 no tema claro sem uso):**

| Par | Razão | Mínimo | Onde | Correção sugerida |
|---|---|---|---|---|
| Branco `#FFFFFF` sobre o laranja `#FF6A13` (botão primário, 16 px negrito) | **2,87:1** | 4,5:1 | `src/components/button.tsx:31,71`; `tokens.ts:52-53` | **Texto escuro `#070708` sobre o laranja: 7,02:1** (P8 do prompt; resolve M-2 da REVISAO). O laranja continua igual |
| Branco sobre o laranja, botão `lg` (título de 20 px negrito; é texto grande, mínimo 3:1) | **2,87:1** | 3:1 | `button.tsx:71` (variant `title` = 20 px) | o mesmo |
| Branco sobre `danger` `#FF4D45` (botão de perigo) | **3,28:1** | 4,5:1 | `button.tsx:34`; `tokens.ts` `dark.danger` | texto `#070708` (6,1:1) ou fundo `#C8261F` |
| Borda `line` `#24252B` sobre o fundo `#070708` (campo, botão secundário, cartão) | **1,32:1** | 3:1 (1.4.11) | `button.tsx:60`; `tokens.ts:51`; `neon.ts:12` | `#5B5C60` para bordas de **controles** (campos e botão secundário); cartões podem manter a borda sutil. Nas capturas `clube_crew__vazio__390` e `cadastro__deslogado__390`, os campos quase somem no fundo |
| Borda `line` sobre a superfície `#111215` | **1,23:1** | 3:1 | campos sobre cartões | `#616266` |
| Azul dos Striders `#0072B2` usado como **texto** sobre o fundo | **3,88:1** | 4,5:1 | uso de `factions.*.color` em texto | para texto, usar `neonTeam.striders` `#2FA8FF` (7,83:1); `#0072B2` só em preenchimento ou forma (passa 3:1) |
| Vermelho dos Owls `#D7263D` como texto | **4,06:1** | 4,5:1 | idem | `neonTeam.owls` `#FF2D55` (5,52:1) |
| Branco sobre o verde dos Volt `#009E73` | **3,42:1** | 4,5:1 (texto pequeno) | `onColor` dos Volt; `edit-profile-screen.tsx:116` (iniciais em 24 px: passa como texto grande) | texto `#070708` no selo dos Volt, como os Coyotes já fazem |
| (tema claro sem uso) branco sobre `#FF5A1F`; `ink3` sobre branco | 3,12:1; 2,44:1 | 4,5:1 | `tokens.ts:36`; `palette.ink3` | registrar como dívida ou apagar o tema claro |

**O que passa:**
- texto principal, secundário, de destaque e de erro em todos os fundos (de 5,24:1 a 18,06:1);
- todas as cores neon dos times;
- os selos dos times sobre o fundo (forma, 3:1).

A faixa da corrida já calcula o fundo legível (`src/features/run/banner-color.ts`, QA-19).

### 5.2 Alvos de toque (medidos no DOM do react-native-web, 390 px)
O DOM **não** soma o `hitSlop`; por isso a tabela traz a caixa visível e o `hitSlop` do código.

| Elemento | Caixa | `hitSlop` | Resultado |
|---|---|---|---|
| Links "Termos de Uso" e "Política de Privacidade" no cadastro | **117×20 e 178×20** | nenhum (é `Text onPress`, `src/features/auth/sign-up-screen.tsx:185`) | **Falha:** 20 px de altura |
| `Switch` de Escolta, Alerta de parada, 4 notificações e Corrida Segura | **40×20** (web) | não aceita | **Falha na web.** No nativo o `Switch` tem ~51×31; envolver numa linha inteira tocável (`profile-screen.tsx:185`, `edit-profile-screen.tsx:184`, `run-screen.tsx:224`) |
| Chips das camadas do mapa | 105–121 × **36** | ? (`map-layer-chips.tsx:50`, altura fixa 36) | limite; conferir o `hitSlop` |
| Chips do ranking no Clube (9) | 69–102 × **36** | `slop: 8` (`chip-row.tsx:19`) | passa com o slop (52 px) |
| Chips de período em Atividades (4) | 73–101 × **40** | `slop: 4` (`chip-row.tsx:20`) | passa com o slop (48 px) |
| `Button` (`md` 48, `lg` 60) e `IconButton` (48) | ≥ 48 | 8 | passa |

### 5.3 Rótulos e estados para leitor de tela
- **Nenhum interativo sem nome acessível** nas 24 rotas medidas (`unlabeled = 0` no `relatorio.json`). O `src/__tests__/testids.test.ts` já obriga `testID` e rótulo.
- **Estado "desativado" não é anunciado:** o `Button` recebe `disabled`, mas não repassa `accessibilityState={{ disabled }}` (`src/components/button.tsx:39-45`). No leitor de tela, o "Entrar na crew" ocupado continua soando como um botão normal. Só 10 ocorrências de `accessibilityState` no app inteiro (`grep`).
- **Chips selecionados:** conferir se o `ChipRow` anuncia `selected` (tarefa T7.E10.8).

### 5.4 Fonte grande
- **Nenhum** `maxFontSizeMultiplier` ou `allowFontScaling` no app (`grep`, 0 ocorrências).
- O `Text` usa `lineHeight` fixo em pontos para o `hero` (96/96) e o `metric` (40/42) (`src/components/text.tsx:10-11`). Com fonte em 200%, o tempo da corrida (96 pt) passa de 190 pt e estoura a largura de 360 px.
- Os chips têm **altura fixa** (`chip-row.tsx:19-20`, 36 e 40; `map-layer-chips.tsx:50`, 36): com a fonte maior, o rótulo é cortado.
- **Proposta:**
  - `maxFontSizeMultiplier` de 1,3 nos números de display;
  - `minHeight` em vez de `height` nos chips;
  - teste estático que proíbe `height` fixa em contêiner de texto;
  - captura na F5 com a fonte do sistema em 130% e 200% no Android (ou zoom de texto na web).

### 5.5 Reduzir movimento
- 16 arquivos usam `useReducedMotion` e existe o teste `src/__tests__/reduced-motion.test.ts`.
- As capturas com `reducedMotion: 'reduce'` (`inicio__sem-servidor-reduzir-movimento__390`, `inicio__vazio-reduzir-movimento__390`) renderizam iguais às normais depois de 2,5 s, sem erro.
- **Lacuna:** o `TickerText` da corrida monta a animação de máscara com `reduced: false` fixo (`src/features/run/ticker-text.tsx:48`). Confirmar se o pai desliga com `animate`; o tempo da corrida usa `animate={mode === 'gps'}` (`run-screen.tsx:377`), sem considerar a preferência do sistema.

---

## 6. Auditoria de desempenho

| # | Problema | Evidência | Custo estimado | Correção |
|---|---|---|---|---|
| D1 | **O mapa da corrida recalcula as regiões a cada ponto de GPS.** `mapZonesNear(zones, s.position, 1400)` depende de `s.position` e devolve um array novo a cada ponto → o `TerritoryMap` recalcula `mapLayers` (`territoryRegions` + `chaikin`/`relax` + `smoothCells`) | `src/features/screens/run-screen.tsx:244`; `src/components/territory-map.tsx:46`; `territory-map.layers.ts:22-37` | Na **simulação** são 10 pontos/s (`SIM_TIME_SCALE = 10`, `use-run-session.ts:43,192`): 10 reconstruções das regiões e do mapa nativo por segundo na thread de JS. No GPS real, 1/s | Memoizar por **zona atual** (ou a cada 100 m), não por posição; separar o marcador do corredor das regiões |
| D2 | `mapZonesNear` chama `cellCenter(z.id)` (h3) para **todas** as zonas a cada chamada; existe um `centerCache` logo abaixo que não é usado ali | `src/features/map-data.ts:21`, contra o `centerOf` em `:27-33` | O(zonas) chamadas ao h3 por ponto | usar `centerOf` |
| D3 | **Barras animam `width`/`height` (layout), não `transform`** (P9) | `src/features/screens/game-motion.tsx:39,59,74`; `src/components/territory-bar.tsx:44` (transição de `width`), usado na corrida (`run-screen.tsx:400`) | recalcula o layout a cada quadro; no Android médio dá queda de quadros na Arena e no Clube | `scaleX` com `transformOrigin: 'left'` |
| D4 | Tela da corrida monolítica: 663 linhas, re-renderizada pelo relógio (`setElapsed` a cada 1 s, ou a cada 100 ms na simulação), `useNow(5000)` e cada ponto | `run-screen.tsx` (663 linhas, `wc -l`); `use-run-session.ts:192-201,249` | com o React Compiler o custo cai, mas o mapa (D1) e o `TickerText` remontam | separar `RunMetrics` (relógio) de `RunMap` (zonas) |
| D5 | Listas sem virtualização: **nenhuma** `FlatList`/`FlashList` no app; tudo é `ScrollView` + `.map` | `grep FlatList` → só um comentário em `fade-up.tsx:54`; `ScrollView` em 11 arquivos | hoje as listas são curtas (ranking com `limit` 50, notificações 50, atividades até 200: `activities-repo.ts:67`). Atividades com 200 itens e o futuro feed (E8) vão travar | `FlatList` em Atividades, Notificações, ranking e feed |
| D6 | `CountUp` anima por `requestAnimationFrame` + `setState` na thread de JS | `src/components/motion/count-up.tsx:69-82` | aceitável no resumo; **proibido** na corrida (P9). Hoje não é usado na corrida (`grep`) | regra no checklist da E5 |
| D7 | Fonte `MaterialSymbols` de 970 KB carregada inteira na web para 43 ícones | `assets/.../MaterialSymbols_400Regular…ttf` = 970.528 B; `src/components/icon.tsx:1-47` | +970 KB no primeiro carregamento da prévia web | subconjunto da fonte ou SVGs na web |
| D8 | Bundle web: `entry` de 3,46 MB (889 KB gzip). Painel de moderação, `h3-js` (534 KiB) e `@supabase/*` (803 KiB) vão no bundle principal | seção 1 | ~0,9 MB gzip antes da primeira tela | `React.lazy` para `/moderacao/*`; o h3 é necessário (domain) |
| D9 | **8 s de tela branca** quando o servidor está fora ou sem rede: o supabase-js tenta de novo em 1, 2 e 4 s antes do erro, e a web não tem fundo escuro nem splash | medido: `docs/melhoria/F1/qa/erro-perfil.cjs` → tentativas aos 0,5/1,5/3,5/7,5 s; texto só aos **7,9 s**; captura `inicio__erro-perfil__390.png` (branca aos 2,8 s). Não há `src/app/+html.tsx`, e o splash nativo é `#FF5A1F` (laranja antigo, `app.json:35`) | primeira impressão ruim, sem feedback (P11) | esqueleto com "Conectando…" depois de 1 s; `+html.tsx` com fundo `#070708`; splash com o laranja neon |
| D10 | Animações em loop infinito no fundo de Entrar/Cadastro (`withRepeat`, -1) | `src/features/auth/neon-backdrop.tsx:43-44` | gasto contínuo de GPU/bateria enquanto a pessoa digita; já respeita "Reduzir movimento" | pausar quando o teclado abre ou depois de 2 ciclos |

---

## 7. CI no GitHub (X5)

O arquivo proposto é `docs/melhoria/ci/ci.yml` e a explicação está em `docs/melhoria/ci/README.md`. O YAML foi validado com `python3 yaml.safe_load` (3 jobs).

- **`app`:**
  - Node 22 com cache do npm por `apps/mobile/package-lock.json`;
  - `npm ci` → `typecheck` → `eslint src --max-warnings 0` → `jest --ci`;
  - cobertura do domain com `--coverageThreshold='{"./src/domain/":{…90}}'`. Testado aqui: passa com 90 e **falha** com 99 em funções, com a mensagem certa.
- **`web`:**
  - `expo export -p web --clear` (por causa do cache, seção 1);
  - orçamento do bundle: `entry` ≤ 980.000 B gzip.
- **`functions`:** `denoland/setup-deno@v2` (v2.9.x) → `deno test` → `deno check` das functions → `domain-copy.mjs --check`.
- **Configuração geral:** `permissions: contents: read`; `concurrency` cancela a execução antiga da mesma branch.

**Risco da permissão `workflow`:**
- o push de `.github/workflows/*` é **recusado** se o token não tiver esse escopo, e a recusa derruba o push inteiro;
- plano A: commit isolado só com o `ci.yml`, testado antes;
- plano B: o arquivo fica em `docs/melhoria/ci/` e o dono cria pelo site do GitHub (1 minuto).

---

## 8. Checklist de ética (seção 5.4) para revisar cada entrega

Responder **sim/não com evidência** (arquivo:linha ou captura). Qualquer "não" é achado **Alto**.

**Notificações**
- [ ] N-1. Nenhuma notificação de engajamento entre 22h e 7h (horário local)? Existe teste com relógio às 22h01 e às 6h59?
- [ ] N-2. No máximo **1** notificação de engajamento por dia? Alerta de ataque real e de segurança têm limite próprio documentado?
- [ ] N-3. Nenhum texto com culpa ("você decepcionou", "seu time precisa de você", "não desista")? Lista de palavras proibidas num teste estático.
- [ ] N-4. Cada tipo pode ser desligado no perfil, e a preferência é respeitada (`prefAllows`, `src/features/notifications/local-alert.ts:8`)?
- *Linha de base:* hoje só há alerta com o app aberto (`local-alert.ts:22-38`), **sem** horário de silêncio nem limite diário. A E7 precisa disso antes de qualquer push.

**Sequência e descanso**
- [ ] S-1. A sequência é **semanal** (2 corridas valem a semana) e há congelamento mensal? (Hoje: `activities-screen.tsx:84` e a captura `atividades__vazio__390`, ok.)
- [ ] S-2. Nenhuma perda, penalidade ou mensagem negativa por um dia sem correr?
- [ ] S-3. Nenhum incentivo a correr lesionado, doente ou no calor extremo?

**Recompensas**
- [ ] R-1. Nenhuma recompensa paga, loot box paga ou "pagar para ganhar"?
- [ ] R-2. As chances de raridade dos baús estão **visíveis** na tela do baú?
- [ ] R-3. Nenhum contador, escassez ou prazo **falso**? Todo número mostrado vem do servidor ou é rotulado "Demonstração".
  - *Achado na linha de base:* em conta real, o Clube mostra "Sábado, 6h30 · **17 confirmados**" e um botão laranja **"Confirmar presença"** que não grava nada (`src/features/screens/club-screen.tsx:203-221`, captura `clube__vazio__390`). A Arena mostra um Raid com "2.312 km" (`arena-screen.tsx:62-80`).
  - Os dois têm a legenda pequena "de demonstração", mas o botão é a ação primária da tela. É contador falso numa conta real.
- [ ] R-4. Toda promessa de recompensa existe no código?
  - *Achado:* o Perfil diz "Cada nível libera uma cor de rastro ou moldura" (`src/features/screens/profile-screen.tsx:66`), e não há nenhuma implementação disso (`grep "rastro|moldura"` só acha essa linha).

**Segurança e privacidade**
- [ ] P-1. Card de compartilhamento e feed cortam o trecho dentro das zonas de privacidade (nunca mostram a casa)? Teste com uma rota que começa dentro de uma zona.
- [ ] P-2. A posição ao vivo vai só para os contatos da Corrida Segura?
- [ ] P-3. SOS a no máximo 1 toque na tela da corrida, em todos os estados novos (celebração, pop-up de baú, chefão)?
- [ ] P-4. Exportar e excluir conta continuam funcionando com as tabelas novas (a E9 inclui as tabelas novas no `account-export`/`account-delete`)?

**Transparência**
- [ ] T-1. Toda regra nova tem explicação visual (folha "?" com 3 cartões)?
- [ ] T-2. Dados de demonstração estão **sempre** rotulados, inclusive no card compartilhado?

---

## 9. Mapa de riscos de regressão

**O que cada suíte protege hoje** (contagem de arquivos de teste por pasta, `find … -name '*.test.ts*'`):

| Pasta | Testes | Protege | Não protege |
|---|---|---|---|
| `src/domain` | 9 (104 casos, cobertura 99,6%, propriedades em `properties.test.ts`) | regras de território, pontuação, anti-fraude, temporada | a **regra nova** da E3 (vai precisar de testes de propriedade novos) |
| `src/services/api` | 12 | mapeamento das linhas, erros, contrato das functions | repos novos da E9 |
| `src/features/run` | 5 | controlador da corrida, simulação, fila | desempenho (D1) |
| `src/features/auth` | 4 | guarda de rotas, validação, links | botão de demonstração |
| `src/services/sync`, `offline`, `signing` | 3 + 2 + 2 | fila offline, HMAC, sync | — |
| `src/__tests__` | 2 (`testids`, `reduced-motion`) | `testID`/rótulo em todo interativo; "Reduzir movimento" | contraste, toque ≥ 44, fonte grande |
| `src/features/screens` | **1** (`game-motion`) | matemática das barras | **nenhuma tela é renderizada em teste** |
| `components` | 3 + 1 | celebração, parallax | — |
| Deno (`supabase/functions/tests`) | 9 arquivos, 58 casos | validação, pontuação, HMAC, ponte do domain | — |
| pgTAP (285) | só com banco local | RLS, RPCs | **não roda aqui nem na CI proposta** (sem Docker) |
| e2e web (`apps/mobile/e2e-web`) e Maestro (`.maestro/`, 5 fluxos) | precisam de Supabase local | fluxo da demonstração e de autenticação | **não rodam sem servidor** (o modo demonstração resolve) |

**Sem teste nenhum (lacunas):**
- **RF-017 compartilhar:** `src/lib/share-json.ts` exporta JSON; não há card de imagem nem teste.
- **Telas:** não há teste de renderização (React Native Testing Library não está instalada). Os fluxos visuais dependem de Maestro/Playwright com servidor.
- Notificações: horário de silêncio e limite diário não existem.
- **Raid/Liga:** só dados de demonstração na tela.
- Fonte grande e contraste não têm verificação automática.

**Onde a reformulação mais pode quebrar (e a proteção proposta):**
1. **Regra nova de território (E3)**, que muda o domain e o servidor ao mesmo tempo.
   - Proteções: testes de propriedade, `domain_bridge.test.ts` e a compatibilidade X7 (app novo com servidor antigo).
   - Teste de contrato de versão: o app lê `rules_version` e cai na regra antiga se o servidor não tiver a nova.
2. **`src/app/_layout.tsx` e o guarda de rotas** (escolha de time na primeira abertura, selo de demonstração e rotas novas).
   - O teste do `route-guard` cobre a função pura; falta um teste do fluxo completo no modo demonstração (Playwright).
3. **Tela da corrida** (pintura ao vivo, pop-ups, chefão).
   - Riscos: desempenho (D1/D4) e SOS escondido (P-3).
   - Proteção: medição de quadros na simulação e verificação de que o `testID` do SOS está visível em cada captura da corrida.
4. **Repos e functions novos (E9).** Proteções: teste de contrato da demonstração (2.4) e `deno check` na CI.
5. **Tokens (`tokens.ts`/`neon.ts`)** mexidos pela E6.
   - O `contraste.cjs --strict` na CI impede piora. Hoje falharia nos 8 pares; liga-se quando a E6 corrigir.
6. **Bundle web** (arte em SVG, Lottie/Skia na web). Proteção: orçamento na CI.

---

## 10. As 10 piores falhas (acessibilidade, desempenho, usabilidade)

| # | Gravidade | Falha | Evidência | Dono sugerido |
|---|---|---|---|---|
| 1 | **Alta** | **Nova corrida começa em "Simulação" por padrão:** quem toca Correr → Começar corre uma volta falsa no Flamboyant, não a própria corrida | `src/features/screens/run-screen.tsx:61` (`useState<RunMode>('simulacao')`); captura `corrida__vazio__390` | E6 |
| 2 | **Alta** | **Texto branco no botão laranja: 2,87:1** (M-2 da REVISAO, ainda aberto); botão de perigo 3,28:1 | `src/components/button.tsx:31,34`; `tokens.ts:52-53`; `contraste-resultado.md` | E6 |
| 3 | **Alta** | **Sem servidor, o app mostra instruções de desenvolvedor** (`.env`, `npx supabase status`) e nenhuma ação | `src/features/auth/unavailable-screen.tsx:26-43`; captura `inicio__sem-servidor__390` (nota 0,25 no teste de 5 s) | E10 (modo demonstração) + E6 |
| 4 | **Alta** | **Contador e ação falsos em conta real:** "17 confirmados" + "Confirmar presença"; Raid "2.312 km" | `src/features/screens/club-screen.tsx:203-221`; `arena-screen.tsx:62-80`; capturas `clube__vazio__390`, `arena__vazio__390` | E7/E9 (dados reais) + E6 |
| 5 | **Alta** | **8 s de tela branca** sem feedback quando o servidor cai ou não há rede | `docs/melhoria/F1/qa/erro-perfil.cjs` (texto aos 7,9 s); captura `inicio__erro-perfil__390`; sem `src/app/+html.tsx` | E6 + E9 (tentativas do cliente) |
| 6 | Média | **O mapa da corrida recalcula as regiões a cada ponto** (10/s na simulação) | `run-screen.tsx:244`; `territory-map.tsx:46`; `use-run-session.ts:43` | E6/E3 |
| 7 | Média | **Bordas de campos e do botão secundário invisíveis:** 1,32:1 | `tokens.ts:51`; `neon.ts:12`; `button.tsx:60`; captura `clube_crew__vazio__390` | E6 |
| 8 | Média | **Telas de jogo sem ação primária ou com duas** (Arena e Perfil sem nenhuma; Clube e Crew com 2 botões laranja) e com muito texto (Arena 227 palavras, Perfil 177, Clube 143) | `relatorio.json` (`words`); `crew-screen.tsx:198,216`; teste de 5 s, telas de jogo com média 0,61 | E6 |
| 9 | Média | **Toque e leitor de tela:** links de Termos/Privacidade com 20 px de altura; `Switch` de 40×20 na web; `Button` desativado sem `accessibilityState` | `sign-up-screen.tsx:185`; `profile-screen.tsx:185`; `button.tsx:39-45`; `relatorio.json` (`small`) | E6 |
| 10 | Média | **Fonte grande quebra o layout:** nenhum `maxFontSizeMultiplier`; `lineHeight` fixo nos números de 96/40 pt; chips com altura fixa | `src/components/text.tsx:10-11`; `chip-row.tsx:19-20`; `map-layer-chips.tsx:50` | E6 |

**Logo abaixo da lista:**
- animação de `width` (D3, `game-motion.tsx:39`);
- jargão "RP" e "células reveladas" (`run-screen.tsx:391,402`; `profile-screen.tsx:76`);
- promessa sem implementação "cor de rastro ou moldura" (`profile-screen.tsx:66`);
- fonte de ícones de 970 KB na web (D7);
- "0 semanas seguidas… mais 2 corridas **mantém** a sequência" com sequência zero (`activities-screen.tsx:84`);
- vazamento de handle no Jest.

---

## 11. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| DC-1 | Onde entra o modo demonstração? | A) cliente de demonstração em `getSupabase()`; B) `if` em cada repo; C) alias do Metro | **A**, com o teste de contrato estático (2.4) |
| DC-2 | Como liga? | só por build (`EXPO_PUBLIC_DEMO=1`); só pelo botão; os dois | **Os dois.** O build serve a web, as capturas, a CI e a Vercel; o botão "Ver demonstração" serve o Expo Go do dono. As contas de demonstração do Cloud (achado A-1) deixam de ser necessárias |
| DC-3 | Raid, Liga e Encontro de demonstração em **conta real** | manter com a legenda; esconder até a E9 ter o real; mostrar atrás de flag "Prévia" | **Esconder ou trocar por estado vazio ilustrado** em conta real até haver dado do servidor. Mostrar cheio só no modo demonstração (regra R-3 do checklist) |
| DC-4 | Quando ativar a CI? | já na F3 (onda 1); no fim da F3; só na F6 | **Onda 1 da F3**, em commit isolado (risco da permissão `workflow`). Com a CI verde, as ondas seguintes têm rede de segurança |
| DC-5 | O `contraste.cjs --strict` entra na CI? | agora (falha); depois da correção da E6 | **Depois** que a E6 trocar o texto do botão e as bordas (F4). Até lá roda sem `--strict` e publica a tabela |
| DC-6 | Ordem dos arquivos compartilhados da costura (`supabase.ts`, `env.ts`, caches, fila, `session-controller.ts`, `_layout.tsx`) | — | **F3, onda 1:** E10 sozinha em `supabase.ts`, `env.ts`, caches e fila, antes da E9 criar repos. **F4:** `session-controller.ts`, `sign-in-screen.tsx` e `_layout.tsx` junto da E6, numa janela combinada |
| DC-7 | Simulação como padrão da Nova corrida (falha 1) | GPS como padrão e simulação escondida; simulação só no modo demonstração | **GPS real como padrão** na conta real; **Simulação** só no modo demonstração (ou num menu "Testar sem sair de casa") |
| DC-8 | Teste de renderização das telas | instalar `@testing-library/react-native`; ficar só com Playwright no modo demonstração | **Playwright no modo demonstração** (zero dependência nova; cobre web e capturas). Reavaliar a biblioteca na F5 se faltar cobertura de lógica de tela |

---

## 12. Tarefas propostas para F3/F4/F5

| ID | Título | Dono | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| **T7.E10.1** | Servidor de demonstração em memória e costura em `getSupabase()` | E10 | `src/services/api/demo/**` (novo), `src/demo/world.ts`; costura em `supabase.ts`, `env.ts`, caches e fila (liberação do coordenador) | DC-1, DC-6 | Cada função de 2.5 responde `ok` no modo demonstração; `finish-activity` usa o domain; teste "sem rede" (fetch proibido) passa no fluxo entrar → correr → resumo; jest e tsc verdes |
| **T7.E10.2** | Teste de contrato da demonstração | E10 | `src/__tests__/demo-contract.test.ts` | T7.E10.1 | Falha ao acrescentar um `rpc('nova')` sem tratador; lista no erro o nome que falta |
| **T7.E10.3** | `apps/mobile/e2e-web/capturas.cjs` com a matriz 3.2 | E10 | `apps/mobile/e2e-web/**`, `docs/melhoria/capturas/**` | T7.E10.1, T7.E10.5 | Gera todas as rotas × estados × 3 resoluções com `?cenario=`; `relatorio.json` com palavras, toque, rótulos e FCP; roda em < 10 min |
| **T7.E10.4** | CI no GitHub | E10 (coordenador faz o push) | `.github/workflows/ci.yml` | DC-4 | 3 jobs verdes no GitHub em push e PR; falha de propósito (teste quebrado) deixa vermelho |
| **T7.E10.5** | Ligar a demonstração: `EXPO_PUBLIC_DEMO`, `enterDemo`/`exitDemo`, selo "Demonstração", roteiros por URL e relógio fixo | E10 + E6 (botões) + coordenador (`_layout.tsx`) | `src/demo/**`, `src/components/demo-badge.tsx`, `session-controller.ts`, `sign-in-screen.tsx`, `unavailable-screen.tsx`, `_layout.tsx` | T7.E10.1 | Selo visível em 100% das capturas da demonstração; "Sair da demonstração" limpa as chaves `demo` (teste); a tela "Backend não configurado" não tem mais instruções de desenvolvedor |
| **T7.E10.6** | Fluxo completo no Playwright no modo demonstração (abrir → escolher time → correr → resumo → compartilhar → Arena → chefão → missões) | E10 | `apps/mobile/e2e-web/demo-mode-flow.cjs` | T7.E10.5 e as telas da F4 | Roda sem servidor e sem rede externa, verde 3 vezes seguidas |
| **T7.E10.7** | Corrigir o vazamento de handle no Jest | E10 (avisa o dono do teste) | testes com temporizador | — | `npx jest --detectOpenHandles` sem aviso; o aviso "worker process has failed to exit" some |
| **T7.E10.8** | Verificações transversais de acessibilidade | E10 | `src/__tests__/a11y-*.test.ts`, `docs/melhoria/F1/qa/contraste.cjs` → `apps/mobile/scripts/` | correções da E6 | `contraste.cjs --strict` verde e na CI; teste estático proíbe `height` fixa em chip e exige `accessibilityState` quando há `disabled` |
| T7.E6.x (pedido) | Corrigir as falhas 1, 2, 3 (UI), 5 (UI), 7, 8, 9 e 10 | E6 | `src/components/**`, `src/theme/**`, `src/features/screens/**` | — | Contraste ≥ 4,5:1 nos botões; bordas de controle ≥ 3:1; alvos ≥ 44 pt; GPS como padrão; teste de 5 s com as telas de jogo ≥ 0,75 |
| T7.E6.y (pedido) | Mapa da corrida sem recalcular as regiões a cada ponto (D1, D2) e barras com `scaleX` (D3) | E6 (+E5 para as barras) | `run-screen.tsx`, `map-data.ts`, `game-motion.tsx`, `territory-bar.tsx` | — | Na simulação, `mapLayers` roda ≤ 1 vez por troca de zona (contador em teste); nenhuma animação de `width`/`height` (teste estático) |
| **T7.E10.9** (F5) | Revisão adversarial de cada onda | E10 | `docs/QA.md` (Fase 7), `docs/melhoria/relatorios/` | cada onda | Capturas "depois" nas 3 resoluções; teste de 5 s ≥ 80% nas telas principais; checklist de ética sem "não"; zero achado Alto/Médio aberto |
| **T7.E10.10** (F5) | Teste de 5 segundos com pessoas | E10 + dono | `docs/melhoria/F5/5-segundos.md` | F4 pronta e prévia web | 5 pessoas ou mais, protocolo 4.1, resultado registrado |

---

## 13. Pedidos às outras equipes

- **Pedido para E9:**
  1. cada RPC, tabela ou function nova vem com o par no servidor de demonstração (`src/services/api/demo/`) ou com um pedido à E10 na mesma onda; o teste de contrato vai cobrar;
  2. avaliar as tentativas automáticas do cliente (1+2+4 s antes do erro, falha 5); para o perfil inicial, um tempo máximo de 3 s com "Conectando…";
  3. tabelas novas entram no `account-export` e no `account-delete`;
  4. confirmar se a corrida `simulated` é aceita ou rejeitada no servidor real (falha 1).
- **Pedido para E6:**
  - falhas 1, 2, 7, 8, 9 e 10 e o gabarito do teste de 5 segundos (o que cada tela comunica e a ação primária);
  - o botão "Ver demonstração" e o local do selo;
  - tirar as instruções de desenvolvedor da tela indisponível.
- **Pedido para E5:**
  - barras com `scaleX` (D3);
  - nada de `requestAnimationFrame` + `setState` durante a corrida (D6);
  - pausar o fundo animado do login com o teclado aberto (D10);
  - `TickerText` respeitando "Reduzir movimento".
- **Pedido para E7:** horário de silêncio (22h–7h) e no máximo 1 notificação de engajamento por dia, com teste de relógio (N-1, N-2); recompensas de nível que existam de verdade (R-4).
- **Pedido para E7 e E9:** Raid, Liga e Encontro reais, ou estado vazio em conta real (DC-3).
- **Pedido para E8:** card de compartilhamento com marca d'água "Demonstração" no modo demonstração e corte nas zonas de privacidade, com teste (P-1).
- **Pedido para E3:** a regra nova vem com `rules_version` para a compatibilidade com o servidor antigo (X7) e com os testes de propriedade.
- **Pedido para E4:** arte em SVG otimizado (orçamento do bundle web na CI).

---

## 14. Riscos e bloqueios

- **Contas de demonstração com senha pública no Cloud** (A-1 da REVISAO). Continua valendo até o dono trocar as senhas. O modo demonstração elimina a necessidade dessas contas na apresentação.
- **Permissão `workflow`:** o push da CI pode ser recusado (seção 7, planos A e B).
- **Cache do Metro com `EXPO_PUBLIC_*`:** sem `--clear`, o export da demonstração sai sem o modo e sem aviso. Isso está na CI proposta e precisa ir para o README do `e2e-web`.
- **Fidelidade do servidor de demonstração:** imitar o PostgREST pode divergir do servidor real. Mitigação:
  - teste de contrato;
  - as mesmas funções de mapeamento;
  - o `finish` usando o domain;
  - e2e com servidor real continua na máquina da equipe.
- **pgTAP e e2e com servidor não rodam aqui** (sem Docker). Dependem da prova do banco local da E9.
- **Capturas "antes" sem estados cheios:** o mapa sem mapa-base e as listas vazias. O antes cheio vem de `docs/ui-audit/` (parte ainda no tema claro). A comparação justa antes/depois dos estados cheios só vai existir com o modo demonstração rodando sobre o código **antigo**. Sugestão: a E10 gera esse "antes cheio" logo depois da T7.E10.1, antes das telas novas da F4.
- **Teste de 5 segundos automático é heurístico:** o avaliador conhece padrões de apps. As notas tendem a ser otimistas, e as pessoas reais vão errar mais.
- **CPU compartilhada:** os tempos da linha de base (seção 1) foram medidos com outras equipes rodando. Servem de ordem de grandeza, não de orçamento rígido.

---

## 15. Arquivos desta entrega

- `docs/melhoria/F1/10-qualidade.md`: este relatório.
- `docs/melhoria/F1/qa/contraste.cjs`: auditoria de contraste dos tokens (`--json`, `--strict`).
- `docs/melhoria/F1/qa/contraste-resultado.md`: tabela dos 63 pares (antes).
- `docs/melhoria/F1/qa/capturas-antes.cjs`: protótipo do `capturas.cjs` (interceptação do supabase-js e medições de toque, rótulo, palavras e FCP).
- `docs/melhoria/F1/qa/erro-perfil.cjs`: medição da tela branca no erro e sem rede.
- `docs/melhoria/ci/ci.yml` e `docs/melhoria/ci/README.md`: proposta da CI e plano B.
- `docs/melhoria/capturas/antes/`: 71 PNG e o `relatorio.json`.

**Como reproduzir as capturas:**

```bash
# na raiz; T = pasta temporária
(cd apps/mobile && npx expo export -p web --output-dir $T/web)
(cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 EXPO_PUBLIC_SUPABASE_ANON_KEY=chave-falsa \
   npx expo export -p web --clear --output-dir $T/web-fake)
NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/qa/capturas-antes.cjs $T/web $T/web-fake $T/capturas
```
