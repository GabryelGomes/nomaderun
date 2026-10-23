import { cssEasings, durations, press } from '@/theme/motion';

/** Opacidade do botão pressionado quando a escala está desligada (movimento reduzido). */
const PRESSED_OPACITY = press.reducedOpacity;

/**
 * Retorno ao toque (D-54): escala 0,97 em 120 ms com power2.out, como transição CSS do Reanimated
 * (sem shared value para um estado de dois valores). Usado por Button, IconButton e `Pressable` de
 * `@/components/motion`.
 * "Reduzir movimento" (RNF-011, QA-12): sem escala; o retorno vira só opacidade.
 */
export function pressFeedback(pressed: boolean, reduced: boolean, baseOpacity = 1) {
  if (reduced) {
    return {
      opacity: pressed ? baseOpacity * PRESSED_OPACITY : baseOpacity,
      transitionProperty: 'opacity' as const,
      transitionDuration: durations.press,
      transitionTimingFunction: cssEasings.standard,
    };
  }
  return {
    opacity: baseOpacity,
    transform: [{ scale: pressed ? press.scale : 1 }],
    transitionProperty: 'transform' as const,
    transitionDuration: durations.press,
    transitionTimingFunction: cssEasings.standard,
  };
}
