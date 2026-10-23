---
name: swm-rn-animations
description: "Production animation patterns for React Native using Reanimated 4, Skia, WebGPU, and TypeGPU. Covers CSS transitions, CSS animations, CSS pseudo-selectors, CSS callbacks, shared value animations, canvas animations with react-native-skia, GPU shader animations, layout animations, scroll-driven animations, particle systems, procedural noise, SDF rendering, performance tuning, and accessibility. Trigger on: Reanimated, useSharedValue, useAnimatedStyle, withSpring, withTiming, withDecay, withRepeat, withSequence, CSS transition, CSS animation, layout animation, FadeIn, SlideIn, ZoomIn, LinearTransition, keyframe, interpolate, scrollTo, useFrameCallback, react-native-skia, Skia Canvas, Atlas, usePathInterpolation, usePathValue, useClock, useTexture, SKSL, interpolateColors, Picture API, canvas animation, sprite animation, WebGPU, react-native-wgpu, TypeGPU, GPU shader, WGSL, particle system, Perlin noise, SDF, Three.js, react-three-fiber, animation performance, or any request to animate UI in React Native."
---

> **Nota NOMADE RUN (E2, 2026-10-23).** Cópia de `software-mansion-labs/skills` (MIT), sub-skill `react-native-best-practices/references/animations`, com o `name` trocado para não colidir. Só 3 das 10 referências vieram (`animations.md`, `canvas-animations.md`, `animations-performance.md`); as outras estão em https://github.com/software-mansion-labs/skills/tree/main/skills/react-native-best-practices/references/animations.
> Regras do projeto que valem acima do texto abaixo:
> - O app usa **Reanimated 4.5.1** e **Worklets 0.10.1** (o que vem no Expo Go SDK 57). Callbacks de CSS (`onCSSAnimation*`, `onCSSTransition*`) são da 4.6.0 e **não existem aqui**. Pseudo-seletores (`:active`) e CSS em `react-native-svg` (4.4/4.5) existem.
> - Animações e transições CSS **ignoram** "Reduzir movimento": leia `useReducedMotion()` e encurte (1 ms), como o texto explica.
> - GPU/WebGPU (`gpu-animations.md`, `react-native-wgpu`, TypeGPU) **não roda no Expo Go**. Não use.
> - React Compiler: não escreva `sharedValue.value = ...` durante a renderização (alguns exemplos fazem isso); mova para `useEffect` ou handler.


# Animations

Software Mansion's production animation patterns for React Native on Reanimated 4 and the New Architecture.

Load at most one reference file per question. For API signatures and config options, webfetch the documentation pages linked in each reference file.

## Version Check

Read the installed Reanimated version before writing animation code: `node_modules/react-native-reanimated/package.json` or the lockfile, not the `package.json` range. Reanimated 3.x has no CSS transitions or animations; use shared values there. On 4.x, a feature used below the version that added it (table in `animations.md`) is silently ignored or throws: do not emit it, and if the user asked for that feature, say which version adds it.

## Critical Rules

- **NEVER use `runOnJS`**. It is removed in Reanimated 4. Use `scheduleOnRN(fn, ...args)` from `react-native-worklets` instead. This applies everywhere: scroll handlers, gesture callbacks, `useAnimatedReaction`, `useFrameCallback`, and any other worklet context.

## References

| File | When to read |
|------|-------------|
| `references/animations.md` | Choosing between CSS transitions, CSS animations, and shared value animations; CSS feature availability by Reanimated version; CSS transition and CSS animation patterns and rules; CSS callbacks (`onCSS*`, 4.6.0+); animating text; infinite animation cleanup; `scheduleOnRN` |
| `css-pseudo-selectors.md` (não incluído aqui; ver URL na nota) | Interaction state without React state: `:hover`, `:active`, `:active-deepest`, `:focus`, `:focus-within` (4.5.0+), selector precedence, the property lock, per-platform press traps |
| `animation-functions.md` (não incluído aqui; ver URL na nota) | Gotchas and rules for core hooks (`useSharedValue`, `useAnimatedStyle`, `useAnimatedProps`, `useDerivedValue`); `withSpring` config modes; `withRepeat` and `withClamp` caveats; composing animations |
| `layout-animations.md` (não incluído aqui; ver URL na nota) | Entering/exiting animation gotchas (`nativeID` conflict, view flattening); layout transitions; keyframe animation rules; list item animations (`itemLayoutAnimation`); shared element transitions |
| `scroll-and-events.md` (não incluído aqui; ver URL na nota) | Scroll-driven animation patterns (`useAnimatedScrollHandler`, `scrollTo`, `useScrollOffset`); `useAnimatedReaction` patterns; `useFrameCallback`; `measure` rules |
| `references/canvas-animations.md` | Canvas animations with `@shopify/react-native-skia`; Reanimated integration (shared values as direct props); `interpolateColors`; retained vs immediate mode (Picture API); path animations (`usePathInterpolation`, `usePathValue`); `useClock`; gesture integration and element tracking; SKSL runtime shaders and image filters; textures |
| `canvas-atlas.md` (não incluído aqui; ver URL na nota) | Atlas for batched sprite/tile animation; `useTexture`, `useRSXformBuffer`; RSXform matrix format (`[scos, ssin, tx, ty]`) |
| `gpu-animations.md` (não incluído aqui; ver URL na nota) | GPU shader animations; `react-native-wgpu` Canvas and device setup; TypeGPU typed pipelines; Reanimated + WebGPU worklet integration; compute pipelines for particle systems, physics, and simulations; `@typegpu/noise` (Perlin noise, PRNG); `@typegpu/sdf` (signed distance shapes); Three.js / React Three Fiber for 3D |
| `svg-animations.md` (não incluído aqui; está em `swm-rn-svg/references/`) | Animating SVG elements and paths with Reanimated; `createAnimatedComponent` for SVG; progress arcs; pulsing circles |
| `references/animations-performance.md` | Performance tuning; 120fps setup; feature flags; FPS drop fixes; simultaneous animation limits; accessibility (`useReducedMotion`, `ReducedMotionConfig`); worklet closure optimization; debug vs release builds |
