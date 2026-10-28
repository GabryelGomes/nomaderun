/**
 * Contas puras da aba "Você" (T7.3.1): estante de medalhas, quilômetros da semana e números do cartão.
 * Nada aqui inventa dado: tudo sai das corridas, das zonas e do Atlas reais da pessoa.
 */
import type { MedalKind, MedalTier } from '@/components/art';
import { brtCalendar } from '@/domain/progression';
import type { HistoryItem } from '@/features/run/history-model';

export type ShelfInput = {
  /** Corridas que contam (válidas ou parciais). */
  runs: number;
  /** Zonas conquistadas (resultado oficial). */
  zones: number;
  /** Trechos revelados no Atlas (células da antiga neblina). */
  atlasCells: number;
  /** Semanas seguidas com a meta cumprida. */
  streakWeeks: number;
};

export type ShelfMedal = { kind: MedalKind; tier: MedalTier; locked: boolean };

/**
 * Degraus de cada medalha (1, 2 e 3 estrelas). São as 3 conquistas antigas do perfil ("Primeiros passos",
 * "Primeira zona", "Explorador") mais a sequência, agora com níveis.
 */
export const SHELF_RULES: readonly { kind: MedalKind; metric: keyof ShelfInput; steps: readonly [number, number, number] }[] = [
  { kind: 'primeiros-passos', metric: 'runs', steps: [1, 10, 50] },
  { kind: 'conquistador', metric: 'zones', steps: [1, 10, 50] },
  { kind: 'explorador', metric: 'atlasCells', steps: [100, 500, 2000] },
  { kind: 'sequencia', metric: 'streakWeeks', steps: [2, 4, 12] },
];

/** Estante do "Você": as conquistadas primeiro (do nível mais alto), depois as bloqueadas. */
export function medalShelf(input: ShelfInput): { medals: ShelfMedal[]; earned: number; total: number } {
  const medals = SHELF_RULES.map(({ kind, metric, steps }): ShelfMedal => {
    const v = Math.max(0, Number.isFinite(input[metric]) ? input[metric] : 0);
    const tier = steps.filter((s) => v >= s).length;
    return tier === 0 ? { kind, tier: 1, locked: true } : { kind, tier: tier as MedalTier, locked: false };
  });
  const sorted = [...medals].sort((a, b) => Number(a.locked) - Number(b.locked) || (a.locked ? 0 : b.tier - a.tier));
  return { medals: sorted, earned: medals.filter((m) => !m.locked).length, total: medals.length };
}

/**
 * Quilômetros de cada dia da semana atual (segunda a domingo, em Brasília, D-63) e o índice de hoje.
 * Corrida rejeitada não entra; a que ainda está no aparelho entra (a pessoa correu).
 */
export function weekKm(history: readonly Pick<HistoryItem, 'startedAt' | 'meters' | 'tag'>[], now: number): { days: number[]; today: number; total: number } {
  const clock = brtCalendar.clock(now);
  const monday = brtCalendar.weekMonday(clock.dayId);
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const h of history) {
    if (h.tag === 'rejeitada' || h.tag === 'erro') continue;
    const d = brtCalendar.daysBetween(monday, brtCalendar.clock(h.startedAt).dayId);
    if (d >= 0 && d < 7) days[d] += Math.max(0, h.meters) / 1000;
  }
  return { days, today: clock.weekday, total: days.reduce((s, v) => s + v, 0) };
}

/** Corridas que contam para a sequência nesta semana (segunda a domingo, em Brasília). */
export function runsThisWeek(history: readonly Pick<HistoryItem, 'startedAt' | 'counts'>[], now: number): number {
  const monday = brtCalendar.weekMonday(brtCalendar.clock(now).dayId);
  return history.filter((h) => h.counts && brtCalendar.daysBetween(monday, brtCalendar.clock(h.startedAt).dayId) >= 0 && h.startedAt <= now).length;
}

/** Zonas conquistadas nas corridas oficiais. */
export function conqueredZones(runs: readonly { result: { zones?: readonly { outcome: string }[] } | null }[]): number {
  return runs.reduce((n, r) => n + (r.result?.zones ?? []).filter((z) => z.outcome === 'conquered').length, 0);
}

/** Selos curtos do card da corrida (no máximo 3, D-74): o estado do envio, zonas, fantasma e pontos. */
export function runBadges(
  item: Pick<HistoryItem, 'rp' | 'tag' | 'simulated'>,
  result: { zones?: readonly { outcome: string }[]; beatGhost?: boolean | null } | null | undefined,
  tagLabel: (tag: NonNullable<HistoryItem['tag']>) => string,
): string[] {
  const out: string[] = [];
  if (item.tag) out.push(tagLabel(item.tag));
  if (item.simulated) out.push('simulada');
  const zones = (result?.zones ?? []).filter((z) => z.outcome === 'conquered').length;
  if (zones > 0) out.push(zones === 1 ? '1 zona' : `${zones} zonas`);
  if (result?.beatGhost) out.push('Venceu o fantasma');
  if (item.rp > 0) out.push(`+${item.rp.toLocaleString('pt-BR')} pontos`);
  return out.slice(0, 3);
}

/** Iniciais do nome para o avatar (até 2 letras). */
export function initialsOf(name: string): string {
  const parts = name.replace(/[_.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[1][0] : (parts[0][1] ?? '');
  return (first + second).toUpperCase();
}
