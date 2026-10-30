import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { FactionId } from '@/domain/types';

import { expand, type Quality } from '../neon/core';
import { Prims } from '../neon/render';
import { BACKGROUND_BOX, BACKGROUND_OPACITY, backgroundNodes, MAX_BACKGROUND_OPACITY, type TabBackgroundKind } from './background-art';

export type TabBackgroundProps = {
  kind: TabBackgroundKind;
  /** Time da pessoa (a aura de "Você"). */
  team?: FactionId;
  /** Opacidade; nunca passa de 6% (`MAX_BACKGROUND_OPACITY`). */
  opacity?: number;
  /** Padrão `plano`: a 6% o halo não aparece e só custaria elementos. */
  quality?: Quality;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fundo sutil da aba, estático e decorativo: cobre o pai (`absoluteFill`), não recebe toque e fica fora do
 * leitor de tela. Coloque-o como primeiro filho da tela, atrás do conteúdo.
 */
export function TabBackground({ kind, team, opacity, quality = 'plano', testID, style }: TabBackgroundProps) {
  const op = Math.min(opacity ?? BACKGROUND_OPACITY[kind], MAX_BACKGROUND_OPACITY);
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[StyleSheet.absoluteFill, { opacity: op, pointerEvents: 'none' }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${BACKGROUND_BOX.vbW} ${BACKGROUND_BOX.vbH}`} preserveAspectRatio="xMidYMid slice">
        <Prims prims={expand(backgroundNodes(kind, team), quality)} />
      </Svg>
    </View>
  );
}
