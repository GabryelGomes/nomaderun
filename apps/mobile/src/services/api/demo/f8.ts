/**
 * Pares de demonstração da F8 · A2 (migration 20261031120000_f8_fundacao), com as regras puras do domain:
 * - `faction_activity()` (D-96): corredores com corrida na semana de demonstração, por time; `isDemo = true`;
 * - `crew_echo()`: o colega da crew que correu nesta semana "reforçou" alguns dos seus trechos; `isDemo = true`;
 * - `extras.milestones` no `finish-activity`: "primeiro trecho pintado" e "recorde de trechos" (`paintMilestones`),
 *   com os trechos de cada corrida calculados pelo domain (`paintCellsOfRun`), guardados em `activities.v2_extras`.
 */
import { validateActivity } from '@/domain/anti-cheat';
import { isEchoHour, paintMilestones } from '@/domain/faction-activity';
import { paintCellsOfRun } from '@/domain/paint';
import { FACTION_IDS } from '@/domain/types';

import { msOf, raise, type DemoDb, type Row } from './db';
import { toGeoPoints } from './scoring';
import { storedPoints } from './server';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

function requireUser(db: DemoDb, userId: string | null): Row {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return p;
}

/** Trechos que a corrida pinta pela regra do domain (os mesmos que o servidor marcaria). */
function demoPaintCells(db: DemoDb, activityId: string): number {
  const geo = toGeoPoints(storedPoints(db, activityId));
  if (geo.length < 2) return 0;
  return paintCellsOfRun(geo, validateActivity(geo)).length;
}

const milestonesOf = (a: Row) => {
  const m = (a.v2_extras as Row | null | undefined)?.milestones;
  return m && typeof m === 'object' ? (m as Row) : null;
};
const endedOf = (a: Row) => msOf(a.ended_at) ?? msOf(a.finished_at) ?? msOf(a.started_at) ?? 0;

/** `extras.milestones` da corrida que acabou de ser finalizada (idempotente: repetir devolve o mesmo). */
export function withPaintMilestones<T>(db: DemoDb, userId: string, response: T): T {
  const r = response as unknown as Row;
  const act = db.tables.activities.find((a) => a.id === r.activityId && a.user_id === userId);
  if (!act || act.scored !== true) return response;
  const extras = (r.extras && typeof r.extras === 'object' ? r.extras : {}) as Row;
  const stored = milestonesOf(act);
  if (stored) {
    r.extras = { contract: 2, ...extras, milestones: stored };
    return response;
  }
  const others = db.tables.activities
    .filter((a) => a.user_id === userId && a.id !== act.id && a.scored === true)
    .map((a) => {
      const m = milestonesOf(a);
      return { id: String(a.id), cells: m ? Number(m.cells) || 0 : demoPaintCells(db, String(a.id)), endedAt: endedOf(a), firstPaint: m?.firstPaint === true };
    });
  const milestones = paintMilestones({ id: String(act.id), cells: demoPaintCells(db, String(act.id)), endedAt: endedOf(act), others });
  r.extras = { contract: 2, ...extras, milestones };
  act.v2_extras = { ...((act.v2_extras as Row | null) ?? {}), ...(r.extras as Row) };
  return response;
}

/** Número pequeno e estável (2 a 6) para o eco de demonstração: muda por dia e por colega. */
function demoEchoCells(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 2 + (h % 5);
}

export const DEMO_F8_RPC_HANDLERS: Record<string, RpcHandler> = {
  faction_activity: (db, userId) => {
    requireUser(db, userId);
    const counts = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<string, number>;
    for (const p of db.tables.profiles) {
      if (p.status !== 'active' || typeof p.faction !== 'string' || !(p.faction in counts)) continue;
      const s = db.stats(String(p.id), 'week');
      if (s.runs > 0) counts[p.faction] += 1;
    }
    const now = db.now();
    return {
      windowDays: 7,
      since: now - 7 * 86_400_000,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      isDemo: true,
    };
  },

  crew_echo: (db, userId) => {
    requireUser(db, userId);
    const crewId = db.crewOf(userId!);
    const now = db.now();
    if (!crewId || !isEchoHour(now)) return null;
    const mates = db.tables.crew_members
      .filter((m) => m.crew_id === crewId && m.user_id !== userId)
      .map((m) => db.profile(String(m.user_id)))
      .filter((p): p is Row => !!p && p.status === 'active' && db.stats(String(p.id), 'week').runs > 0)
      .sort((a, b) => String(a.username).localeCompare(String(b.username)));
    if (mates.length === 0) return null;
    const today = db.brToday();
    const day = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const cells = demoEchoCells(`${String(mates[0].id)}|${day}`);
    const start = Date.parse(`${today}T00:00:00Z`) + 3 * 3_600_000;
    return {
      day,
      mate: { username: String(mates[0].username) },
      cells,
      othersCount: 0,
      totalCells: cells,
      notifyFrom: start + 7 * 3_600_000,
      notifyUntil: start + 22 * 3_600_000,
      isDemo: true,
    };
  },
};
