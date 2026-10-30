import { useState, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { Burst } from '@/components/motion/burst';
import { formatCount } from '@/components/motion/count';
import { haptic } from '@/components/motion/haptics';
import { PressableScale } from '@/components/motion/pressable';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { durations, springCss } from '@/theme/motion';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { BORA_TIMELINE as B, boraFeedback } from './choreography';
import { kf } from './moment';

export type BoraReactionProps = {
  /** Obrigatório (feed: `feed-<id>-bora`). */
  testID: string;
  /** A pessoa já mandou "Bora!" neste card. */
  active: boolean;
  /** Toque: a tela alterna (otimista) e fala com o servidor. A comemoração sai na hora do toque. */
  onPress: () => void;
  /** Quantos "Bora!" o card tem (opcional). */
  count?: number;
  /** Texto do botão (padrão "Bora!"). As outras reações prontas (fogo, raio) usam o mesmo componente. */
  label?: string;
  /** Ícone à esquerda do texto (opcional). */
  icon?: ReactNode;
  /** Padrão: "Mandar Bora!" / "Tirar Bora!", com a contagem. */
  accessibilityLabel?: string;
  /** Cor de destaque quando ativo (padrão: o laranja). */
  color?: string;
  /** Liga/desliga a vibração aqui (a preferência salva "Vibração" também vale). */
  hapticsEnabled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Mola curta e viva (≈ 320 ms, amortecimento 0,45) para o pulo da reação. */
const BORA_SPRING = springCss({ dampingRatio: 0.45 });

/**
 * "Bora!" do feed da crew (D-79, para a E8): ao mandar, o selo pula com mola curta, solta 6 faíscas e vibra
 * leve (seleção); tirar é silencioso. A cor de ativo entra por opacidade (sem animar cor). "Reduzir
 * movimento": sem pulo nem faíscas, só o fade da cor (a vibração leve continua, é o retorno do toque).
 * O alvo de toque tem ≥ 44 pt.
 */
export function BoraReaction({ testID, active, onPress, count, label = 'Bora!', icon, accessibilityLabel, color = neon.orange, hapticsEnabled = true, disabled, style }: BoraReactionProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionSetting();
  const [pulse, setPulse] = useState(0);
  const a11y = accessibilityLabel ?? `${active ? `Tirar ${label}` : `Mandar ${label}`}${count !== undefined ? `, ${count} no total` : ''}`;

  const press = () => {
    const fb = boraFeedback(active, !active, reduced);
    if (fb.haptic) haptic(fb.haptic, { enabled: hapticsEnabled });
    if (fb.pop) setPulse((n) => n + 1);
    onPress();
  };

  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={a11y}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={press}
      style={[
        { minHeight: 44, minWidth: 64, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: active ? color : colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
        style,
      ]}>
      {/* fundo aceso: só opacidade (transição curta), nada de animar cor */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: radius.pill,
          backgroundColor: neon.activeFill,
          opacity: active ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: durations.reducedFade,
        }}
      />
      <Animated.View
        key={pulse}
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: space[1] },
          pulse > 0 && !reduced
            ? {
                animationName: kf({ from: { transform: [{ scale: 0.78 }] }, to: { transform: [{ scale: 1 }] } }),
                animationDuration: B.popMs,
                animationTimingFunction: BORA_SPRING,
                animationFillMode: 'both',
              }
            : null,
        ]}>
        {icon}
        <Text variant="bodyBold" color={active ? neon.orangeText : undefined}>
          {label}
        </Text>
        {count !== undefined ? (
          <Text variant="small" tabular muted={!active}>
            {formatCount(count)}
          </Text>
        ) : null}
      </Animated.View>
      {pulse > 0 && !reduced ? <Burst key={`b${pulse}`} color={color} count={B.burstCount} distance={B.burstDistance} length={8} duration={260} seed={pulse} /> : null}
    </PressableScale>
  );
}
