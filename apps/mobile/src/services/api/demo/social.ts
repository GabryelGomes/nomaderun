/**
 * Pares de demonstração da E8 (T7.2.5): feed da crew com reações (D-79) e `record_share`.
 * Imita o contrato da E9 (`docs/API_CONTRATO.md`, "Contrato v2 — onda 2"):
 *  - só a crew vê o feed; o item não traz hora nem coordenada fora da rota cortada;
 *  - a rota sai cortada pelo mesmo `clipRouteForSharing` do domain (zonas de privacidade do autor e
 *    pontas escondidas) e vai como polyline de precisão 4, no máximo 80 pontos por item;
 *  - reações `bora | fogo | raio`, 1 por pessoa por item, `KUDOS_SELF` e `KUDOS_LIMIT` (200 por dia).
 *
 * O feed da crew de demonstração tem 6 corridas: as 3 mais recentes do corredor de demonstração (as do
 * banco, incluindo a que ele acabou de correr) e 3 de colegas da crew, geradas sobre a rota do lago.
 * Estado (reações) guardado fora do `DemoDb`, por banco, para não mexer nas tabelas da E10.
 *
 * T7.3.7 (revisão M4) — Realtime dos aplausos: cada reação sai pelo canal de demonstração como os
 * contadores do item (`postgres_changes` em `feed_kudos_counts`, sem quem reagiu, como no servidor real). Para a demonstração ficar viva, ~4 s depois da
 * 1ª abertura do feed um colega da crew manda um "Bora!" na corrida mais recente do corredor (uma vez por
 * banco). O `crew_feed` seguinte já devolve o contador novo: tela e servidor contam a mesma coisa.
 * Também aqui: o recap semanal (`weeklyRecapDemo`), servido como a Edge Function `weekly-recap` (o app não usa
 * o `rpc('weekly_recap')`, então ele não tem par: o teste de contrato não aceita par órfão).
 */
import { distanceMeters } from '@/domain/geo';
import { zoneOf } from '@/domain/grid';
import { clipRouteForSharing, type PrivacyCircle } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';
import { demoRoute, zoneName } from '@/demo/demo-data';
import { demoRunPoints } from '@/demo/world';

import { encodePolyline, FEED_DAILY_REACTIONS, FEED_PAGE_SIZE, isFeedReaction, type FeedReaction } from '../feed-repo';
import { msOf, raise, type DemoDb, type Row } from './db';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

const DAY_MS = 86_400_000;
/** Corridas por pessoa no feed de demonstração (3 + 3 = 6). */
const OWN_ITEMS = 3;
const MATE_ITEMS = 3;
/** Teto de pontos da polyline por item (contrato: ≤ 80). */
export const FEED_ROUTE_MAX_POINTS = 80;

type StoredItem = {
  id: string;
  actorId: string;
  activityId: string | null;
  createdAt: number;
  meters: number;
  movingSeconds: number;
  route: string[] | null;
  highlights: Row[];
};

type SocialState = {
  /** itemId → (userId → reação). */
  kudos: Map<string, Map<string, FeedReaction>>;
  /** `${userId}|${dia}` → reações dadas no dia. */
  given: Map<string, number>;
  /** Rotas já cortadas por item (o corte é estável dentro da sessão). */
  routes: Map<string, string[] | null>;
  mates: StoredItem[] | null;
  /** Itens que o autor tirou do feed. */
  deleted: Set<string>;
  /** `user_settings` de demonstração (padrão: tudo ligado). */
  settings: Map<string, { shareRunsToFeed: boolean; feedShowMap: boolean }>;
  /** O "Bora!" ao vivo do colega já foi agendado neste banco. */
  liveScheduled: boolean;
};

/** Quanto tempo depois da 1ª abertura do feed o colega aplaude ao vivo. */
export const DEMO_LIVE_KUDO_MS = 4000;

const states = new WeakMap<DemoDb, SocialState>();

function stateOf(db: DemoDb): SocialState {
  let s = states.get(db);
  if (!s) {
    s = { kudos: new Map(), given: new Map(), routes: new Map(), mates: null, deleted: new Set(), settings: new Map(), liveScheduled: false };
    states.set(db, s);
  }
  return s;
}

