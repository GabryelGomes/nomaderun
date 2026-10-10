# Pesquisa 3 — Stack técnica para um app extremamente fluido (out/2026)

> Versões marcadas **(?)** vieram de fonte secundária. Conferidas no npm em 10/10/2026: `expo` 57.0.27, `react-native` 0.87.1 (o SDK 57 usa 0.86.3), `react-native-reanimated` 4.7.1 (o SDK 57 instala 4.5.x), `@shopify/react-native-skia` 2.14.0, `@rnmapbox/maps` 10.3.7, `@maplibre/maplibre-react-native` 11.5.0, `h3-js` 4.5.0.

## 1. React Native + Expo hoje
- **RN 0.86** (jun/2026) e **0.87** (ago/2026); **New Architecture obrigatória** (Fabric/JSI/bridgeless) desde o SDK 55; **Hermes V1** padrão desde o RN 0.84.
- **Expo SDK 57** (30/06/2026, RN 0.86, React 19.2) é o estável; SDK 58 em beta (iOS 27).
- **React Compiler 1.0** estável e ativado por padrão em projetos Expo novos (sem `useMemo` manual).
- **Reanimated 4** (animações e transições estilo CSS + worklets na UI thread).
- **Skia 2.14** estável (shaders, glow, partículas); v3 com Graphite recém-lançada — testar em branch.
- **Gesture Handler 3** (API de hooks), **FlashList 2** (listas).
- **expo-glass-effect** (Liquid Glass iOS 26+), **Expo UI** (SwiftUI/Compose), **expo-widgets** (Live Activities).

## 2. Comparação de frameworks
| Critério | RN/Expo | Flutter | KMP + Compose MP | Nativo |
|---|---|---|---|---|
| Fluidez | Muito boa (UI thread, Skia, Fabric) | Excelente (Impeller) | Boa | Máxima |
| Mapa pesado | SDKs nativos Mapbox/MapLibre | Bom com SDK nativo | Embrulhar SDKs à mão | Máxima |
| GPS em background | Módulo nativo | Plugins | Nativo | Total |
| Velocidade p/ 2 estudantes | **Maior** (TS, EAS, OTA) | Alta (Dart) | Média | Baixa (2 bases) |
| Ecossistema | O maior | Grande | Crescendo | Completo |

**Decisão:** **Expo SDK 57 + React Native + TypeScript, com Development Builds.** Os SDKs nativos de mapa e GPS fazem o trabalho pesado; Reanimated + Skia entregam 60–120 fps. Flutter seria a 2ª opção; nativo puro não compensa para 2 pessoas.

## 3. Mapas
- **Mapbox (`@rnmapbox/maps`, Maps SDK v11):** estilo Standard 3D, `fill-extrusion`, iluminação dia/noite, emissive (brilho). Grátis até ~25.000 MAU no mobile (?) — conferir mapbox.com/pricing.
- **MapLibre RN 11.5:** open source, **feature-state API** (recolorir hexágonos sem reenviar dados); tiles por conta própria.
- **react-native-maps:** roda no Expo Go, mas sem extrusão/estilo vetorial rico e trava com muitos polígonos — bom só para protótipo.
- **Boas práticas:** hexágonos como vector tiles (`ST_AsMVT`) ou GeoJSON por viewport; troca de dono via feature-state; agregação em zoom baixo; **nunca um componente React por hexágono**.
- **Web/painel:** deck.gl `H3HexagonLayer`.
- **Decisão:** Mapbox no MVP; estilo compatível com MapLibre como plano B.

