---
name: swm-rn-svg
description: "Software Mansion's best practices for SVG rendering in React Native apps using React Native SVG. Use when rendering vector graphics, icons, charts, illustrations, or any SVG content. Trigger on: 'react-native-svg', 'SVG', 'vector graphics', 'render icon', 'draw shape', 'chart', 'path', 'Svg component', 'SvgUri', 'SvgXml', 'SvgCss', 'FilterImage', 'SVG filter', or any request to display scalable vector content in a React Native app."
---

> **Nota NOMADE RUN (E2, 2026-10-23).** Cópia de `software-mansion-labs/skills` (MIT), sub-skill `react-native-best-practices/references/svg`, com o `name` trocado e com `svg-animations.md` (da sub-skill de animações) incluído em `references/`. Fonte: https://github.com/software-mansion-labs/skills/tree/main/skills/react-native-best-practices/references/svg.
> Regras do projeto: `react-native-svg` **15.15.4** (vem no Expo Go SDK 57). Ilustrações estáticas grandes (mascotes, chefões parados) renderizam melhor via `expo-image` ou Skia; use `react-native-svg` + Reanimated só quando precisar animar partes. Lottie (`lottie-react-native` 7.3.8) também vem no Expo Go; Rive **não**. React Compiler: não atribua `sharedValue.value` na renderização (os exemplos de `svg-animations.md` fazem isso; mova para `useEffect`).


# SVG

Software Mansion's production SVG patterns for React Native using React Native SVG.

For API details on specific components and props, webfetch https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md

## References

| File | When to read |
|------|-------------|
| `references/when-to-use.md` | Deciding between react-native-svg, expo-image, @expo/vector-icons, Skia, or Lottie |
| `references/svg.md` | Installing react-native-svg; loading SVGs from URIs, XML strings, or files; filters; touch events; performance considerations; known issues |
| `references/svg-animations.md` | Animar elementos e paths SVG com Reanimated (`createAnimatedComponent`), arcos de progresso, círculos pulsando (incluído pelo NOMADE a partir da sub-skill de animações) |
