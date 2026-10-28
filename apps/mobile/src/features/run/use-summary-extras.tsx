/**
 * Resumo (T7.3.2, E6b): os encaixes das outras frentes no `SummaryScreen`.
 * - `rewards`: bloco "Recompensas" da E7 (`useRunRewards(official)` + `<RunRewardsBlock>`). Servidor v1 (sem
 *   `extras.engagement`) ou corrida antiga desta sessão: nada.
 * - `renderShare`: `<ShareButton>` da E8, que abre o card com imagem (antes, só texto), com o nível novo e o
 *   chefão derrotado quando forem verdade.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { RunRewardsBlock, useRunRewards } from '@/features/engagement';
import { ShareButton } from '@/features/social/share';
import { isDemoMode } from '@/services/api/env';
import { fetchRaidCurrent, type RaidCurrent } from '@/services/api/raid-repo';
import { useEngagement } from '@/store/engagement-store';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';

import { useRawOfficial } from './official-cache';
import { careerTotals, raidExtraOf, shareBossFrom, shareLevelFrom } from './summary-extras';
import { useRunRecord } from './use-run-record';

export type SummaryExtras = {
  rewards: ReactNode;
  renderShare: (ctx: { runId: string; status?: 'valid' | 'partial' | 'review' | 'rejected' | null }) => ReactNode;
};

export function useSummaryExtras(id: string | undefined): SummaryExtras {
  const official = useRawOfficial(id);
  const parsed = useRunRewards(official);
  const lastRun = useEngagement((s) => s.lastRun);
  const block = parsed ?? (lastRun && lastRun.activityId === id ? lastRun.block : null);
  const demo = isDemoMode();

  const record = useRunRecord(id);
  const serverRuns = useGame((s) => s.serverRuns);
  const xp = useGame((s) => s.xp);
  const city = useSession((s) => s.profile?.city ?? null);
  const summary = record.summary;
  const level = useMemo(() => {
    if (!block || !id) return null;
    const conquered = summary ? summary.zones.filter((z) => z.outcome === 'conquered').length : 0;
    return shareLevelFrom(block, xp, careerTotals(serverRuns, { id, meters: summary?.meters ?? 0, conquered }));
  }, [block, id, summary, serverRuns, xp]);

  // Chefão: só quando o servidor diz que esta corrida ajudou a derrubar (aí busca nome, cidade e dias).
  const raidExtra = useMemo(() => raidExtraOf(official), [official]);
  const defeated = raidExtra?.defeated === true;
  const [raid, setRaid] = useState<RaidCurrent | null>(null);
  useEffect(() => {
    if (!defeated) return;
    let alive = true;
    void fetchRaidCurrent().then((r) => alive && r.ok && r.data.available && setRaid(r.data));
    return () => {
      alive = false;
    };
  }, [defeated]);
  const boss = useMemo(() => shareBossFrom(raidExtra, raid, city), [raidExtra, raid, city]);

  const rewards = block ? <RunRewardsBlock block={block} demo={demo} testID="resumo-recompensas" /> : null;
  const renderShare: SummaryExtras['renderShare'] = ({ runId, status }) => <ShareButton activityId={runId} status={status} level={level} boss={boss} size="lg" wide />;
  return { rewards, renderShare };
}