function requireUser(db: DemoDb, userId: string | null): Row {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return p;
}

const settingsOf = (db: DemoDb, userId: string) => stateOf(db).settings.get(userId) ?? { shareRunsToFeed: true, feedShowMap: true };

/** Semente estável por item (no servidor real ela é sorteada a cada geração do item). */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Afina os pedaços para caber em `max` pontos no total, sem perder as pontas de cada pedaço. */
export function thinPieces(pieces: readonly (readonly LatLng[])[], max = FEED_ROUTE_MAX_POINTS): LatLng[][] {
  const total = pieces.reduce((n, p) => n + p.length, 0);
  if (total <= max) return pieces.map((p) => [...p]);
  return pieces.map((p) => {
    const keep = Math.max(2, Math.floor((p.length / total) * max));
    if (p.length <= keep) return [...p];
    const out: LatLng[] = [];
    for (let i = 0; i < keep; i++) out.push(p[Math.round((i * (p.length - 1)) / (keep - 1))]);
    return out;
  });
}

function clippedPolylines(db: DemoDb, itemId: string, actorId: string, points: readonly LatLng[]): string[] | null {
  const s = stateOf(db);
  if (s.routes.has(itemId)) return s.routes.get(itemId)!;
  const zones: PrivacyCircle[] = db.tables.privacy_zones.filter((z) => z.user_id === actorId).map((z) => ({ lat: Number(z.lat), lng: Number(z.lng), radiusM: Number(z.radius_m) }));
  const clipped = clipRouteForSharing(points, zones, { seed: seedOf(itemId), hideEnds: true });
  const route = clipped.mode === 'route' ? thinPieces(clipped.pieces).map((p) => encodePolyline(p)) : null;
  s.routes.set(itemId, route);
  return route;
}

const zoneTitle = (db: DemoDb, id: string) => db.zones.get(id)?.name || zoneName(id);

/** As 3 corridas pontuadas mais recentes do corredor (as do banco: o que ele correr agora entra também). */
function ownItems(db: DemoDb, userId: string): StoredItem[] {
  return db.tables.activities
    .filter((a) => a.user_id === userId && (a.status === 'valid' || a.status === 'partial'))
    .sort((a, b) => (msOf(b.started_at) ?? 0) - (msOf(a.started_at) ?? 0))
    .slice(0, OWN_ITEMS)
    .map((a) => {
      const id = `feed-${String(a.id)}`;
      const pts = db.pointsOf(String(a.id)).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
      const conquered = db.tables.activity_zones.filter((z) => z.activity_id === a.id && z.outcome === 'conquered').slice(0, 2);
      return {
        id,
        actorId: userId,
        activityId: String(a.id),
        createdAt: msOf(a.ended_at) ?? msOf(a.started_at) ?? db.now(),
        meters: Number(a.meters) || 0,
        movingSeconds: Number(a.moving_seconds) || 0,
        route: clippedPolylines(db, id, userId, pts),
        highlights: conquered.map((z) => ({ kind: 'zone_conquered', name: zoneTitle(db, String(z.zone_id)) })),
      };
    });
}

const MATE_SHIFTS: LatLng[] = [
  { lat: 0.006, lng: 0.005 },
  { lat: -0.004, lng: -0.004 },
  { lat: 0.002, lng: -0.007 },
];

