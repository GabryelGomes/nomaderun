# F1 · E5 — Motion, feedback e recompensa

> Equipe E5 (Reformulação v2 "Dopamina"). Fase F1: descoberta e design, **sem alterar código de produção**.
> Base: prompt mestre §1–5, §11, §16 e §19; `docs/DESIGN_MOBILE_MOTION.md`; D-54 a D-60; código em `apps/mobile/src` (lido em 2026-10-23).
> Protótipos: `docs/melhoria/F1/motion/prototipo.html` (7 cenas, versão reduzida de cada) e 106 quadros PNG em `docs/melhoria/F1/motion/quadros/` (14 folhas de contato `folha-*.png`).

## Sumário

0. Resumo em 10 linhas
1. Auditoria do motion atual (arquivo:linha)
2. Linguagem de motion v2: escala de celebração, tokens novos, vibração
3. Catálogo de momentos (tabela mestra)
4. Coreografias detalhadas dos momentos prototipados
5. Resumo cinematográfico e orquestrador de celebrações
6. Chefões da Raid: estados, golpe, barra de vida, derrota
7. Escolha de time: confirmação épica
8. API das primitivas (F3/F4)
9. Movimento reduzido, leitor de tela e som
10. Desempenho: custo, orçamento e medição
11. Decisões para o coordenador
12. Pedidos para outras equipes
13. Tarefas propostas para F3/F4
14. Riscos
15. Protótipos: como abrir e regravar

---

## 0. Resumo em 10 linhas

1. O app já tem uma base boa (tokens em `theme/motion.ts`, primitivas `FadeUp`/`Stagger`/`CountUp`/`RevealText`/`Pressable`, `CaptureCelebration`), mas **só existe um momento de recompensa** (zona conquistada no resumo). Baú, chefão, nível, sequência, liga, recorde e escolha de time **não têm celebração nenhuma**.
2. Inconsistências principais: três barras animam **largura/altura** (layout) em vez de `transform`; `CountUp` re-renderiza por `requestAnimationFrame` (thread de JS) e há telas com 6 a 15 contadores ao mesmo tempo; a vibração é **só iOS** em 5 lugares e iOS+Android em outros 8; dois arquivos de tokens de motion convivem (`tokens.motion` e `theme/motion`).
3. Proponho uma **escala de celebração** (micro · pequena · média · épica) com orçamento fixo de tempo, partículas e vibração para cada nível, e **4 molas** (`snappy`, `gentle`, `bouncy`, `stamp`) que valem igual em `withSpring` e nas animações CSS do Reanimated (via `linear(...)`).
4. Um **orquestrador de celebrações** (fila pura, testável) roteiriza o **resumo cinematográfico**: rota → números → conquistas uma a uma → nível → card do Instagram, com **Pular** e versão para leitor de tela. Pico ≤ 8,4 s, típico 5–6 s.
5. Um **módulo de vibração** único (`haptics.ts`) com 7 padrões, mapeamento iOS/Android/web, intervalo mínimo de 150 ms e chave "Vibração" nas preferências.
6. Chefão: 4 estados (parado, golpe, furioso, derrotado), número de dano flutuante e **barra fantasma**. Detalhe de produto: o dano de uma corrida (8 km em 3.600) é invisível na barra; mostrar o **dano da cidade desde a última visita** e o "sua parte" separado.
7. Escolha de time: a cor do time **inunda a tela a partir do botão** (círculo, 560 ms), emblema/mascote com mola, 2 ondas de choque, nome do time palavra por palavra e frase do líder. 2,0 s, vibração forte → sucesso.
8. Tudo foi prototipado em HTML com Web Animations e gravado em quadros determinísticos (o mesmo `t` dá a mesma imagem), com a trilha de vibração desenhada ao lado.
9. **Sem Skia e sem Lottie na v2** (recomendação): tudo cabe em Reanimated 4.5 + react-native-svg, que já estão no app e na web. Skia fica como plano B para partículas se o orçamento estourar no Android (ele vem no Expo Go 57: `@shopify/react-native-skia` 2.6.2 está em `expo/bundledNativeModules.json`).
10. 12 tarefas para F3/F4 (T7.E5.1 a T7.E5.12) com dependências da E3 (eventos), E4 (arte por props), E6 (onde montar) e E7 (níveis, sequência, missões).

---

## 1. Auditoria do motion atual

### 1.1 O que existe (inventário)

| Peça | Onde | O que faz | Nota |
|---|---|---|---|
| Tokens de motion | `src/theme/motion.ts:20-135` | 5 curvas (GSAP → Bézier), durações (120 a 2000 ms), staggers, distâncias, `staggerDelay` | Bom. Falta **mola**, curva de **saída** e tokens de **celebração** |
| Tokens antigos | `src/theme/tokens.ts:107-114` | `motion.press/small/enter/holdToConfirm/spring/stagger` | Duplicado; só `holdToConfirm` ainda é usado (`components/hold-button.tsx:50`) |
| Retorno ao toque | `src/components/press-feedback.ts:12-28` | escala 0,97, 120 ms, transição CSS; reduzido = opacidade 0,7 | Bom e barato |
| `PressableScale` | `src/components/motion/pressable.tsx:30-59` | alvo de toque com o retorno acima; `haptic` opcional | Vibração só iOS (`:52`) |
| `CountUp` | `src/components/motion/count-up.tsx:38-105` | número que conta (expo.out, 1 s) | **`setState` por quadro** via `requestAnimationFrame` (`:74-82`) |
| `FadeUp`/`Stagger` | `src/components/motion/fade-up.tsx:25-68` | entrada 16 pt + fade, power3.out 500 ms; cascata com teto 12 itens / 500 ms | Bom (animação CSS, thread de UI) |
| `RevealText` | `src/components/motion/reveal-text.tsx:37` | título palavra por palavra saindo da máscara | Bom |
| `ScreenEnter`/`screenTransition` | `src/components/motion/screen-enter.tsx:19-54` | entrada de tela e opções de transição do Stack | Bom |
| `ParallaxScrollView` | `src/components/motion/parallax-header.tsx:14-54` | cabeçalho a 0,5× da rolagem | Bom |
| `CaptureCelebration` | `src/components/capture-celebration.tsx:65-134` | 6 traços fecham o anel (60 ms, 420 ms expo.out), selo, título; vibração de sucesso | Único momento de recompensa do app. Sem confete, sem número subindo no anel |
| `HoldButton` | `src/components/hold-button.tsx:27-80` | segurar 600 ms para terminar a corrida, anel linear na UI | Bom (worklet + `scheduleOnRN`) |
| `GrowBar`/`InfluenceBar`/`GrowPillar` | `src/features/screens/game-motion.tsx:35-93` | barras de vida/influência e pódio que crescem | **Animam `width` e `height`** (`:39`, `:59`, `:74`) |
| `SwapFade`/`CounterBadge` | `src/features/screens/game-motion.tsx:101-132` | troca de filtro; contador do sino com "pop" | Bom |
| `TickerText` | `src/features/run/ticker-text.tsx:33-57` | dígitos do cronômetro trocam subindo (200 ms) | Bom; desliga no 10× |
| Contagem 3-2-1 | `src/features/screens/run-screen.tsx:523-575` | número sobe da máscara; barrinha enche | A barrinha anima **`width`** (`:566`) |
| Faixa "zona rival" | `src/features/screens/run-screen.tsx:258-335` | faixa desce do topo + vibração de aviso | Bom |
| `NeonBackdrop` | `src/features/auth/neon-backdrop.tsx:34-45` | rota que se desenha, cometa e respiração em loop | Loops `withRepeat(-1)` sem pausa fora de foco; usado atrás do resumo (`summary-screen.tsx:110`) |

### 1.2 Vibração hoje (todas as chamadas)

| Arquivo:linha | Chamada | Plataforma |
|---|---|---|
| `components/button.tsx:49` | impacto leve ao tocar | só iOS |
| `components/motion/pressable.tsx:52` | impacto leve (opcional) | só iOS |
| `components/capture-celebration.tsx:72` | sucesso | todas |
| `components/hold-button.tsx:33` | sucesso ao confirmar | todas |
| `features/run/use-run-session.ts:135` | sucesso ao abrir baú | todas |
| `features/run/use-run-session.ts:158` | leve a cada número do 3-2-1 | todas |
| `features/safety/use-run-safety.ts:51`, `:95` | aviso / erro (segurança) | todas |
| `features/screens/faction-screen.tsx:50`, `:115` | sucesso ao trocar / seleção | só iOS |
| `features/screens/onboarding-screen.tsx:230` | seleção do time | só iOS |
| `features/screens/run-screen.tsx:97` | médio ao tocar "Começar" | todas |
| `features/screens/run-screen.tsx:263` | aviso ao entrar em zona rival | todas |

