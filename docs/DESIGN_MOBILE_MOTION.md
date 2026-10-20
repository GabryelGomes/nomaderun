# Design mobile e motion — guia da Fase 6

> Para os agentes das telas (T6.2 A3, T6.3 A8, T6.4 A4) e para o QA (T6.5 A5). Base: **D-54** (motion no estilo landonorris.com, layout pela skill `mobile-app-ui-design`), D-15 (identidade "Pista") e RNF-011 (reduzir movimento).
> A identidade não muda: paleta, fontes Inter/Inter Tight, cores e formas dos times (`src/theme/tokens.ts`). Mudam o **movimento** e o **layout**.

## 1. Tokens — `src/theme/motion.ts`

| Curva (`curves`, `easings`, `cssEasings`) | GSAP de origem | Bézier | Quando |
|---|---|---|---|
| `standard` | power2.out | 0.25, 0.46, 0.45, 0.94 | toque, troca de estado, chips |
| `enter` | power3.out | 0.215, 0.61, 0.355, 1 | cards e itens entrando |
| `reveal` | expo.out | 0.19, 1, 0.22, 1 | títulos, conteúdo da tela, contadores |
| `screen` | expo.inOut | 0.87, 0, 0.13, 1 | transições próprias entre estados de tela |
| `swap` | power2.inOut | 0.455, 0.03, 0.515, 0.955 | indicador que muda de lugar |
| `linear` | none | — | progresso contínuo (anel do HoldButton, barras) |

- `easings.*` vão em `withTiming(v, { duration, easing })`; `cssEasings.*` em `transitionTimingFunction`/`animationTimingFunction` (animações CSS do Reanimated 4); `curveFn(nome)` dá a função em JS puro.
- **Durações** (`durations`, ms): `press` 120 · `quick` 200 · `state` 300 · `enter` 500 · `screen` 600 · `reveal` 800 · `count` 1000 · `hero` 1500 / `heroLong` 2000 · `navigation` 400 · `reducedFade` 150.
- **Staggers** (`staggers`, ms): `word` 20 · `wordFast` 15 · `line` 30 · `item` 40 · `itemRelaxed` 50 · `maxTotal` 500. `staggerDelay(i, step?, limit?)` limita a cascata a 12 itens e a 0,5 s no total.
- **Distâncias** (`distances`, pt): `enter` 16 · `enterLarge` 24 · `screen` 16 · `parallax` 0,5 (fator).
- **Toque** (`press`): escala 0,97; com reduzir movimento, opacidade 0,7.
- Compatível: `theme/easing.ts` (`EASE_OUT`, `CSS_EASE_OUT`, `EASE_IN_OUT`) e `tokens.motion` continuam exportados como antes. Código novo usa `@/theme/motion`.

## 2. Primitivas — `@/components/motion`

Todas respeitam **Reduzir movimento** (só opacidade, sem deslocamento nem escala) e nenhuma bloqueia toque.

