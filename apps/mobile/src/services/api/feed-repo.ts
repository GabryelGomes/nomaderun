/**
 * Feed da crew com reações prontas (RF-014, D-79; E8, T7.2.5). Só RPCs (`feed_items` não é lida direto):
 *  - `crew_feed(p_limit, p_before)` → página do feed da crew (só a crew vê; rota já cortada no servidor);
 *  - `react_feed_item(p_item, p_reaction)` → põe, troca ou tira (`null`) a reação; devolve o item;
 *  - `feed_item_kudos(p_item)` → quem reagiu; `delete_feed_item(p_item)` → tira a própria corrida;
 *  - `my_feed_settings()` / `set_feed_settings(p_share_runs, p_show_map)`.
 *
 * Contrato: `docs/API_CONTRATO.md`, "Contrato v2 — onda 2" (E9). Servidor antigo (`PGRST202`) ou flag
 * `feed` desligada (`FEATURE_DISABLED`) viram "indisponível" (`FEED_UNAVAILABLE`).
 *
 * A rota do item chega como polyline (precisão 4) já cortada pelo `clipRouteForSharing` na Edge Function.
 * O decodificador daqui produz `ServerClippedRoute`: um tipo próprio, só para o mini-mapa do feed. Ele não
 * é `SharedRoute` e o card de compartilhar não o aceita (a rota de outra pessoa nunca vira card).
 */
import type { FactionId, LatLng } from '@/domain/types';

import { AppError, attempt, fail, ok, toAppError, type Result } from './errors';
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

export type FeedHighlight = { kind: 'zone_conquered'; name: string } | { kind: 'raid_damage'; km: number; damage: number } | { kind: 'pr'; distance: string };

/** Item `F` do contrato (`crew_feed`, `react_feed_item`). */
export type FeedItem = {
  id: string;
  author: { username: string; faction: FactionId | null; avatarUrl: string | null };
  /** O item é da própria pessoa (não dá para reagir a si mesmo: `KUDOS_SELF`; pode tirar do feed). */
  you: boolean;
  /** Data local da corrida, `AAAA-MM-DD`. O feed nunca traz a hora. */
  day: string;
  meters: number;
  movingSeconds: number;
  /** Ritmo médio (s/km) quando o servidor manda; senão o app calcula. */
  avgPace: number | null;
  /** `null` = sem mapa (a pessoa desligou, ou o corte não deixou nada). */
  route: ServerClippedRoute | null;
  /** Parte da rota foi escondida (ou não há rota). */
  routeHidden: boolean;
  highlights: FeedHighlight[];
  kudos: Record<FeedReaction, number>;
  myReaction: FeedReaction | null;
  isDemo: boolean;
};

export type FeedCrew = { id: string; name: string; tag: string; faction: FactionId | null };

export type FeedPage = {
  /** `null` = a pessoa não está em crew (estado vazio "Entre numa crew"). */
  crew: FeedCrew | null;
  items: FeedItem[];
  /** Cursor da próxima página (`p_before` = id do último item), ou `null` no fim. */
  next: string | null;
};

type Row = Record<string, unknown>;

const FACTIONS: readonly FactionId[] = ['striders', 'coyotes', 'owls', 'volt'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const faction = (v: unknown): FactionId | null => (FACTIONS.includes(v as FactionId) ? (v as FactionId) : null);
export const isFeedReaction = (v: unknown): v is FeedReaction => FEED_REACTIONS.includes(v as FeedReaction);

function toHighlight(v: unknown): FeedHighlight | null {
  const h = obj(v);
  if (h.kind === 'zone_conquered' && str(h.name)) return { kind: 'zone_conquered', name: str(h.name) };
  if (h.kind === 'raid_damage' && num(h.km) > 0) return { kind: 'raid_damage', km: num(h.km), damage: num(h.damage) };
  if (h.kind === 'pr' && str(h.distance)) return { kind: 'pr', distance: str(h.distance) };
  return null;
}

export function toKudos(v: unknown): Record<FeedReaction, number> {
  const r = obj(v);
  return { bora: Math.max(0, num(r.bora)), fogo: Math.max(0, num(r.fogo)), raio: Math.max(0, num(r.raio)) };
}

/** Converte o `F` do servidor sem confiar no formato (campo ausente ou estranho vira o neutro). */
export function toFeedItem(row: Row): FeedItem {
  const author = obj(row.author);
  const route = decodeServerRoute(row.route);
  const pace = num(row.avgPace);
  return {
    id: str(row.id),
    author: { username: str(author.username) || 'corredor', faction: faction(author.faction), avatarUrl: str(author.avatarUrl) || null },
    you: row.you === true,
    day: /^\d{4}-\d{2}-\d{2}$/.test(str(row.day)) ? str(row.day) : '',
    meters: num(row.meters),
    movingSeconds: num(row.movingSeconds),
    avgPace: pace > 0 ? pace : null,
    route,
    routeHidden: row.routeHidden === true || route === null,
    highlights: (Array.isArray(row.highlights) ? row.highlights : []).map(toHighlight).filter((h): h is FeedHighlight => h !== null).slice(0, 3),
    kudos: toKudos(row.kudos),
    myReaction: isFeedReaction(row.myReaction) ? row.myReaction : null,
    isDemo: row.isDemo === true,
  };
}

export function toFeedPage(data: unknown): FeedPage {
  const d = obj(data);
  const c = d.crew && typeof d.crew === 'object' ? obj(d.crew) : null;
  return {
    crew: c ? { id: str(c.id), name: str(c.name), tag: str(c.tag), faction: faction(c.faction) } : null,
    items: (Array.isArray(d.items) ? (d.items as Row[]) : []).map(toFeedItem).filter((i) => i.id),
    next: str(d.next) || null,
  };
}

/** Uma página do feed da crew, da mais recente para a mais antiga. `before` = id do último item já carregado. */
export async function listCrewFeed(opts: { before?: string | null; limit?: number } = {}): Promise<Result<FeedPage>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('crew_feed', { p_limit: opts.limit ?? FEED_PAGE_SIZE, p_before: opts.before ?? null });
    if (error) throw error;
    return toFeedPage(data);
  });
  return asUnavailable(res);
}

