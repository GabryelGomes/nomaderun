import { type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Confetti } from '@/components/motion/confetti';
import { PressableScale } from '@/components/motion/pressable';
import { TeamBadge } from '@/components/team-badge';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { cssEasings, durations, springCss, springs } from '@/theme/motion';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';

import { floodScale, TEAM_TIMELINE } from './choreography';
import { type MomentBaseProps, kf, rise, step, useMoment } from './moment';

export type TeamConfirmProps = MomentBaseProps & {
  faction: FactionId;
  /** Mascote do time (arte da E4). Sem arte: o emblema do time. */
  mascot?: ReactNode;
  /** Líder do time e a frase dele (D-70; texto final da E4/E6). */
  leader: { name: string; quote: string };
  /** Centro do botão que confirmou, em pt da tela: a cor nasce dali. */
  origin: { x: number; y: number };
  /** "Bora correr". */
  onContinue: () => void;
  /** `ftue`: primeira escolha (épica, 2 s); `switch`: troca de time (curta, 1,2 s, sem ondas nem confete). */
  variant?: 'ftue' | 'switch';
  /** Texto do botão final (padrão "Bora correr"). */
  ctaLabel?: string;
};

const BASE = 100;

/**
 * Confirmação épica da escolha de time (catálogo §7, D-72): a cor do time inunda a tela a partir do botão
 * (círculo que cresce só com `scale`, ≤ 600 ms), vibração forte aos 150 ms, emblema/mascote com mola, 2 ondas
 * de choque e confete, o nome do time sobe e a frase do líder aparece; "Bora correr" é tocável desde o
 * início. "Reduzir movimento": a cor aparece com fade de 250 ms e o conteúdo com fades curtos.
 */
export function TeamConfirm(props: TeamConfirmProps) {
  const { faction, mascot, leader, origin, onContinue, variant = 'ftue', ctaLabel = 'Bora correr', testID } = props;
  const team = factions[faction];
  const glow = neonTeam[faction];
  const text = `Você agora corre com os ${team.name}. ${leader.name}: ${leader.quote}`;
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('team-confirm', 'epic', { ...props, compact: variant === 'switch' }, text, reduced, {
    durationMs: variant === 'switch' ? 1200 : 2000,
    beats: [
      { offsetMs: TEAM_TIMELINE[variant].flood, pattern: 'heavy' },
      { offsetMs: TEAM_TIMELINE[variant].waves > 0 ? TEAM_TIMELINE[variant].waves : TEAM_TIMELINE[variant].flood + TEAM_TIMELINE[variant].floodMs, pattern: 'success' },
    ],
  });
  const T = TEAM_TIMELINE[variant];
  const { width, height } = useWindowDimensions();
  const scale = floodScale(origin, width, height, BASE);
  const words = team.name.split(' ');

  return (
    <View testID={testID} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* a cor do time: um círculo que cresce do botão (só transform) */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: origin.x - BASE / 2, top: origin.y - BASE / 2, width: BASE, height: BASE, borderRadius: BASE / 2, backgroundColor: team.color },
          reduced
            ? { animationName: kf({ from: { opacity: 0, transform: [{ scale }] }, to: { opacity: 1, transform: [{ scale }] } }), animationDuration: 250, animationFillMode: 'both' }
            : still
              ? { transform: [{ scale }] }
              : { animationName: kf({ from: { transform: [{ scale: 0 }] }, to: { transform: [{ scale }] } }), animationDuration: T.floodMs, animationDelay: T.flood, animationTimingFunction: cssEasings.screen, animationFillMode: 'both' },
        ]}
      />
      {/* vinheta para o texto ficar legível */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.32)' }, step(still, { from: { opacity: 0 }, to: { opacity: 1 } }, 400, T.vignette, cssEasings.standard)]}
      />
      <View accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: space[6] }}>
        <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          {variant === 'ftue' && !still
            ? [0, 160].map((d) => (
                <Animated.View
                  key={d}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                    animationName: kf({ from: { opacity: 0.9, transform: [{ scale: 0.6 }] }, to: { opacity: 0, transform: [{ scale: 2.6 }] } }),
                    animationDuration: 800,
                    animationDelay: T.waves + d,
                    animationTimingFunction: cssEasings.standard,
                    animationFillMode: 'both',
                  }}
                />
              ))
            : null}
          <Animated.View
            style={step(still, { from: { opacity: 0, transform: [{ rotate: '-90deg' }, { scale: 0.3 }] }, to: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1 }] } }, springs.bouncy.duration, T.content, springCss('bouncy'))}>
            {mascot ?? <TeamBadge faction={faction} size={140} />}
          </Animated.View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] }}>
          {words.map((w, i) => (
            <View key={`${w}${i}`} style={{ overflow: 'hidden' }}>
              <Animated.View style={step(still, rise(40), durations.reveal * 0.75, T.name + i * 70, cssEasings.reveal)}>
                <Text variant="headline" color={team.onColor} style={{ textShadowColor: glow, textShadowRadius: 16 }}>
                  {w.toUpperCase()}
                </Text>
              </Animated.View>
            </View>
          ))}
        </View>
        <Animated.View style={[{ alignItems: 'center', gap: 4 }, step(still, rise(16), 500, T.quote)]}>
          <Text variant="lead" color={team.onColor} style={{ textAlign: 'center' }}>
            “{leader.quote}”
          </Text>
          <Text variant="small" color={team.onColor} style={{ opacity: 0.85 }}>
            {leader.name}
          </Text>
        </Animated.View>
        <Animated.View style={step(still, rise(12), 400, T.cta)}>
          <PressableScale
            testID={`${testID}-continuar`}
            accessibilityLabel={ctaLabel}
            onPress={onContinue}
            style={{ height: 56, paddingHorizontal: space[8], borderRadius: radius.pill, backgroundColor: team.onColor, alignItems: 'center', justifyContent: 'center' }}>
            {/* D-75: texto escuro sobre o botão claro (e claro sobre o escuro, no amarelo) */}
            <Text variant="bodyBold" color={team.onColor === '#FFFFFF' ? '#070708' : '#FFFFFF'}>
              {ctaLabel}
            </Text>
          </PressableScale>
        </Animated.View>
      </View>
      {variant === 'ftue' && !still ? <Confetti count={24} colors={['#FFFFFF', glow, team.tint]} width={width} height={height} origin={{ x: width / 2, y: height * 0.38 }} delay={T.waves} seed={13} /> : null}
    </View>
  );
}
