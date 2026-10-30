import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Burst } from '@/components/motion/burst';
import { Confetti } from '@/components/motion/confetti';
import { formatCount } from '@/components/motion/count';
import { CountUp } from '@/components/motion/count-up';
import { ProgressRing } from '@/components/motion/progress-ring';
import { TeamBadge } from '@/components/team-badge';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { springCss, springs } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';

import { ZONE_TIMELINE as Z } from './choreography';
import { type MomentBaseProps, pop, rise, step, useMoment } from './moment';
import { RewardToast } from './reward-toast';

export type ZoneCapturedProps = MomentBaseProps & {
  faction: FactionId;
  zone: string;
  /** Pontos da conquista. Na corrida (previsão ao vivo) eles ainda não existem: sem `points`, não aparecem. */
  points?: number;
  /** `run`: toast + borda acesa, sem partícula (o GPS vem primeiro). `summary`: anel, selo, faíscas e confete. */
  context: 'run' | 'summary';
  /** Arte do selo (E4); padrão: o `TeamBadge`. */
  badge?: ReactNode;
};

/**
 * Zona conquistada (catálogo §4.1 e §4.6). No resumo: o anel fecha em 720 ms (6 traços), o selo entra com
 * mola, o título sobe, o anel pulsa com 10 faíscas e 24 confetes e os pontos contam. "Reduzir movimento":
 * anel já fechado e tudo com fade.
 */
export function ZoneCaptured(props: ZoneCapturedProps) {
  const { faction, zone, points, context, badge, testID } = props;
  const text = points === undefined ? `Zona conquistada: ${zone}` : `Zona conquistada: ${zone}, mais ${points} pontos`;
  if (context === 'run') {
    return (
      <RewardToast
        {...props}
        size="medium"
        placement="top"
        edgeGlow
        particles={false}
        color={neonTeam[faction]}
        icon={badge ?? <TeamBadge faction={faction} size={36} />}
        title="Zona conquistada"
        subtitle={zone}
        value={points === undefined ? undefined : `+${points}`}
        testID={testID}
      />
    );
  }
  return <ZoneSummary {...props} text={text} />;
}

function ZoneSummary(props: ZoneCapturedProps & { text: string }) {
  const { faction, zone, points, badge, testID, text } = props;
  const reduced = useReducedMotionSetting();
  const { still, at } = useMoment('zone-captured', 'medium', props, text, reduced);
  const team = neonTeam[faction];
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing
          value={1}
          size={132}
          stroke={10}
          color={neonTeam[faction]}
          segments={6}
          pulseAt={[1]}
          duration={still ? 0 : at(Z.ringMs)}
          accessibilityLabel={`Zona ${zone} conquistada`}>
          <Animated.View style={step(still, pop(0.5), springs.bouncy.duration, at(Z.badge), springCss('bouncy'))}>{badge ?? <TeamBadge faction={faction} size={72} />}</Animated.View>
        </ProgressRing>
        {!still ? <Burst color={team} count={10} distance={90} delay={at(Z.peak)} /> : null}
        {!still ? <Confetti count={24} colors={[team, '#FFFFFF', neon.orange]} width={260} height={360} origin={{ x: 66, y: 66 }} delay={at(Z.peak)} seed={3} /> : null}
      </View>
      <Animated.View style={step(still, rise(14), 600, at(Z.title))}>
        <Text variant="headline" style={{ textAlign: 'center' }}>
          Zona conquistada
        </Text>
      </Animated.View>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }, step(still, rise(12), 500, at(Z.points))]}>
        {points === undefined ? null : (
          <CountUp value={points} format={(n) => `+${formatCount(n)}`} duration={still ? 0 : 600} delay={still ? 0 : at(Z.points + 40)} variant="lead" color={neon.orangeText} accessibilityLabel={`mais ${points} pontos`} />
        )}
        <Text variant="lead" muted>
          {points === undefined ? zone : `pontos em ${zone}`}
        </Text>
      </Animated.View>
    </View>
  );
}