/** Põe, troca ou tira (`reaction = null`) a reação. Devolve o item atualizado. Erros: `KUDOS_SELF`, `KUDOS_LIMIT`, `NOT_FOUND`. */
export async function reactToFeedItem(itemId: string, reaction: FeedReaction | null): Promise<Result<FeedItem>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('react_feed_item', { p_item: itemId, p_reaction: reaction });
    if (error) throw error;
    const item = toFeedItem(obj(data));
    return item.id ? item : { ...item, id: itemId };
  });
  return asUnavailable(res);
}

export type FeedKudo = { username: string; faction: FactionId | null; avatarUrl: string | null; reaction: FeedReaction };

/** Quem reagiu a um item (só nomes da crew). */
export async function listFeedItemKudos(itemId: string): Promise<Result<FeedKudo[]>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('feed_item_kudos', { p_item: itemId });
    if (error) throw error;
    return (Array.isArray(data) ? (data as Row[]) : [])
      .filter((k) => isFeedReaction(k.reaction))
      .map((k) => ({ username: str(k.username) || 'corredor', faction: faction(k.faction), avatarUrl: str(k.avatarUrl) || null, reaction: k.reaction as FeedReaction }));
  });
  return asUnavailable(res);
}

/** Tira a própria corrida do feed (`true` quando apagou). */
export async function deleteFeedItem(itemId: string): Promise<Result<boolean>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('delete_feed_item', { p_item: itemId });
    if (error) throw error;
    return data === true;
  });
  return asUnavailable(res);
}

/** "Mostrar minhas corridas para a crew" e "Mostrar o mapa das minhas corridas" (padrão: ligados). */
export type FeedSettings = { shareRunsToFeed: boolean; feedShowMap: boolean };

const toSettings = (v: unknown): FeedSettings => {
  const d = obj(v);
  return { shareRunsToFeed: d.shareRunsToFeed !== false, feedShowMap: d.feedShowMap !== false };
};

export async function getFeedSettings(): Promise<Result<FeedSettings>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('my_feed_settings');
    if (error) throw error;
    return toSettings(data);
  });
  return asUnavailable(res);
}

/** Muda só o que vier (`undefined` = não muda). Desligar "mostrar corridas" apaga os itens; desligar o mapa tira as rotas já publicadas. */
export async function setFeedSettings(patch: Partial<FeedSettings>): Promise<Result<FeedSettings>> {
  const res = await attempt(async () => {
    const { data, error } = await requireSupabase().rpc('set_feed_settings', { p_share_runs: patch.shareRunsToFeed ?? null, p_show_map: patch.feedShowMap ?? null });
    if (error) throw error;
    return toSettings(data);
  });
  return asUnavailable(res);
}

// -----------------------------------------------------------------------------------------------
// Realtime dos aplausos (T7.3.7, revisão M4)
// -----------------------------------------------------------------------------------------------

/**
 * Contadores de um item que chegaram pelo Realtime de `feed_kudos_counts` (só números: sem `user_id`, RLS da
 * crew na assinatura). Valores **absolutos**: a tela troca o contador, não soma (nada conta 2 vezes). A
 * reação da própria pessoa (`myReaction`) continua vindo das RPCs. `kudos` saiu do Realtime na revisão (M4):
 * o DELETE não passa pela RLS e levava quem desfez.
 */
export type KudosCounts = { itemId: string; kudos: Record<FeedReaction, number> };

export function toKudosCounts(payload: unknown): KudosCounts | null {
  const p = obj(payload);
  const event = p.eventType;
  if (event !== 'INSERT' && event !== 'UPDATE' && event !== 'DELETE') return null;
  const row = event === 'DELETE' ? obj(p.old) : obj(p.new);
  const itemId = str(row.feed_item_id);
  if (!itemId) return null;
  // Linha apagada (o item saiu do feed): zera.
  return { itemId, kudos: event === 'DELETE' ? { bora: 0, fogo: 0, raio: 0 } : toKudos(row) };
}

export type KudosSubscription = { unsubscribe: () => void };

let kudosTopic = 0;

/**
 * Assina `feed_kudos_counts` (`postgres_changes`, evento `*`). `onStatus` recebe `SUBSCRIBED`, `CHANNEL_ERROR`,
 * `TIMED_OUT` ou `CLOSED` (fora do ar, a tela segue com a atualização ao abrir). Cada assinatura tem um tópico
 * próprio: o feed pode estar aberto no Clube e na tela cheia ao mesmo tempo.
 */
export function subscribeKudosCounts(onChange: (counts: KudosCounts) => void, onStatus?: (status: string) => void): Result<KudosSubscription> {
  try {
    const supabase = requireSupabase();
    kudosTopic += 1;
    const channel = supabase
      .channel(`feed-kudos-${kudosTopic}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_kudos_counts' }, (payload: unknown) => {
        const counts = toKudosCounts(payload);
        if (counts) onChange(counts);
      })
      .subscribe((status: string) => onStatus?.(status));
    return ok({ unsubscribe: () => void supabase.removeChannel(channel) });
  } catch (e) {
    return fail(toAppError(e));
  }
}
