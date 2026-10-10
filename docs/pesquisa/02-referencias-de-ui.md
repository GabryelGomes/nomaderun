# Pesquisa 2 — Referências de UI, motion e direção de design (out/2026)

> Parâmetros marcados **(rec.)** são recomendação da equipe de design, sem fonte primária.

## 1. Apps de referência — o que copiar
| App | Padrões que valem copiar |
|---|---|
| **Zenly** (2014–2023) | O mapa **é** o produto; camada de "pegadas" mostrando onde você já esteve; micro-vida no mapa; avatar expressivo como pin; privacidade divertida (congelar/borrar) |
| **Strava** (2025–26) | Tela de gravação com mapa + métricas juntos (jul/2025); splits em tempo real |
| **Nike Run Club** | Iniciar a 1 toque; pausa enorme; linguagem visual própria por tipo de corrida; "high five" em recordes |
| **Apple Workout (watchOS 26)** | Coach por voz (Workout Buddy) — os olhos ficam na rua |
| **Runna** | Onboarding conversacional; progresso semanal como anel |
| **Pokémon GO / Monopoly GO** | Base map simplificado para o jogo saltar; anéis de estado; "Reward Flow"; encadear camadas de efeito a cada 60–150 ms |
| **Duolingo** | Mascote em Rive com state machine; marcos de streak (7/30/100/365); fluxo "welcome back"; atraso de rede disfarçado de animação |
| **Airbnb (2025)** | Ícones 3D que animam ao toque; cantos arredondados |
| **Arc Search** | Um gesto físico com metáfora forte vira assinatura (ex.: "pinça para dobrar o território em card") |
| **Things 3 / Revolut / Linear** | Microinterações, consistência, transições curtas (< 200 ms) |
| **Concorrentes de território** | INTVL (loop), RunWars (H3 com força), Wibto (território inativo desbota), Zonner (roubar/defender, ranking por bairro) |

## 2. Linguagens de plataforma
- **Liquid Glass (iOS 26):** vidro só na camada de navegação/controles que flutua sobre o conteúdo; nunca vidro sobre vidro; variantes Regular e Clear; agrupar formas num container. RN: `expo-glass-effect`, `@callstack/liquid-glass`, fallback `expo-blur`. Sobre mapa claro, vidro precisa de tint para contraste 4,5:1.
- **Material 3 Expressive (Android 16):** molas em duas famílias (spatial e effects); 35 formas com morphing; haptics em gestos. Tokens de terceiros: fast (ζ 0,6 / k 800), default (0,8 / 380), slow (0,8 / 200).
- **Estratégia:** um design system com tokens de mola compatíveis com M3E; vidro no iOS, superfície tonal (28 dp) + shape morph no Android.

## 3. Motion e efeitos
| Preset (rec., mass 1) | damping | stiffness | Uso |
|---|---|---|---|
| snappy | 22 | 300 | toques, chips |
| sheet | 26 | 260 | bottom sheets |
| bouncy | 12 | 180 | recompensas |
| camera-ui | 30 | 200 | elementos que seguem o mapa |

- Shared element (Reanimated) 350–450 ms; `@gorhom/bottom-sheet` com snaps 12% / 45% / 92%.
- Haptics: selection (troca), Light (tap), Medium/Heavy (célula), Success (conquista), Warning (ataque) — nunca o único sinal.
- **Rive** para mascote/celebrações (state machine, arquivos menores); **Lottie** para loops simples.
- **Skia:** shaders SkSL (glow radial, mesh gradient), confete de 60–120 partículas.
- Mapa: Mapbox Standard com `lightPreset` (dia/entardecer/noite), prédios 3D, `emissive-strength` para brilho noturno; fly-to 1,2–1,8 s com pitch 0→55°; com Reduce Motion vira `easeTo` de 300 ms.

