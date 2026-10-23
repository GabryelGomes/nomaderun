# E5 · Onda 1 — Motion, feedback e recompensa (T7.1.12 a T7.1.15)

> Equipe E5, Fase 7, F3 onda 1 (fundação). Data: 2026-10-23.
> Branch `worktree-agent-abb20d52116406dbf`. Worktree em `.claude/worktrees/agent-abb20d52116406dbf`.
> Base: a worktree nasceu em `a663bee`, um ancestral de `d7747d8`. Ela foi avançada com fast-forward (`merge --ff-only`) até `d7747d8` antes de qualquer mudança. Não houve merge de outra branch nem rebase.

## 1. Resumo

| Tarefa | Entrega | Situação |
|---|---|---|
| T7.1.12 | Tokens v2 em `theme/motion.ts`: 4 molas, `springCss()` com `linear()`, curva de saída, durações v2, escala de celebração e regras de ritmo | ✅ |
| T7.1.13 | Primitivas em `components/motion/`: `haptics.ts`, `CountUp` na thread de UI, `ProgressBar`, `ProgressRing`, `Confetti`, `Burst`, `Flash`, `FloatingNumber`, `SpinRays`, `Shake`, `ShimmerSkeleton` e `PressableScale` com vibração e brilho | ✅ |
| T7.1.14 | Orquestrador (`planCelebrations`, `skipTo`, `a11ySummary`, `<CelebrationSequence>`) e 10 momentos com arte por props | ✅ |
| T7.1.15 | Galeria `/dev/motion` (17 momentos + primitivas + vibração), quadros PNG neste relatório | ✅ |

- **Nomes antigos mantidos:** `curves`, `easings`, `cssEasings`, `durations`, `staggers`, `distances`, `press`, `STAGGER_LIMIT`, `staggerDelay`, `curveFn`, `motionTokens`, `CountUp`/`CountUpProps`, `PressableScale`/`Pressable`.
- **Só acréscimos:**
  - `curves.exit`;
  - novas chaves em `durations`;
  - `haptic` passou a aceitar também um padrão (`true` continua valendo).
- **Pastas fora da E5:** nenhuma foi alterada (`tokens.ts`, telas, `_layout`, `route-guard`, `package.json` intocados). Nenhuma biblioteca foi instalada.

## 2. Arquivos

**Tokens:** `apps/mobile/src/theme/motion.ts`.

**Primitivas** (`apps/mobile/src/components/motion/`):
- `haptics.ts`
- `reduced-motion.tsx`
- `particles.ts` (puro)
- `count.ts` (+ `countSteps`, `countStepsFor`, `widestLabel`)
- `count-up.tsx` (reescrito)
- `pressable.tsx` (evoluído)
- `progress-bar.tsx`
- `progress-ring.tsx`
- `shimmer-skeleton.tsx`
- `confetti.tsx`
- `burst.tsx`
- `flash.tsx`
- `floating-number.tsx`
- `spin-rays.tsx`
- `shake.tsx`
- `index.ts` (exporta tudo)

**Celebrações** (`apps/mobile/src/components/celebration/`, pasta nova):
- `queue.ts` (puro)
- `choreography.ts` (puro)
- `moment.tsx` (ciclo de vida comum)
- `celebration-sequence.tsx`
- `reward-toast.tsx`
- `zone-captured.tsx`
- `chest-opening.tsx`
- `boss.tsx` (`BossHit`, `BossDefeated`)
- `progress-moments.tsx` (`LevelUp`, `StreakFlame`, `PRStamp`, `RankShift`)
- `team-confirm.tsx`
- `default-moment.tsx` (`renderCelebrationMoment`)
- `index.ts`

**Galeria:** `apps/mobile/src/app/dev/motion.tsx`. Não há `_layout.tsx` em `dev/`.

**Testes:**
- `components/motion/__tests__/motion-v2.test.ts`
- `components/motion/__tests__/primitives-render.test.tsx`
- `components/motion/__tests__/render-mocks.ts` (mocks compartilhados)
- `components/celebration/__tests__/queue.test.ts`
- `components/celebration/__tests__/moments-render.test.tsx`