Problemas: (a) política de plataforma inconsistente; (b) no Android, `impactAsync`/`notificationAsync` usam o `Vibrator` (o próprio `expo-haptics` 57 recomenda `performAndroidHapticsAsync`, que soa como a háptica do sistema e não pede permissão); (c) nada impede duas vibrações coladas (ex.: baú + zona no mesmo ponto de GPS); (d) não há chave para desligar a vibração.

### 1.3 Inconsistências técnicas

1. **Layout animado em vez de transform:** `GrowBar` (`game-motion.tsx:39`, `width: %`), `InfluenceBar` (`:59`), `GrowPillar` (`:74`, `height`), barrinha do 3-2-1 (`run-screen.tsx:566`). Animar layout recalcula o Yoga a cada quadro. Trocar por `scaleX`/`scaleY` com `transformOrigin` (Reanimated 4 aceita `transformOrigin`).
2. **`CountUp` na thread de JS:** `count-up.tsx:74-82` faz `setState` a cada quadro. O guia D-54 aceita "um texto", mas o resumo monta 6 ao mesmo tempo (`summary-screen.tsx:147-160`), o Clube monta um por linha de ranking (`club-screen.tsx:298`, até 15) e o pódio mais 3 (`:362`). Isso disputa a thread de JS com o GPS e a fila de sync (a fila roda logo depois da corrida, exatamente no resumo).
3. **Loops infinitos sem pausa:** `neon-backdrop.tsx:43-44` roda para sempre, inclusive com a tela fora de foco (não há `useIsFocused`/`AppState`).
4. **Tokens duplicados:** `tokens.motion` (`tokens.ts:107`) e `theme/motion.ts`; `tokens.motion.spring` não é usado.
5. **Sem mola:** nenhum `withSpring` no app; todo "pop" é Bézier. Recompensas pedem overshoot (mola com amortecimento < 1).
6. **Sem curva de saída:** tudo sai com curva de entrada; saídas devem acelerar (power3.in) e ser mais curtas que a entrada.
7. **Vibração e animação desacopladas:** cada tela chama `expo-haptics` direto; não há como garantir "no mesmo quadro" nem o intervalo mínimo.

### 1.4 Onde falta feedback (tela por tela, a fechar com a E6)

| Tela / rota | Hoje | Falta |
|---|---|---|
| Mapa (`map-screen.tsx`) | carregando com `ActivityIndicator` (`:196`); nada anima o que mudou | "o que mudou desde ontem" (zona perdida pisca, baú do dia pulsa, chefão com vida baixa), esqueleto com brilho |
| Nova corrida / 3-2-1 | bom (contagem, vibração) | — (só trocar a barrinha para `scaleX`) |
| Corrida (`run-screen.tsx`) | barra de progresso da zona e texto "Faltam X RP" (`:400-402`); baú = só texto (`:413-415`) | **marco 25/50/75%**, **zona conquistada durante a corrida** (toast + borda), **baú encontrado** (toast), **dano no chefão** (toast pequeno). Nada disso existe |
| Resumo (`summary-screen.tsx`) | celebração da zona + 6 contadores + cascata | roteiro (rota → números → conquistas), baú, chefão, XP/nível, sequência, recorde, **Pular**, card do Instagram |
| Arena / Raid (`arena-screen.tsx:55-80`) | texto + `CountUp` + `GrowBar` estáticos (demonstração) | chefão desenhado e animado (parado/golpe/furioso/derrotado), dano flutuante, barra fantasma |
| Clube / ranking (`club-screen.tsx:281-301`) | cascata + contador por linha | **subir posições** (linha troca de lugar), promoção de divisão |
| Perfil (`profile-screen.tsx:56-81`) | contadores | barra de XP, nível, coleção de medalhas com "brilho novo", chama da sequência |
| Atividades (`activities-screen.tsx:104-110`) | contadores | selo **PR** nas corridas com recorde |
| Escolha de time (onboarding, `onboarding-screen.tsx:213-255`, `:144`) | cartão selecionado + vibração de seleção (só iOS); "Continuar" vai direto para localização | **confirmação épica** |
| Trocar de time (`faction-screen.tsx:78-82`) | aviso `InfoNotice` com fade | versão curta da confirmação épica |
| Carregando (10 arquivos com `ActivityIndicator`) | roda girando | `ShimmerSkeleton` no formato do conteúdo |
| Notificações | contador do sino com "pop" | toast in-app para "zona sob ataque" e "baú do dia" |

---

## 2. Linguagem de motion v2

### 2.1 Princípios (motion.dev aplicado ao app)

- **Mola para o que "chega", curva para o que "anda".** Recompensas, selos e cartões chegam com mola (overshoot pequeno = vivo); rota, barra e anel andam com curva (progresso legível).
- **Coreografia em camadas, nunca tudo junto:** causa → efeito → número → recompensa. Cada camada começa antes da anterior terminar (sobreposição de 30–40%), como no `stagger` do motion.dev.
- **Saída mais rápida que a entrada** (≈ 60%), com aceleração (power3.in).
- **Proporcional ao feito:** a escala de celebração (2.2) limita duração, partículas e vibração. Uma corrida comum nunca ganha confete; um nível novo sempre ganha.
- **Antecipação antes do pico** (baú treme, chefão pisca, círculo cresce do botão): é ela que dá a "dopamina" de expectativa (§5.1).
- **Nada bloqueia o toque.** Toda celebração aceita toque para avançar/pular; CTA tocável desde o primeiro quadro.
- **Só transform e opacidade** (e `strokeDashoffset` de SVG). Sombra/brilho animado só em 1 elemento por vez.

### 2.2 Escala de celebração (orçamento por nível)

| Nível | Exemplos | Duração | Partículas | Vibração | Tela |
|---|---|---|---|---|---|
| **Micro** | toque, chip, seleção | 120–300 ms | 0 | leve ou seleção (opcional) | no próprio elemento |
| **Pequena** | XP ganho, dano no chefão, marco 25/50/75%, sequência mantida | 300–800 ms | 0–8 faíscas | leve ou média | no elemento ou toast |
| **Média** | zona conquistada, baú raro, subir na liga, missão semanal, PR | 0,8–1,5 s | até 24 | sucesso (ou crescente no baú) | cartão em destaque |
| **Épica** | nível novo, chefão derrotado, baú lendário, promoção, escolha de time, fim de temporada | 1,5–2,5 s | até 60 | forte → sucesso | tela cheia (sobreposição) |

Regra de ritmo (§5.3): **no máximo 1 épica por resumo** (as outras viram média) e **no máximo 3 médias**; o excedente é agrupado ("+3 zonas").

### 2.3 Tokens novos (proposta para `src/theme/motion.ts`)

```ts
/** Molas: as mesmas para withSpring (worklets) e para animações CSS (via `springCss`). */
export const springs = {
  snappy: { duration: 350, dampingRatio: 0.8 },  // toast, chip, troca de estado (overshoot ~1,5%)
  gentle: { duration: 500, dampingRatio: 1 },    // cards, folhas, layout (sem overshoot)
  bouncy: { duration: 650, dampingRatio: 0.5 },  // item do baú, emblema, nível (overshoot ~16%)
  stamp:  { duration: 550, dampingRatio: 0.42 }, // carimbo PR, "derrotado", número do nível
} as const;

/** Curva da mola amostrada (49 pontos) para `animationTimingFunction` do Reanimated 4.5: `linear(...)`. */
export function springCss(name: keyof typeof springs): CSSTimingFunction; // usa `linear` de react-native-reanimated
/** Curva de saída (power3.in). */
curves.exit = [0.55, 0.055, 0.675, 0.19];

export const celebration = {
  micro:  { maxMs: 300,  particles: 0,  haptic: 'tap' },
  small:  { maxMs: 800,  particles: 8,  haptic: 'impact' },
  medium: { maxMs: 1500, particles: 24, haptic: 'success' },
  epic:   { maxMs: 2500, particles: 60, haptic: 'success' },
  gapMs: 200,            // respiro entre momentos na fila
  summaryBudgetMs: 8500, // teto do resumo inteiro
} as const;

export const durations = { ...durations, exit: 200, toastHold: 2250, ghostHold: 300, ghostDrain: 420, damageFloat: 800 };
```

A técnica do `springCss` foi validada no protótipo (função `springLinear` em `prototipo.html`): mola amortecida amostrada como `linear(0, 0.06, …, 1)`. O Reanimated 4.5 exporta `linear()` em `react-native-reanimated` (`lib/typescript/css/easing/linear.d.ts`), então a mesma curva serve na animação CSS (estado simples, sem shared value) e no `withSpring({ duration, dampingRatio })` (worklets).

### 2.4 Vibração: um módulo, sete padrões

`src/components/motion/haptics.ts` (novo). As telas chamam `haptic('success')`, nunca o `expo-haptics` direto.

