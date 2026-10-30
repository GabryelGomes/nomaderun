import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { EmptyArt, ModeIcon, type ModeIconKind } from '@/components/art';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { MissionCoachCard } from '@/components/mission-coach-card';
import { ProgressBar, ProgressRing, ShimmerSkeleton } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { ftueBarProgress } from '@/domain/missions';
import type { EngagementMission } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { useGame } from '@/store/game-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { markRankingOpened, refreshEngagement, rerollDailyMission } from './controller';
import { useEngagementData } from './hooks';
import { canReroll, FTUE_PRIZE, ftueAction, ftueComplete, ftueDoneCount, ftueRows, missionA11y, missionProgressLabel, missionRatio, pct, TIER_LABEL, unlockLabel, type FtueAction, type FtueRow } from './model';

/** Volta à tela depois de fazer um passo (compartilhou, entrou na crew): relê se o dado tem mais de 15 s. */
const STALE_MS = 15_000;
/** E10 (onda 4): item bloqueado continua legível (WCAG AA 4,5:1 com o texto secundário e o laranja sobre o fundo). */
const LOCKED_OPACITY = 0.8;

/** Leva ao lugar onde o passo se faz de verdade; quem conta o passo é o servidor. */
export function goToFtueStep(a: FtueAction) {
  if (a.mode) useGame.getState().setMission(a.mode);
  if (a.ranking) void markRankingOpened();
  router.push(a.href);
}

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
        {m.tier === 'leve' ? (
          <Text variant="caption" muted numberOfLines={1}>
            {TIER_LABEL.leve}
          </Text>
        ) : null}
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
  const action = ftueAction(row);
  const caption = done ? 'Feito' : locked ? unlockLabel(row, now) : row.mission && row.mission.target > 1 ? missionProgressLabel(row.mission) : null;
  const label = `Passo ${row.step}: ${row.title}. ${done ? 'Feito' : locked ? unlockLabel(row, now) : `Aberto, +${row.xp} XP`}`;
  return (
    <View
      testID={`primeira-semana-passo-${row.step}`}
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], opacity: locked ? LOCKED_OPACITY : 1, paddingVertical: space[1] }}>
      <View aria-hidden style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: done ? neon.activeFill : colors.surfaceSunken }}>
        {done ? <Icon name="check" size={20} color={colors.accentText} /> : locked ? <Icon name="lock" size={18} color={colors.textSecondary} /> : icon ? <ModeIcon kind={icon} size={32} /> : <Icon name="share" size={20} color={colors.accentText} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant={row.status === 'open' ? 'bodyBold' : 'body'} numberOfLines={2}>
          {row.title}
        </Text>
        {caption ? (
          <Text variant="caption" muted>
            {caption}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text variant="small" color={done ? colors.textSecondary : colors.accentText} tabular>{`+${row.xp} XP`}</Text>
        {action ? <Button testID={`primeira-semana-ir-${row.step}`} label={action.label} kind="secondary" onPress={() => goToFtueStep(action)} /> : null}
      </View>
    </View>
  );
}

/** Os 7 passos feitos: o prêmio "Primeira Semana" (moldura dada pelo servidor no 7º passo). */
function FtuePrizeCard({ owned }: { owned: boolean | null }) {
  const { colors } = useTheme();
  return (
    <View
      testID="missoes-primeira-semana-premio"
      accessible
      accessibilityLabel={`Primeira semana completa. Prêmio: moldura ${FTUE_PRIZE.name}${owned === false ? ', chegando' : ', já é sua'}.`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.action, backgroundColor: neon.activeFill }}>
      <Icon name="trophy" size={28} color={colors.accentText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold">Primeira semana completa!</Text>
        <Text variant="caption" muted>
          {owned === false ? `Moldura ${FTUE_PRIZE.name} a caminho.` : `Moldura ${FTUE_PRIZE.name} é sua.`}
        </Text>
      </View>
    </View>
  );
}

/** Recolhido: só o passo da vez (o aberto, ou o próximo a liberar). A lista inteira fica atrás de "Ver todos". */
export function currentSteps(rows: readonly FtueRow[]): FtueRow[] {
  const open = rows.filter((r) => r.status === 'open');
  if (open.length > 0) return open;
  const next = rows.find((r) => r.status === 'locked');
  return next ? [next] : [];
}

/** `/missoes` (E7, T7.2.4): primeira semana, missão de volta, 3 de hoje e 3 da semana com anéis de progresso. */
export function MissionsScreen() {
  const { colors } = useTheme();
  // Selo de demonstração: só o global do layout (E10, onda 4).
  const { missions, now, refresh } = useEngagementData();
  const owned = useEngagement((s) => (s.status.data?.cosmetics ? s.status.data.cosmetics.some((c) => c.id === FTUE_PRIZE.cosmeticId) : null));
  useFocusEffect(
    useCallback(() => {
      const at = useEngagement.getState().loadedAt;
      if (at !== null && Date.now() - at > STALE_MS) void refreshEngagement(Date.now());
    }, []),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [allSteps, setAllSteps] = useState(false);
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
  const ftueDone = ftueComplete(rows);
  const ftueValue = ftueBarProgress(rows.map((r) => ({ id: r.id, step: r.step, status: r.status, unlocksAt: r.unlocksAt, completedAt: null })));

  return (
    <ScreenScroll testID="tela-missoes" edges={['bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
      <Stack.Screen options={{ title: 'Missões' }} />

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
            <MissionCoachCard testID="missoes-volta" eyebrow="Missão de volta" title={data.comeback.title} done={0} steps={['Hoje']} reward={`+${data.comeback.xp} XP`} demo={false} />
          ) : null}

          {ftueOpen ? (
            <View testID="missoes-primeira-semana" style={{ gap: space[2] }}>
              <SectionHeader title="Primeira semana" testID="missoes-primeira-semana-titulo" />
              <ProgressBar value={ftueValue} color={colors.action} trackColor={colors.surfaceSunken} height={8} milestones={[]} accessibilityLabel={`Primeira semana: ${ftueDoneCount(rows)} de ${rows.length} passos`} />
              <Text testID="missoes-primeira-semana-resumo" variant="caption" muted accessibilityLabel={`${ftueDoneCount(rows)} de ${rows.length} passos. Um por dia, sem prazo. Prêmio: moldura ${FTUE_PRIZE.name}.`}>
                {`${ftueDoneCount(rows)}/${rows.length} · prêmio: moldura ${FTUE_PRIZE.name}`}
              </Text>
              {(allSteps ? rows : currentSteps(rows)).map((r) => (
                <FtueStepRow key={r.id} row={r} now={now} />
              ))}
              <Button testID="missoes-primeira-semana-ver-mais" label={allSteps ? 'Ver menos' : 'Ver todos'} kind="ghost" onPress={() => setAllSteps((v) => !v)} />
            </View>
          ) : null}

          {ftueDone ? <FtuePrizeCard owned={owned} /> : null}

          <View style={{ gap: space[2] }}>
            <SectionHeader title="Hoje" testID="missoes-hoje-titulo" />
            <Text testID="missoes-hoje-prazo" variant="caption" muted accessibilityLabel={data.rerollsLeft > 0 ? 'Valem até 23h59. Dá para trocar 1 por dia.' : 'Valem até 23h59. A troca de hoje já foi usada.'}>
              Até 23h59
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
            <Text variant="caption" muted>
              Até domingo
            </Text>
            {data.weekly.map((m) => (
              <MissionRow key={m.id} m={m} rerollsLeft={0} onReroll={reroll} busy={busy} />
            ))}
          </View>

          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            Caminhar também conta.
          </Text>
        </>
      ) : null}
    </ScreenScroll>
  );
}
