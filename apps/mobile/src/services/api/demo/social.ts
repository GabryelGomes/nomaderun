/**
 * Pares de demonstração da E8 (T7.2.5): feed da crew com reações (D-79) e `record_share`.
 * Imita o contrato proposto para a E9 (`docs/melhoria/relatorios/E8-onda2.md` §5):
 *  - só a crew vê o feed; o item não traz hora nem coordenada fora da rota cortada;
 *  - a rota sai cortada pelo mesmo `clipRouteForSharing` do domain (zonas de privacidade do autor e
 *    pontas escondidas) e vai como polyline de precisão 4, no máximo 80 pontos por item;
 *  - reações `bora | fogo | raio`, 1 por pessoa por item, `KUDOS_SELF` e `KUDOS_LIMIT` (200 por dia).
 *
 * O feed da crew de demonstração tem 6 corridas: as 3 mais recentes do corredor de demonstração (as do
 * banco, incluindo a que ele acabou de correr) e 3 de colegas da crew, geradas sobre a rota do lago.
 * Estado (reações) guardado fora do `DemoDb`, por banco, para não mexer nas tabelas da E10.
 */
import { distanceMeters } from '@/domain/geo';
import { zoneOf } from '@/domain/grid';
import { clipRouteForSharing, type PrivacyCircle } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';
import { demoRoute, zoneName } from '@/demo/demo-data';
import { demoRunPoints } from '@/demo/world';

import { encodePolyline, FEED_DAILY_REACTIONS, FEED_PAGE_SIZE, isFeedReaction, type FeedReaction } from '../feed-repo';
import { iso, msOf, raise, type DemoDb, type Row } from './db';

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
};

const states = new WeakMap<DemoDb, SocialState>();

function stateOf(db: DemoDb): SocialState {
  let s = states.get(db);
  if (!s) {
    s = { kudos: new Map(), given: new Map(), routes: new Map(), mates: null };
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
  const own = ownItems(db, userId);
  const mates = mateItems(db, crewId, userId);
  // Colegas aplaudem as corridas do corredor de demonstração (sempre os mesmos, para a captura ser estável).
  const crewMates = db.tables.crew_members.filter((m) => m.crew_id === crewId && m.user_id !== userId).map((m) => String(m.user_id)).sort();
  own.forEach((item, k) => {
    if (s.kudos.has(item.id)) return;
    const n = Math.max(0, crewMates.length - k);
    s.kudos.set(item.id, new Map(crewMates.slice(0, n).map((m, i) => [m, i === 0 && k === 0 ? 'raio' : i % 3 === 2 ? 'fogo' : 'bora'])));
  });
  return { crewId, items: [...own, ...mates].sort((a, b) => b.createdAt - a.createdAt) };
}

function countsOf(kudos: Map<string, FeedReaction> | undefined): Record<FeedReaction, number> {
  const out: Record<FeedReaction, number> = { bora: 0, fogo: 0, raio: 0 };
  for (const r of kudos?.values() ?? []) out[r]++;
  return out;
}

/** Data local (Brasília, UTC−3) sem hora. */
const localDate = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);

function itemRow(db: DemoDb, item: StoredItem, userId: string): Row {
  const actor = db.profile(item.actorId);
  const kudos = stateOf(db).kudos.get(item.id);
  return {
    id: item.id,
    kind: 'run',
    activityId: item.actorId === userId ? item.activityId : null,
    actor: { username: actor?.username ?? 'corredor', faction: actor?.faction ?? null, avatarUrl: actor?.avatar_url ?? null },
    you: item.actorId === userId,
    localDate: localDate(item.createdAt),
    meters: item.meters,
    movingSeconds: item.movingSeconds,
    route: item.route,
    routeHidden: item.route === null,
    highlights: item.highlights,
    reactions: countsOf(kudos),
    myReaction: kudos?.get(userId) ?? null,
    isDemo: true,
    createdAt: iso(item.createdAt),
  };
}

export const DEMO_SOCIAL_RPC_HANDLERS: Record<string, RpcHandler> = {
  crew_feed: (db, userId, args) => {
    requireUser(db, userId);
    const { crewId, items } = visibleItems(db, userId!);
    const crew = crewId ? db.tables.crews.find((c) => c.id === crewId) : null;
    const before = msOf(args.p_before);
    const limit = Math.max(1, Math.min(50, typeof args.p_limit === 'number' ? args.p_limit : FEED_PAGE_SIZE));
    const page = items.filter((i) => before === null || i.createdAt < before).slice(0, limit);
    const more = items.filter((i) => before === null || i.createdAt < before).length > page.length;
    return {
      crew: crew ? { id: crew.id, name: crew.name, tag: crew.tag, faction: crew.faction } : null,
      items: page.map((i) => itemRow(db, i, userId!)),
      nextBefore: more && page.length ? iso(page[page.length - 1].createdAt) : null,
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
    if (reaction === null) kudos.delete(userId!);
    else if (kudos.get(userId!) !== reaction) {
      const key = `${userId}|${db.brToday()}`;
      const given = s.given.get(key) ?? 0;
      if (given >= FEED_DAILY_REACTIONS) throw raise('KUDOS_LIMIT: limite de reações do dia atingido');
      s.given.set(key, given + 1);
      kudos.set(userId!, reaction);
    }
    return { itemId: item.id, reactions: countsOf(kudos), myReaction: kudos.get(userId!) ?? null };
  },

  record_share: (db, userId, args) => {
    requireUser(db, userId);
    if (db.activityOwner(args.p_activity) !== userId) throw raise('NOT_FOUND: corrida não encontrada');
    return { completed: [] };
  },
};
