# E6b — Mapa, Correr, Resumo e folha da zona · Fase 7, F4, onda 3

> Tarefa **T7.3.2**. 2026-10-28. Branch `worktree-agent-a9625910e1cb75207`, base `092497c` + merge de `claude/affectionate-gauss-e8gm77` (E7/E9 integradas, a pedido do coordenador).

## 1. O que mudou

| Tela | Encaixe |
|---|---|
| **Mapa** | `useMapToday()` → `MapScreen today`. Adaptador puro `mapTodayFrom` (`map-screen.today.ts`): `useTodayStrip()` (E7) + `fetchRaidCurrent()` (E3) → sequência (pausa; risco da sexta ao domingo), baú (guardados + bônus), **chefão com vida**, missão da 1ª semana/volta (abre `/missoes`) e chip da missão. `available: false`, sem chefão, derrotado ou fugido: **o chip some**. Chips abrem `/recompensas`, `/arena`, `/missoes`. Os 3 chips agora cabem em 390 pt ("2 Baús"). |
| **Correr** | `createPaintedLiveTracker` (`live-paint.ts`): retrato `fetchPaintNear()` no 1º ponto e de novo a cada **1 km** (falha de rede: nova tentativa em 60 s; `available: false`: para de pedir). Troca o retrato sem perder metros, trechos e conquistas, sem repintar e sem repetir o aviso de entrada. `toastForEvent` → `createLiveFeedback()` (E5) via `liveEffects`: vibração no ritmo de 10 s, voz na conquista e nos 75%. Entrar em zona rival não vibra nem fala duas vezes (a faixa e o Guia já avisam). "Sua 1ª zona!" usa o `getFirstConquestEver()` da E7. |
| **Resumo** | `resumo.tsx` → `useSummaryExtras(id)`: `rewards` = `useRunRewards(official)` + `<RunRewardsBlock>`. Antes, o resumo só tinha o `RunSummary`, sem `extras`; agora a resposta oficial crua fica num cache em memória (`official-cache.ts`, alimentado pelo `confirmRun` e pelo sync), com o `lastRun` da E7 como reserva. `renderShare` = `<ShareButton activityId status level boss>`: abre o card. O `level` só existe quando o nível subiu de verdade. O `boss` só existe com `extras.raid.defeated` + o Raid atual (nome, cidade e dias). |
| **Folha da zona** | `zone-sheet.model.ts` + folha nova (wireframe 15): mascote do dono (`Mascot`, ou `EmptyArt` na neutra), placar de 2 cores (`ProgressBar`, com emblema de cada time), relógio da defesa em número grande, **1 frase de regra**, "faltam X m" (`paintZoneGap` na v2 com o retrato, `influenceGapV1` na v1), ação no detent 0,55. O histórico e os maiores corredores ficam recolhidos ("pts" no lugar de "RP"). |
| **Limpeza** | `components/capture-celebration.tsx` apagado, junto com a menção no `reduced-motion.test.ts`. O `capture-celebration.math.ts` fica, porque o `run-motion.test` ainda o testa. |

## 2. Capturas (modo demonstração, 390 × 844, pngquant: 536 → 244 KB) — `E6b-onda3/`

| Tela | Antes | Depois | Palavras visíveis |
|---|---|---|---|
| Folha da zona (Parque, sob ataque) | `antes-zona-parque.png` | `depois-zona-parque.png` | ~67 → **37** |
| Mapa | `antes-inicio.png` | `depois-inicio.png` (3 chips: 2/2 Semana · 2 Baús · 36% Chefão) | 25 → 24 |
| Resumo de corrida antiga | `antes-resumo.png` | `depois-resumo.png` | igual (sem `extras` para uma corrida antiga) |
| Corrida simulada → resumo novo | — | `depois-corrida-ativa*.png`, `depois-resumo-novo.png`, `depois-resumo-recompensas.png` (bloco da E7) | — |

O export foi feito com `EXPO_PUBLIC_DEMO=1 --clear` e `TMPDIR` próprio. Os ids novos `zona-historico` e `mapa-hoje-missao` estão no bundle. O "antes" é o export de `092497c` (`git archive`). Nenhum pedido ao servidor nem página com erro.

