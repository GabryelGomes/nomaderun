/**
 * Histórico (RF-006): corridas do servidor + as que ainda estão na fila do aparelho, sem
 * repetir, com filtro por período.
 */
import type { ActivitySummary } from '@/services/api/activities-repo';
import type { LocalRun, MissionId } from '@/store/game-store';

export type PeriodId = '7d' | '30d' | 'ano' | 'tudo';

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'ano', label: 'Este ano' },
  { id: 'tudo', label: 'Tudo' },
];

const DAY = 86_400_000;

/** Início do período (epoch ms) ou undefined para "Tudo". */
export function periodStart(id: PeriodId, now: number): number | undefined {
  if (id === '7d') return now - 7 * DAY;
  if (id === '30d') return now - 30 * DAY;
  if (id === 'ano') return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  return undefined;
}

export type HistoryTag = 'provisorio' | 'enviando' | 'erro' | 'revisao' | 'rejeitada' | 'parcial' | null;

export type HistoryItem = {
  id: string;
  mission: MissionId;
  startedAt: number;
  meters: number;
  movingSeconds: number;
  avgPace: number | null;
  rp: number;
  simulated: boolean;
  tag: HistoryTag;
  /** Conta para a sequência semanal (válida ou parcial). */
  counts: boolean;
};

export const TAG_LABEL: Record<Exclude<HistoryTag, null>, string> = {
  provisorio: 'provisório',
  enviando: 'enviando',
  erro: 'erro no envio',
  revisao: 'em revisão',
  rejeitada: 'rejeitada',
  parcial: 'parcial',
};

const statusTag = (s: string | undefined): HistoryTag => (s === 'review' ? 'revisao' : s === 'rejected' ? 'rejeitada' : s === 'partial' ? 'parcial' : null);

export function mergeHistory(serverRuns: ActivitySummary[], localRuns: LocalRun[], from?: number): HistoryItem[] {
  const byId = new Map<string, HistoryItem>();
  for (const a of serverRuns) {
    if (a.status === 'recording' && !a.result) continue; // ainda chegando: a cópia local aparece
    byId.set(a.id, {
      id: a.id,
      mission: a.mission,
      startedAt: a.startedAt,
      meters: a.meters,
      movingSeconds: a.movingSeconds,
      avgPace: a.avgPace,
      rp: a.rpTotal,
      simulated: false,
      tag: statusTag(a.status),
      counts: a.status === 'valid' || a.status === 'partial',
    });
  }
  for (const l of localRuns) {
    if (l.state === 'recording' || !l.summary) continue;
    const prev = byId.get(l.id);
    if (prev && l.state === 'synced') {
      byId.set(l.id, { ...prev, simulated: l.simulated });
      continue;
    }
    const s = l.summary;
    const tag: HistoryTag = l.state === 'failed' ? 'erro' : l.state === 'syncing' ? 'enviando' : l.state === 'pending' ? 'provisorio' : statusTag(s.status);
    byId.set(l.id, {
      id: l.id,
      mission: l.mission,
      startedAt: l.startedAt,
      meters: s.meters,
      movingSeconds: s.movingSeconds,
      avgPace: s.avgPace,
      rp: s.rpTotal,
      simulated: l.simulated,
      tag,
      counts: l.state === 'synced' && (s.status === 'valid' || s.status === 'partial'),
    });
  }
  return [...byId.values()].filter((h) => from === undefined || h.startedAt >= from).sort((a, b) => b.startedAt - a.startedAt);
}
