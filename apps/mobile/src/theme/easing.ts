import { cubicBezier, Easing } from 'react-native-reanimated';

/** Curves from the expo-animation skill. Never ease-in on UI. */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
