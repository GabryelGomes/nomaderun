import { Modal, ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ModeIcon } from '@/components/art';
import { IconButton } from '@/components/button';
import { DemoBadge } from '@/components/demo-badge';
import { Icon, type IconName } from '@/components/icon';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { formatPoints } from '@/features/format';
import { useNow } from '@/features/use-now';
import type { LeagueCurrent, LeagueMemberRow } from '@/services/api/league-repo';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { leagueCloses, leagueRules, leagueTitle } from './arena-league.model';

/**
 * F8-B3 (UX-11): a Liga deixa de ser beco sem saída. Tocar na faixa abre esta folha com o grupo, quem sobe, quem
 * desce e quando fecha, e a tabela do grupo (a pessoa destacada). Detalhe sob demanda: as palavras daqui não
 * somam na régua da Arena. Com "Reduzir movimento", a folha aparece por esmaecimento.
 */
export function LeagueSheet({ visible, league, demo, onClose }: { visible: boolean; league: LeagueCurrent; demo: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const now = useNow(60_000);
  const rules = leagueRules(league);
  const rows: { key: string; icon: IconName; text: string; color?: string }[] = [
    { key: 'grupo', icon: 'club', text: rules.group },
    { key: 'sobe', icon: 'arrowUp', text: rules.up, color: colors.accentText },
    { key: 'desce', icon: 'arrowDown', text: rules.down },
    { key: 'prazo', icon: 'timer', text: leagueCloses(league.closesAt, now) },
  ];
  return (
    <Modal visible={visible} animationType={reduced ? 'fade' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView testID="arena-liga-folha" contentContainerStyle={{ padding: space[6], gap: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <ModeIcon kind="liga" size={48} />
            <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
              {leagueTitle(league)}
            </Text>
            <IconButton testID="arena-liga-folha-fechar" icon="close" label="Fechar" tone="sunken" size={44} onPress={onClose} />
          </View>
          {demo ? <DemoBadge testID="arena-liga-folha-demonstracao" /> : null}

          <View style={{ gap: space[2], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            {rows.map((r) => (
              <View key={r.key} testID={`arena-liga-regra-${r.key}`} accessible accessibilityLabel={r.text} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 36 }}>
                <Icon name={r.icon} size={22} color={r.color ?? colors.textSecondary} />
                <Text variant="bodyBold" style={{ flex: 1 }}>
                  {r.text}
                </Text>
              </View>
            ))}
          </View>

          {league.members.length > 0 ? (
            <View style={{ gap: space[1] }}>
              {league.members.map((m) => (
                <MemberRow key={`${m.position}-${m.username}`} m={m} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Uma linha do grupo: posição, emblema, nome e pontos; a faixa de subida em laranja, a de descida apagada. */
function MemberRow({ m }: { m: LeagueMemberRow }) {
  const { colors } = useTheme();
  const zone = m.zone === 'promote' ? ', na faixa de subida' : m.zone === 'relegate' ? ', na faixa de descida' : '';
  return (
    <View
      testID={`arena-liga-linha-${m.position}`}
      accessible
      accessibilityLabel={`${m.position}º ${m.username}${m.you ? ' (você)' : ''}, ${formatPoints(m.points, { signed: false })}${zone}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingHorizontal: space[2],
        borderRadius: radius.md,
        backgroundColor: m.you ? colors.surfaceSunken : undefined,
        borderLeftWidth: 3,
        borderLeftColor: m.zone === 'promote' ? colors.action : 'transparent',
        opacity: m.zone === 'relegate' ? 0.7 : 1,
      }}>
      <Text variant="bodyBold" tabular style={{ width: 28 }}>
        {m.position}
      </Text>
      <TeamBadge faction={m.faction} size={22} />
      <Text variant={m.you ? 'bodyBold' : 'body'} numberOfLines={1} style={{ flex: 1 }}>
        {m.you ? `${m.username} (você)` : m.username}
      </Text>
      <Text variant="small" muted={!m.you} tabular>
        {formatPoints(m.points, { signed: false })}
      </Text>
    </View>
  );
}
