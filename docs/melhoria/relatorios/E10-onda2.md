# E10 — Qualidade e plataforma · F3, onda 2

> **Tarefa:** T7.2.10 (interruptor do modo demonstração, CI do banco e contraste estrito, estilos animados, contrato).
> **Branch:** `worktree-agent-a35f6a08452a452f7` (worktree `.claude/worktrees/agent-a35f6a08452a452f7`), base `89144d8`.
> **Data:** 2026-10-23.

## Commits
`42ba174` prazo do `currentPosition` · `8307eb4` interruptor da demonstração · `9877b7c` teste "só transform e opacidade" · `2f1cfad` contrato · este relatório e o `docs/QA.md` §16 · por último, **só** o `.github/workflows/ci.yml`.

## 1. Resumo
- **Interruptor em tempo de execução:** `enterDemo()`/`exitDemo()`/`isDemoActive()` em `src/services/demo-mode.ts`. Entrar não toca na conta real; sair apaga tudo o que a demonstração deixou no aparelho. Provado no teste entrar → correr → sair.
- **Duas defesas novas na troca:** um envio em andamento não vai ao servidor do outro modo (`MODE_SWITCHED`), e o espelho fila → store continua ligado ao motor novo (o antigo para de repassar eventos).
- **CI:** job `db` com `npm run db:test:local` (574 pgTAP, sem Docker) e contraste `--strict` no job `app`.
- **Teste estático "só transform e opacidade"** em `useAnimatedStyle`, `animationName` e transições. Achou 5 animações de layout em telas da E6b, registradas como exceção com dono (saem na T7.2.7).
- **Contrato da demonstração:** continua útil com os pares da onda 2 e agora segue constantes e tipos importados.
- **`current.ts`:** `clearTimeout` no `Promise.race`.

## 2. API do interruptor (para a E6a)

```ts
import { enterDemo, exitDemo, isDemoActive, isDemoBuild, onDemoSwitch } from '@/services/demo-mode';

enterDemo(opts?: { scenario?: DemoScenario }): Promise<boolean> // true = ligou; false = já estava ligado
exitDemo(): Promise<boolean>                                     // true = desligou; false = não estava ou build EXPO_PUBLIC_DEMO=1
isDemoActive(): boolean                                          // build de demonstração OU interruptor ligado
isDemoBuild(): boolean                                           // EXPO_PUBLIC_DEMO=1: esconder "Sair da demonstração"
onDemoSwitch(fn: (active: boolean) => void | Promise<void>): () => void
```

| Passo | `enterDemo` | `exitDemo` |
|---|---|---|
| Fila | `setQueueStore(null)`: a próxima é `nomade-queue.demo.db` (na web, só memória) | apaga as corridas e os pontos da fila da demonstração, depois `setQueueStore(null)` |
| Sync | `setSyncEngine(null)` | `setSyncEngine(null)` |
| Servidor em memória | `setDemoClient(null)` (ou um com o `scenario` pedido): mundo novo | `setDemoClient(null)` (fecha os canais) |
| Caches | apaga sobras `nomade.demo.*` de uma demonstração interrompida | apaga `nomade.demo.zones.v1` e `nomade.demo.profile.v1` |
| Chave HMAC | apaga sobra do `demo-corredor` | apaga `nomade.device.v1.demo-corredor` |
| GPS em segundo plano | — | `stopBackgroundUpdates()` se uma corrida da demonstração estava gravando |
| Conta real | intacta (sessão no SecureStore, `nomade-queue.db`, `nomade.zones.v1`, `nomade.profile.v1`, chave) | intacta |
| Ouvintes | `onDemoSwitch` com `true` | `onDemoSwitch` com `false` |

- Trocas seguidas ficam em fila (dois toques no botão não intercalam limpeza e entrada).
- `isDemoMode()` (`env.ts`) agora lê também o interruptor; caches, fila e `getSupabase()` seguem o modo atual sem mudar.
- **Stores:** `src/services` não pode importar `src/store` (ARQUITETURA §2). As stores são zeradas pelo ouvinte que a camada de features registra (pedido à E6a, §6). Sem ouvinte, `enterDemo` avisa no console em desenvolvimento.

### 2.1 Defesas da troca
- **`transport.ts`:** o transporte guarda o modo em que foi criado. Se o modo mudou, `invoke`, `fetchResult` e `refreshSession` respondem `MODE_SWITCHED` (status 0, tratado como sem conexão: a corrida fica para depois). Sem isso, um envio real em andamento ao entrar iria para o servidor de demonstração, e um envio da demonstração ao sair iria para o servidor real (o `getSupabase()` é lido na hora).
- **`sync-service.ts`:** o `wireSyncEvents` (E6b) se liga uma vez por processo. Depois do `setSyncEngine(null)`, o motor novo não teria ouvintes e o resultado oficial não chegaria à store. Agora os ouvintes ficam no `sync-service` e cada motor criado por `getSyncEngine()` repassa os eventos só enquanto for o atual.

