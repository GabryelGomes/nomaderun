/**
 * T7.3.7 — recap semanal (modelo 5), parte pura: semana (segunda a domingo), link da tela, recap montado das
 * próprias corridas (quando o servidor não tem o `weekly_recap`) e a entrada do card (`ShareWeekInput`).
 *
 * Privacidade: as mini-rotas só saem pelo corte do domain (`clipRouteForSharing`) com as zonas da pessoa e
 * semente nova; sem as zonas (sem internet, erro) o card vai **sem rotas**, com aviso. A data vai sem hora.
 */
import { clipRouteForSharing, type PrivacyCircle, type SharedRoute } from '@/domain/share-privacy';
import type { FactionId, LatLng } from '@/domain/types';
import type { WeeklyRecap } from '@/services/api/recap-repo';

import type { CardDate, ShareWeekInput } from '../card/card-model';
import { PRIVACY_NOTICE_NO_ZONES } from '../share/share-input';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** `AAAA-MM-DD` de uma data local. */
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Segunda-feira (fuso do aparelho) da semana de `ms`, como `AAAA-MM-DD`. */
export function mondayOf(ms: number): string {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0); // meio-dia: mudança de horário de verão não troca o dia
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

/** Soma dias a uma data `AAAA-MM-DD` (sem fuso: aritmética de calendário). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function cardDateOfIso(iso: string): CardDate {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/** Início (ms, meia-noite local) da semana `AAAA-MM-DD`. */
export function weekStartMs(iso: string): number {
  const { year, month, day } = cardDateOfIso(iso);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Link da tela do recap. Sem `weekStart`, a tela abre a semana atual (ou a anterior, se a atual ainda não
 * tem corrida). A notificação de segunda passa a semana que acabou.
 */
export function recapHref(weekStart?: string | null): string {
  return weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? `/compartilhar/semana?inicio=${weekStart}` : '/compartilhar/semana';
}

/** O que o recap local precisa de cada corrida (é o `ActivitySummary` do app, sem depender dele). */
export type RecapActivity = {
  id: string;
  status: string;
  startedAt: number;
  meters: number;
  movingSeconds: number;
  conquered: number;
};

/**
 * Recap montado das próprias corridas (servidor sem `weekly_recap`, ou fora do ar). Só corridas pontuadas
 * (`valid`, `partial`); as 3 mais longas viram mini-rotas.
 */
export function recapFromActivities(activities: readonly RecapActivity[], weekStart: string, streakWeeks: number, isDemo: boolean): WeeklyRecap {
  const from = weekStartMs(weekStart);
  const to = weekStartMs(addDaysIso(weekStart, 7));
  const runs = activities.filter((a) => (a.status === 'valid' || a.status === 'partial') && a.startedAt >= from && a.startedAt < to);
  const dayMeters = [0, 0, 0, 0, 0, 0, 0];
  for (const a of runs) {
    const i = Math.round((weekStartMs(isoOf(new Date(a.startedAt))) - from) / DAY_MS);
    if (i >= 0 && i < 7) dayMeters[i] += Math.max(0, a.meters);
  }
  return {
    weekStart,
    dayMeters,
    runs: runs.length,
    meters: dayMeters.reduce((s, m) => s + m, 0),
    movingSeconds: runs.reduce((s, a) => s + Math.max(0, a.movingSeconds), 0),
    zones: runs.reduce((s, a) => s + Math.max(0, a.conquered), 0),
    zonesHeld: null,
    streakWeeks: Math.max(0, streakWeeks),
    activityIds: [...runs].sort((a, b) => b.meters - a.meters).slice(0, 3).map((a) => a.id),
    isDemo,
  };
}

export type RecapSource = {
  recap: WeeklyRecap;
  /** Pontos de cada corrida do recap (por id). Corrida sem pontos fica sem mini-rota. */
  paths: ReadonlyMap<string, readonly LatLng[]>;
  /** Zonas de privacidade; `null` = não deu para carregar (as rotas não saem). */
  privacyZones: readonly PrivacyCircle[] | null;
  seed: number;
  faction: FactionId;
  username: string | null;
  city: string | null;
  isDemo: boolean;
};

/** Recap → entrada do card da semana, com as mini-rotas cortadas no aparelho. */
export function buildRecapWeekInput(src: RecapSource): { input: ShareWeekInput; notice: string | null } {
  const zonesKnown = src.privacyZones !== null;
  const routes: SharedRoute[] = zonesKnown
    ? src.recap.activityIds
        .slice(0, 3)
        .map((id, i) => clipRouteForSharing(src.paths.get(id) ?? [], src.privacyZones ?? [], { seed: (src.seed + i * 0x9e3779b1) >>> 0, hideEnds: true }))
        .filter((r) => r.mode === 'route')
    : [];
  const hasPaths = src.recap.activityIds.some((id) => (src.paths.get(id)?.length ?? 0) >= 2);
  return {
    input: {
      faction: src.faction,
      weekStart: cardDateOfIso(src.recap.weekStart),
      dayMeters: src.recap.dayMeters,
      runs: src.recap.runs,
      movingSeconds: src.recap.movingSeconds,
      zones: src.recap.zones,
      streakWeeks: src.recap.streakWeeks,
      routes,
      city: src.city,
      username: src.username,
      isDemo: src.isDemo || src.recap.isDemo,
    },
    notice: !zonesKnown && hasPaths ? PRIVACY_NOTICE_NO_ZONES : null,
  };
}

/** Legenda do recap ("Copiar legenda"). */
export function recapCaption(input: ShareWeekInput, km: string, opts: { showCity: boolean }): string {
  let text = `Minha semana no NOMADE RUN: ${km} km em ${input.runs} ${input.runs === 1 ? 'corrida' : 'corridas'}`;
  text += input.zones > 0 ? ` e ${input.zones} ${input.zones === 1 ? 'zona conquistada' : 'zonas conquistadas'}.` : '.';
  if (opts.showCity && input.city) text += ` Bora pintar ${input.city}!`;
  if (input.isDemo) text += ' (dados de demonstração)';
  return text;
}