**Quadros:** `docs/melhoria/relatorios/E5-onda1/`.
- 15 folhas de contato (`folha-<cena>.png`, das quais 4 em versão `-reduzido`);
- `galeria.png`.
- Total: 432 KB, com paleta reduzida.

## 3. Antes → depois

| Ponto da auditoria F1 | Antes | Depois (primitiva pronta; a E6 integra nas telas) |
|---|---|---|
| `CountUp` | `setState` a cada quadro (thread de JS) | Os textos de cada quadro são formatados uma vez; na thread de UI, um `TextInput` não editável troca o texto via `useAnimatedProps({ text })`. Na web, rAF limitado a 30 quadros/s. A API não mudou e o leitor de tela lê o valor final |
| Vibração | `expo-haptics` direto, só iOS em 5 lugares, sem intervalo | `haptic(padrão)` com 8 padrões e portão de 150 ms. No Android usa `performAndroidHapticsAsync`; na web não faz nada. Tem a preferência "Vibração" (`enabled`) e `force` para alertas de segurança |
| Barras | `GrowBar`/`InfluenceBar`/`GrowPillar` animam `width`/`height` | `ProgressBar` só com `scaleX` (`transformOrigin: left`), com barra fantasma, segmentos e marcos |
| Anel | só o anel de giz da zona | `ProgressRing` só com transform: duas metades de anel (SVG estático) giram dentro de recortes, com pulso e `onMilestone` nos marcos |
| Carregando | `ActivityIndicator` | `ShimmerSkeleton` em 4 formas (`line`, `card`, `circle`, `row`). Com movimento reduzido, pulsa só a opacidade |
| Mola | nenhuma | `springs` + `springCss()` (`linear(...)` com 49 pontos, cacheado) + `springConfig()` para `withSpring` |
| Recompensa | só a zona do resumo | 10 momentos + orquestrador com "Pular", leitor de tela e movimento reduzido |

## 4. API

### 4.1 Tokens (`@/theme/motion`)

- **Molas e curvas:**
  - `springs`: `{ snappy: 350 ms/ζ 0,8, gentle: 500/1, bouncy: 650/0,5, stamp: 550/0,42 }`;
  - `springPoints(ζ, n = 48)`;
  - `springCss(nome | { dampingRatio })`;
  - `springConfig(nome)`;
  - `curves.exit`, `easings.exit`, `cssEasings.exit`.
- **Durações novas:** `exit` 200, `toastHold` 2250, `ghostHold` 300, `ghostDrain` 420, `damageFloat` 800, `skip` 200.
- **Escala de celebração:**
  - `CELEBRATION_LEVELS`;
  - `celebrationLevels`, por nível (`minMs`, `maxMs`, `particles`, `haptic`):

    | Nível | Duração | Partículas | Vibração |
    |---|---|---|---|
    | micro | 120–300 ms | 0 | tap |
    | small | 300–800 ms | 8 | impact |
    | medium | 800–1500 ms | 24 | success |
    | epic | 1500–2500 ms | 60 | success |

  - `celebration`: os níveis acima mais `gapMs` 200, `summaryBudgetMs` 8500, `maxEpic` 1, `maxMedium` 3 e `reducedStepMs` 60.
- **Vibração e partículas:** `HAPTIC_PATTERNS`, `HapticPattern`, `HAPTIC_MIN_GAP_MS` 150, `PARTICLE_COUNTS`, `MAX_PARTICLES` 60.

### 4.2 Primitivas (`@/components/motion`)