| Padrão | Quando | iOS (`expo-haptics`) | Android (`performAndroidHapticsAsync`) | Web |
|---|---|---|---|---|
| `selection` | trocar opção, tique de progresso | `selectionAsync()` | `AndroidHaptics.Segment_Tick` | nada |
| `tap` | toque em botão primário | `impactAsync(Light)` | `Virtual_Key` | nada |
| `impact` | golpe no chefão, item do baú | `impactAsync(Medium)` | `Context_Click` | nada |
| `heavy` | antecipação épica (time, golpe final) | `impactAsync(Heavy)` | `Long_Press` | nada |
| `success` | conquista, nível, confirmação | `notificationAsync(Success)` | `Confirm` | nada |
| `warning` | zona rival, sinal fraco | `notificationAsync(Warning)` | `Reject` | nada |
| `error` | SOS, falha | `notificationAsync(Error)` | `Reject` | nada |
| `crescendo` | baú abrindo | `tap` → `impact` → `heavy` a 0/200/400 ms | idem | nada |

Regras do módulo (lógica pura, testável):
- **Intervalo mínimo de 150 ms**: chamada dentro da janela é descartada, exceto `success`/`warning`/`error`, que substituem a pendente (prioridade: error > warning > success > heavy > impact > tap > selection).
- `crescendo` é a **única sequência** permitida e respeita 200 ms entre toques.
- Respeita a preferência **"Vibração" (ligada por padrão)** — pedido à E6/E7 para a tela de preferências; alertas de segurança (`use-run-safety.ts`) ignoram a preferência.
- `Platform.OS === 'web'` → não chama nada (o `ExpoHaptics.web` só existe para `notification/impact/selection`).
- Dispara **no mesmo quadro** da animação: quem anima chama `haptic()` no `useEffect` que inicia a animação ou via `scheduleOnRN` no callback do worklet no instante do pico (ex.: baú estoura aos 750 ms).

---

## 3. Catálogo de momentos

Legenda de custo: **B** baixo (transição CSS de 1 elemento), **M** médio (até ~10 elementos animados ou 1 worklet contínuo), **A** alto (partículas, tela cheia, vários worklets). "Reduzido" = com "Reduzir movimento" ligado. Vibração conforme 2.4. Curvas: `standard` (power2.out), `enter` (power3.out), `reveal` (expo.out), `screen` (expo.inOut), `swap` (power2.inOut), `exit` (power3.in) e molas de 2.3.

| # | Momento | Gatilho | Coreografia (resumo) | Duração · curva | Vibração | Reduzido | Custo | Nível |
|---|---|---|---|---|---|---|---|---|
| 1 | Toque em botão | `onPressIn` | escala 0,97 + brilho do neon sobe 20% | 120 ms · standard | `tap` (CTA primário; resto nada) | opacidade 0,7 | B | micro |
| 2 | Trocar de aba | NativeTabs | transição nativa; conteúdo novo fade + 8 pt | 220 ms · enter | — | fade 150 ms | B | micro |
| 3 | Tela empilhada / modal | Stack | `slide_from_right` / `fade_from_bottom` | 400 ms (iOS) | — | fade 300 ms | B | micro |
| 4 | Carregando | dados pendentes | `ShimmerSkeleton`: faixa de brilho atravessa (−100% → 100%) | 1200 ms loop · linear | — | sem faixa; pulso de opacidade 0,5↔0,8 a cada 1,6 s | B/M | — |
| 5 | Lista entra | montar | `Stagger` 40 ms, teto 12 itens / 500 ms | 500 ms · enter | — | fade 150 ms | B/M | — |
| 6 | Número muda | valor novo | `CountUp` (ver 8.2) | 600–1000 ms · reveal | — | valor final direto | B (UI) | — |
| 7 | Pull to refresh concluído | dados chegaram | linhas novas com `FadeUp`, sino `CounterBadge` | 300 ms | `selection` | fade | B | micro |
| 8 | Erro de formulário | validação | campo treme 3× (±6 pt) | 300 ms · linear | `warning` | borda vermelha + fade da mensagem | B | micro |
| 9 | Pintar trecho (corrida) | ponto de GPS válido | rastro na cor do time; ponta com brilho que respira | contínuo; brilho 1,6 s ida e volta | — | rastro sem brilho | M (mapa nativo) | — |
| 10 | Marco 25/50/75% da zona | progresso cruza o limiar | anel/barra da zona enche com `scaleX`; pulso 1,0→1,08→1,0 no anel; rótulo "50%" sobe | 300 ms · standard (pulso) | `selection` | sem pulso; barra muda com fade | B | pequena |
| 11 | Faltam 120 m | ≤ 15% para conquistar | número "faltam" ganha cor do time e brilho fixo; sem loop | 200 ms | — | igual | B | — |
| 12 | Entrar em zona rival | `rival` vira verdadeiro | faixa desce do topo (já existe) | 300 ms · enter | `warning` | fade | B | pequena |
| 13 | **Zona conquistada (corrida)** | servidor/estimativa local cruza o limiar | borda da tela acende na cor do time (inset, 600 ms) + toast desce (mola `snappy`) + selo gira; zona pinta no mapa; voz do Guia. Fica 2,25 s, sai em 200 ms (exit) | 600 ms de entrada; 3,05 s total | `success` | toast e borda com fade 150 ms | B/M (sem partícula) | média (versão leve) |
| 14 | Zona defendida | corrida em zona própria sob ataque | escudo pulsa 1×; toast "Zona defendida" | 400 ms · `snappy` | `impact` | fade | B | pequena |
| 15 | **Zona conquistada (resumo)** | item `zone` na fila | 6 traços fecham o anel (60/420 ms reveal) → selo `bouncy` (540 ms) → título por palavras (660 ms) → anel fecha: pulso 1,06×, 10 faíscas, 24 confetes (720 ms) → "+120" conta 600 ms (860 ms) | 1,2 s (+ cauda de confete até 1,6 s) | `tap` 0 ms + `success` 720 ms | anel já fechado, tudo fade 150 ms; 1 `success` | A (24 partículas) | média |
| 16 | Baú encontrado (corrida) | baú no alcance | toast pequeno com ícone do baú tremendo 1× e raridade na cor; **abre no resumo** | 350 ms entrada · `snappy` | `impact` | fade | B | pequena |
| 17 | **Baú abrindo** | resumo / tela do baú | treme 3× (4°/6°/8°, 200 ms cada) → achata 150 ms → estoura (tampa voa, clarão, raios giram) → item sobe (`bouncy`) → nome da raridade → "+XP" conta → chances visíveis | 1,5 s · ver 4.2 | `crescendo` (0/200/400) + `success` 750 ms | baú aberto + item, fade 200 ms; 1 `success` | A | média (comum: pequena, sem confete; lendário: épica, 60 partículas) |
| 18 | **Golpe no chefão** | dano novo (resumo, Raid) | pisca branco 160 ms + treme 14 pt amortecido + achata → número de dano pula 1,2× e flutua 78 pt → barra cai 150 ms, **barra fantasma** espera 300 ms e escoa | 800 ms · ver 4.3 | `impact` | número e barra com fade; fantasma 300 ms | M | pequena |
| 19 | Chefão furioso | vida < 25% | parado mais rápido (1,2 → 0,8 s), tom avermelhado, 2 faíscas a cada ciclo | loop | — | estático com selo "furioso" | M (loop pausável) | — |
| 20 | **Chefão derrotado** | vida chega a 0 | golpe final → tremor crescente + fica branco → explode (36 partículas, clarão) → "CHEFÃO DERROTADO" carimba (`stamp`) → frase coletiva + confete com as 4 cores → "Sua parte" conta → baú do raid | 2,0 s (+0,5 s cauda) | `heavy` 0 + `success` 700 + `tap` 1800 | sem tremor/explosão; fades em cascata 100 ms | A | épica |
| 21 | XP ganho | resumo | barra de XP enche com `scaleX` (enter 600 ms); "+215 XP" conta | 600 ms | — | barra final direto | B | pequena |
| 22 | **Nível novo** | XP cruza o nível | tela escurece (88%) → raios abrem e giram → número do nível carimba (`stamp`, 0,3→1) → recompensa sobe → 60 confetes; toque fecha | 2,0 s (1,5 s dentro do resumo) | `success` | fundo e textos com fade; sem raios/confete | A | épica |
| 23 | Sequência semanal mantida | 2ª corrida da semana | chama acende (escala 0,6→1 `bouncy`, brilho) e contador gira (dígito sobe, `TickerText`) | 600 ms | `selection` | fade | B | pequena |
| 24 | Congelamento usado | semana salva pelo congelamento | cristal de gelo cobre a chama (fade + escala 0,9→1) | 500 ms · `gentle` | — | fade | B | pequena |
| 25 | Liga: subir posições | posição nova | linha sobe trocando de lugar (`LinearTransition` 600 ms swap); a linha do usuário brilha; número da posição conta | 600 ms | `selection` | linhas trocam com fade | M | pequena |
| 26 | Promoção de divisão | fim da liga | emblema da divisão nova desce e encaixa (`stamp`), anel de luz, 40 confetes | 1,8 s | `heavy` + `success` | fade | A | épica |
| 27 | **Recorde pessoal (PR)** | resumo / atividades | selo "PR" carimba: escala 1,6→1 (`stamp`), giro −8°→0, brilho varre o selo | 800 ms | `impact` | fade | B/M | média |
| 28 | Missão concluída | progresso 100% | check desenha (traço 300 ms), cartão pulsa, "+XP" | 600 ms | `success` | fade | B | pequena |
| 29 | Medalha nova | coleção | medalha gira 180° no eixo Y (simulado com `scaleX` 1→0→1 trocando a face) e brilho varre | 900 ms | `success` | fade | B/M | média |
| 30 | **Escolha de time** | confirmar time (FTUE e troca) | toque → cor do time inunda a tela a partir do botão → emblema/mascote com mola → 2 ondas de choque + 24 confetes → nome por palavras → frase do líder → "Bora correr" | 2,0 s · ver 7 | `heavy` 150 + `success` 710 | cor com fade 250 ms, textos 150 ms | A | épica |
| 31 | Contagem 3-2-1 | iniciar corrida | já existe; trocar barrinha para `scaleX` | 800 ms por número | `tap` por número | já existe | B | — |
| 32 | Pausar / retomar | botão | cronômetro esmaece 50% e pulsa devagar enquanto pausado | 300 ms; pulso 1,6 s | `tap` | sem pulso | B | micro |
| 33 | Segurar para terminar | `HoldButton` | já existe | 600 ms linear | `success` | já existe | B | — |
| 34 | Sincronizou / falhou | fila de sync | ícone de nuvem: check desenha / exclamação treme | 400 ms | — / `warning` | fade | B | micro |
| 35 | Aplauso da crew ("Bora!") | tocar em aplaudir | mão/ícone pula (`bouncy`) + 6 faíscas + contador +1 | 500 ms | `tap` | fade | B | micro |
| 36 | Card do Instagram pronto | fim do resumo | card desliza de baixo (`gentle`), botão "Compartilhar" pulsa 1× | 700 ms | — | fade | B | — |
| 37 | Zona sob ataque (in-app) | notificação real-time | toast vermelho com escudo tremendo 1× | 350 ms · `snappy` | `warning` | fade | B | pequena |
| 38 | Splash → app | abertura | wordmark neon desenha e "acende" (já há `hero-wordmark`); transição `fade` para o mapa | ≤ 1,2 s | — | fade | M | — |
| 39 | Estado vazio | lista vazia | ilustração (E4) entra com `FadeUp` e respira devagar (1,02×, 3 s) | contínuo | — | estático | B | — |

