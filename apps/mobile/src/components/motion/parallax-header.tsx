import type { ReactNode } from 'react';
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { distances } from '@/theme/motion';

import { parallaxValues } from './parallax-math';

/**
 * Parallax de cabeçalho com `useAnimatedScrollHandler` (UI thread, sem re-render).
 * Uso livre: `const p = useParallax(240)` → `<Animated.ScrollView onScroll={p.onScroll} scrollEventThrottle={16}>`
 * e `<Animated.View style={[{ height: 240 }, p.headerStyle]}>` no topo do conteúdo.
 */
export function useParallax(height: number, factor: number = distances.parallax) {
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });
  const headerStyle = useAnimatedStyle(() => {
    const v = parallaxValues(scrollY.get(), height, factor, reduced);
    return { opacity: v.opacity, transform: [{ translateY: v.translateY }, { scale: v.scale }] };
  });
  return { scrollY: scrollY as SharedValue<number>, onScroll, headerStyle };
}

export type ParallaxScrollViewProps = Omit<ScrollViewProps, 'onScroll' | 'children'> & {
  /** Conteúdo do cabeçalho grande (título herói, número, ilustração). */
  header: ReactNode;
  /** Altura do cabeçalho em pt (múltiplo de 8). */
  headerHeight: number;
  /** 0–1: quanto o cabeçalho acompanha a rolagem (padrão 0,5). */
  factor?: number;
  headerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
};

/**
 * Lista rolável com cabeçalho grande em parallax sutil (landonorris.com). O conteúdo passa por cima do
 * cabeçalho, que anda na metade da velocidade e some. "Reduzir movimento": o cabeçalho só esmaece.
 * Para a barra fixa inferior, passe `contentContainerStyle={{ paddingBottom: reserve }}` (ver `Screen`).
 */
export function ParallaxScrollView({ header, headerHeight, factor, headerStyle, children, testID, contentContainerStyle, ...rest }: ParallaxScrollViewProps) {
  const p = useParallax(headerHeight, factor);
  return (
    <Animated.ScrollView testID={testID} {...rest} onScroll={p.onScroll} scrollEventThrottle={16} contentContainerStyle={contentContainerStyle}>
      <Animated.View style={[{ height: headerHeight, overflow: 'visible', zIndex: 0 }, headerStyle, p.headerStyle]}>{header}</Animated.View>
      <View style={{ zIndex: 1 }}>{children}</View>
    </Animated.ScrollView>
  );
}
