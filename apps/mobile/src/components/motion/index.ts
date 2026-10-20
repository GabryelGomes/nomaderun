/** Primitivas de motion da Fase 6 (D-54, T6.1). Guia: docs/DESIGN_MOBILE_MOTION.md. */
export { CountUp, type CountUpProps } from './count-up';
export { countValue, formatCount } from './count';
export { FadeUp, Stagger, type FadeUpProps, type StaggerProps } from './fade-up';
export { enterAnimation, splitReveal } from './motion-styles';
export { ParallaxScrollView, useParallax, type ParallaxScrollViewProps } from './parallax-header';
export { parallaxValues } from './parallax-math';
export { Pressable, PressableScale, type PressableScaleProps } from './pressable';
export { RevealText, type RevealTextProps } from './reveal-text';
export { ScreenEnter, screenTransition, useScreenTransition, type ScreenEnterProps, type ScreenTransitionKind } from './screen-enter';
export { staggerDelay } from '@/theme/motion';