---

## 4. Coreografias detalhadas (momentos prototipados)

Cada passo: **início (ms) · o quê · duração · curva**. Os quadros de cada cena estão em `docs/melhoria/F1/motion/quadros/` (folha de contato `folha-<cena>.png`).

### 4.1 Zona conquistada (resumo) — `folha-zona.png`, `folha-zona-reduzido.png`

| ms | Passo | Duração | Curva | API (Reanimated 4.5) |
|---|---|---|---|---|
| 0 | 6 traços do anel na cor do time, 60 ms entre eles | 420 ms cada (fim 720) | reveal | 1 shared value relógio + `useAnimatedProps` (já existe em `capture-celebration.tsx:32-38`) |
| 0 | vibração `tap` (o primeiro traço "risca") | — | — | `haptic('tap')` |
| 540 | selo do time entra 0,5→1 | 650 | `bouncy` | animação CSS com `springCss('bouncy')` |
| 660 | "Zona conquistada" por palavras (60 ms) | 600 | reveal | `RevealText` |
| 720 | anel fecha: pulso 1→1,06→1, brilho 0,4→1→0,8, 10 faíscas, 24 confetes | 400 / 420 / 280 / 900–1300 | standard | CSS keyframes (pulso), `<Burst>` e `<Confetti>` |
| 720 | vibração `success` | — | — | `haptic('success')` |
| 820 | "+120 pontos em Setor Bueno" sobe 12 pt | 500 | enter | `FadeUp` |
| 860 | "+120" conta | 600 | reveal | `CountUp` |
| 1000 | chips "Nível da zona 1", "Escudo 1/3" (60 ms) | 450 | enter | `Stagger` |

Reduzido: anel já fechado, selo e textos com fade de 150 ms, sem confete/faísca, 1 `success`. Custo: 6 SVG animados + 24 partículas (A durante 1 s, depois zero).

### 4.2 Baú abrindo — `folha-bau.png`, `folha-bau-lendario.png`, `folha-bau-reduzido.png`

| ms | Passo | Duração | Curva |
|---|---|---|---|
| 0 | baú treme 3× (rotação 4°, 6°, 8° + 0,6 pt de x por grau), pivô na base | 600 (200 por tremida) | linear (keyframes) |
| 0 | halo da raridade acende 0→0,6 | 600 | standard |
| 0 / 200 / 400 | vibração `crescendo`: leve → média → forte | — | — |
| 600 | antecipação: achata (1,08 × 0,86) e estica (0,96 × 1,08) | 300 | standard |
| 750 | **estoura**: tampa voa (−30, −120 pt, −40°, some) | 380 | enter |
| 750 | clarão branco 0,3→1,8× e some | 320 | standard |
| 750 | raios abrem (0,3→1, 0→25°) e giram 1 volta a cada 9 s | 450 + loop | reveal |
| 750 | vibração `success` | — | — |
| 760 | 10 faíscas na cor da raridade | 280 | standard |
| 800 | **item sobe** 150 pt, escala 0,3→1 | 650 | `bouncy` |
| 800 | confete: comum 0 · raro 24 · lendário 60 | 900–1300 | física (14 keyframes) |
| 1050 | nome da raridade sobe 14 pt | 450 | enter |
| 1150 | "+40 XP" pula 0,8→1 e conta | 350 / 500 | `snappy` / reveal |
| 1400 | "Chances: comum 70% · raro 25% · lendário 5%" (ética §5.4: chances visíveis) | 300 | standard |

Cores de raridade propostas (a E4 confirma): comum `#C9C6BF`, raro `#9B6BFF` (violeta, não colide com nenhum time), lendário `#FFB800`. Reduzido: baú já aberto, item no lugar final, textos com fade 150–200 ms, 1 `success`. Custo: A por ~1 s (raios são 1 elemento com gradiente cônico; no app, uma `Svg` com 16 raios estática dentro de um `View` que gira).

### 4.3 Golpe no chefão — `folha-chefao.png`, `folha-chefao-reduzido.png`

| ms | Passo | Duração | Curva |
|---|---|---|---|
| — | parado: respira (translateY −6, escala 1,025) ida e volta | 1200 por sentido, loop | ease-in-out |
| 0 | silhueta branca por cima (opacidade 0→0,9→0) | 160 | linear |
| 0 | tremor x: 0, −14, 11, −7, 4, −2, 0 | 320 | linear (keyframes) |
| 0 | achata 1,06×0,92 → 0,98×1,03 → 1 | 420 | standard |
| 0 | 8 faíscas no ponto do golpe | 280 | standard |
| 0 | número de dano: pula 0,5→1,2→1 (0–200), sobe a 78 pt e some (200–800) | 800 | linear com keyframes |
| 0 | vibração `impact` | — | — |
| 80 | barra da frente cai (`scaleX`) | 150 | standard |
| 80 | barra dá um tranco ±3 pt | 180 | linear |
| 80 | **barra fantasma** fica 300 ms e escoa | 720 (300 parada + 420) | reveal |
| 280 | selo "Sua parte: 8,4 km" sobe | 400 | enter |

O branco do golpe é uma **segunda camada da arte** (silhueta branca) com opacidade — a E4 entrega o chefão em camadas (corpo, rosto, silhueta). Alternativa sem arte extra: `tintColor` em `Image` PNG; com SVG, a silhueta é o mesmo `Path` com `fill="#fff"`.

### 4.4 Chefão derrotado — `folha-chefao-derrota.png`

| ms | Passo | Duração | Curva |
|---|---|---|---|
| 0 | golpe final (4.3), barra zera | 800 | — |
| 0 | vibração `heavy` | — | — |
| 300 | tremor crescente (4 → 12 pt) e o chefão vira branco (0→1) | 400 | linear / ease-in |
| 700 | explode: escala 1→1,25 e some; clarão de tela 0→0,85→0; 36 partículas em todas as direções | 260 / 360 / 700–1100 | enter / standard |
| 700 | vibração `success` | — | — |
| 900 | "CHEFÃO DERROTADO" carimba 1,8→1 | 550 | `stamp` |
| 1100 | "Goiânia venceu junta" sobe; confete com **as 4 cores dos times** cai do topo (a vitória é coletiva) | 500 / 1300–1700 | enter |
| 1350 | "Sua parte" sobe; 1400 "42,3 km" conta | 450 / 600 | enter / reveal |
| 1800 | "Baú do raid liberado" (`bouncy`) + vibração `tap` | 650 | `bouncy` |

