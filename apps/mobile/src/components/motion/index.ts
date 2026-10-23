/** Primitivas de motion da Fase 6 (D-54, T6.1) e da v2 (Fase 7, T7.1.13). Guia: docs/DESIGN_MOBILE_MOTION.md. */
export { CountUp, type CountUpProps } from './count-up';
export { countSteps, countValue, formatCount } from './count';
export { FadeUp, Stagger, type FadeUpProps, type StaggerProps } from './fade-up';
export { enterAnimation, splitReveal } from './motion-styles';
export { ParallaxScrollView, useParallax, type ParallaxScrollViewProps } from './parallax-header';
export { parallaxValues } from './parallax-math';
export { Pressable, PressableScale, type PressableScaleProps } from './pressable';
export { RevealText, type RevealTextProps } from './reveal-text';
export { ScreenEnter, screenTransition, useScreenTransition, type ScreenEnterProps, type ScreenTransitionKind } from './screen-enter';
export { staggerDelay } from '@/theme/motion';

// v2 (T7.1.13)
export { haptic, HapticGate, resetHaptics, useHaptics, type HapticOptions, type HapticPattern } from './haptics';
export { ReducedMotionOverride, useReducedMotionSetting } from './reduced-motion';
export { ProgressBar, type ProgressBarProps } from './progress-bar';
export { ProgressRing, type ProgressRingProps } from './progress-ring';
export { ShimmerSkeleton, type ShimmerSkeletonProps } from './shimmer-skeleton';
export { Confetti, type ConfettiProps } from './confetti';
export { Burst, type BurstProps } from './burst';
export { Flash, type FlashProps } from './flash';
export { FloatingNumber, type FloatingNumberProps } from './floating-number';
export { SpinRays, type SpinRaysProps } from './spin-rays';
export { Shake, type ShakeProps } from './shake';
export { clampParticles, confettiParticles, crossedMilestones, floatingStack, seededRandom, shakeOffsets } from './particles';

// onda 2 (T7.2.9)
export { isHidden, usePausedWhenHidden } from './use-paused-when-hidden';
