import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { neon } from '@/theme/neon';

/**
 * Luz ambiente neon atrás das telas (D-59): a mesma mancha laranja do login, mais fraca e parada,
 * para as abas terem a atmosfera da apresentação sem disputar com o conteúdo. Decorativa (fora do
 * leitor de tela, sem toque) e estática (nada a reduzir com "Reduzir movimento").
 */
export function NeonAmbient() {
  return (
    <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: neon.bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="ambTop" cx="85%" cy="0%" r="70%">
            <Stop offset="0" stopColor={neon.orange} stopOpacity="0.2" />
            <Stop offset="0.5" stopColor={neon.glowBg} stopOpacity="0.35" />
            <Stop offset="1" stopColor={neon.bg} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambBottom" cx="0%" cy="100%" r="60%">
            <Stop offset="0" stopColor={neon.orange} stopOpacity="0.1" />
            <Stop offset="1" stopColor={neon.bg} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill="url(#ambTop)" />
        <Rect width="390" height="844" fill="url(#ambBottom)" />
      </Svg>
    </View>
  );
}