### 4.5 Escolha de time — `folha-time.png`, `folha-time-reduzido.png` (ver §7)

### 4.6 Zona conquistada durante a corrida — `folha-zona-corrida.png`

| ms | Passo | Duração | Curva |
|---|---|---|---|
| 0 | borda da tela acende na cor do time (sombra interna 3 pt + 70 pt de brilho) 0→1→0 | 600 | standard |
| 0 | zona pinta no mapa (preenchimento 0→0,6→0,42) | 600 | standard |
| 0 | toast desce −140→0 pt | 350 | `snappy` |
| 0 | vibração `success` + voz do Guia (já existe: `voice-guide.ts`) | — | — |
| 120 | selo gira −45°→0 e cresce 0,6→1 | 650 | `bouncy` |
| 350–2600 | toast parado (legível correndo) | 2250 | — |
| 2600 | toast sai para cima e some | 200 | exit |

Sem partícula e sem tela cheia: durante a corrida o GPS e a sync vêm primeiro (§16.9). A borda usa 1 `View` absoluta com `boxShadow` **pré-renderizado** (a sombra não anima; só a opacidade da camada anima).

---

## 5. Resumo cinematográfico e orquestrador

### 5.1 Roteiro (`folha-resumo.png`, `folha-resumo-pular.png`, `folha-resumo-reduzido.png`)

| Ato | ms | O quê | Duração · curva | Vibração |
|---|---|---|---|---|
| 0 | 0 | mapa da corrida aparece (fade); pino de saída pula | 300 · standard / `snappy` | — |
| **1 Rota** | 200 | rota desenha (`strokeDashoffset`) com cometa branco na ponta | 1500 · swap (power2.inOut) | — |
| | 700 / 1050 / 1450 | cada zona conquistada **pinta quando a rota passa por ela** (preenchimento 0→0,55→0,3) | 500 · standard | `selection` em cada |
| | 1650 | pino de chegada pula | 650 · `bouncy` | — |
| **2 Números** | 1700 | distância grande conta | 900 · reveal | `tap` ao "pousar" (2600) |
| | 1850 / 1970 / 2090 | tempo, ritmo, pontos entram e contam (120 ms entre eles) | 450 entrada · 700 contagem | — |
| **3 Conquistas** | 2700 | fila do orquestrador, um momento por vez, cartão entra com mola `gentle` e brilha na cor do feito | ver abaixo | ver abaixo |
| | 2700 | Zona conquistada (média): selo gira, 12 confetes, +120 | 1100 | `success` 3100 |
| | 4000 | Baú raro (média, versão compacta): ícone treme e estoura, +40 XP | 1000 | `tap` 4150 · `impact` 4450 |
| | 5200 | Dano no chefão (pequena): mini barra com fantasma, −8,4 km | 800 | `impact` 5300 |
| **4 Pico** | 6200 | XP enche (72%→100%) | 600 · enter | — |
| | 6800 | **NÍVEL 7** (épica, versão de 1,5 s): raios, carimbo, 60 confetes | 1500 | `success` 6920 |
| **Final** | 8200 | "Compartilhar no Instagram" sobe e pulsa 1× (brilho 0,55→0,95→0,55) | 400 + 700 | — |
| | 8200 | "Pular" some | 200 | — |

Teto: 8,4 s com nível novo; sem nível (caso típico) ~6 s; corrida sem conquista: atos 1 e 2 (2,6 s) e o card.

**Pular** (pílula no topo direito, 44 pt de alvo, `testID="resumo-pular"`):
- toque em "Pular" → todos os momentos vão ao **estado final** com fade de 200 ms, sem vibrações pendentes; confete em voo some em 150 ms; uma única vibração `success` se havia algo médio/épico ainda não mostrado;
- toque em qualquer lugar da área de conquistas → **adianta o momento atual** (vai ao fim dele e começa o próximo);
- rolar a tela também pula (a pessoa quer ver o resto);
- a escolha "sempre pular" fica nas preferências (pedido E6) — sem punição, sem texto de culpa.

**Leitor de tela ligado** (`AccessibilityInfo.isScreenReaderEnabled`): sem roteiro; tela no estado final e **um anúncio único** com `AccessibilityInfo.announceForAccessibility`: "Corrida concluída: 8,42 km em 47 minutos. Você conquistou Setor Bueno, abriu um baú raro, causou 8,4 km de dano no chefão e chegou ao nível 7."

**Reduzir movimento:** sem roteiro; tudo entra em fade de 150 ms numa cascata de 60 ms; 1 `success`.

### 5.2 Orquestrador de celebrações (lógica pura + componente)

O roteiro acima **não é escrito à mão em cada tela**: o resumo entrega os eventos e o orquestrador monta a fila.

```ts
// src/components/celebration/queue.ts (puro, sem React — testável em Jest)
export type CelebrationLevel = 'micro' | 'small' | 'medium' | 'epic';
export type CelebrationKind =
  | 'zone-captured' | 'zone-defended' | 'chest' | 'boss-hit' | 'boss-defeated'
  | 'xp' | 'level-up' | 'streak' | 'personal-record' | 'mission' | 'medal' | 'league-up';

export type CelebrationEvent = {
  id: string;
  kind: CelebrationKind;
  level: CelebrationLevel;   // vem da E3/E7 (regra do jogo), não da tela
  payload: Record<string, unknown>;
};

export type ScheduledMoment = CelebrationEvent & { startMs: number; durationMs: number; haptics: { atMs: number; pattern: HapticPattern }[] };

export type PlanOptions = { reduced: boolean; screenReader: boolean; startAtMs?: number; budgetMs?: number };

/**
 * Ordena (pequenas → médias → épica por último: pico-fim), limita (1 épica, 3 médias; o resto vira um
 * momento "grupo"), calcula início/duração com `gapMs`, garante 150 ms entre vibrações e respeita o teto.
 */
export function planCelebrations(events: CelebrationEvent[], opts: PlanOptions): ScheduledMoment[];
export function skipTo(plan: ScheduledMoment[], atMs: number): { finishedIds: string[]; pendingIds: string[] };
export function a11ySummary(events: CelebrationEvent[]): string; // texto do anúncio único
export const MOMENT_DURATIONS: Record<CelebrationKind, Record<'full' | 'compact', number>>;
```

```tsx
// src/components/celebration/celebration-sequence.tsx
type CelebrationSequenceProps = {
  events: CelebrationEvent[];
  /** Componente de cada momento: a tela decide o desenho; o orquestrador decide o tempo. */
  renderMoment: (m: ScheduledMoment, state: 'waiting' | 'playing' | 'done', compact: boolean) => ReactNode;
  startDelayMs?: number;          // ex.: 2700 no resumo (depois da rota e dos números)
  onStepChange?: (index: number) => void;
  onDone?: () => void;
  testID: string;                 // "resumo-conquistas"
  skipLabel?: string;             // "Pular"
};
export function CelebrationSequence(props: CelebrationSequenceProps): JSX.Element;
export function useCelebrationClock(plan: ScheduledMoment[]): { nowMs: SharedValue<number>; skip: () => void; advance: () => void; done: boolean };
```

Implementação: **um único relógio** (`useSharedValue` + `withTiming(total, linear)`) na thread de UI. Cada momento lê `nowMs` em `useAnimatedStyle`/`useAnimatedProps` e calcula o próprio progresso (como `chalkStrokeProgress` já faz em `capture-celebration.math.ts`). As vibrações e a troca de estado React ("waiting → playing → done") saem do worklet por `scheduleOnRN` **só nos limites dos momentos** (≤ 10 chamadas por resumo), nunca por quadro. Pular = `cancelAnimation` + `nowMs.set(total)`.

Testes Jest (lógica pura): ordem pico-fim; limites (1 épica, 3 médias, agrupamento); `startMs` crescente com `gapMs`; intervalo ≥ 150 ms entre vibrações; reduzido = durações 150 e 1 vibração; leitor de tela = plano vazio + resumo textual; `skipTo` no meio de um momento.

---

## 6. Chefões da Raid

### 6.1 Estados e animação (arte em camadas pela E4)

