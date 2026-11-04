import { type ReactNode, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Mascot } from '@/components/art';
import { Confetti } from '@/components/motion/confetti';
import { PressableScale } from '@/components/motion/pressable';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { useMountStage } from '@/components/motion/use-mount-stage';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { cssEasings, durations, springCss, springs } from '@/theme/motion';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';

import { floodScale, MASCOT_NOD, TEAM_TIMELINE } from './choreography';
import { type MomentBaseProps, kf, rise, step, useMoment } from './moment';

export type TeamConfirmProps = MomentBaseProps & {
  faction: FactionId;
  /** Troca o mascote (padrão: o `Mascot` da E4 do time, na pose "vitória", que acena com a cabeça). */
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
  /**
   * Último quadro (D-91): entra depois da frase do líder (ex.: "Seu rastro agora é amarelo" + moldura Recruta).
   * Recebe `still` (sem coreografia) e o atraso em ms do quadro.
   */
  finale?: (ctx: { still: boolean; delay: number }) => ReactNode;
  /** Texto do último quadro para o leitor de tela. */
  finaleText?: string;
  /** Um toque em qualquer lugar fora do botão pula para o estado final (padrão: sim na `ftue`). */
  skippable?: boolean;
};

const BASE = 100;

/**
 * Confirmação épica da escolha de time (catálogo §7, D-72): a cor do time inunda a tela a partir do botão
 * (círculo que cresce só com `scale`, ≤ 600 ms), vibração forte aos 150 ms, o mascote do time (arte da E4,
 * pose "vitória") salta com mola e acena com a cabeça (`parts.cabeca`, pivô no pescoço), 2 ondas de choque e
 * confete, o nome do time sobe e a frase do líder aparece; "Bora correr" é tocável desde o início.
 * "Reduzir movimento": a cor aparece com fade de 250 ms e o conteúdo com fades curtos, sem aceno.
 */
export function TeamConfirm(props: TeamConfirmProps) {
  const { faction, mascot, leader, origin, onContinue, variant = 'ftue', ctaLabel = 'Bora correr', testID, finale, finaleText, skippable = variant === 'ftue' } = props;
  const team = factions[faction];
  const glow = neonTeam[faction];
  const text = `Você agora corre com os ${team.name}. ${leader.name}: ${leader.quote}${finaleText ? ` ${finaleText}` : ''}`;
  const reduced = useReducedMotionSetting();
  // "Pular": um toque fora do botão leva ao estado final (fade curto), como o orquestrador faria com `state: 'done'`.
  const [skipped, setSkipped] = useState(false);
  const { still } = useMoment('team-confirm', 'epic', { ...props, state: skipped ? 'done' : props.state, compact: variant === 'switch' }, text, reduced, {
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
  // F8-D (QA da onda D): o mascote em SVG neon, as ondas e o confete montam 1 quadro pintado depois da cor e do texto
  // (o quadro do toque caía para 150–316 ms a 4× de CPU). A caixa do mascote tem tamanho fixo: nada pula na tela.
  // Os atrasos descontam o tempo até a montagem (`lag`), e a coreografia continua no mesmo relógio.
  const { stage, lag } = useMountStage(1);
  const late = (ms: number) => Math.max(0, ms - lag(1));

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
      {/* "Pular": um toque em qualquer lugar fora do botão leva ao estado final (o botão, mais fundo, ganha o toque). */}
      {/* Sem `disabled`: na web ele viraria aria-disabled e "desligaria" o botão de dentro para o Playwright e o leitor. */}
      <Pressable testID={`${testID}-pular`} accessible={false} focusable={false} role="none" accessibilityLabel="Pular a cerimônia" onPress={skippable && !still ? () => setSkipped(true) : undefined} style={{ flex: 1 }}>
        <View accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: space[6] }}>
        <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          {variant === 'ftue' && !still && stage >= 1
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
                    // escondida até a hora dela (com 'both' a onda ficava parada na tela antes de sair)
                    opacity: 0,
                    animationName: kf({ from: { opacity: 0.9, transform: [{ scale: 0.6 }] }, to: { opacity: 0, transform: [{ scale: 2.6 }] } }),
                    animationDuration: 800,
                    animationDelay: late(T.waves + d),
                    animationTimingFunction: cssEasings.standard,
                    animationFillMode: 'forwards',
                  }}
                />
              ))
            : null}
          <Animated.View
            style={step(still, { from: { opacity: 0, transform: [{ translateY: 48 }, { scale: 0.4 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } }, springs.bouncy.duration, T.content, springCss('bouncy'))}>
            {stage < 1 ? null : (mascot ?? (
              <Mascot
                team={faction}
                pose="vitoria"
                size={150}
                parts={
                  still
                    ? undefined
                    : { cabeca: { animationName: kf(MASCOT_NOD.keyframes), animationDuration: MASCOT_NOD.durationMs, animationDelay: late(T.name), animationTimingFunction: cssEasings.standard, animationFillMode: 'both' } }
                }
              />
            ))}
          </Animated.View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] }}>
          {words.map((w, i) => (
            <View key={`${w}${i}`} style={{ overflow: 'hidden' }}>
              <Animated.View style={step(still, rise(40), durations.reveal * 0.75, T.name + i * 70, cssEasings.reveal)}>
                {/* UX-18: sem brilho atrás do nome (na web virava uma faixa escura que parecia seleção) */}
                <Text variant="headline" color={team.onColor}>
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
        {finale ? finale({ still, delay: T.finale }) : null}
        <Animated.View style={step(still, rise(12), 400, finale ? T.ctaFinale : T.cta)}>
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
      </Pressable>
      {variant === 'ftue' && !still && stage >= 1 ? <Confetti count={24} colors={['#FFFFFF', glow, team.tint]} width={width} height={height} origin={{ x: width / 2, y: height * 0.38 }} delay={late(T.waves)} seed={13} /> : null}
    </View>
  );
}
