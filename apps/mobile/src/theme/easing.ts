import { cubicBezier, Easing } from 'react-native-reanimated';

/**
 * Curvas da fase anterior (skill expo-animation). Continuam exportadas para não quebrar quem usa
 * (`run-screen`, `capture-celebration`). Código novo: use `@/theme/motion` (`easings`, `cssEasings`).
 */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export { cssEasings, curves, easings } from './motion';