| Estado | Quando | Animação | Custo |
|---|---|---|---|
| **Parado** | sempre que visível | respira 1,025× e sobe 6 pt (1,2 s ida e volta); olhos piscam a cada 3–5 s (escala Y 1→0,1→1 em 120 ms) | M (1 loop CSS; `animationPlayState: 'paused'` fora de foco) |
| **Levando golpe** | dano novo | §4.3 (800 ms) | M |
| **Furioso** | vida < 25% | respira mais rápido (0,8 s), tom vermelho (camada vermelha a 30%), raios de calor pulsam | M |
| **Derrotado** | vida = 0 | §4.4 (2,0 s); depois, estado "vencido" estático (chefão caído, cinza) até o próximo raid | A (2 s) |

Pedido à E4: cada chefão em **SVG com camadas nomeadas** (`corpo`, `rosto`, `silhueta-branca`, `raios`/apêndices, `rosto-furioso`, `caido`) entregues como componentes React que aceitam `style`/props animadas, sem animação própria.

### 6.2 Barra de vida

- 10 segmentos (separadores fixos) para leitura rápida; preenchimento com `scaleX` + `transformOrigin: 'left'`.
- **Barra fantasma** (clara) atrás da da frente: a da frente cai em 150 ms, a fantasma espera 300 ms e escoa em 420 ms (expo.out). Isso mostra **quanto** caiu.
- Texto "1.104 / 3.600 km" conta junto (500 ms).
- **Problema de escala:** uma corrida de 8,4 km num chefão de 3.600 km mexe 0,2% da barra (invisível). Proposta: na Raid, o golpe mostra o **dano da cidade desde a sua última visita** (−184 km, barra visível) e um selo "Sua parte: 8,4 km"; no resumo, a mini barra usa **zoom no segmento atual** (mostra só os últimos 10% da vida). Pedido E3 (regra) e E9 (endpoint "dano desde"), ver §12.

### 6.3 Dano flutuante

Fonte de display 46 pt branca com contorno e brilho do time; pula 0,5→1,2→1 em 200 ms e sobe 78 pt sumindo em 600 ms. Vários golpes seguidos (ex.: atualização em tempo real) **empilham com 120 ms** e deslocamento lateral alternado (±18 pt), no máximo 3 visíveis.

---

## 7. Escolha de time: confirmação épica

`folha-time.png`. Entra no FTUE (`onboarding-screen.tsx`, passo "faccao") **depois** do botão "Entrar para os <time>" e na troca de time (`faction-screen.tsx`, versão curta de 1,2 s sem ondas).

| ms | Passo | Duração | Curva | API |
|---|---|---|---|---|
| 0 | botão 0,97× e volta | 240 | standard | `pressFeedback` |
| 150 | **círculo na cor do time cresce a partir do botão** até cobrir a tela (escala 0→2,2× a diagonal) | 560 | screen (expo.inOut) | 1 `View` circular com `transform: scale` (não `clip-path`) |
| 150 | vibração `heavy` | — | — | `haptic('heavy')` |
| 450 | camada de conteúdo aparece; emblema/mascote gira −90°→0 e cresce 0,3→1 | 200 / 650 | standard / `bouncy` | CSS |
| 600 | vinheta escura assenta (legibilidade do texto branco) | 400 | standard | opacidade |
| 710 | 2 ondas de choque (anel branco 0,6→2,6×, some), 160 ms entre elas; 24 confetes brancos/rosados | 800 | standard | CSS + `<Confetti>` |
| 710 | vibração `success` | — | — | — |
| 750 | "NIGHT OWLS" sobe por palavras (70 ms) | 600 | reveal | `RevealText` |
| 1150 | frase do líder sobe 16 pt | 500 | enter | `FadeUp` |
| 1600 | "Bora correr" (tocável já) | 400 | enter | `FadeUp` |

O mascote animado (piscar, respirar, pose de vitória) é arte da E4 recebida por prop (`mascot: ReactNode`). Frase e nome do líder: E4/E6 (no protótipo estão como "texto provisório"). Reduzido: a cor do time aparece com fade de 250 ms, conteúdo com fade 150 ms (80 ms entre eles), 1 `success`. Custo: A por 1,5 s (fora da corrida, sem concorrência com GPS).

Acessibilidade: ao terminar, `announceForAccessibility("Você agora corre com os Night Owls. A cidade dorme. A gente pinta.")`; foco no botão "Bora correr".

---

## 8. API das primitivas (F3/F4)

Todas: TypeScript, JSDoc curto, `testID` obrigatório nas interativas, `useReducedMotion()`, só transform/opacidade, `.get()/.set()` (React Compiler), sem `Date.now()` na renderização.

### 8.1 `src/components/motion/` (primitivas)

```ts
// pressable.tsx (evolução do atual)
type PressableScaleProps = RNPressableProps & {
  testID: string; accessibilityLabel: string;
  haptic?: HapticPattern | false;      // antes: boolean e só iOS
  glow?: boolean;                      // brilho neon sobe 20% ao pressionar (só no CTA)
  scale?: number;                      // padrão 0,97
};

// count-up.tsx — mesma API; implementação nova na thread de UI (ver decisão D3)
type CountUpProps = { value: number; from?: number; decimals?: number; format?: (n: number) => string;
  duration?: number; delay?: number; curve?: CurveName; variant?: TextVariant; unit?: string;
  accessibilityLabel?: string; testID?: string; onLand?: () => void /* vibra/encadeia ao pousar */ };

// progress-ring.tsx
type ProgressRingProps = { value: number /* 0–1 */; size: number; stroke?: number; color: string;
  trackColor?: string; segments?: number /* 6 = giz */; pulseAt?: number[] /* [0.25, 0.5, 0.75] */;
  onMilestone?: (m: number) => void; children?: ReactNode; accessibilityLabel: string; testID?: string };

// progress-bar.tsx (substitui GrowBar/InfluenceBar no visual de motion; scaleX)
type ProgressBarProps = { value: number; color: string; ghost?: boolean /* barra fantasma */;
  segments?: number; height?: number; glow?: boolean; accessibilityLabel: string; testID?: string };

// shimmer-skeleton.tsx
type ShimmerSkeletonProps = { shape: 'line' | 'card' | 'circle' | 'row'; width?: number | `${number}%`;
  height?: number; lines?: number; testID?: string };

// confetti.tsx  (partículas pré-calculadas, 1 Animated.View por partícula, keyframes CSS)
type ConfettiProps = { count: 8 | 12 | 24 | 36 | 60; colors: string[]; origin: { x: number; y: number };
  mode?: 'burst' | 'rain'; delay?: number; seed?: number; onEnd?: () => void };

// burst.tsx (faíscas radiais)
type BurstProps = { count?: number; color: string; distance?: number; length?: number; delay?: number };

// flash.tsx (clarão / borda que acende / silhueta branca)
type FlashProps = { kind: 'radial' | 'screen' | 'edge'; color?: string; peak?: number; duration?: number; delay?: number };

// floating-number.tsx
type FloatingNumberProps = { text: string; color?: string; size?: number; rise?: number; delay?: number; onEnd?: () => void };

// spin-rays.tsx (raios que abrem e giram; pausam fora de foco)
type SpinRaysProps = { color: string; size: number; rays?: number; periodMs?: number; delay?: number };

// shake.tsx (envolve o filho; tremor por keyframes)
type ShakeProps = { trigger: number /* muda = treme */; amplitude?: number; cycles?: number; axis?: 'x' | 'rotate'; children: ReactNode };

// haptics.ts
type HapticPattern = 'selection' | 'tap' | 'impact' | 'heavy' | 'success' | 'warning' | 'error' | 'crescendo';
function haptic(p: HapticPattern, opts?: { force?: boolean /* segurança */ }): void;
function createHapticGate(minGapMs?: number): (p: HapticPattern, nowMs: number) => boolean; // puro, testável
function useHapticsEnabled(): boolean;
```

### 8.2 `src/components/celebration/` (momentos de recompensa, arte por props)

```ts
type Base = { testID: string; onDone?: () => void; /** controlado pelo orquestrador; sem isso toca sozinho */ clock?: SharedValue<number>; startMs?: number; compact?: boolean };

type RewardToastProps = Base & { size: 'small' | 'medium' | 'epic'; icon: ReactNode; title: string;
  subtitle?: string; value?: string; color: string; placement?: 'top' | 'center'; holdMs?: number; edgeGlow?: boolean };
type ZoneCapturedProps = Base & { faction: FactionId; zone: string; points: number; context: 'run' | 'summary' };
type ChestOpeningProps = Base & { rarity: 'comum' | 'raro' | 'lendario'; xp: number; chest: ReactNode /* E4: {tampa, corpo} */; item: ReactNode; odds: { comum: number; raro: number; lendario: number } };
type BossHitProps = Base & { boss: BossArt /* E4: camadas */; hpFrom: number; hpTo: number; hpMax: number; damageLabel: string; mineLabel?: string; mood?: 'idle' | 'furious' };
type BossDefeatedProps = Base & { boss: BossArt; city: string; myKm: number; reward?: ReactNode };
type LevelUpProps = Base & { level: number; reward?: { label: string; icon: ReactNode } };
type StreakFlameProps = Base & { weeks: number; state: 'kept' | 'frozen' | 'idle' };
type RankShiftProps = { rows: { id: string; label: string; value: number; you?: boolean }[]; highlightId?: string; testID: string };
type PRStampProps = Base & { label?: 'PR' | string; metric: string };
type TeamConfirmProps = Base & { faction: FactionId; mascot: ReactNode; leader: { name: string; quote: string }; origin: { x: number; y: number } /* centro do botão */; onContinue: () => void; variant?: 'ftue' | 'switch' };
type CelebrationSequenceProps = /* §5.2 */;
```

