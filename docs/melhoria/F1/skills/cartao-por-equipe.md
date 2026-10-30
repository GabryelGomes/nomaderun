# Cartão por equipe: quais skills chamar (Fase 7)

Feito pela E2 em 2026-10-23. Todas as skills abaixo estão em `.claude/skills/` (o Claude Code carrega sozinho). O detalhe, as regras e as fontes estão em `docs/melhoria/F1/02-skills-e-mcps.md`. Antes de instalar qualquer biblioteca nativa, confira a tabela do Expo Go SDK 57 (seção 4 do relatório).

| Equipe | Chame primeiro | Depois, se precisar |
|---|---|---|
| E1 Pesquisa | `user-onboarding-activation`, `retention-engagement` | `game-responsibility-review`, `referrals-word-of-mouth` |
| E3 Jogo e território | `game-mechanics-design`, `game-balance-economy` | `gamification-loops`, `property-based-testing`, `game-responsibility-review` |
| E4 Arte | `swm-rn-svg`, `motion-design` | `text-to-lottie` (player só no scratchpad), `impeccable-refs` (`delight.md`), `react-native-skia` |
| E5 Motion | `swm-rn-animations`, `game-feel`, `expo-animation` | `react-native-reanimated`, `react-native-skia`, `emil-design-eng`, `motion-design` |
| E6 UX | `ux-writing`, `impeccable-refs` (`onboard.md`, `audit.native.md`) | `mobile-accessibility`, `expo-native-ui`, `expo-router`, `mobile-app-ui-design`, `emil-design-eng` |
| E7 Engajamento | `user-onboarding-activation`, `retention-engagement`, `game-responsibility-review` | `gamification-loops`, `game-feel` |
| E8 Social | `referrals-word-of-mouth` | `react-native-skia` (captura alternativa), `ux-writing` |
| E9 Backend | `supabase`, `supabase-postgres-best-practices` | `property-based-testing` |
| E10 Qualidade | `visual-testing`, `mobile-accessibility`, `webapp-testing` | `impeccable-refs` (`audit.native.md`), `react-native-best-practices` (Callstack), `sharp-edges` |

## Lembretes que valem para todas

- **Versões do app** (Expo Go SDK 57): Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32.0 (API v2), react-native-svg 15.15.4.
- **Reanimated:**
  - sem `onCSS*`, que só existe a partir da 4.6;
  - sem `runOnJS`: use `scheduleOnRN`;
  - animação CSS com "Reduzir movimento" ligado: duração de 1 ms.
- **React Compiler:** nunca escreva `sharedValue.value` nem leia ref durante a renderização.
- **Não rodam no Expo Go:** Rive, `react-native-share`, Pulsar e WebGPU. Push remoto também não funciona no Android.
- **Antes de entregar** sequência, recompensa diária ou notificação: passe pela `game-responsibility-review`.
