import { useState, type ComponentProps, type ReactNode } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Helpers de layout mobile (D-54, T6.1): área segura, grade de 8 pt e barra fixa inferior que
 * **reserva o espaço** do botão — o conteúdo nunca termina escondido atrás do CTA (bug "botão Começar
 * cobre a seção Corrida Segura").
 */
export const layout = {
  /** Margem lateral da tela. */
  gutter: space[4],
  /** Espaço entre blocos relacionados. */
  gap: space[4],
  /** Espaço entre seções (2× o gap). */
  sectionGap: space[8],
  /** Distância do CTA fixo até a borda inferior segura (zona do polegar). */
  footerOffset: space[4],
  /** Folga entre o fim do conteúdo e o topo da barra fixa. */
  footerBreathing: space[4],
  /** Altura de `Button size="lg"` — estimativa antes de medir a barra. */
  ctaHeight: 60,
} as const;

export type Edge = 'top' | 'bottom';

/**
 * Quanto o conteúdo precisa de espaço embaixo para não ficar sob a barra fixa.
 * `barHeight` = altura medida da barra (já inclui a área segura e o recuo); sem medida ainda, estima
 * pela altura do CTA. Sem barra: só a área segura (se pedida) mais a margem.
 */
export function bottomBarReserve({ barHeight, insetBottom, hasBar, safeBottom = true }: { barHeight?: number; insetBottom: number; hasBar: boolean; safeBottom?: boolean }): number {
  const safe = safeBottom ? insetBottom : 0;
  if (!hasBar) return safe + layout.gutter;
  const measured = barHeight && barHeight > 0 ? barHeight : layout.ctaHeight + space[2] + layout.footerOffset + safe;
  return Math.ceil(measured + layout.footerBreathing);
}

export type BottomBarProps = {
  children: ReactNode;
  /** Recebe a altura medida da barra (para reservar o espaço em listas próprias). */
  onHeightChange?: (height: number) => void;
  /** Fundo da cor da tela atrás do botão (padrão: sim), para o texto rolando não aparecer ao redor do CTA. */
  backdrop?: boolean;
  /** Soma a área segura inferior (padrão: sim). Desligue dentro de abas, onde a barra de abas já cuida. */
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Barra fixa no rodapé com o CTA principal (zona do polegar). Mesma posição do botão "Começar" atual:
 * 16 pt das laterais e 16 pt acima da área segura. Use dentro de `Screen`/`ScreenScroll` (prop `footer`),
 * que reservam o espaço sozinhos; fora deles, use `onHeightChange` + `bottomBarReserve`.
 */
export function BottomBar({ children, onHeightChange, backdrop = true, safeBottom = true, style, testID }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: layout.gutter,
          paddingTop: space[2],
          paddingBottom: (safeBottom ? insets.bottom : 0) + layout.footerOffset,
          gap: space[2],
          backgroundColor: backdrop ? colors.background : 'transparent',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Nome alternativo. */
export const StickyFooter = BottomBar;

type CommonProps = {
  children: ReactNode;
  /** Bordas com área segura aplicada pelo helper. Padrão `['top', 'bottom']`. Em telas com cabeçalho nativo, use `['bottom']` ou `[]`. */
  edges?: Edge[];
  /** CTA fixo no rodapé (ex.: `<Button size="lg" wide …/>`). O espaço dele é reservado no fim do conteúdo. */
  footer?: ReactNode;
  /** Props da barra do rodapé. */
  footerProps?: Omit<BottomBarProps, 'children' | 'onHeightChange'>;
  /** Margem lateral e topo da grade (padrão: sim). */
  padded?: boolean;
  /** Espaço entre filhos (padrão 16). */
  gap?: number;
  testID?: string;
};

function useReserve(footer: ReactNode, edges: Edge[], footerProps?: CommonProps['footerProps']) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(0);
  const safeBottom = footer ? (footerProps?.safeBottom ?? true) : edges.includes('bottom');
  const reserve = bottomBarReserve({ barHeight, insetBottom: insets.bottom, hasBar: Boolean(footer), safeBottom });
  return { insets, reserve, setBarHeight };
}

/** Tela sem rolagem (mapa, contagem, estados de tela cheia), com área segura e CTA fixo opcional. */
export function Screen({ children, edges = ['top', 'bottom'], footer, footerProps, padded = true, gap = layout.gap, style, testID }: CommonProps & { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const { insets, reserve, setBarHeight } = useReserve(footer, edges, footerProps);
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          {
            flex: 1,
            gap,
            paddingTop: (edges.includes('top') ? insets.top : 0) + (padded ? layout.gutter : 0),
            paddingHorizontal: padded ? layout.gutter : 0,
            paddingBottom: reserve,
          },
          style,
        ]}>
        {children}
      </View>
      {footer ? (
        <BottomBar {...footerProps} onHeightChange={setBarHeight}>
          {footer}
        </BottomBar>
      ) : null}
    </View>
  );
}

export type ScreenScrollProps = CommonProps &
  Omit<ComponentProps<typeof Animated.ScrollView>, 'children'> & {
    /** Desligue para formulários longos que já tratam o teclado de outro jeito. */
    keyboardAware?: boolean;
  };

/**
 * Tela rolável: área segura, margem de 16 pt, gap da grade, teclado tratado (toques passam com o teclado
 * aberto; no iOS o conteúdo sobe junto) e espaço reservado para o CTA fixo. Aceita `onScroll` do
 * Reanimated (ex.: `useParallax().onScroll`).
 */
export function ScreenScroll({
  children,
  edges = ['top', 'bottom'],
  footer,
  footerProps,
  padded = true,
  gap = layout.gap,
  keyboardAware = true,
  contentContainerStyle,
  testID,
  ...rest
}: ScreenScrollProps) {
  const { colors } = useTheme();
  const { insets, reserve, setBarHeight } = useReserve(footer, edges, footerProps);
  const manualTop = edges.includes('top');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        testID={testID}
        contentInsetAdjustmentBehavior={manualTop ? 'never' : 'automatic'}
        keyboardShouldPersistTaps={keyboardAware ? 'handled' : undefined}
        keyboardDismissMode={keyboardAware ? 'interactive' : undefined}
        automaticallyAdjustKeyboardInsets={keyboardAware}
        scrollEventThrottle={16}
        {...rest}
        contentContainerStyle={[
          {
            gap,
            paddingTop: (manualTop ? insets.top : 0) + (padded ? layout.gutter : 0),
            paddingHorizontal: padded ? layout.gutter : 0,
            paddingBottom: reserve,
          },
          contentContainerStyle,
        ]}>
        {children}
      </Animated.ScrollView>
      {footer ? (
        <BottomBar {...footerProps} onHeightChange={setBarHeight}>
          {footer}
        </BottomBar>
      ) : null}
    </View>
  );
}