```ts
haptic(p: HapticPattern, opts?: { enabled?: boolean; force?: boolean; os?: string }): void
useHaptics(enabled?: boolean): (p, force?) => void
class HapticGate { request(p, nowMs): {kind:'fire'|'defer'|'drop'}; take(p, nowMs) }   // puro
// padrões: selection · tap · impact · heavy · success · warning · error · crescendo (0/200/400 ms)
useReducedMotionSetting(): boolean;  <ReducedMotionOverride reduced={true|false|null}>
<CountUp value from decimals format duration delay curve variant color muted unit accessibilityLabel testID style />   // igual a antes
<ProgressBar value from? color trackColor ghost ghostColor segments milestones onMilestone height duration delay glow accessibilityLabel testID />
<ProgressRing value size stroke color trackColor segments gapColor pulseAt onMilestone duration delay accessibilityLabel testID>{centro}</ProgressRing>
<ShimmerSkeleton shape="line|card|circle|row" width height lines accessibilityLabel="Carregando" testID />
<Confetti count colors origin mode="burst|rain" delay seed width height onEnd testID />   // ≤ 60, determinístico
<Burst count color distance length delay duration origin seed />
<Flash kind="radial|screen|edge" color peak duration delay size />
<FloatingNumber text color size rise delay duration offsetX onEnd />
<SpinRays color size rays periodMs delay paused opacity />
<Shake trigger amplitude cycles axis="x|rotate" duration delay origin="center|bottom">{filho}</Shake>
<PressableScale testID accessibilityLabel haptic={padrão|true} hapticsEnabled glow glowColor scale ... />
// puros: seededRandom, clampParticles, confettiParticles, burstRays, shakeOffsets, crossedMilestones, ringHalves, floatingStack
```

### 4.3 Orquestrador (`@/components/celebration`)

```ts
type CelebrationEvent = { id; kind; level: 'micro'|'small'|'medium'|'epic'; label /* "conquistou Setor Bueno" */; payload }
// kind: zone-captured · zone-defended · zone-milestone · chest · boss-hit · boss-defeated · xp · level-up ·
//       streak · personal-record · mission · medal · league-up · team-confirm  (payload tipado por kind)
planCelebrations(events, { reduced, screenReader, startAtMs?, gapMs?, budgetMs?, intro? }): CelebrationPlan
  // { mode: 'full'|'reduced'|'screen-reader', moments: ScheduledMoment[], haptics, totalMs, announcement }
skipTo(plan, atMs) → { finishedIds, currentId, pendingIds };  nextStepAt(plan, atMs);  skipHaptic(plan, atMs)
a11ySummary(events, intro?) → "Corrida concluída: 8,42 km. Você conquistou Setor Bueno, abriu um baú raro e chegou ao nível 7."
defaultLevel(event);  MOMENT_SPECS;  renderCelebrationMoment(art?)  // desenho padrão de cada kind
<CelebrationSequence events renderMoment={(m, ctx) => …} testID startDelayMs budgetMs intro layout="stack|single"
                     hapticsEnabled screenReader? onStepChange onDone skipLabel="Pular" />
```

**Regras do plano:**
- **Ordem pico-fim:** pequenas → grupo → médias (da mais fraca para a mais forte) → épica.
- **Limites:** 1 épica (a de maior peso; as outras viram média) e 3 médias. O excedente vira um momento `group`.
- **Teto do roteiro (8,5 s):** primeiro encurta o que não é épico; depois junta as pequenas no grupo; por último encurta a épica.
- **Vibrações:** expande o `crescendo` e mantém ≥ 150 ms entre vibrações; dentro da janela, fica a mais forte.
- **Reduzido:** fades de 150 ms em cascata de 60 ms e 1 vibração (a do maior nível).
- **Leitor de tela:** nada roteirizado, tudo no estado final, nenhuma vibração e o anúncio único.

**Componente `<CelebrationSequence>`:**
- **Relógio:** um único `useSharedValue` com `withTiming` linear. Um `useAnimatedReaction` avisa a thread de JS (`scheduleOnRN`) só quando muda o número de passos iniciados ou de vibrações vencidas.
- **"Pular":**
  - leva o relógio ao fim;
  - descarta as vibrações pendentes;
  - marca como `done` os momentos que ainda não tinham terminado (fade de 150 ms ≤ 200 ms);
  - os momentos que já tocaram inteiros não piscam;
  - vibra 1× `success` se faltava algo médio ou épico.
- **Toque na área:** adianta o momento atual.