Cada momento anuncia ao leitor de tela (`announceForAccessibility`) e expõe `accessibilityLiveRegion="polite"` no texto final.

### 8.3 Galeria de desenvolvimento

`src/app/dev/motion.tsx` (só `__DEV__` ou web): lista de momentos com botões "tocar", "reduzido", "pular", "lendário", seletor de time. Serve à E10 para capturas e à banca do TCC.

---

## 9. Movimento reduzido, leitor de tela e som

- **Reduzido** (`useReducedMotion()` em todo componente; o teste `src/__tests__/reduced-motion.test.ts` já obriga): sem deslocamento, escala, giro, tremor e partícula; tudo vira **fade de 150 ms** (200–250 ms para a cor que inunda a tela); estado final mostrado direto; **1 vibração** por momento (a de maior prioridade). Loops (respirar, raios, cometa) ficam **estáticos**.
- **Reanimated `ReduceMotion`**: em `withTiming/withSpring`, passar `reduceMotion: ReduceMotion.System` só onde o valor final importa; nos momentos, preferir o ramo explícito `reduced ? fade : coreografia` (mais previsível e já é o padrão do projeto).
- **Leitor de tela**: orquestrador não roteiriza; anúncio único (§5.1). Números com `accessibilityLabel` do valor final (já é assim no `CountUp`).
- **Som**: desligado por padrão (§11). Se o coordenador aprovar `expo-audio` (está em `bundledNativeModules.json`, ~57.0.5), 4 sons curtos (< 300 ms): conquista, baú, golpe, nível. Fica para depois da v2 (decisão D5).

---

## 10. Desempenho

### 10.1 Custo por técnica (Reanimated 4.5, nova arquitetura)

| Técnica | Onde roda | Custo | Uso |
|---|---|---|---|
| Transição/animação CSS de `transform`/`opacity` | UI (nativo) | baixo; sem shared value, sem re-render | estados simples, entradas, molas via `linear()` |
| `useSharedValue` + `useAnimatedStyle` | UI (worklet) | baixo por elemento; cresce com o nº de estilos | relógio do orquestrador, gestos, barra fantasma |
| `useAnimatedProps` em SVG (`strokeDashoffset`) | UI | médio (react-native-svg redesenha o caminho) | anel, rota; ≤ 8 caminhos animados por tela |
| `setState` por quadro (CountUp atual) | **JS** | alto quando há vários | eliminar (D3) |
| `boxShadow` animado | UI, mas caro no Android | alto | **não animar a sombra**: animar a opacidade de uma camada com a sombra fixa |
| Partícula (1 `Animated.View` com keyframes CSS) | UI | ~0,05–0,1 ms/quadro cada em aparelho médio (estimativa a medir) | teto 60 por tela, 24 no caso comum |
| Gradiente cônico/radial | UI | baixo se estático | raios: SVG estático dentro de `View` que gira |
| `blur` | GPU, caro no Android | alto | evitar (§16.9); usar brilho pré-desenhado |

### 10.2 Orçamento

- **Durante a corrida:** no máximo 2 animações simultâneas além do mapa (toast + borda), sem partícula, sem SVG animado novo; cronômetro continua com `TickerText`. Nada roda na thread de JS por quadro.
- **Resumo:** 1 relógio na UI; ≤ 60 partículas vivas; `NeonBackdrop` **pausado** enquanto o roteiro toca (hoje ele roda junto: `summary-screen.tsx:110`); contadores na UI.
- **Listas:** `Stagger` só nos primeiros 12 itens (já é assim); ranking com `RankShift` anima só as linhas que mudaram.
- **Loops:** todo loop (`respirar`, raios, cometa) recebe `animationPlayState: 'paused'` quando a tela perde foco (`useIsFocused`) ou o app vai para o fundo.

### 10.3 Medição (com a E10)

- Perf Monitor (UI e JS fps) num Android médio (ex.: Moto G) e no iPhone 15, nas cenas: resumo completo, baú lendário, chefão derrotado, escolha de time.
- Critério: UI ≥ 55 fps no p95; JS sem quadro > 50 ms durante o resumo com a sync rodando.
- Teste estático novo (proposta à E10): proíbe `width`/`height`/`top`/`left` dentro de `useAnimatedStyle` e de `animationName` keyframes em `components/motion` e `components/celebration`.

---

## 11. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Usar **Skia** para partículas/brilho? | (a) não; Reanimated + SVG; (b) Skia só no confete; (c) Skia em tudo | **(a)**. Vem no Expo Go 57 (2.6.2 em `bundledNativeModules.json`), mas pesa no bundle web (CanvasKit ~3 MB), complica a prévia na Vercel e os testes Jest. O protótipo mostra que 60 partículas em transform bastam. Plano B: (b) se a medição no Android ficar < 55 fps |
| D2 | Usar **Lottie** para chefões/mascotes? | (a) não; SVG em camadas animado por Reanimated; (b) Lottie para mascotes; (c) Lottie para tudo | **(a)**. `lottie-react-native` ~7.3.8 vem no Expo Go 57, mas exige pipeline After Effects que a E4 não tem, e na web usa outro motor. SVG em camadas mantém o "mesmo traço" (D-61) e o controle de estados (golpe, furioso) |
| D3 | Como tirar o `CountUp` da thread de JS? | (a) `TextInput` não editável com `useAnimatedProps({ text })` (padrão conhecido, roda na UI); (b) manter rAF, mas limitar a 30 fps e a 3 contadores simultâneos; (c) `TickerText` por dígito | **(a) no nativo + (b) na web**, mesma API. Acessibilidade continua pelo `accessibilityLabel` do invólucro (o `TextInput` fica escondido do leitor) |
| D4 | Molas nas animações CSS via `linear(...)`? | (a) sim, `springCss()`; (b) só `withSpring` em worklets | **(a)**: estados simples continuam sem shared value (regra D-54) e ganham overshoot. Validado no protótipo; o Reanimated 4.5 exporta `linear` |
| D5 | Som nas celebrações | (a) não na v2; (b) `expo-audio` com 4 sons, desligado por padrão | **(a)** na v2; (b) como extra se sobrar tempo (registrar no backlog) |
| D6 | Vibração no Android | (a) `performAndroidHapticsAsync`; (b) manter `impact/notification` (Vibrator) | **(a)**, recomendado pelo próprio `expo-haptics` 57; sem permissão de vibração e com sensação nativa |
| D7 | Preferências "Vibração" e "Pular celebrações" | (a) criar; (b) não | **(a)** — autonomia (§5.1) e acessibilidade; pedido à E6/E7 |
| D8 | Celebração da escolha de time na **troca** de time | (a) a mesma épica; (b) versão curta 1,2 s | **(b)**: a épica é da primeira escolha (pertencimento); a troca é ajuste |
| D9 | Tokens antigos `tokens.motion` | (a) remover e migrar `holdToConfirm`; (b) manter | **(a)** em F3, numa tarefa pequena (só a E5 mexe em `theme/motion.ts`; `tokens.ts` é da E6 → pedido) |

---

## 12. Pedidos para outras equipes