/** 3 corridas de colegas da crew, geradas uma vez por banco (hoje, 2 e 5 dias atrás). */
function mateItems(db: DemoDb, crewId: string, userId: string): StoredItem[] {
  const s = stateOf(db);
  if (s.mates) return s.mates;
  const mates = db.tables.crew_members
    .filter((m) => m.crew_id === crewId && m.user_id !== userId)
    .map((m) => String(m.user_id))
    .sort()
    .slice(0, MATE_ITEMS);
  const base = demoRoute();
  s.mates = mates.map((mateId, k) => {
    const startedAt = db.now() - [0.25, 2, 5][k] * DAY_MS - 3600_000;
    const pts = demoRunPoints(base, startedAt, { shift: MATE_SHIFTS[k], roundTrip: k === 1 });
    const path = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
    let meters = 0;
    for (let i = 1; i < path.length; i++) meters += distanceMeters(path[i - 1], path[i]);
    const id = `feed-demo-colega-${k + 1}`;
    const mid = path[Math.floor(path.length / 2)];
    const highlights: Row[] = k === 0 ? [{ kind: 'zone_conquered', name: zoneTitle(db, zoneOf(mid)) }] : k === 1 ? [{ kind: 'raid_damage', km: Math.round(meters / 100) / 10 }] : [];
    // Reações já dadas por outros colegas (nunca pelo próprio autor nem pelo corredor de demonstração).
    const others = mates.filter((m) => m !== mateId);
    const kudos = new Map<string, FeedReaction>(others.slice(0, 2 - (k % 2)).map((m, i) => [m, i === 0 ? 'bora' : 'fogo']));
    s.kudos.set(id, kudos);
    return {
      id,
      actorId: mateId,
      activityId: null,
      createdAt: startedAt + pts.length * 1000,
      meters: Math.round(meters),
      movingSeconds: pts.length,
      route: clippedPolylines(db, id, mateId, path),
      highlights,
    };
  });
  return s.mates;
}

/** Itens visíveis para `userId`, do mais recente para o mais antigo. */
function visibleItems(db: DemoDb, userId: string): { crewId: string | null; items: StoredItem[] } {
  const crewId = db.crewOf(userId);
  if (!crewId) return { crewId: null, items: [] };
  const s = stateOf(db);
  const own = settingsOf(db, userId).shareRunsToFeed ? ownItems(db, userId) : [];
  const mates = mateItems(db, crewId, userId);
  // Colegas aplaudem as corridas do corredor de demonstração (sempre os mesmos, para a captura ser estável).
  const crewMates = db.tables.crew_members.filter((m) => m.crew_id === crewId && m.user_id !== userId).map((m) => String(m.user_id)).sort();
  own.forEach((item, k) => {
    if (s.kudos.has(item.id)) return;
    // Falta 1 colega em cada (o último da lista): é ele quem aplaude ao vivo a corrida mais recente.
    const n = Math.max(0, crewMates.length - 1 - k);
    s.kudos.set(item.id, new Map(crewMates.slice(0, n).map((m, i) => [m, i === 0 && k === 0 ? 'raio' : i % 3 === 2 ? 'fogo' : 'bora'])));
  });
  return { crewId, items: [...own, ...mates].filter((i) => !s.deleted.has(i.id)).sort((a, b) => b.createdAt - a.createdAt) };
}

function countsOf(kudos: Map<string, FeedReaction> | undefined): Record<FeedReaction, number> {
  const out: Record<FeedReaction, number> = { bora: 0, fogo: 0, raio: 0 };
  for (const r of kudos?.values() ?? []) out[r]++;
  return out;
}

/** Data local (Brasília, UTC−3) sem hora. */
const localDate = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);

/** Item `F` do contrato: sem hora, sem id de corrida, rota só se o autor deixa mostrar o mapa. */
function itemRow(db: DemoDb, item: StoredItem, userId: string): Row {
  const author = db.profile(item.actorId);
  const kudos = stateOf(db).kudos.get(item.id);
  const route = settingsOf(db, item.actorId).feedShowMap ? item.route : null;
  return {
    id: item.id,
    day: localDate(item.createdAt),
    you: item.actorId === userId,
    author: { username: author?.username ?? 'corredor', faction: author?.faction ?? null, avatarUrl: author?.avatar_url ?? null },
    meters: item.meters,
    movingSeconds: item.movingSeconds,
    avgPace: item.meters > 0 ? Math.round(item.movingSeconds / (item.meters / 1000)) : null,
    highlights: item.highlights,
    route,
    routeHidden: true, // o corte sempre esconde começo e fim
    kudos: countsOf(kudos),
    myReaction: kudos?.get(userId) ?? null,
    isDemo: true,
  };
}

/**
 * Manda os contadores do item pelo Realtime de demonstração, como o trigger de `feed_kudos_counts` do servidor
 * (revisão M4): só números, sem quem reagiu.
 */
function emitCounts(db: DemoDb, itemId: string) {
  const c = countsOf(stateOf(db).kudos.get(itemId));
  db.emit('feed_kudos_counts', 'UPDATE', { feed_item_id: itemId, ...c, total: c.bora + c.fogo + c.raio });
}