**Momentos:**
- **Props comuns** (`MomentBaseProps`): `testID`, `state` (`playing` | `done`), `compact`, `haptics`, `hapticsEnabled`, `announce` e `onDone`.
- **Fora do orquestrador:** cada momento vibra no tempo do catálogo, anuncia ao leitor de tela 1× e chama `onDone`.
- **Dentro do orquestrador:** `ctx.props` já passa `haptics: false` e `announce: false`.
- **Lista:**
  - `RewardToast` (`size: small | medium | epic`, `placement`, `holdMs`, `autoHide`, `edgeGlow`, `particles`);
  - `ZoneCaptured` (`context: run | summary`);
  - `ChestOpening` (`rarity`, `xp`, `odds?`, `chest`, `lid`, `item`);
  - `BossHit` (`bossName`, `boss`, `bossFlash`, `hpFrom`, `hpTo`, `hpMax`, `damageLabel`, `mineLabel`);
  - `BossDefeated` (`bossName`, `boss`, `bossFlash`, `city`, `myKm`, `reward`);
  - `LevelUp` (`level`, `title`, `reward`);
  - `StreakFlame` (`weeks`, `status: kept | frozen`, `flame`, `ice`);
  - `PRStamp` (`label`, `metric`);
  - `RankShift` (`rows`, `previousOrder`, `rowHeight`; só `translateY` com transição CSS);
  - `TeamConfirm`:
    - props: `faction`, `mascot`, `leader {name, quote}`, `origin {x,y}`, `onContinue`, `variant: ftue | switch`, `ctaLabel`;
    - coreografia: a cor do time inunda a tela a partir do botão com um círculo em `scale` (560 ms, curva expo.inOut, a partir dos 150 ms); vibração `heavy` aos 150 ms e `success` aos 710 ms;
    - "Bora correr" com `testID="<id>-continuar"`.

**Arte por props:** tudo é opcional. Sem arte, entram marcadores geométricos provisórios (baú, chefão, chama e gelo).

## 5. Testes (em `apps/mobile`)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `./node_modules/.bin/eslint src` | ✅ 0 erros, 0 avisos |
| `npx jest --maxWorkers=2` (suíte inteira) | ✅ 54 suítes passaram e 4 foram puladas (já eram puladas antes: dependem do backend). 545 testes passaram e 26 foram pulados |
| Testes da E5 | 154 testes em 5 suítes:<br>• `motion.test` 26;<br>• `motion-v2` 33;<br>• `primitives-render` 11;<br>• `queue` 32;<br>• `moments-render` 52 |
| Cobertura da parte pura | • `queue.ts`: 100% das linhas e 99,1% dos ramos;<br>• `choreography.ts`, `particles.ts`, `count.ts` e `theme/motion.ts`: 100% / 100%;<br>• `haptics.ts`: 98,3% / 90,6% |
| `reduced-motion.test.ts` e `testids.test.ts` | ✅ (todos os arquivos novos consultam "Reduzir movimento"; todos os botões têm `testID` e descrição) |

**O que os testes garantem:**
- **`springCss`:** começa em 0 e termina em 1. Só passa do alvo com amortecimento < 1, e passa mais quanto menor o amortecimento. Com ζ ≥ 1, não decresce.
- **Portão de vibração:** propriedade com 50 sequências aleatórias, nunca 2 vibrações a menos de 150 ms. Testa também o adiamento só de sucesso, aviso e erro mais fortes, o `crescendo`, o Android com `performAndroidHapticsAsync`, a web sem vibrar e `enabled`/`force`.
- **Partículas:** mesma semente, mesmas trajetórias; teto de 60; quadros-chave só com `transform`/`opacity`.
- **Plano:** propriedade com 200 misturas aleatórias. Verifica:
  - ≤ 1 épica e ≤ 3 médias;
  - todo evento aparece exatamente 1×;
  - momentos em sequência, com o respiro;
  - vibrações a ≥ 150 ms;
  - a épica sempre por último.
- **Renderização:**
  - cada momento renderiza tocando, no estado final e com movimento reduzido (15 variações × 3 casos);
  - fora do orquestrador, cada momento anuncia 1× e chama `onDone`;
  - no estado final, nada desloca;
  - "Pular" leva tudo a `done` e avisa o fim;
  - com leitor de tela, há 1 anúncio só;
  - a galeria toca todos os botões sem erro.

## 6. Galeria `/dev/motion`

