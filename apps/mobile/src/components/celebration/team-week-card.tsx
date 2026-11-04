import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Mascot } from '@/components/art';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { cssEasings, durations, springCss, springs } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';
import { floating, radius, space } from '@/theme/tokens';

import { TEAM_WEEK } from './f8-choreography';
import { kf, pop, step } from './moment';

export type TeamWeekCardProps = {
  team: FactionId;
  /** "2º na temporada · 48 zonas" ou o convite. */
  body: string;
  /** O time está em 1º: o mascote comemora (`vitoria`); senão, "bora virar" (`parado`, vivo). */
  first: boolean;
  /** Saindo (1 toque ou 4 s): some com fade de 200 ms. */
  leaving?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
};

const SLIDE = { from: { opacity: 0, transform: [{ translateY: TEAM_WEEK.slideFrom }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };
const OUT = { from: { opacity: 1 }, to: { opacity: 0 } };

/**
 * Faixa "A semana do time" (F8 · C1, ideia 5.10): entra de cima com a mola `snappy`, o mascote salta na pose com a
 * mola `bouncy` (0,6 → 1) e fica vivo enquanto a faixa está na tela (≤ 4 s); sai com fade. Os dados e o tempo de
 * tela são da E7 (`TeamWeekBanner`). "Reduzir movimento": fades de 150 ms e o mascote parado.
 */
export function TeamWeekCard({ team, body, first, leaving = false, onPress, accessibilityLabel, testID }: TeamWeekCardProps) {
  const reduced = useReducedMotionSetting();
  // D-90 (F8-D): a faixa fica ao lado do emblema/mascote fora do mapa, então usa o neon do time (não o sólido do
  // mapa); a tinta é a base quase preta, que passa 5:1 nos 4 neons (teste em `f8-d-fix-e7`).
  const bg = neonTeam[team];
  const ink = neon.bg;
  return (
    <Animated.View
      style={
        leaving
          ? { animationName: kf(OUT), animationDuration: reduced ? durations.reducedFade : durations.exit, animationTimingFunction: cssEasings.exit, animationFillMode: 'both' }
          : step(reduced, SLIDE, springs.snappy.duration, 0, springCss('snappy'))
      }>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
        onPress={onPress}
        // À direita ficam o sino e as camadas do mapa: a faixa para antes deles.
        style={{ marginRight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: bg, boxShadow: floating }}>
        <Animated.View aria-hidden importantForAccessibility="no-hide-descendants" style={[{ width: 40, height: 44 }, step(reduced, pop(TEAM_WEEK.mascotFrom), springs.bouncy.duration, TEAM_WEEK.mascotAt, springCss('bouncy'))]}>
          <Mascot team={team} pose={first ? 'vitoria' : 'parado'} size={40} color={ink} animated={!reduced && !leaving} />
        </Animated.View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyBold" color={ink} numberOfLines={1}>
            Semana nova!
          </Text>
          <Text variant="caption" color={ink} numberOfLines={1}>
            {body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
