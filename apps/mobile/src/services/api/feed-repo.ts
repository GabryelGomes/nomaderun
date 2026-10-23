/**
 * Feed da crew com reações prontas (RF-014, D-79; E8, T7.2.5). Só RPCs, sem tabela direta:
 *  - `crew_feed(p_before, p_limit)` → página do feed da crew (só a crew vê; rota já cortada no servidor);
 *  - `react_feed_item(p_item, p_reaction)` → põe, troca ou tira (`null`) a reação da pessoa.
 *
 * Contrato proposto para a E9 em `docs/melhoria/relatorios/E8-onda2.md` (§5). Servidor antigo (`PGRST202`)
 * ou flag `feed` desligada (`FEATURE_DISABLED`) viram "indisponível" (`FEED_UNAVAILABLE`).
 *
 * A rota do item chega como polyline (precisão 4) já cortada pelo `clipRouteForSharing` na Edge Function.
 * O decodificador daqui produz `ServerClippedRoute`: um tipo próprio, só para o mini-mapa do feed. Ele não
 * é `SharedRoute` e o card de compartilhar não o aceita (a rota de outra pessoa nunca vira card).
 */
import type { FactionId, LatLng } from '@/domain/types';

import { AppError, attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

export const FEED_REACTIONS = ['bora', 'fogo', 'raio'] as const;
export type FeedReaction = (typeof FEED_REACTIONS)[number];

export const FEED_PAGE_SIZE = 20;
/** Teto de reações por dia (o servidor confere: `KUDOS_LIMIT`). */
export const FEED_DAILY_REACTIONS = 200;

/** Código do `AppError.detail` quando o servidor não tem o feed (contrato 1) ou a flag está desligada. */
export const FEED_UNAVAILABLE = 'FEATURE_UNAVAILABLE';
const UNAVAILABLE_DETAILS = new Set(['PGRST202', 'PGRST205', '42883', '42P01', 'FEATURE_DISABLED']);

/** Erro que a tela mostra como "indisponível" (sem jargão). */
export function isFeedUnavailable(error: AppError): boolean {
  return error.detail === FEED_UNAVAILABLE || (!!error.detail && UNAVAILABLE_DETAILS.has(error.detail));
}

function asUnavailable<T>(res: Result<T>): Result<T> {
  if (res.ok || !isFeedUnavailable(res.error)) return res;
  return { ok: false, error: new AppError('SERVER', 'O feed da crew ainda não está disponível.', { detail: FEED_UNAVAILABLE }) };
}

// -----------------------------------------------------------------------------------------------
// Polyline (formato do Google, precisão 4 ≈ 11 m) e a rota cortada pelo servidor
// -----------------------------------------------------------------------------------------------

export const FEED_POLYLINE_PRECISION = 4;

declare const SERVER_CLIPPED_BRAND: unique symbol;

/** Rota de um item do feed, cortada no servidor. Só `decodeServerRoute` cria valores deste tipo. */
export type ServerClippedRoute = {
  /** Pedaços visíveis (o servidor já tirou começo, fim e zonas de privacidade). */
  readonly pieces: readonly (readonly LatLng[])[];
  readonly [SERVER_CLIPPED_BRAND]: true;
};

const issued = new WeakSet<object>();

export function isServerClippedRoute(value: unknown): value is ServerClippedRoute {
  return typeof value === 'object' && value !== null && issued.has(value);
}

function encodeSigned(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

/** Codifica uma linha (usado pelo servidor de demonstração; a Edge Function usa o mesmo formato). */
export function encodePolyline(points: readonly LatLng[], precision = FEED_POLYLINE_PRECISION): string {
  const k = 10 ** precision;
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * k);
    const lng = Math.round(p.lng * k);
    out += encodeSigned(lat - lastLat) + encodeSigned(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

/** Decodifica uma linha. Texto inválido (caractere fora da faixa, número cortado) → `null`. */
export function decodePolyline(text: string, precision = FEED_POLYLINE_PRECISION): LatLng[] | null {
  const k = 10 ** precision;
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let shift = 0;
    let result = 0;
    for (;;) {
      if (i >= text.length || shift > 30) return null;
      const b = text.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) return null;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (b < 0x20) break;
    }
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < text.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) return null;
    lat += dLat;
    lng += dLng;
    const p = { lat: lat / k, lng: lng / k };
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null;
    out.push(p);
  }
  return out;
}

/** Máximo de pontos que o app aceita por item (o contrato pede ≤ 80; folga para o servidor antigo). */
const MAX_ROUTE_POINTS = 400;

/**
 * `payload.route` → `ServerClippedRoute`. Aceita uma polyline (1 pedaço) ou uma lista (1 por pedaço).
 * Pedaço inválido ou com menos de 2 pontos é descartado; sem nenhum, `null` (o card mostra "sem rota").
 */
export function decodeServerRoute(value: unknown): ServerClippedRoute | null {
  const texts = typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  const pieces: LatLng[][] = [];
  let total = 0;
  for (const t of texts) {
    const piece = t ? decodePolyline(t) : null;
    if (!piece || piece.length < 2) continue;
    total += piece.length;
    if (total > MAX_ROUTE_POINTS) break;
    pieces.push(piece);
  }
  if (pieces.length === 0) return null;
  const route = Object.freeze({ pieces: Object.freeze(pieces.map((p) => Object.freeze(p))) }) as unknown as ServerClippedRoute;
  issued.add(route);
  return route;
}

// -----------------------------------------------------------------------------------------------
// Itens do feed
// -----------------------------------------------------------------------------------------------

export type FeedHighlight = { kind: 'zone_conquered'; name: string } | { kind: 'raid_damage'; km: number } | { kind: 'pr'; distance: string };

