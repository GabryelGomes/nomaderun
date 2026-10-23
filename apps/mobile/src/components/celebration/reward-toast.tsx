import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Burst } from '@/components/motion/burst';
import { Confetti } from '@/components/motion/confetti';
import { Flash } from '@/components/motion/flash';
import { SpinRays } from '@/components/motion/spin-rays';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { celebrationLevels, cssEasings, durations, springCss, springs, type CelebrationLevel } from '@/theme/motion';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { kf, step, type MomentBaseProps, useMoment } from './moment';

export type RewardToastSize = 'small' | 'medium' | 'epic';

export type RewardToastProps = MomentBaseProps & {
  size: RewardToastSize;
  /** Ícone ou arte (E4) à esquerda/no centro. */
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Valor em destaque: "+120 pontos", "+40 XP". */
  value?: string;
  /** Cor do feito (time, raridade). */
  color: string;
  /** `top`: desce do topo (durante a corrida); `center`: cartão no meio. Padrão: `top` no pequeno e médio. */
  placement?: 'top' | 'center';
  /** Quanto tempo fica parado antes de sair (padrão 2,25 s). */
  holdMs?: number;
  /** Sai sozinho depois do `holdMs` (padrão: sim no `top`). */
  autoHide?: boolean;
  /** Borda da tela acende na cor (zona conquistada durante a corrida). */
  edgeGlow?: boolean;
  /** Faíscas, raios e confete (padrão: sim). Durante a corrida passe `false`: o GPS vem primeiro. */
  particles?: boolean;
};

const LEVEL: Record<RewardToastSize, CelebrationLevel> = { small: 'small', medium: 'medium', epic: 'epic' };

/**
 * Aviso de recompensa em 3 tamanhos. Pequeno: desce com mola `snappy`, sem partícula. Médio: + faíscas.
 * Épico: cartão no centro com raios, faíscas e confete. Durante a corrida use pequeno/médio (sem partícula
 * pesada). O texto final fica numa região viva para o leitor de tela.
 */
export function RewardToast(props: RewardToastProps) {
  const { size, icon, title, subtitle, value, color, placement = size === 'epic' ? 'center' : 'top', holdMs = durations.toastHold, edgeGlow, particles = true, testID } = props;
  const autoHide = props.autoHide ?? placement === 'top';
  const { colors } = useTheme();
  const text = [title, subtitle, value].filter(Boolean).join('. ');
  const enterMs = placement === 'top' ? springs.snappy.duration : springs.bouncy.duration;
  // o toast vive o tempo de entrar, ficar parado e sair; vibra 1× com o padrão do nível
  const lifeMs = autoHide ? enterMs + holdMs + durations.exit : Math.max(enterMs, celebrationLevels[LEVEL[size]].minMs);
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('group', LEVEL[size], props, text, reduced, { durationMs: lifeMs, beats: [{ offsetMs: 0, pattern: celebrationLevels[LEVEL[size]].haptic }] });
  const enter = placement === 'top' ? { from: { opacity: 0, transform: [{ translateY: -80 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } } : { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } };
  const exit = placement === 'top' ? { from: { opacity: 1, transform: [{ translateY: 0 }] }, to: { opacity: 0, transform: [{ translateY: -40 }] } } : { from: { opacity: 1 }, to: { opacity: 0 } };
  const exitDelay = (still ? durations.reducedFade : enterMs) + holdMs;

  return (
    <View testID={testID} pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0 }, placement === 'top' ? { top: space[4] } : { top: 0, bottom: 0, justifyContent: 'center' }]}>
      {edgeGlow ? <Flash kind="edge" color={color} duration={600} peak={0.9} /> : null}
      <Animated.View
        style={[
          { alignSelf: 'center' },
          autoHide
            ? { animationName: kf(still ? { from: { opacity: 1 }, to: { opacity: 0 } } : exit), animationDuration: still ? durations.reducedFade : durations.exit, animationDelay: exitDelay, animationTimingFunction: cssEasings.exit, animationFillMode: 'both' }
            : null,
        ]}>
        <Animated.View
          accessibilityLiveRegion="polite"
          accessible
          accessibilityLabel={text}
          style={[
            {
              flexDirection: placement === 'top' ? 'row' : 'column',
              alignItems: 'center',
              gap: space[3],
              paddingVertical: space[3],
              paddingHorizontal: space[4],
              minWidth: placement === 'top' ? 260 : 240,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: color,
              boxShadow: `0 0 24px ${color}55`,
            },
            step(still, enter, enterMs, 0, springCss(placement === 'top' ? 'snappy' : 'bouncy')),
          ]}>
          {icon ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }}>
              {size === 'epic' && particles && !still ? <SpinRays color={color} size={200} delay={100} /> : null}
              {size !== 'small' && particles && !still ? <Burst color={color} count={size === 'epic' ? 12 : 8} delay={enterMs * 0.6} distance={size === 'epic' ? 80 : 48} /> : null}
              {icon}
            </View>
          ) : null}
          <View style={{ alignItems: placement === 'top' ? 'flex-start' : 'center', gap: 2, flexShrink: 1 }}>
            <Text variant={size === 'epic' ? 'headline' : 'bodyBold'} style={placement === 'center' ? { textAlign: 'center' } : undefined}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="small" muted style={placement === 'center' ? { textAlign: 'center' } : undefined}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {value ? (
            <Text variant={size === 'epic' ? 'metric' : 'title'} tabular color={neon.orangeText} style={placement === 'top' ? { marginLeft: 'auto' } : undefined}>
              {value}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
      {size === 'epic' && particles && !still ? <Confetti count={36} colors={[color, '#FFFFFF', neon.orange]} delay={enterMs * 0.5} seed={11} /> : null}
    </View>
  );
}
