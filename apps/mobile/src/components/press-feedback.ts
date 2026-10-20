import { CSS_EASE_OUT } from '@/theme/easing';
import { motion } from '@/theme/tokens';

/** Opacidade do botão pressionado quando a escala está desligada (movimento reduzido). */
const PRESSED_OPACITY = 0.7;

/**
 * Press feedback per expo-animation: scale 0.97 on press-in, 120 ms, strong ease-out,
 * as a Reanimated CSS transition (no shared value for a two-state toggle).
 * "Reduzir movimento" (RNF-011, QA-12): sem escala; o retorno vira só opacidade.
 */
export function pressFeedback(pressed: boolean, reduced: boolean, baseOpacity = 1) {
  if (reduced) {
    return {
      opacity: pressed ? baseOpacity * PRESSED_OPACITY : baseOpacity,
      transitionProperty: 'opacity' as const,
      transitionDuration: motion.press.duration,
      transitionTimingFunction: CSS_EASE_OUT,
    };
  }
  return {
    opacity: baseOpacity,
    transform: [{ scale: pressed ? motion.press.scale : 1 }],
    transitionProperty: 'transform' as const,
    transitionDuration: motion.press.duration,
    transitionTimingFunction: CSS_EASE_OUT,
  };
}