| Primitiva | Props principais | Use em |
|---|---|---|
| `RevealText` | `children` (string), `variant` (`headline` padrão, `hero`, `metric`…), `by` (`words`/`lines` com `\n`), `delay`, `stagger`, `align`, `header`, `color`, `testID` | título da tela, frase do momento herói. O leitor de tela lê a frase inteira uma vez (`accessibilityLabel`); cabeçalho por padrão em `hero`/`headline` |
| `FadeUp` | `delay`, `distance` (16), `duration` (500), `curve` (`enter`), `style` | um bloco que entra depois do título |
| `Stagger` | filhos diretos; `step` (40), `delay`, `limit` (12), `gap`, `itemStyle` (ex.: `{flex:1}` numa linha) | lista curta de cards, grade de métricas. Em `FlatList`, use `FadeUp` no `renderItem` com `delay={staggerDelay(index)}` |
| `CountUp` | `value`, `from` (0), `decimals`, `format` (ex.: `formatPace`), `unit`, `variant` (`metric`), `duration` (1000), `delay`, `accessibilityLabel` | RP, km, posição no ranking, total da semana. Algarismos tabulares; o leitor de tela lê só o valor final |
| `Pressable` (= `PressableScale`) | props do `Pressable` do RN + **`testID` e `accessibilityLabel` obrigatórios**; `style` (visual, encolhe), `containerStyle` (layout do alvo), `haptic`, `baseOpacity` | cards tocáveis, linhas de lista, opções de missão. Mesmo retorno do `Button` (0,97 / 120 ms / power2.out). `hitSlop` padrão 8 |
| `ScreenEnter` | `delay`, `style` | corpo de cada tela (não envolva o cabeçalho nativo nem a barra fixa). Sobe 16 pt, expo.out 600 ms. Ele vira um único filho: passe `style={{ gap: 16 }}` se o pai usava `gap` |
| `screenTransition(kind, reduced)` / `useScreenTransition(kind)` | `kind`: `push` (slide da direita), `modal` (sobe com fade), `fade`, `none` | `options`/`screenOptions` do `Stack` do Expo Router: `options={{ ...useScreenTransition('modal') }}` em layouts (`src/app/**`) |
| `ParallaxScrollView` | `header`, `headerHeight` (múltiplo de 8), `factor` (0,5), `contentContainerStyle`, props de `ScrollView` | perfil, resumo da corrida, crew: cabeçalho grande que anda na metade da rolagem e esmaece |
| `useParallax(height, factor?)` | retorna `{ scrollY, onScroll, headerStyle }` | parallax livre; `onScroll` serve em `ScreenScroll` |

**Regras de uso**
1. **Um momento herói por tela** (o maior movimento: `RevealText variant="hero"`, `CaptureCelebration` ou um `CountUp` grande). O resto é discreto.
2. Ordem típica: título (`RevealText`, 0 ms) → conteúdo (`Stagger`/`FadeUp`, `delay` ~150–200 ms) → números (`CountUp`, `delay` ~200–300 ms).
3. Não anime CTA principal, abas, mapa nem botões de controle da corrida na entrada: eles têm que estar prontos no primeiro frame.
4. Troca de aba não anima (NativeTabs). Telas empilhadas: `push`; telas cheias (corrida, resumo): `modal`; entrar ↔ app: `fade`.
5. Repetição (lista que recarrega, `value` que muda): `Stagger`/`FadeUp` só animam ao montar; `CountUp` conta do valor atual até o novo.
6. **Títulos com `RevealText` viram palavras separadas na árvore visual.** Para seletores de teste use `testID` ou o papel/nome acessível (`getByRole('heading', { name })` no Playwright). Antes de trocar um título usado num fluxo Maestro por `RevealText`, confira o seletor (prefira `id:`).

## 3. Layout — `@/components/screen` e `@/components/chip-row`

| Helper | Props principais | Corrige |
|---|---|---|
| `ScreenScroll` | `edges` (`['top','bottom']` padrão; `['bottom']`/`[]` com cabeçalho nativo), `footer` (CTA fixo), `footerProps` (`backdrop`, `safeBottom`), `gap` (16), `padded`, `keyboardAware` (padrão sim), `onScroll` (aceita Reanimated), demais props de `ScrollView` | área segura, margem de 16 pt, teclado (`keyboardShouldPersistTaps`, `automaticallyAdjustKeyboardInsets`) e **espaço do CTA reservado** no fim do conteúdo |
| `Screen` | mesmas de cima, sem rolagem | telas cheias (contagem, pré-voo do GPS, estados de erro) |
| `BottomBar` (= `StickyFooter`) | `backdrop` (fundo da tela atrás do botão, padrão sim), `safeBottom`, `onHeightChange` | CTA na zona do polegar, 16 pt das laterais e acima da área segura (mesma posição do "Começar" atual). Fora de `Screen`/`ScreenScroll`: `onHeightChange` + `bottomBarReserve()` no `paddingBottom`/`contentContainerStyle` da sua lista |
| `bottomBarReserve({ barHeight, insetBottom, hasBar, safeBottom })` | — | conta pura do espaço a reservar |
| `ChipRow` | `options` (`[chave, rótulo]` ou `{key,label,accessibilityLabel}`), `value`, `onChange`, `testID` (prefixo: cada chip vira `${testID}-${chave}`), `accessibilityLabel` do grupo, `chipLabel` (ex.: `` l => `Período: ${l}` ``), `size` (`sm` 36 pt texto caption · `md` 40 pt texto bodyBold), `role` (`radio`/`button`), `bleed` | filtros que quebravam em 2 linhas: rola na horizontal de ponta a ponta. Visual igual aos chips atuais; alvo ≥ 44 pt via `hitSlop` |
| `Chip` | `testID`, `accessibilityLabel`, `label`, `selected`, `onPress`, `size`, `role` | chip avulso (dentro de `ChipRow` como `children`) |
| `layout` | `gutter` 16 · `gap` 16 · `sectionGap` 32 · `footerOffset` 16 · `footerBreathing` 16 · `ctaHeight` 60 | constantes da grade |

