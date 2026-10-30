import { createElement, useId, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Prim, PrimTag } from './core';
import { PRISM_STOPS } from './palette';

const TAGS: Record<PrimTag, ComponentType<Record<string, unknown>>> = {
  g: G as unknown as ComponentType<Record<string, unknown>>,
  path: Path as unknown as ComponentType<Record<string, unknown>>,
  circle: Circle as unknown as ComponentType<Record<string, unknown>>,
  rect: Rect as unknown as ComponentType<Record<string, unknown>>,
  ellipse: Ellipse as unknown as ComponentType<Record<string, unknown>>,
};

/** A arte nunca recebe toque (fica por baixo do botão ou do card que a usa). */
const NO_TOUCH: ViewStyle = { pointerEvents: 'none' };

function renderPrim(p: Prim, key: number): ReactNode {
  return createElement(TAGS[p.tag], { key, ...p.a }, p.c ? p.c.map(renderPrim) : undefined);
}

/** Desenha os elementos gerados por `expand()` (1:1, sem lógica). */
export function Prims({ prims }: { prims: Prim[] }) {
  return <>{prims.map(renderPrim)}</>;
}

/** Id de gradiente estável e válido em `url(#…)` (o `useId` traz ":" que algumas plataformas recusam). */
export function useGradId(prefix = 'prisma'): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function PrismDefs({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        {PRISM_STOPS.map(([o, c]) => (
          <Stop key={o} offset={o} stopColor={c} />
        ))}
      </LinearGradient>
    </Defs>
  );
}

export type ArtBox = { vbW: number; vbH: number; width: number };

/** Estilo de uma camada animável: aceita o resultado de `useAnimatedStyle` (E5) ou um estilo comum. */
export type ArtPartStyle = ComponentProps<typeof Animated.View>['style'];

/** Um `Svg` com o viewBox fixo da família, na largura pedida (altura pela proporção). */
export function ArtSvg({ box, prims, gradId }: { box: ArtBox; prims: Prim[]; gradId?: string }) {
  const height = (box.width * box.vbH) / box.vbW;
  return (
    <Svg width={box.width} height={height} viewBox={`0 0 ${box.vbW} ${box.vbH}`}>
      {gradId ? <PrismDefs id={gradId} /> : null}
      <Prims prims={prims} />
    </Svg>
  );
}

/** Ponto de pivô no viewBox → `transformOrigin` em porcentagem, para o `Animated.View` da camada. */
export function originOf(box: ArtBox, x: number, y: number): string {
  return `${Math.round((x / box.vbW) * 10000) / 100}% ${Math.round((y / box.vbH) * 10000) / 100}%`;
}

/**
 * Camada animável: um `Svg` dentro de um `Animated.View` que cobre a arte inteira, com o pivô em
 * `transformOrigin`. Mover a camada inteira é muito mais barato do que animar cada path (P9).
 */
export function ArtLayer({
  box,
  prims,
  gradId,
  origin,
  style,
  children,
}: {
  box: ArtBox;
  prims: Prim[];
  gradId?: string;
  origin?: string;
  style?: ArtPartStyle;
  children?: ReactNode;
}) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, NO_TOUCH, origin ? { transformOrigin: origin } : null, style]}>
      <ArtSvg box={box} prims={prims} gradId={gradId} />
      {children}
    </Animated.View>
  );
}

export type ArtA11y = {
  /** Com rótulo, a arte é informativa (lida como imagem); sem rótulo, é decorativa e some do leitor de tela. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Caixa da arte com a acessibilidade certa. Decorativa: `aria-hidden` + `accessibilityElementsHidden` +
 * `importantForAccessibility="no-hide-descendants"` no `View` (as props `accessibility*` no próprio `Svg`
 * vazam para o DOM na web). Informativa: `accessibilityRole="image"` com o rótulo.
 */
export function ArtFrame({ box, accessibilityLabel, testID, style, children }: ArtA11y & { box: ArtBox; children: ReactNode }) {
  const size = { width: box.width, height: (box.width * box.vbH) / box.vbW };
  if (accessibilityLabel) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} testID={testID} style={[size, NO_TOUCH, style]}>
        {children}
      </View>
    );
  }
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[size, NO_TOUCH, style]}>
      {children}
    </View>
  );
}

/** Arte estática de uma camada só (a maioria das famílias). */
export function StaticArt({ box, prims, gradId, ...a11y }: ArtA11y & { box: ArtBox; prims: Prim[]; gradId?: string }) {
  return (
    <ArtFrame box={box} {...a11y}>
      <ArtSvg box={box} prims={prims} gradId={gradId} />
    </ArtFrame>
  );
}