- **Quando aparece:** só em `__DEV__` ou na web; fora disso, mostra uma frase de indisponível.
- **Botões:**
  - os 17 momentos (`galeria-motion-<chave>`), incluindo `resumo` (a fila com "Pular") e `resumo-leitor` (modo leitor de tela);
  - ajustes: movimento (sistema, reduzido ou completo), time, raridade e vibração;
  - primitivas: barra +25% e −30%, efeitos;
  - os 8 padrões de vibração.
- **Dados:** de demonstração, identificados na tela.
- **Rota sem login:** o `route-guard` **não bloqueou** no export web. Sem backend configurado, `/dev/motion` abriu direto, sem redirecionar e sem erro no console (Playwright). Isso ainda não foi conferido no Expo Go.
- **Quadros:** em `E5-onda1/`.
  - **Movimento completo:** `folha-zona-resumo`, `folha-bau`, `folha-chefao-golpe`, `folha-chefao-derrota`, `folha-nivel`, `folha-time`, `folha-recorde`, `folha-toast-epico`, `folha-zona-corrida`, `folha-liga` e `folha-resumo`.
  - **Movimento reduzido** (`reducedMotion: 'reduce'`): `-reduzido` de `zona-resumo`, `bau`, `time` e `resumo`.
  - **Visão geral:** `galeria.png`.
- **Como regravar:** exporte a web com o cache do Metro isolado (ver risco R1) e rode um script Playwright simples. Ele abre `/dev/motion`, clica no botão da cena e fotografa `galeria-motion-palco` nos instantes desejados. O script desta onda ficou fora do repositório; ele só usa `e2e-web/serve.cjs`.

## 7. Decisões locais (para o coordenador registrar, se concordar)

1. **`ProgressRing` só com transform.** Duas metades de anel (SVG estático) giram de 0 a 180° dentro de recortes com `overflow: hidden`. Nada de `strokeDashoffset` animado.
2. **`CountUp` com quadros pré-formatados.** Até 120 textos são formatados na thread de JS, uma vez por mudança de valor. A UI só escolhe o índice, o que funciona com qualquer `format` (ex.: `formatPace`). A largura é reservada por um texto invisível com o maior entre o início e o fim, porque o `TextInput` não refaz o layout quando o texto muda pela UI.
3. **Portão de vibração.** Dentro da janela de 150 ms, `success`/`warning`/`error` mais fortes **esperam** o fim dela (fica pendente só a mais forte); o resto é descartado. No plano do orquestrador, entre duas vibrações próximas fica a mais forte.
4. **Cor do baú raro** passou de violeta (`#9B6BFF`, F1) para azul `#5FA8FF` (provisória), porque a D-67 reserva o violeta para os vilões.
5. **Chances do baú:** `ChestOpening` só mostra a linha de chances quando recebe `odds` reais (`payload.odds`). Não há valor padrão inventado; a galeria usa valores marcados como demonstração.
6. **Quadros-chave cacheados por conteúdo** (`kf()`), para a animação CSS não reiniciar a cada render.

## 8. Pedidos para outras equipes

- **E6 (telas):**
  - **Barras e carregamento:**
    - trocar `GrowBar`/`InfluenceBar`/`GrowPillar` (`game-motion.tsx`) e a barrinha do 3-2-1 (`run-screen.tsx:566`) por `ProgressBar`/`scaleY`;
    - trocar os `ActivityIndicator` por `ShimmerSkeleton`.
  - **Vibração:**
    - trocar as chamadas diretas de `expo-haptics` em `button.tsx`, `capture-celebration.tsx`, `hold-button.tsx`, `faction-screen.tsx`, `onboarding-screen.tsx`, `run-screen.tsx` e `use-run-session.ts` por `haptic('…')`;
    - nos alertas de segurança, usar `force: true`.
  - **Tokens e preferências:**
    - remover `tokens.motion` de `tokens.ts` (onda 2);
    - criar as preferências "Vibração" e "Pular celebrações", passadas como `hapticsEnabled` e usadas para pular o roteiro.
  - **Onde montar:**
    - `TeamConfirm` no onboarding (passo do time), com `origin` = centro do botão medido por `measureInWindow`;
    - `CelebrationSequence` + `renderCelebrationMoment()` no resumo (`startDelayMs` ≈ 2700, depois da rota e dos números);
    - `ZoneCaptured context="run"` na corrida.
  - **`NeonBackdrop`:** pausar enquanto o roteiro toca.