export type FeedItemKind = 'run' | 'zone_captured' | 'medal' | 'raid_defeated' | 'league_promoted' | 'level_up';

export type FeedItem = {
  id: string;
  kind: FeedItemKind;
  activityId: string | null;
  actor: { username: string; faction: FactionId | null; avatarUrl: string | null };
  /** O item é da própria pessoa (não dá para reagir a si mesmo: `KUDOS_SELF`). */
  you: boolean;
  /** Data local da corrida, `AAAA-MM-DD`. O feed nunca traz a hora. */
  localDate: string;
  meters: number;
  movingSeconds: number;
  /** `null` = sem mapa (a pessoa desligou, ou o corte não deixou nada). */
  route: ServerClippedRoute | null;
  routeHidden: boolean;
  highlights: FeedHighlight[];
  reactions: Record<FeedReaction, number>;
  myReaction: FeedReaction | null;
  isDemo: boolean;
  createdAt: string;
};

export type FeedCrew = { id: string; name: string; tag: string; faction: FactionId | null };

export type FeedPage = {
  /** `null` = a pessoa não está em crew (estado vazio "Entre numa crew"). */
  crew: FeedCrew | null;
  items: FeedItem[];
  /** Cursor da próxima página (`p_before`), ou `null` no fim. */
  nextBefore: string | null;
};

type Row = Record<string, unknown>;

const FACTIONS: readonly FactionId[] = ['striders', 'coyotes', 'owls', 'volt'];
const KINDS: readonly FeedItemKind[] = ['run', 'zone_captured', 'medal', 'raid_defeated', 'league_promoted', 'level_up'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const faction = (v: unknown): FactionId | null => (FACTIONS.includes(v as FactionId) ? (v as FactionId) : null);
export const isFeedReaction = (v: unknown): v is FeedReaction => FEED_REACTIONS.includes(v as FeedReaction);

function toHighlight(v: unknown): FeedHighlight | null {
  if (!v || typeof v !== 'object') return null;
  const h = v as Row;
  if (h.kind === 'zone_conquered' && str(h.name)) return { kind: 'zone_conquered', name: str(h.name) };
  if (h.kind === 'raid_damage' && num(h.km) > 0) return { kind: 'raid_damage', km: num(h.km) };
  if (h.kind === 'pr' && str(h.distance)) return { kind: 'pr', distance: str(h.distance) };
  return null;
}

export function toReactions(v: unknown): Record<FeedReaction, number> {
  const r = (v && typeof v === 'object' ? v : {}) as Row;
  return { bora: Math.max(0, num(r.bora)), fogo: Math.max(0, num(r.fogo)), raio: Math.max(0, num(r.raio)) };
}

export function toFeedItem(row: Row): FeedItem {
  const actor = (row.actor && typeof row.actor === 'object' ? row.actor : {}) as Row;
  const route = decodeServerRoute(row.route);
  return {
    id: str(row.id),
    kind: KINDS.includes(row.kind as FeedItemKind) ? (row.kind as FeedItemKind) : 'run',
    activityId: str(row.activityId) || null,
    actor: { username: str(actor.username) || 'corredor', faction: faction(actor.faction), avatarUrl: str(actor.avatarUrl) || null },
    you: row.you === true,
    localDate: /^\d{4}-\d{2}-\d{2}$/.test(str(row.localDate)) ? str(row.localDate) : '',
    meters: num(row.meters),
    movingSeconds: num(row.movingSeconds),
    route,
    routeHidden: row.routeHidden === true || route === null,
    highlights: (Array.isArray(row.highlights) ? row.highlights : []).map(toHighlight).filter((h): h is FeedHighlight => h !== null).slice(0, 3),
    reactions: toReactions(row.reactions),
    myReaction: isFeedReaction(row.myReaction) ? row.myReaction : null,
    isDemo: row.isDemo === true,
    createdAt: str(row.createdAt),
  };
}

export function toFeedPage(data: unknown): FeedPage {
  const d = (data && typeof data === 'object' ? data : {}) as Row;
  const c = d.crew && typeof d.crew === 'object' ? (d.crew as Row) : null;
  return {
    crew: c ? { id: str(c.id), name: str(c.name), tag: str(c.tag), faction: faction(c.faction) } : null,
    items: (Array.isArray(d.items) ? (d.items as Row[]) : []).map(toFeedItem).filter((i) => i.id),
    nextBefore: str(d.nextBefore) || null,
  };
}

/** Uma página do feed da crew, da mais recente para a mais antiga. */
export async function listCrewFeed(opts: { before?: string | null; limit?: number } = {}): Promise<Result<FeedPage>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('crew_feed', { p_before: opts.before ?? null, p_limit: opts.limit ?? FEED_PAGE_SIZE });
    if (error) throw error;
    return toFeedPage(data);
  });
  return asUnavailable(res);
}

export type ReactionResult = { itemId: string; reactions: Record<FeedReaction, number>; myReaction: FeedReaction | null };

/** Põe, troca ou tira (`reaction = null`) a reação da pessoa num item. Erros: `KUDOS_SELF`, `KUDOS_LIMIT`, `NOT_FOUND`. */
export async function reactToFeedItem(itemId: string, reaction: FeedReaction | null): Promise<Result<ReactionResult>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('react_feed_item', { p_item: itemId, p_reaction: reaction });
    if (error) throw error;
    const d = (data ?? {}) as Row;
    return { itemId: str(d.itemId) || itemId, reactions: toReactions(d.reactions), myReaction: isFeedReaction(d.myReaction) ? d.myReaction : null };
  });
  return asUnavailable(res);
}