## 3. Régua (`node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes`)

| Tela | Antes (F1) | Depois | Meta |
|---|---:|---:|---:|
| `zona/[id]` | 135 | **76** (4 → 0 blocos longos) | 50 |
| `resumo` | 113 | 76 | 60 |
| Mapa | 36 | 44 | 45 |
| Telas de jogo | média 57 | média **54** | |

A régua conta todos os estados. Na zona, os 76 incluem o histórico recolhido (~27) e os estados vazio e erro. Na 1ª dobra da folha aparecem **37 palavras** (≤ 50). As frases da regra ficam em `zone-sheet.model.ts`, e um teste garante que cada uma tem ≤ 90 caracteres e é 1 frase só. A régua deixou de ler o `capture-celebration.tsx`, que foi apagado (1 linha no script).

## 4. Testes (em `apps/mobile`)

- `npm run typecheck` ok; `eslint src`: 0 erros e 0 avisos.
- `npx jest --silent --maxWorkers=2`: **119 suítes · 1.355 passam, 26 pulados (banco local), 0 falhas**.
- **Testes novos (39):**
  - `live-paint.test.ts` (10);
  - `map-screen-today.test.ts` (12);
  - `summary-extras.test.ts` (10);
  - `zone-sheet-model.test.ts` (10, em `features/screens/__tests__`).
- **Mudados de propósito:**
  - `live-hud.test.ts`: os casos do `toastForEvent` passaram para o `liveEffects` (mesmas garantias). A entrada em zona rival agora não gera aviso e há 1 caso novo para o ritmo de 10 s;
  - `map-screen-model.test.ts`: o chip do baú passou de "2×" para "2";
  - `reduced-motion.test.ts`: só a menção ao componente apagado.
- **Maestro `03-uc03`:** tocar em `zona-historico` antes de `zona-corredores` e `zona-eventos`.

## 5. Pendências e riscos

- **E7/E9:** no resumo novo, o "Nível +98 XP" (`r.xp` da resposta v1) não bate com o total "153 XP" do bloco Recompensas (baús e semana entram só no bloco). Vale alinhar o rótulo ou a fonte.
- **Resumo de corridas antigas:** sem o bloco Recompensas. O `activities-repo` (E9/E10) não lê `v2_extras`. Se quiserem o bloco também no histórico, basta pôr `v2_extras` no `COLUMNS` e repassar ao cache.
- **Folha da zona na v1:** o "faltam X m" usa o ritmo-base da pessoa (`selectBasePace`), então é uma estimativa ("~").
- **Previsão ao vivo:** zonas fora do raio de 1,5 km usam o retrato do mapa até o próximo pedido (a cada 1 km). Se a pessoa já conquistou a zona ao vivo, a herança do dono antigo não volta depois de trocar o retrato.
- **Código sem uso:** `InfluenceBar` (game-motion) e `capture-celebration.math.ts` só aparecem nos testes. Apagar os dois junto com os testes fica para a decisão do coordenador.

## 6. Correção da QA (E10, achado Médio) — depois da onda 4

- **Chips do Mapa a 360 pt** ("Sem…", "B…", "Ch…"): a faixa agora fica numa `ScrollView` horizontal. Os chips mostram o rótulo inteiro, e o último passa da borda e rola, sem corte de texto. Capturas: `E6b-onda3/qa-antes-mapa-360.png` → `qa-depois-mapa-360.png`.
- **Cidade do status:** antes era a cidade natal do perfil ("zonas em Anápolis" com a pessoa em Goiânia). Agora é a cidade mais frequente entre as zonas da área visível (`mapCityOf`, a partir de `meta[id].city`). Sem cidade conhecida, o status diz "N zonas por perto". O modo demonstração sem GPS continua com "Goiânia · demonstração".
- **Verificações:**
  - `typecheck` ok; `eslint` em `features/screens` sem avisos;
  - Jest de `features/screens` + `testids`: 76 passam, com 1 teste novo do `mapCityOf`.