/** Agenda (uma vez por banco) o "Bora!" ao vivo do colega que ainda não aplaudiu a corrida mais recente. */
function scheduleLiveKudo(db: DemoDb, userId: string, items: StoredItem[]) {
  const s = stateOf(db);
  if (s.liveScheduled) return;
  const crewId = db.crewOf(userId);
  const target = items.find((i) => i.actorId === userId);
  if (!crewId || !target) return;
  const mate = db.tables.crew_members
    .filter((m) => m.crew_id === crewId && m.user_id !== userId)
    .map((m) => String(m.user_id))
    .sort()
    .find((m) => !s.kudos.get(target.id)?.has(m));
  if (!mate) return;
  s.liveScheduled = true;
  const timer = setTimeout(() => {
    if (s.deleted.has(target.id)) return;
    const kudos = s.kudos.get(target.id) ?? new Map<string, FeedReaction>();
    s.kudos.set(target.id, kudos);
    if (kudos.has(mate)) return;
    kudos.set(mate, 'bora');
    emitCounts(db, target.id);
  }, DEMO_LIVE_KUDO_MS);
  // Não segura o processo (testes e Node) só por causa do aplauso de demonstração.
  (timer as { unref?: () => void }).unref?.();
}

/**
 * Recap semanal de demonstração (contrato da E9, "Resumo da semana"): corridas pontuadas da pessoa, semana de
 * segunda a domingo em Brasília, sem horário. Com `withRoutes`, as até 3 mais longas vão como a rota do feed:
 * `clipRouteForSharing` com as zonas de privacidade da pessoa → ≤ 80 pontos → polylines de precisão 4.
 */
export function weeklyRecapDemo(db: DemoDb, userId: string | null, weekStartArg: unknown, withRoutes: boolean): Row {
  const profile = requireUser(db, userId);
  const asked = typeof weekStartArg === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekStartArg) ? weekStartArg : db.brToday();
  const noon = Date.parse(`${asked}T12:00:00Z`);
  if (!Number.isFinite(noon)) throw raise('VALIDATION: semana inválida');
  const back = (new Date(noon).getUTCDay() + 6) % 7;
  const weekStart = new Date(noon - back * DAY_MS).toISOString().slice(0, 10);
  const weekEnd = new Date(noon + (6 - back) * DAY_MS).toISOString().slice(0, 10);
  const from = Date.parse(`${weekStart}T03:00:00Z`); // 00:00 em Brasília
  const runs = db.tables.activities.filter((a) => {
    const t = msOf(a.started_at) ?? 0;
    return a.user_id === userId && (a.status === 'valid' || a.status === 'partial') && t >= from && t < from + 7 * DAY_MS;
  });
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const a of runs) days[Math.floor(((msOf(a.started_at) ?? from) - from) / DAY_MS)] += Number(a.meters) || 0;
  const ids = new Set(runs.map((a) => a.id));
  const longest = [...runs].sort((a, b) => (Number(b.meters) || 0) - (Number(a.meters) || 0)).slice(0, 3);
  const zones: PrivacyCircle[] = db.tables.privacy_zones.filter((z) => z.user_id === userId).map((z) => ({ lat: Number(z.lat), lng: Number(z.lng), radiusM: Number(z.radius_m) }));
  const routes = withRoutes
    ? longest
        .map((a, i) => {
          const pts = db.pointsOf(String(a.id)).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
          // semente nova a cada chamada, como no servidor real
          const clipped = clipRouteForSharing(pts, zones, { seed: (seedOf(String(a.id)) ^ (db.now() + i)) >>> 0, hideEnds: true });
          return clipped.mode === 'route' ? { pieces: thinPieces(clipped.pieces).map((p) => encodePolyline(p)), routeHidden: true } : null;
        })
        .filter((r): r is { pieces: string[]; routeHidden: boolean } => r !== null)
    : [];
  return {
    weekStart,
    weekEnd,
    final: db.brToday() > weekEnd,
    days: days.map(Math.round),
    meters: Math.round(days.reduce((n, m) => n + m, 0)),
    runs: runs.length,
    movingSeconds: runs.reduce((n, a) => n + (Number(a.moving_seconds) || 0), 0),
    zones: new Set(db.tables.activity_zones.filter((z) => ids.has(z.activity_id) && z.outcome === 'conquered').map((z) => z.zone_id)).size,
    streakWeeks: Number(profile.streak_weeks) || 0,
    isDemo: true,
    routes,
  };
}