- **Pedido para E3 (eventos da corrida e do jogo):** emitir os eventos tipados que alimentam o orquestrador, com o **nível de celebração** decidido pela regra (não pela tela): `zone-captured {zoneId, name, previousOwner, points}`, `zone-milestone {zoneId, fraction: 0.25|0.5|0.75}`, `zone-defended`, `chest-found/opened {rarity, xp}`, `boss-hit {damageKm, cityDamageSinceLastVisitKm, hpBefore, hpAfter, hpMax}`, `boss-defeated`, `xp {gained, levelBefore, levelAfter}`, `personal-record {metric, value}`. Também: confirmar se o marco 25/50/75% vale na regra nova de território (R3).
- **Pedido para E4 (arte):** chefões em **SVG com camadas** (§6.1: corpo, rosto, silhueta branca, apêndices, rosto furioso, caído); baú em 2 partes (tampa, corpo) por raridade; emblemas/mascotes com pose parada e de vitória; cores de raridade (proposta §4.2); ilustração do selo "PR" e da chama da sequência. Tudo recebido por props, sem animação própria.
- **Pedido para E6 (UX):** onde montar cada momento (resumo, Arena/Raid, FTUE, troca de time, ranking, perfil); botão "Pular" no resumo; preferências "Vibração" e "Pular celebrações"; troca de `ActivityIndicator` por `ShimmerSkeleton` nas 10 telas; remover `tokens.motion` de `tokens.ts` (D9); texto da frase de cada líder.
- **Pedido para E7 (engajamento):** curva de XP/nível, regra da sequência semanal e do congelamento, missões e medalhas (para `LevelUp`, `StreakFlame`, `PRStamp`, `RankShift`); limite de 1 épica por resumo combinado com o ritmo de recompensas (§5.3).
- **Pedido para E8 (social):** o fim do roteiro entrega o card do Instagram; precisamos do componente do card (E8) e do evento "card pronto" para a animação #36.
- **Pedido para E9 (backend):** campo "dano da cidade desde a última visita" no estado do raid (ou `last_seen_at` por usuário) para o golpe ter barra visível (§6.2).
- **Pedido para E10 (qualidade):** medir fps (§10.3); teste estático de "só transform/opacidade" nas pastas da E5; capturas da galeria `dev/motion` com `reducedMotion: 'reduce'`.
- **Pedido para E2 (skills):** confirmar no documento da SDK 57 que Skia 2.6.2 e Lottie 7.3.8 rodam no **Expo Go** (a documentação da Expo não abriu desta máquina: DNS bloqueado), para registrar D1/D2 com fonte.

---

## 13. Tarefas propostas para F3/F4

| ID | Título | Dono | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E5.1 | Tokens v2: molas, `springCss`, curva de saída, escala de celebração | E5 | `src/theme/motion.ts` | — | `springs`, `springCss`, `curves.exit`, `celebration` exportados; Jest testa que `springCss` começa em 0, termina em 1 e tem overshoot só onde ζ < 1; typecheck/lint/jest verdes |
| T7.E5.2 | Módulo de vibração | E5 | `src/components/motion/haptics.ts` (+ migração das chamadas: pedido às donas das telas) | T7.E5.1; E6 (preferência) | 8 padrões; Android usa `performAndroidHapticsAsync`; web não chama; portão de 150 ms testado em Jest (puro); nenhuma chamada direta a `expo-haptics` em `components/**` |
| T7.E5.3 | `CountUp` na thread de UI | E5 | `src/components/motion/count-up*.tsx` | D3 | mesma API; nativo via `TextInput` + `useAnimatedProps`; web com rAF limitado; teste de renderização e de a11y (lê o valor final) |
| T7.E5.4 | Barras e anéis por transform (`ProgressBar` com fantasma, `ProgressRing` com marcos) | E5 | `src/components/motion/progress-*.tsx` | T7.E5.1 | nada anima `width/height`; fantasma 300 + 420 ms; `onMilestone` dispara em 0,25/0,5/0,75; E6 troca `GrowBar/InfluenceBar/GrowPillar` (pedido) |
| T7.E5.5 | Partículas e efeitos (`Confetti`, `Burst`, `Flash`, `FloatingNumber`, `SpinRays`, `Shake`) | E5 | `src/components/motion/` | T7.E5.1 | contagens só 8/12/24/36/60; trajetórias puras testadas (seed → mesmas posições); reduzido = nada renderiza; ≥ 55 fps com 60 partículas no Android médio (E10 mede) |
| T7.E5.6 | `ShimmerSkeleton` | E5 | `src/components/motion/shimmer-skeleton.tsx` | — | 4 formas; reduzido = pulso de opacidade; usado pela E6 nas telas (pedido) |
| T7.E5.7 | Orquestrador de celebrações | E5 | `src/components/celebration/queue.ts`, `celebration-sequence.tsx` | T7.E5.1–2; E3 (tipos de evento) | `planCelebrations`, `skipTo`, `a11ySummary` puros com ≥ 95% de cobertura; 1 relógio na UI; Pular leva ao estado final em ≤ 200 ms; leitor de tela recebe 1 anúncio |
| T7.E5.8 | Momentos de zona e baú (`ZoneCaptured` run/summary, `RewardToast`, `ChestOpening`) | E5 | `src/components/celebration/` | T7.E5.4–5, T7.E5.7; E4 (baú) | durações e passos de §4.1, §4.2, §4.6 (tolerância ±20 ms nos testes de plano); versão compacta para o resumo; chances visíveis |
| T7.E5.9 | Chefão: `BossStage` (parado/furioso), `BossHit`, `BossDefeated` | E5 | `src/components/celebration/boss-*.tsx` | T7.E5.4–5; E4 (camadas), E9 (dano desde) | §4.3/§4.4/§6; loop pausa fora de foco; dano empilha até 3; reduzido conforme §9 |
| T7.E5.10 | `TeamConfirm` (FTUE e troca) | E5 | `src/components/celebration/team-confirm.tsx` | T7.E5.5; E4 (mascote), E6 (montagem no onboarding) | §7; origem no centro do botão; foco final em "Bora correr"; anúncio ao leitor |
| T7.E5.11 | `LevelUp`, `StreakFlame`, `PRStamp`, `RankShift`, missão/medalha | E5 | `src/components/celebration/` | T7.E5.5, T7.E5.7; E7 (regras) | §3 itens 22–29; `RankShift` com `LinearTransition` e só nas linhas que mudaram |
| T7.E5.12 | Galeria `dev/motion` + relatório | E5 (+E10 capturas) | `src/app/dev/motion.tsx` (rota nova: pedido ao coordenador, `src/app` é da E6), `docs/melhoria/relatorios/` | T7.E5.8–11 | todos os momentos tocáveis, com reduzido e pular; capturas PNG; só em `__DEV__`/web |

Integração nas telas (resumo cinematográfico, Raid, onboarding, ranking, perfil, corrida) fica com a **E6** usando estas peças; a E5 revisa a coreografia em par.

---

## 14. Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| Partículas no Android de entrada | queda de fps no resumo e no baú lendário | teto de 60; 24 no caso comum; medir (E10); plano B Skia só no confete (D1) |
| Resumo junto com a sync (HMAC, fila) | quadros perdidos na thread de JS | relógio na UI, `CountUp` na UI (D3), `scheduleOnRN` só nos limites de momento, pausar `NeonBackdrop` |
| `boxShadow` grande animado (neon) | caro no Android | sombra fixa; anima a opacidade da camada |
| `linear(...)` com muitos pontos nas animações CSS | custo de interpolação/normalização | 48 pontos; objetos de curva cacheados por nome (como `riseKeyframes`) |
| Excesso de celebração vira ruído | perde o efeito "dopamina"; cansa | escala 2.2, 1 épica por resumo, Pular e preferência |
| Vibrações em cascata (baú + zona no mesmo ponto) | desconforto | portão de 150 ms e prioridade (2.4) |
| Arte da E4 atrasar | momentos sem chefão/baú | componentes recebem arte por props; placeholders geométricos como no protótipo |
| Reanimated CSS na web (react-native-web) | diferença de comportamento | galeria em web nas capturas da E10; manter fallback de fade |
| Documentação da Expo inacessível daqui | dúvida sobre Expo Go (Skia/Lottie) | não depende disso com D1/D2 = (a); E2 confirma |

**Bloqueios:** nenhum para a F3 das primitivas (T7.E5.1–7). Momentos dependem dos tipos de evento da E3 e da arte da E4 (podem começar com placeholders).

---

## 15. Protótipos: como abrir e regravar

- **Abrir:** `docs/melhoria/F1/motion/prototipo.html?cena=<cena>` no navegador (toca em loop). Cenas: `zona`, `zona-corrida`, `bau` (`&raridade=comum|raro|lendario`), `chefao`, `chefao-derrota`, `time`, `resumo` (`&pular=3000` simula o Pular). `&reduzido=1` mostra a versão com movimento reduzido. `&t=<ms>` congela num instante.
- **Painel à direita:** tempo, trilha de vibração (cores por padrão) e passos da coreografia acesos no instante; o selo "VIBRA · <padrão>" aparece no telefone por 160 ms a cada vibração.
- **Regravar quadros:** `NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/motion/gravar-quadros.cjs` (Playwright + Chromium; ~1 min). Gera os quadros `quadros/<cena>-<ms>.png` e as folhas `quadros/folha-<cena>.png`, e reduz a paleta para 128 cores (Pillow) para caber no repositório (~4,5 MB).
- **Técnica:** Web Animations API pausada e posicionada em `currentTime = t` (determinístico); contadores e rota são funções do tempo. As curvas e molas são as mesmas propostas para o app (`cubic-bezier` dos tokens e `linear(...)` das molas).
- Arte (chefão "Mormaço de Outubro", baú, emblema, mascote) é **provisória**; dados são de **demonstração** (identificados no rodapé de cada quadro).