## 3. CI (`.github/workflows/ci.yml`, último commit, sozinho)
- **Job `db` (novo):** `apt-get install postgresql-16 postgresql-16-postgis-3 postgresql-16-pgtap postgresql-16-cron libtap-parser-sourcehandler-pgtap-perl` e `npm run db:test:local` na raiz. Se a imagem do `ubuntu-latest` não tiver o Postgres 16 no apt (ex.: uma imagem nova com outro Postgres padrão), o passo liga o repositório oficial PGDG antes (`apt.postgresql.org.sh -y`). O cluster temporário usa a porta 54329 só por socket; o servidor do pacote (5432) não atrapalha. O resumo (`Arquivos`, `Result`, `Migrations aplicadas`) vai para a página do job.
- **Contraste estrito:** `node docs/melhoria/F1/qa/contraste.cjs --strict` no job `app`. Hoje: 62 pares e 1 abaixo do mínimo (`palette.ink3` no tema claro, sem uso, que o `--strict` ignora); saída 0.
- **Conferido aqui:** YAML com 4 jobs (8/6/6/3 passos); o passo do banco simulado com `bash -eo pipefail` (como o `shell: bash` do GitHub) passou e gerou o resumo; os 4 pacotes existem no `noble/universe` (Ubuntu 24.04, o do runner hoje). **Não conferido:** o runner como usuário comum (aqui o script rodou como root); o `banco-local.sh` tem o caminho de usuário comum (`as_pg` direto) e o `mktemp` em `/tmp`.
- **`banco-local.sh` não precisou de ajuste**: nada pedido à E9.

## 4. Teste "só transform e opacidade" (`src/__tests__/animated-styles.test.ts`)
- Olha o retorno do `useAnimatedStyle` (corpo de expressão, `return` do worklet, condicionais), os quadros do `animationName` (literal, constante do arquivo, função local ou `kf(...)`) e as transições (`transitionProperty` com nome de layout, `'all'`, ou `transitionDuration` sem `transitionProperty`, cujo padrão é `'all'`).
- Proibido: `width`, `height`, `top`, `left`, `margin*`. Cores e sombras não entram (não refazem layout).
- Viu 16 `useAnimatedStyle`, 30 `animationName` e 7 `transitionProperty`.
- **Exceções (`BASELINE_LAYOUT_ANIMATIONS`, no padrão do `testids.test.ts`):** a lista deveria nascer vazia, mas o código atual tem 5 ocorrências, todas em arquivos da E6b. Não posso mexer nesses arquivos nem desligar o teste, então elas entraram com motivo e dono:
  - `features/screens/game-motion.tsx:39` `GrowBar` → `width`;
  - `game-motion.tsx:59` `InfluenceBar` → `width`;
  - `game-motion.tsx:74` `GrowPillar` → `height`;
  - `features/screens/run-screen.tsx:572` contagem regressiva → `width` (quadros `from`/`to`, 2 entradas).
  
  As três primeiras somem quando a T7.2.7 trocar por `ProgressBar`.
- Não há teste de "entrada que já não acontece", como no `testids`. Quando a E6b apagar o `GrowBar`, a lista fica com sobra, mas a CI não quebra no merge; a entrada sai depois.
- **Limites:**
  - quadros montados em outro arquivo e só referenciados aqui (ex.: `p.keyframes` do confete) não são seguidos;
  - `entering`/`layout` (animações de layout do Reanimated) e `useAnimatedProps` (SVG) ficam de fora.

## 5. Contrato da demonstração
- **Continua útil na onda 2:** um repositório novo da E3/E7/E8 sem par falha com `rpc "x" (arquivo:linha) não tem par…`. Um par sem uso também falha (órfão).
- **Ficou mais robusto:** antes, um nome vindo de constante (`const RAID = 'raid_status'`) ou de tipo importado (`fn: RaidRpc`, com o tipo no `types.ts`) era acusado como "nome dinâmico". Agora o teste segue os dois. Autoteste novo usando um tipo real de outro arquivo (`FactionId`).
- **Estrutura dos índices: mantida, de propósito.**
  - As listas do contrato (`DEMO_TABLES`, `DEMO_RPCS`, `DEMO_FUNCTIONS`) já saem de `Object.keys` dos índices: não há lista duplicada para conflitar.
  - O conflito esperado é só de linhas somadas no fim dos mesmos objetos (`DEMO_TABLE_COLUMNS`, `DEMO_RPC_HANDLERS`, `DEMO_FUNCTION_HANDLERS`, `FunctionName`). A resolução é "manter os dois lados", e depois do merge o contrato confere.
  - Reestruturar agora (um arquivo de pares por equipe) mexeria em `db.ts`/`rpc.ts`/`functions.ts` ao mesmo tempo que as 3 equipes, e criaria mais conflito do que evita. Proposta para a onda 3 em §6.