## 4. Localização em segundo plano
- `expo-location` + TaskManager: serve para protótipo (bug aberto em bridgeless #50060; Android não reinicia app encerrado).
- **`react-native-background-geolocation` (Transistor) 5.7:** o mais confiável (detecção de movimento, SQLite, filtros); grátis em debug, licença paga em release (~US$ 399 (?)).
- Alternativa: Expo Module próprio (iOS `CLLocationUpdate.liveUpdates` + `CLBackgroundActivitySession`; Android FusedLocation + foreground service tipo `location`).
- Se a corrida sempre começa com o app aberto, basta permissão "durante o uso" + foreground service (evita revisão dura de `ACCESS_BACKGROUND_LOCATION`).
- Bateria: `distanceFilter` 5–10 m, `activityType` fitness, pausa automática, filtro de Kalman, envio em lote, GPS desligado fora da corrida.
- Saúde: HealthKit (`@kingstinct/react-native-healthkit`) e Health Connect.

## 5. Backend
- **Supabase:** Postgres + PostGIS, Auth, Storage, Edge Functions, Realtime (**Broadcast from Database** em canais privados). Free ~200 conexões; Pro US$ 25/mês (?).
- **`h3-pg` não existe no Supabase hospedado** → calcular H3 com `h3-js` na Edge Function e gravar como `bigint` indexado.
- Firebase (sem SQL geoespacial) e Convex (sem PostGIS) descartados; Elixir/Go + Redis GEO na fase 2.
- **Fluxo multiplayer:** cliente envia lotes (30–60 s) → Edge Function valida antifraude e converte em células → transação faz upsert em `territory` → trigger publica no tópico da célula-pai (res 5/6) → cada cliente assina só os tópicos do seu viewport.
- **Resolução H3:** captura em **res 10** (~15.000 m², aresta ~66 m, tolera erro de GPS); render em res 9/8; agregados em res 7.

## 6. Qualidade
Maestro (E2E), k6 (carga de WebSocket/Realtime), Sentry, EAS Build/Update/Submit.

## 7. Extras
Coach com LLM via Edge Function (sem chave no app) + TTS · `expo-speech`/`expo-audio` com ducking · Live Activities com `expo-widgets` · Android Live Updates via módulo Kotlin · Apple Watch com `@bacons/apple-targets` · Wear OS nativo.

## Stack recomendada
| Camada | Tecnologia | Versão | Por quê |
|---|---|---|---|
| Framework | Expo (dev builds) + React Native + TypeScript | SDK 57 / RN 0.86 | Uma base, OTA, maior ecossistema |
| Engine | Hermes V1 + React Compiler | padrão / 1.0 | Desempenho sem memoização manual |
| Navegação | Expo Router (NativeTabs) | ~57 | Rotas por arquivo, abas nativas |
| Animação | Reanimated 4 + Worklets | 4.5+ | UI thread, animações CSS |
| Gráficos | @shopify/react-native-skia | 2.14 | Glow, partículas, shaders |
| Gestos | react-native-gesture-handler | 2.32 / 3.x | Integração com Reanimated |
| Listas | FlashList | 2.x | Feita para a New Architecture |
| UI nativa | expo-glass-effect, Expo UI | SDK 57 | Liquid Glass, SwiftUI/Compose |
| Mapa | @rnmapbox/maps; plano B MapLibre | 10.3 / 11.5 | 3D, extrusão, feature-state |
| GPS | react-native-background-geolocation | 5.7 | Mais confiável em background |
| Backend | Supabase + PostGIS + h3-js | Pro | SQL geoespacial + realtime |
| Grade | H3 | res 10 / 9 / 8 / 7 | Tolera ruído de GPS |
| QA | Maestro, k6, Sentry, EAS | atuais | E2E, carga, crashes |
| Web | deck.gl H3HexagonLayer | 9.x | Painel |

## Fontes
expo.dev/changelog (sdk-55, 56, 57, 58-beta) · npmjs.com/package/expo · reactnative.dev/blog (0.86, 0.87) · endoflife.date/react-native · callstack.com (Hermes V1) · react.dev/blog/2025/10/07/react-compiler-1 · github.com/software-mansion/react-native-reanimated/releases · github.com/Shopify/react-native-skia · github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.0.0 · npmjs.com/package/@shopify/flash-list · docs.flutter.dev · kotlinlang.org · npmjs.com/package/@rnmapbox/maps · github.com/maplibre/maplibre-react-native/releases/tag/v11.0.0 · storerocket.io/learn/mapbox-pricing · pkgpulse.com (maps 2026; E2E 2026) · deck.gl (H3HexagonLayer) · docs.expo.dev (location; widgets; glass-effect) · github.com/expo/expo/issues/50060 · github.com/transistorsoft/react-native-background-geolocation · developer.apple.com (WWDC23 10180) · developer.android.com (fgs service types) · android-developers.googleblog.com (Android 16) · github.com/29ki/react-native-health-connect · github.com/EvanBacon/expo-apple-targets · supabase.com (realtime broadcast; broadcast from database; postgis; location sharing with maplibre) · github.com/orgs/supabase/discussions/9687 · github.com/getsentry/sentry-react-native/issues/6384
