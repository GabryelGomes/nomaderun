import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { EmptyArt, ModeIcon, type ModeIconKind } from '@/components/art';
import { Button } from '@/components/button';
import { DemoBadge } from '@/components/demo-badge';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { MissionCoachCard } from '@/components/mission-coach-card';
import { ProgressBar, ProgressRing, ShimmerSkeleton } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { ftueBarProgress } from '@/domain/missions';
import type { EngagementMission } from '@/services/api/engagement-repo';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { rerollDailyMission } from './controller';
import { useEngagementData } from './hooks';
import { canReroll, deadlineLabel, ftueDoneCount, ftueRows, missionA11y, missionProgressLabel, missionRatio, pct, TIER_LABEL, unlockLabel, type FtueRow } from './model';

const FTUE_ICON: Record<string, ModeIconKind | null> = {
  'f1-dominio': 'dominio',
  'f2-caca': 'caca',
  'f3-fuga': 'fuga',
  'f4-raid': 'raid',
  'f5-crew': 'crews',
  'f6-liga': 'liga',
  'f7-compartilhar': null,
};

function MissionRow({ m, rerollsLeft, onReroll, busy }: { m: EngagementMission; rerollsLeft: number; onReroll: (m: EngagementMission) => void; busy: boolean }) {
  const { colors } = useTheme();
  const done = m.completedAt !== null;
  const ratio = missionRatio(m);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: done ? colors.action : colors.line,
      }}>
      <ProgressRing value={ratio} size={56} stroke={6} color={colors.action} trackColor={colors.surfaceSunken} accessibilityLabel={missionA11y(m)} testID={`missao-anel-${m.cadence}-${m.slot}`}>
        {done ? (
          <Icon name="check" size={22} color={colors.accentText} />
        ) : (
          <Text variant="caption" tabular maxFontSizeMultiplier={1.2}>
            {pct(ratio)}
          </Text>
        )}
      </ProgressRing>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold" numberOfLines={2}>
          {m.title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {done ? `${TIER_LABEL[m.tier]} · Concluída` : `${TIER_LABEL[m.tier]} · ${missionProgressLabel(m)} · ${deadlineLabel(m)}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text variant="bodyBold" color={done ? colors.textSecondary : colors.accentText} tabular>{`+${m.xp} XP`}</Text>
        {canReroll(m, rerollsLeft) ? (
          <Button testID={`missao-trocar-${m.slot}`} label="Trocar" kind="ghost" disabled={busy} onPress={() => onReroll(m)} />
        ) : null}
      </View>
    </View>
  );
}

function FtueStepRow({ row, now }: { row: FtueRow; now: number }) {
  const { colors } = useTheme();
  const icon = FTUE_ICON[row.id] ?? null;
  const locked = row.status === 'locked';
  const done = row.status === 'done';
  const label = `Passo ${row.step}: ${row.title}. ${done ? 'Feito' : locked ? unlockLabel(row, now) : `Aberto, +${row.xp} XP`}`;
  return (
    <View
      testID={`primeira-semana-passo-${row.step}`}
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], opacity: locked ? 0.6 : 1, paddingVertical: space[1] }}>
      <View aria-hidden style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: done ? neon.activeFill : colors.surfaceSunken }}>
        {done ? <Icon name="check" size={20} color={colors.accentText} /> : locked ? <Icon name="lock" size={18} color={colors.textSecondary} /> : icon ? <ModeIcon kind={icon} size={32} /> : <Icon name="share" size={20} color={colors.accentText} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant={row.status === 'open' ? 'bodyBold' : 'body'} numberOfLines={1}>
          {row.title}
        </Text>
        <Text variant="caption" muted>
          {done ? 'Feito' : locked ? unlockLabel(row, now) : `Hoje · ${row.mission ? missionProgressLabel(row.mission) : ''}`}
        </Text>
      </View>
      <Text variant="small" color={done ? colors.textSecondary : colors.accentText} tabular>{`+${row.xp} XP`}</Text>
    </View>
  );
}

/** `/missoes` (E7, T7.2.4): primeira semana, missão de volta, 3 de hoje e 3 da semana com anéis de progresso. */
export function MissionsScreen() {
  const { colors } = useTheme();
  const { missions, now, refresh, demo } = useEngagementData();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const data = missions.data;

  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const reroll = async (m: EngagementMission) => {
    setBusy(true);
    setNotice(null);
    const res = await rerollDailyMission(m.id);
    setBusy(false);
    setNotice(res.ok ? `Nova missão: ${res.data.title}` : res.error.message);
  };

  const rows = data ? ftueRows(data, now) : [];
  const ftueOpen = rows.length > 0 && ftueDoneCount(rows) < rows.length;
  const ftueValue = ftueBarProgress(rows.map((r) => ({ id: r.id, step: r.step, status: r.status, unlocksAt: r.unlocksAt, completedAt: null })));

  return (
    <ScreenScroll testID="tela-missoes" edges={['bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
      <Stack.Screen options={{ title: 'Missões' }} />
      {demo ? <DemoBadge testID="missoes-demonstracao" /> : null}

      {missions.status === 'loading' || missions.status === 'idle' ? (
        <View testID="missoes-carregando" style={{ gap: space[3] }}>
          <ShimmerSkeleton shape="card" height={88} accessibilityLabel="Carregando missões" />
          <ShimmerSkeleton shape="card" height={88} />
          <ShimmerSkeleton shape="card" height={88} />
        </View>
      ) : null}

      {missions.status === 'unavailable' ? (
        <EmptyState testID="missoes-indisponivel" tag="Em breve" title="Missões em breve" body="O servidor ainda não liberou as missões." art={<EmptyArt kind="sem-medalhas" size={160} />} />
      ) : null}

      {missions.status === 'error' && !data ? (
        <EmptyState
          testID="missoes-erro"
          title="Não deu para carregar"
          body={missions.error?.message}
          art={<EmptyArt kind="sem-conexao" size={160} />}
          action={<Button testID="missoes-tentar" label="Tentar de novo" onPress={() => void refresh()} />}
        />
      ) : null}

      {data ? (
        <>
          {data.comeback && data.comeback.completedAt === null ? (
            <MissionCoachCard testID="missoes-volta" eyebrow="Missão de volta" title={data.comeback.title} done={0} steps={['Hoje']} reward={`+${data.comeback.xp} XP`} demo={demo} />
          ) : null}

          {ftueOpen ? (
            <View testID="missoes-primeira-semana" style={{ gap: space[2] }}>
              <SectionHeader title="Primeira semana" testID="missoes-primeira-semana-titulo" />
              <ProgressBar value={ftueValue} color={colors.action} trackColor={colors.surfaceSunken} height={8} milestones={[]} accessibilityLabel={`Primeira semana: ${ftueDoneCount(rows)} de ${rows.length} passos`} />
              <Text variant="caption" muted>
                Um passo libera por dia. Nenhum expira.
              </Text>
              {rows.map((r) => (
                <FtueStepRow key={r.id} row={r} now={now} />
              ))}
            </View>
          ) : null}

          <View style={{ gap: space[2] }}>
            <SectionHeader title="Hoje" testID="missoes-hoje-titulo" />
            <Text variant="caption" muted>
              {data.rerollsLeft > 0 ? 'Não curtiu uma? Troque 1 por dia.' : 'Troca de hoje já usada.'}
            </Text>
            {data.daily.map((m) => (
              <MissionRow key={m.id} m={m} rerollsLeft={data.rerollsLeft} onReroll={reroll} busy={busy} />
            ))}
            {notice ? (
              <Text testID="missoes-aviso" variant="small" accessibilityLiveRegion="polite" color={colors.textSecondary}>
                {notice}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: space[2] }}>
            <SectionHeader title="Esta semana" testID="missoes-semana-titulo" />
            {data.weekly.map((m) => (
              <MissionRow key={m.id} m={m} rerollsLeft={0} onReroll={reroll} busy={busy} />
            ))}
          </View>

          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            Sempre há uma missão leve: caminhar também conta.
          </Text>
        </>
      ) : null}
    </ScreenScroll>
  );
}
