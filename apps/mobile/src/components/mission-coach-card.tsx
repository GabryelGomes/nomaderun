import type { ReactNode } from 'react';
import { View } from 'react-native';

import { neon } from '@/theme/neon';
import { floating, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { DemoBadge } from './demo-badge';
import { Icon } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

export type MissionCoachCardProps = {
  testID: string;
  /** Ex.: "Corra 500 m e pinte sua primeira zona". */
  title: string;
  /** Passos concluídos (0..steps). */
  done: number;
  /** Os passos, em palavras curtas (ex.: ["Conta", "Time", "Correr 500 m"]). */
  steps: readonly string[];
  /** Ex.: "Missão 1". */
  eyebrow?: string;
  /** Recompensa visível (ex.: "+50 XP"). */
  reward?: string;
  /** Arte pequena (mascote acenando). */
  art?: ReactNode;
  demo?: boolean;
  onPress?: () => void;
};

/** Passos concluídos dentro do intervalo 0..total (progresso honesto: nunca passa do total nem fica negativo). */
export function clampDone(done: number, total: number): number {
  if (!Number.isFinite(done)) return 0;
  return Math.max(0, Math.min(total, Math.floor(done)));
}

/** Card da missão de boas-vindas e de volta no Mapa (E7 decide o conteúdo; a E6 desenha). */
export function MissionCoachCard({ testID, title, done, steps, eyebrow = 'Missão', reward, art, demo, onPress }: MissionCoachCardProps) {
  const { colors } = useTheme();
  const total = steps.length;
  const n = clampDone(done, total);
  const label = `${eyebrow}: ${title}. Passo ${Math.min(n + 1, total)} de ${total}${reward ? `. Recompensa: ${reward}` : ''}${demo ? '. Demonstração' : ''}`;
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        {art ? (
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 48, height: 48 }}>
            {art}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="label" color={colors.accentText} style={{ textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
            {reward ? (
              <Text variant="caption" muted>
                {reward}
              </Text>
            ) : null}
            {demo ? <DemoBadge /> : null}
          </View>
          <Text variant="bodyBold">{title}</Text>
        </View>
        {onPress ? (
          <View aria-hidden>
            <Icon name="chevron" size={18} color={colors.textSecondary} />
          </View>
        ) : null}
      </View>
      <View aria-hidden style={{ flexDirection: 'row', gap: space[2] }}>
        {steps.map((s, i) => {
          const isDone = i < n;
          const current = i === n;
          return (
            <View key={`${i}-${s}`} style={{ flex: 1, gap: space[1] }}>
              <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: isDone ? colors.action : current ? neon.activeFill : colors.surfaceSunken }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {isDone ? <Icon name="check" size={12} color={colors.accentText} /> : null}
                <Text variant="caption" color={isDone || current ? colors.text : colors.textSecondary} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {s}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
  const frame = { gap: space[3], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous' as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.action, boxShadow: floating };
  return onPress ? (
    <PressableScale testID={testID} accessibilityLabel={label} onPress={onPress} hitSlop={0} style={frame}>
      {body}
    </PressableScale>
  ) : (
    <View testID={testID} accessible accessibilityLabel={label} style={frame}>
      {body}
    </View>
  );
}