- **E4 (arte):** a arte entra por props, sem animação própria.
  - **Baú:** `chest` (corpo), `lid` (tampa) e `item`.
  - **Chefão:** `boss` e `bossFlash` (a silhueta branca da mesma arte, para o clarão).
  - **Mascote e chama:** `mascot`, `flame` e `ice`.
  - **Cores de raridade:** confirmar as 3 (`RARITY_COLORS`, provisórias).
- **E3 (eventos):**
  - o adaptador de `live-events.ts` para `CelebrationEvent` fica para a onda 2;
  - cada evento precisa trazer `level` (sugestão em `defaultLevel`) e `label`, uma frase no passado e sem sujeito para o anúncio;
  - a faixa de corrida usa `ZoneCaptured`/`RewardToast` com `particles={false}`.
- **E7 (engajamento):**
  - títulos dos níveis (D-64) para `LevelUp.title`;
  - regra da sequência e do congelamento para `StreakFlame`;
  - o limite de 1 épica por resumo já está no orquestrador.
- **E9 (servidor):**
  - `odds` reais no payload do baú;
  - "dano da cidade desde a última visita" para `BossHit` (`hpFrom`/`hpTo` visíveis na barra).
- **E10 (QA):**
  - medir fps no Android médio: resumo completo, baú lendário com 60 partículas e `TeamConfirm`;
  - teste estático "só transform/opacidade" para `components/motion` e `components/celebration`. Os testes de renderização já conferem os quadros-chave, mas não por análise estática.
- **Coordenador:**
  - **Rota `/dev/motion`:** pelo critério pedido ("`__DEV__` ou web"), ela fica visível também na prévia web publicada. Se isso não for desejado, troque para só `__DEV__`.
  - **`react-test-renderer`:** os testes de renderização usam o `react-test-renderer` 19.2.3, que já está em `node_modules` como dependência transitiva do `jest-expo` e não foi instalado agora. Se quiserem fixá-lo, é o `package.json` (coordenador).

## 9. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Export web dentro de uma worktree com `node_modules` em link simbólico usa a pasta `src/app` do repositório principal** (cache de transformação do Metro). O primeiro export desta onda não tinha `/dev/motion` | Exportar com `TMPDIR=<pasta própria>` (cache do Metro isolado). Vale para todas as equipes que forem gerar capturas |
| R2 | `text` via `useAnimatedProps` no `TextInput` (Fabric) pode não refazer o layout | Texto invisível reserva a largura; algarismos tabulares. Conferir no Expo Go (iOS/Android) na onda 2 |
| R3 | 60 partículas no Android de entrada | Teto de 60; 24 no caso comum; zero durante a corrida (`particles={false}`); E10 mede. Plano B da D-71 (Skia só no confete) |
| R4 | `linear()` com 49 pontos nas animações CSS | Objetos cacheados por amortecimento; renderizou na web sem erro. Medir no nativo |
| R5 | Testes de renderização usam mocks (não executam worklets reais) | A lógica pura (plano, portão, trajetórias) tem testes diretos; a coreografia real foi conferida nos quadros da web |
| R6 | Toast de "zona conquistada" durante a corrida usa `boxShadow` inset fixo (só a opacidade anima) | Conferir custo no Android junto com o fps (E10) |

## 10. Para a onda 2 (E5, T7.2.8)

- **Adaptador:** eventos da E3/E7 para `CelebrationEvent`.
- **Arte:** trocar os marcadores pela arte da E4.
- **Chefão:** `BossStage` (parado/furioso, com pausa fora de foco).
- **Momentos que faltam:** missão e medalha com desenho próprio.
- **Corrida:** marcos de 25/50/75% na faixa da corrida.
- **Resumo:** coreografia final em par com a E6.
- **Desempenho:** laço do `neon-backdrop` pausado fora de foco.
