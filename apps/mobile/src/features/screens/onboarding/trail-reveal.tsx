import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { TeamEmblem } from '@/components/art/team/emblem';
import { rise, step } from '@/components/celebration/moment';
import { Text } from '@/components/text';
import { trailLine } from '@/domain/team-bio';
import type { FactionId } from '@/domain/types';
import { cssEasings, easings, springCss, springs } from '@/theme/motion';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Trecho de rota estilizado (viewBox 280 × 72): sobe e desce como um bairro, termina à direita. */
const ROUTE = 'M 8 56 C 50 56, 60 18, 100 22 S 150 58, 190 44 S 240 12, 272 20';
const ROUTE_LENGTH = 320;
/** Quanto a rota demora para se desenhar (ms). */
export const TRAIL_DRAW_MS = 700;
/** Nome do cosmético liberado na cerimônia (regra 9 de `F8/01` §1.3). */
export const RECRUIT_FRAME = { id: 'moldura-recruta', name: 'Recruta' } as const;

export type TrailRevealProps = {
  team: FactionId;
  /** Sem coreografia (movimento reduzido ou "Pular"): tudo já no estado final. */
  still: boolean;
  /** Atraso (ms) do início deste quadro dentro da cerimônia. */
  delay: number;
  testID?: string;
};

/** Texto do quadro, para o leitor de tela. */
export function trailRevealText(team: FactionId): string {
  return `${trailLine(team)}. Moldura ${RECRUIT_FRAME.name} liberada.`;
}

/**
 * Último quadro da cerimônia (D-91, regra 6): "Seu rastro agora é amarelo", a linha da rota se desenhando na cor
 * do time e a moldura "Recruta" entrando com mola. A linha é 1 `Path` com `strokeDashoffset` animado (o mesmo
 * truque do fundo das telas de entrada); com `still`, aparece já desenhada.
 */
export function TrailReveal({ team, still: stillProp, delay, testID = 'rastro' }: TrailRevealProps) {
  // A cerimônia já respeita "Reduzir movimento" (`useReducedMotionSetting`); aqui é só a garantia local.
  const reduced = useReducedMotion();
  const still = stillProp || reduced;
  const f = factions[team];
  const glow = neonTeam[team];
  const drawn = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      drawn.set(1);
      return;
    }
    drawn.set(0);
    drawn.set(withDelay(delay, withTiming(1, { duration: TRAIL_DRAW_MS, easing: easings.reveal })));
  }, [still, delay, drawn]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LENGTH * (1 - drawn.get()) }));

  return (
    <View testID={testID} style={{ alignItems: 'center', gap: space[3], alignSelf: 'stretch' }}>
      <Animated.View style={step(still, rise(12), 400, delay, cssEasings.standard)}>
        <Text variant="title" color={f.onColor} style={{ textAlign: 'center' }}>
          {trailLine(team)}
        </Text>
      </Animated.View>
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 280, height: 72 }}>
        <Svg width={280} height={72} viewBox="0 0 280 72">
          {[
            { w: 14, o: 0.22, s: glow },
            { w: 6, o: 0.5, s: glow },
            { w: 3, o: 1, s: f.onColor },
          ].map((l) => (
            <AnimatedPath key={l.w} d={ROUTE} fill="none" stroke={l.s} strokeWidth={l.w} strokeOpacity={l.o} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${ROUTE_LENGTH} ${ROUTE_LENGTH}`} animatedProps={lineProps} />
          ))}
        </Svg>
      </View>
      <Animated.View
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], paddingHorizontal: space[4], borderRadius: radius.pill, borderWidth: 2, borderColor: f.onColor },
          step(still, { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } }, springs.bouncy.duration, delay + TRAIL_DRAW_MS, springCss('bouncy')),
        ]}>
        <View aria-hidden importantForAccessibility="no-hide-descendants">
          <TeamEmblem team={team} size={40} variant="medio" color={f.onColor} on={f.color} />
        </View>
        <Text variant="bodyBold" color={f.onColor}>
          Moldura {RECRUIT_FRAME.name}
        </Text>
      </Animated.View>
    </View>
  );
}