export const DEMO_SOCIAL_RPC_HANDLERS: Record<string, RpcHandler> = {
  crew_feed: (db, userId, args) => {
    requireUser(db, userId);
    const { crewId, items } = visibleItems(db, userId!);
    const crew = crewId ? db.tables.crews.find((c) => c.id === crewId) : null;
    const limit = Math.max(1, Math.min(50, typeof args.p_limit === 'number' ? args.p_limit : FEED_PAGE_SIZE));
    // `p_before` = id do último item da página anterior.
    const from = args.p_before ? items.findIndex((i) => i.id === args.p_before) + 1 : 0;
    const page = from > 0 || !args.p_before ? items.slice(from, from + limit) : [];
    const more = from + page.length < items.length && page.length > 0;
    scheduleLiveKudo(db, userId!, items);
    return {
      crew: crew ? { id: crew.id, name: crew.name, tag: crew.tag, faction: crew.faction } : null,
      items: page.map((i) => itemRow(db, i, userId!)),
      next: more ? page[page.length - 1].id : null,
    };
  },

  react_feed_item: (db, userId, args) => {
    requireUser(db, userId);
    const item = visibleItems(db, userId!).items.find((i) => i.id === args.p_item);
    if (!item) throw raise('NOT_FOUND: item do feed não encontrado');
    if (item.actorId === userId) throw raise('KUDOS_SELF: não dá para reagir à própria corrida');
    const reaction = args.p_reaction ?? null;
    if (reaction !== null && !isFeedReaction(reaction)) throw raise('VALIDATION: reação inválida');
    const s = stateOf(db);
    const kudos = s.kudos.get(item.id) ?? new Map<string, FeedReaction>();
    s.kudos.set(item.id, kudos);
    const had = kudos.get(userId!) ?? null;
    if (reaction === null) {
      kudos.delete(userId!);
      if (had) emitCounts(db, item.id);
    } else if (had !== reaction) {
      const key = `${userId}|${db.brToday()}`;
      const given = s.given.get(key) ?? 0;
      if (given >= FEED_DAILY_REACTIONS) throw raise('KUDOS_LIMIT: limite de reações do dia atingido');
      s.given.set(key, given + 1);
      kudos.set(userId!, reaction);
      emitCounts(db, item.id);
    }
    return itemRow(db, item, userId!);
  },

  feed_item_kudos: (db, userId, args) => {
    requireUser(db, userId);
    const item = visibleItems(db, userId!).items.find((i) => i.id === args.p_item);
    if (!item) throw raise('NOT_FOUND: item do feed não encontrado');
    return [...(stateOf(db).kudos.get(item.id) ?? new Map<string, FeedReaction>())].map(([uid, reaction]) => {
      const p = db.profile(uid);
      return { username: p?.username ?? 'corredor', faction: p?.faction ?? null, avatarUrl: p?.avatar_url ?? null, reaction };
    });
  },

  delete_feed_item: (db, userId, args) => {
    requireUser(db, userId);
    const item = visibleItems(db, userId!).items.find((i) => i.id === args.p_item && i.actorId === userId);
    if (!item) return false;
    stateOf(db).deleted.add(item.id);
    return true;
  },

  my_feed_settings: (db, userId) => {
    requireUser(db, userId);
    return settingsOf(db, userId!);
  },

  set_feed_settings: (db, userId, args) => {
    requireUser(db, userId);
    const cur = settingsOf(db, userId!);
    const next = {
      shareRunsToFeed: typeof args.p_share_runs === 'boolean' ? args.p_share_runs : cur.shareRunsToFeed,
      feedShowMap: typeof args.p_show_map === 'boolean' ? args.p_show_map : cur.feedShowMap,
    };
    stateOf(db).settings.set(userId!, next);
    return next;
  },

  record_share: (db, userId, args) => {
    requireUser(db, userId);
    if (db.activityOwner(args.p_activity) !== userId) throw raise('NOT_FOUND: corrida não encontrada');
    return { completed: [] };
  },
};
