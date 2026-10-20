import { emptyInfluence, type Influence, type Zone } from '@/domain/territory';
import { FACTION_IDS, type FactionId } from '@/domain/types';

import { AppError, fail, MESSAGES, ok, toAppError, type Result } from './errors';
import { callFunction } from './functions';
import { requireSupabase } from './supabase';
import { isFaction } from './types';

/**
 * Zonas do servidor (RF-007): `GET /zones?bbox=`, `GET /zone?id=` e Realtime na tabela `zones`.
 * O formato do app é o `Zone` do domain; nome e cidade ficam à parte (`ZoneMeta`).
 */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type ZoneMeta = { name: string | null; city: string | null };

export type ServerZone = { zone: Zone; meta: ZoneMeta };

export type ZoneEventType = 'captured' | 'under_attack' | 'defended' | 'neutralized' | 'shield_up' | 'shield_down';

export type ZoneDetail = ServerZone & {
  updatedAt: number | null;
  topRunners: { username: string; faction: FactionId | null; rp: number }[];
  events: { type: ZoneEventType; faction: FactionId | null; from: FactionId | null; at: number }[];
};

type Row = Record<string, unknown>;

/** O servidor recusa caixas maiores que 1 grau por lado (contrato). */
export const MAX_BBOX_DEGREES = 1;

export function clampBbox(b: Bbox): Bbox {
  const fix = (min: number, max: number, lo: number, hi: number) => {
    let a = Math.max(lo, Math.min(min, max));
    let z = Math.min(hi, Math.max(min, max));
    if (z - a > MAX_BBOX_DEGREES) {
      const mid = (a + z) / 2;
      a = mid - MAX_BBOX_DEGREES / 2 + 1e-6;
      z = mid + MAX_BBOX_DEGREES / 2 - 1e-6;
    }
    return [a, z] as const;
  };
  const [minLng, maxLng] = fix(b.minLng, b.maxLng, -180, 180);
  const [minLat, maxLat] = fix(b.minLat, b.maxLat, -90, 90);
  return { minLng, minLat, maxLng, maxLat };
}

/** Caixa ao redor de um ponto, com meia-altura em metros (aproximação equiretangular, suficiente para a cidade). */
export function bboxAround(center: { lat: number; lng: number }, halfSpanM: number): Bbox {
  const dLat = halfSpanM / 111_320;
  const dLng = halfSpanM / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  return clampBbox({ minLng: center.lng - dLng, minLat: center.lat - dLat, maxLng: center.lng + dLng, maxLat: center.lat + dLat });
}

export const bboxParam = (b: Bbox) => [b.minLng, b.minLat, b.maxLng, b.maxLat].map((n) => n.toFixed(6)).join(',');

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);

function toMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function toInfluence(v: unknown): Influence {
  const inf = emptyInfluence();
  if (v && typeof v === 'object') {
    for (const f of FACTION_IDS) {
      const n = (v as Row)[f];
      if (typeof n === 'number' && Number.isFinite(n)) inf[f] = n;
    }
  }
  return inf;
}

/** Aceita o formato das functions (camelCase, datas em ms) e o da tabela/Realtime (snake_case, ISO). */
export function toServerZone(row: Row): ServerZone {
  const attackStartedAt = toMs(row.attackStartedAt ?? row.attack_started_at);
  return {
    zone: {
      id: String(row.id ?? ''),
      influence: toInfluence(row.influence),
      owner: isFaction(row.owner) ? row.owner : null,
      shield: typeof row.shield === 'number' ? row.shield : 0,
      attackStartedAt,
      attacker: attackStartedAt !== null && isFaction(row.attacker) ? row.attacker : null,
      blocked: row.blocked === true,
    },
    meta: { name: str(row.name), city: str(row.city) },
  };
}

export function toZoneDetail(body: Row): ZoneDetail {
  const base = toServerZone(body);
  const runners = Array.isArray(body.topRunners) ? (body.topRunners as Row[]) : [];
  const events = Array.isArray(body.events) ? (body.events as Row[]) : [];
  return {
    ...base,
    updatedAt: toMs(body.updatedAt),
    topRunners: runners.map((r) => ({
      username: String(r.username ?? ''),
      faction: isFaction(r.faction) ? r.faction : null,
      rp: typeof r.rp === 'number' ? r.rp : 0,
    })),
    events: events.map((e) => ({
      type: String(e.type) as ZoneEventType,
      faction: isFaction(e.faction) ? e.faction : null,
      from: isFaction(e.from) ? e.from : null,
      at: toMs(e.at) ?? 0,
    })),
  };
}

export async function fetchZonesInBbox(bbox: Bbox): Promise<Result<ServerZone[]>> {
  const res = await callFunction<{ zones?: Row[] }>('zones', { method: 'GET', query: { bbox: bboxParam(clampBbox(bbox)) } });
  if (!res.ok) return res;
  return ok((res.data?.zones ?? []).map(toServerZone));
}

export async function fetchZoneDetail(id: string): Promise<Result<ZoneDetail>> {
  const res = await callFunction<Row>('zone', { method: 'GET', query: { id } });
  if (!res.ok) return res;
  if (!res.data || typeof res.data !== 'object') return fail(new AppError('SERVER', MESSAGES.server));
  return ok(toZoneDetail(res.data));
}

export type ZonesSubscription = { unsubscribe: () => void };

/** Realtime em `zones` (INSERT/UPDATE): cada linha vira `ServerZone`. */
export function subscribeZones(onZone: (z: ServerZone) => void, onStatus?: (status: string) => void): Result<ZonesSubscription> {
  try {
    const supabase = requireSupabase();
    const channel = supabase
      .channel(`zones-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, (payload: { new?: Row }) => {
        const row = payload.new;
        if (row && typeof row === 'object' && typeof row.id === 'string') onZone(toServerZone(row));
      })
      .subscribe((status: string) => onStatus?.(status));
    return ok({ unsubscribe: () => void supabase.removeChannel(channel) });
  } catch (e) {
    return fail(toAppError(e));
  }
}