Exemplo de migração da "Nova corrida": trocar o `ScrollView` com `paddingBottom: 140` e o `View` absoluto do botão por `ScreenScroll footer={<Button testID="corrida-comecar" … size="lg" wide />}` — o testID continua o mesmo. Nos filtros do Clube/Atividades: `ChipRow testID="atividades-periodo" …` mantém `atividades-periodo-<id>`.

Os testes estáticos (`testids.test.ts`) agora também exigem `testID` e `accessibilityLabel` em `PressableScale` e `Chip`; o `reduced-motion.test.ts` exige `useReducedMotion` em todo arquivo que usa `enterAnimation`, `useAnimatedStyle` ou `pressFeedback`.

## 4. Checklist de layout mobile (skill `mobile-app-ui-design`)

- [ ] **Zona do polegar:** CTA principal no terço inferior, em `BottomBar` (ou no fim do conteúdo se a tela é curta). Ações destrutivas longe do CTA.
- [ ] **Grade de 8 pt:** só `space[…]`/`layout.*` (4, 8, 12, 16, 24, 32, 48). Relacionados perto (8–16), grupos distintos 2× (32).
- [ ] **Toque ≥ 44 pt:** alvo visual menor só com `hitSlop` (os helpers já fazem).
- [ ] **No máximo 4 tamanhos de fonte por tela** (ex.: `headline`, `title`, `body`, `caption`) e 2 pesos visíveis por bloco. Valor maior que o rótulo ("591" > "Vendas"). Números com `tabular`.
- [ ] **Área segura:** `Screen`/`ScreenScroll` com `edges` certos; nada encostado no notch nem no indicador de início.
- [ ] **Estados:** carregando (esqueleto ou indicador), vazio (`EmptyState` com direção e CTA), erro (mensagem + tentar de novo), sucesso. Nenhuma tela em branco.
- [ ] **Teclado:** formulários em `ScreenScroll` (padrão `keyboardAware`); o botão de enviar continua visível com o teclado aberto; `returnKeyType` encadeando campos.
- [ ] **Texto longo:** nada de largura fixa em rótulos; testar com nomes de zona longos e fonte do sistema maior.
- [ ] **Hierarquia 60/30/10:** laranja só em ação e rota; cor de time só no jogo (mapa, badges).
- [ ] **Um momento herói** e motion coerente com a seção 2.

## 5. Checklist de verificação (T6.5)

- [ ] Tamanhos: **360×640**, **375×667** (iPhone SE), **390×844**, **430×932**. Nada cortado, nada sob o CTA fixo (role até o fim), chips rolando sem quebrar linha, sem rolagem horizontal da página.
- [ ] **Reduzir movimento** ligado (iOS: Acessibilidade → Movimento; Android: Remover animações; Playwright: `reducedMotion: 'reduce'`): só fades, nada desliza ou escala, nada fica invisível.
- [ ] **60 fps:** animações em CSS/worklets do Reanimated (UI thread); nada de `setState` por frame além do `CountUp` (um texto). Perf Monitor no aparelho ao abrir listas com `Stagger`.
- [ ] Leitor de tela: títulos com `RevealText` lidos uma vez e como cabeçalho; `CountUp` lê o valor final com unidade.
- [ ] Toque durante a animação de entrada funciona (botões tocáveis desde o primeiro frame).
- [ ] Modo escuro em cada tela.
- [ ] `npm run typecheck`, `./node_modules/.bin/eslint src`, `npm test` verdes; imagens de referência do Playwright regeradas de propósito.
