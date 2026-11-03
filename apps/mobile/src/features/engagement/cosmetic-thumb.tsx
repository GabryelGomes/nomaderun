/**
 * Miniatura de cosmético (UX-39): o rastro aparece como um traço colorido (o que a pessoa vai ver no mapa), a
 * moldura como um anel e o efeito com o ícone de brilho. Cores só do Pit Lane Neon (D-61). Decorativa: o nome e o
 * "como ganhar" vão no rótulo do item.
 */
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { EMBER, ICE } from '@/components/art';
import { PRISM_STOPS } from '@/components/art/neon/palette';
import { RARITY_COLORS } from '@/components/celebration';
import { Icon } from '@/components/icon';
import { neon, neonTeam } from '@/theme/neon';
import { radius } from '@/theme/tokens';

import type { CosmeticDef } from './cosmetics';

/** Cores do traço de cada rastro (1 cor = traço liso; 2 ou mais = degradê). */
export const TRAIL_COLORS: Readonly<Record<string, readonly string[]>> = {
  'rastro-faisca': [neonTeam.coyotes],
  'rastro-cometa': [ICE, neonTeam.striders],
  'rastro-temporada': [neon.orange],
  'rastro-temporada-brilho': [neon.orangeText, neonTeam.coyotes],
  'rastro-temporada-animado': PRISM_STOPS.map(([, c]) => c),
  'rastro-aurora': [neonTeam.volt, neonTeam.striders],
  'rastro-lava': [EMBER, neon.orange],
  'rastro-gelo': [ICE],
  'rastro-oceano': [neonTeam.striders, ICE],
  'rastro-neon': [neon.orange, neon.villain],
};

/** Cor do traço (ou do primeiro ponto do degradê): o padrão é o laranja do sistema. */
export function trailColors(id: string): readonly string[] {
  return TRAIL_COLORS[id] ?? [neon.orange];
}

const TRAIL_PATH = 'M3 21 C 11 4, 19 30, 27 13 S 39 6, 45 10';

export function CosmeticThumb({ def, owned, size = 48 }: { def: CosmeticDef; owned: boolean; size?: number }) {
  const ring = RARITY_COLORS[def.rarity];
  const dim = owned ? 1 : 0.55;
  if (def.slot === 'trail') {
    const colors = trailColors(def.id);
    const gid = `rastro-${def.id}`;
    return (
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 0.6, opacity: dim }}>
        <Svg width={size} height={size * 0.6} viewBox="0 0 48 28">
          {colors.length > 1 ? (
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                {colors.map((c, i) => (
                  <Stop key={`${c}-${i}`} offset={i / (colors.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
          ) : null}
          <Path d={TRAIL_PATH} stroke={colors.length > 1 ? `url(#${gid})` : colors[0]} strokeWidth={5} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
    );
  }
  if (def.slot === 'frame') {
    return (
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size * 0.6, height: size * 0.6, borderRadius: radius.pill, borderWidth: 3, borderColor: ring, opacity: dim }} />
    );
  }
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ opacity: dim }}>
      <Icon name="sparkles" size={size * 0.5} color={ring} />
    </View>
  );
}