## 6. Pendências e pedidos
- **E6a (obrigatório para o botão funcionar):** registrar o ouvinte e refazer a sessão na troca, em `src/features/auth/session-controller.ts`:
  ```ts
  import { useSyncExternalStore } from 'react';
  import { isDemoActive, onDemoSwitch } from '@/services/demo-mode';
  import { useNotifications } from '@/store/notifications-store';
  import { useZones } from '@/store/zones-store';

  // Zera as stores a cada troca (não use clearLocal(): o writeCachedProfile(null) apagaria o cache do modo novo).
  onDemoSwitch(() => {
    useGame.getState().resetForSignOut();
    useSession.getState().reset();
    useZones.getState().reset();
    useNotifications.getState().reset();
    // + stores novas da onda 2 com dados do usuário (engajamento da E7, feed da E8); preferências ficam.
  });

  export function useSessionBootstrap() {
    const demo = useSyncExternalStore(onDemoSwitch, isDemoActive);
    useEffect(() => { /* igual ao de hoje */ }, [demo]); // assina o Auth do cliente do modo atual
    ...
  }
  ```
  - Selo: `useSyncExternalStore(onDemoSwitch, isDemoActive)`. "Sair da demonstração" só quando `!isDemoBuild()`.
  - Login social: esconder com `isDemoActive()` (o `env.oauthProviders` do build continua preenchido; na demonstração o Auth responde "Indisponível na demonstração.").
  - O `testID` do selo deve conter `demonstracao` (o `capturas.cjs` deixa de pôr o selo dele).
  - O teste `demo-switch.test.ts` usa exatamente esse ouvinte.
- **E6b (T7.2.7):**
  - trocar `GrowBar`, `InfluenceBar` e `GrowPillar` por `ProgressBar` e a barra da contagem do Correr por `scaleX` com `transformOrigin: 'left'`;
  - depois, apagar as 5 entradas da `BASELINE_LAYOUT_ANIMATIONS` em `src/__tests__/animated-styles.test.ts`. Se preferir, a E10 apaga na onda 3.
- **E7 e E8:** stores novas com dados do usuário entram no ouvinte acima (avisar a E6a). Nomes de RPC em tipos do `types.ts` funcionam no contrato.
- **Coordenador:**
  - o commit da CI é o último e só tem o `ci.yml` (permissão `workflow`, plano B em `docs/melhoria/ci/README.md`);
  - conflito esperado nos índices da demonstração: manter as linhas dos dois lados;
  - **onda 3:** pares por equipe em `demo/pairs/<feature>.ts`, juntados por espalhamento nos índices (um só arquivo por equipe, sem conflito).
- **E9:** nada. O `banco-local.sh` rodou como está.

## 7. Testes (números)

| Verificação | Antes (`89144d8`) | Depois |
|---|---|---|
| `npm run typecheck` | 0 erros | **0 erros** |
| `./node_modules/.bin/eslint src` | 0/0 | **0/0** |
| `npx jest --maxWorkers=2` | 986 passaram, 26 pulados; 81 suítes + 4 puladas | **1003 passaram, 26 pulados (1029); 83 suítes + 4 puladas**; sem aviso de worker preso |
| `npm run db:test:local` | — | **574/574 pgTAP** em 20 arquivos, 17 migrations, `pg_prove` PASS (também pelo passo simulado da CI) |
| `contraste.cjs --strict` | — | **saída 0** (62 pares; 1 falha só no tema claro sem uso) |
| Deno (functions) | 58/0/1 | não muda (nada em `supabase/` nem no domain) |

**17 testes novos:**
- `demo-switch`: 10 (entrar → correr → sair, conta real intacta, motor antigo, sobra de demonstração interrompida, trocas seguidas, nenhum `fetch`);
- `animated-styles`: 5 (2 sobre o código, 3 autotestes do detector);
- `demo-contract`: +1 (constante e tipo importado);
- `current`: +1 (nenhum temporizador fica armado, relógio falso).

**Mutação conferida:** sem a guarda "só o motor atual repassa" do `sync-service`, o teste "o motor antigo da demonstração não repassa eventos" falha.

## 8. Arquivos
- `apps/mobile/src/services/demo-mode.ts` (novo)
- `apps/mobile/src/services/api/env.ts` (interruptor `setRuntimeDemo`, lido pelo `isDemoMode`)
- `apps/mobile/src/services/sync/sync-service.ts` (ouvintes que sobrevivem à troca)
- `apps/mobile/src/services/sync/transport.ts` (`MODE_SWITCHED`)
- `apps/mobile/src/services/location/current.ts` (+ `__tests__/current.test.ts`)
- `apps/mobile/src/__tests__/demo-switch.test.ts` (novo)
- `apps/mobile/src/__tests__/animated-styles.test.ts` (novo)
- `apps/mobile/src/__tests__/demo-contract.test.ts`
- `.github/workflows/ci.yml`
- `docs/QA.md` (§16)
- este relatório

## 9. Riscos
- **Até a E6a ligar o ouvinte,** o botão "Ver demonstração" troca o servidor, mas não zera as stores nem refaz a assinatura do Auth. O aviso no console e o pedido acima cobrem isso.
- **SQLite:** sair deixa o arquivo `nomade-queue.demo.db` vazio no aparelho (sem corridas nem pontos). Apagar o arquivo exigiria fechar a conexão, e o `sqlite-store` não expõe isso.
- **Rede no job `db`:** depende do apt do Ubuntu (e do PGDG, se a imagem mudar). Se cair, o job falha sozinho; os outros três seguem.
