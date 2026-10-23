import { View } from 'react-native';

import { Chest } from '@/components/art';
import { RARITY_COLORS } from '@/components/celebration';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { CountUp, ProgressBar, Stagger } from '@/components/motion';
import { Text } from '@/components/text';
import { DAILY_CHEST, levelProgress } from '@/domain/progression';
import type { RunEngagement } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { cosmeticName } from './cosmetics';
import { pct, RARITY_LABEL } from './model';
import { levelLine, rewardPeak, rewardsA11y, rewardSections, streakLine, type RewardSection } from './run-rewards-model';

export type RunRewardsBlockProps = {
  /** `useRunRewards(official)` ou `parseRunEngagement(official)`. Sem bloco (servidor v1), não desenha nada. */
  block: RunEngagement | null | undefined;
  testID?: string;
  /** Selo de demonstração no título (regra do projeto). */
  demo?: boolean;
};

/**
 * Bloco "Recompensas" do resumo (E7, T7.2.4): XP linha a linha, nível, baús e missões, na ordem pico-fim
 * (`rewardSections`). É a parte calma do resumo: as celebrações grandes ficam com o `CelebrationSequence`
 * (E5/E6b); aqui o pico só ganha a borda acesa.
 */
export function RunRewardsBlock({ block, testID = 'resumo-recompensas', demo }: RunRewardsBlockProps) {
  const { colors } = useTheme();
  const xpNow = useEngagement((s) => s.status.data?.xp ?? null);
  if (!block) return null;
  const sections = rewardSections(block);
  const peak = rewardPeak(block);

  const frame = (s: RewardSection) => ({
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    borderCurve: 'continuous' as const,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: s === peak ? colors.action : 'transparent',
  });

  const render = (s: RewardSection) => {
    switch (s) {
      case 'xp':
        return (
          <View key="xp" testID={`${testID}-xp`} style={frame(s)}>
            {block.xp.lines.map((l) => (
              <View key={`${l.source}-${l.label}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                <Text muted style={{ flex: 1 }}>
                  {l.label}
                </Text>
                <Text variant="bodyBold" tabular>{`+${l.amount}`}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="bodyBold">Total</Text>
              <CountUp value={block.xp.total} variant="headline" color={colors.accentText} unit="XP" accessibilityLabel={`${block.xp.total} XP`} testID={`${testID}-xp-total`} />
            </View>
          </View>
        );
      case 'level': {
        const line = levelLine(block);
        const lp = xpNow !== null ? levelProgress(xpNow) : null;
        const sameLevel = lp && lp.level === block.level.after;
        return (
          <View key="level" testID={`${testID}-nivel`} style={frame(s)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="trophy" size={20} color={colors.accentText} />
              <Text variant="title" style={{ flex: 1 }}>
                {line.title}
              </Text>
              <Text muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {line.body}
              </Text>
            </View>
            {sameLevel && !lp.isMax ? (
              <ProgressBar value={lp.intoLevel / lp.needed} color={colors.action} trackColor={colors.surface} height={8} accessibilityLabel={`Nível ${lp.level}: ${lp.intoLevel} de ${lp.needed} XP`} />
            ) : null}
          </View>
        );
      }
      case 'chests':
        return (
          <View key="chests" testID={`${testID}-baus`} style={frame(s)}>
            {block.dailyChests.opened.length > 0 ? (
              <>
                {block.dailyChests.opened.map((c) => (
                  <View
                    key={`${c.bonus ? 'b' : 'd'}${c.n}`}
                    accessible
                    accessibilityLabel={`Baú ${RARITY_LABEL[c.rarity].toLowerCase()}${c.bonus ? ' bônus' : ''}: ${c.xp} XP${c.cosmeticId ? ` e ${cosmeticName(c.cosmeticId)}` : ''}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <View aria-hidden importantForAccessibility="no-hide-descendants">
                      <Chest rarity={c.rarity} state="aberto" size={44} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold" color={RARITY_COLORS[c.rarity]}>
                        {`Baú ${RARITY_LABEL[c.rarity].toLowerCase()}${c.bonus ? ' bônus' : ''}${c.guaranteed ? ' (garantido)' : ''}`}
                      </Text>
                      {c.cosmeticId ? (
                        <Text variant="small" muted>
                          {`Item novo: ${cosmeticName(c.cosmeticId)}`}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="bodyBold" tabular>{`+${c.xp} XP`}</Text>
                  </View>
                ))}
                <Text variant="caption" muted>
                  {`Chances: comum ${pct(DAILY_CHEST.odds.comum)}, raro ${pct(DAILY_CHEST.odds.raro)}, lendário ${pct(DAILY_CHEST.odds.lendario)}.`}
                </Text>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View aria-hidden importantForAccessibility="no-hide-descendants">
                  <Chest rarity="comum" size={40} />
                </View>
                <Text muted style={{ flex: 1 }}>
                  {`${block.dailyChests.stored === 1 ? '1 baú guardado' : `${block.dailyChests.stored} baús guardados`}. Abrem com 1 km.`}
                </Text>
              </View>
            )}
          </View>
        );
      case 'missions':
        return (
          <View key="missions" testID={`${testID}-missoes`} style={frame(s)}>
            {block.missions.map((m) => (
              <View key={m.userMissionId || m.id} accessible accessibilityLabel={`Missão concluída: ${m.text}. ${m.xp} XP`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <View style={{ width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.activeFill }}>
                  <Icon name="check" size={14} color={colors.accentText} />
                </View>
                <Text style={{ flex: 1 }}>{m.text}</Text>
                <Text variant="bodyBold" tabular>{`+${m.xp} XP`}</Text>
              </View>
            ))}
          </View>
        );
      case 'streak': {
        const line = streakLine(block.streak!);
        return (
          <View key="streak" testID={`${testID}-semana`} accessible accessibilityLabel={`${line.title}. ${line.body}`} style={[frame(s), { flexDirection: 'row', alignItems: 'center', gap: space[3] }]}>
            <Icon name="fire" size={24} color={colors.accentText} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{line.title}</Text>
              <Text variant="small" muted>
                {line.body}
              </Text>
            </View>
          </View>
        );
      }
    }
  };

  return (
    <View testID={testID} accessibilityLabel={rewardsA11y(block)} style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          Recompensas
        </Text>
        {demo ? <DemoBadge testID={`${testID}-demonstracao`} /> : null}
      </View>
      <Stagger gap={space[2]}>{sections.map(render)}</Stagger>
    </View>
  );
}