## 4. UX de mapa para fitness e jogo
- Base map **dessaturado**; territórios são a única cor forte (fill 25–35%, borda 2 px, label com halo).
- Paleta de facções **Okabe-Ito** (segura para daltônicos) + redundância por **padrão de hachura** e glifo.
- Zoom baixo: agregação por bairro; zoom alto: células. Durante a corrida, só o rastro e áreas em disputa.
- Uso com um polegar: controles embaixo, alvos de 56–64 pt, long-press de 600 ms para pausar/encerrar, swipe entre páginas de métricas.
- Sol forte: números de 72–96 pt, no máximo 3 métricas, **modo Sol** (preto puro sobre branco).
- Live Activity: compacto = pace + distância; lock screen = tempo, distância, pace, células.

## 5. Onboarding, retenção, acessibilidade
- Permissão: primeiro "Enquanto usa" + valor imediato; depois priming para "Sempre". O botão do priming sempre leva ao prompt do sistema (diretriz 5.1.1(iv) da Apple).
- Streaks semanais com marcos, "congelar streak", streak com amigos; Reward Flow.
- Empty state: mapa coberto de **névoa** — "Corra 1 km para revelar seu bairro".
- WCAG AA, `useReducedMotion`, fontScale até 200% fora da corrida, VoiceOver descritivo, nunca informação só por cor.

## 6. Onde buscar referências
Mobbin (flows do Strava: onboarding, análise, compartilhamento) · ScreensDesign (NRC, Runna) · Dribbble (tags zenly, running app dark mode) · Behance (zenly).

## 7. Direção proposta: "CARTOGRAFIA VIVA"
A cidade é um atlas de papel que ganha vida quando você corre: de dia, papel de cartógrafo; à noite, mapa noturno com brilho; territórios como tinta aquarelada com borda de nanquim; avatar nômade em Rive.

**Paleta base:** Ink `#0B0D10` · Paper `#F6F3EC` · Surface `#FFFFFF` / `#15181D` · Elevated dark `#1E232A` · **Lima Nômade `#D4FF3A`** (CTA) · Success `#2BB673` · Danger `#FF4D4F`.

**Facções (Okabe-Ito):** Maré `#0072B2`/`#56B4E9` (listras) · Brasa `#E69F00`/`#F5B83D` (pontos) · Mata `#009E73`/`#2FC79A` (xadrez) · Aurora `#CC79A7`/`#E39AC6` (ondas).

**Tipografia:** Bricolage Grotesque (display) · Inter (UI, tabular) · Barlow Condensed (números da corrida).

**10 animações assinatura:** revelar névoa · tinta de conquista · fly-to da cidade · contagem 3-2-1 com morph do botão · rastro vivo · ataque no território · avatar Rive · sheet de território · resumo pós-corrida com cascata · marco de streak.

## Fontes
techcrunch.com (Zenly 2022) · uxdesign.cc/designing-zenly-part-ii · press.strava.com (record experience) · the5krunner.com (2025/07) · ixd.prattsi.org (NRC 2019; Pokémon GO 2026) · wearecollins.com/case-studies/nike-run-club · gsmarena.com (watchOS 26) · techradar.com (Runna) · gamesbeat.com · pocketgamer.biz (Monopoly GO) · blog.duolingo.com (visemes; streak milestones) · rive.app/blog · itsnicethat.com (Airbnb) · developer.apple.com (WWDC25 219; design what's new) · createwithswift.com · androidauthority.com (M3 Expressive) · pub.dev (motor; material_expressive) · unpkg.com (reanimated 4.5.3 springConfigs) · docs.swmansion.com · mintlify.com/shopify/react-native-skia · callstack.com (Lottie vs Rive; Liquid Glass) · docs.expo.dev (haptics; glass-effect) · docs.mapbox.com/map-styles/standard · conceptviz.app (Okabe-Ito) · ntnuopen.ntnu.no · radar.com · mobbin.com · screensdesign.com · dribbble.com · behance.net · runwars.app · hunted.space (Wibto) · mwm.ai (Zonner)
