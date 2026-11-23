/**
 * `zone_heat_json` (RF-013, migration 20261123120000) no banco de demonstração. Mesmas regras do SQL: contagem
 * por zona na área visível, corrida só com 2 ou mais corredores, troca de dono sempre, período 24 h, 7 dias ou
 * temporada. Como o mundo de demonstração não tem corridas de outras pessoas gravadas, soma um calor fictício em
 * volta de 3 lugares onde muita gente corre em Goiânia (marcado como demonstração na tela, como o resto do modo).
 */
import { distanceMeters } from '@/domain/geo';
import { cellCenter } from '@/domain/grid';
import { seasonIdAt } from '@/domain/season';
import type { LatLng } from '@/domain/types';

import { msOf, raise, type DemoDb, type Row } from './db';

const PERIOD_MS: Record<string, number> = { '24h': 24 * 3600_000, '7d': 7 * 24 * 3600_000 };
/** Peso do calor fictício por período (24 h tem menos corridas que a semana; a temporada, mais). */
const DEMO_SCALE: Record<string, number> = { '24h': 0.25, '7d': 1, season: 3 };
/** Onde o calor fictício se concentra: corridas por semana no centro e o raio (m) em que ele some. */
const DEMO_HOTSPOTS: readonly { at: LatLng; runs: number; radius: number }[] = [
  { at: { lat: -16.7104, lng: -49.2385 }, runs: 40, radius: 450 }, // Parque Flamboyant e lago
  { at: { lat: -16.6985, lng: -49.2508 }, runs: 22, radius: 380 }, // Parque Areião
  { at: { lat: -16.7066, lng: -49.2342 }, runs: 12, radius: 320 }, // Serra Dourada
];

function since(period: string, now: number): number {
  if (period === 'season') {
    const [y, m] = seasonIdAt(new Date(now)).split('-').map(Number);
    return Date.UTC(y, m - 1, 1) + 3 * 3600_000; // meia-noite de Brasília (UTC−3)
  }
  const ms = PERIOD_MS[period];
  if (ms === undefined) throw raise('INVALID_PERIOD: use 24h, 7d ou season');
  return now - ms;
}

export const DEMO_HEAT_RPC_HANDLERS: Record<string, (db: DemoDb, userId: string | null, args: Row) => unknown> = {
  zone_heat_json: (db, userId, args) => {
    if (!userId || !db.profile(userId)) throw raise('UNAUTHORIZED: faça login novamente');
    const period = typeof args.p_period === 'string' ? args.p_period : '7d';
    const from = since(period, db.now());
    const [minLng, minLat, maxLng, maxLat] = [args.min_lng, args.min_lat, args.max_lng, args.max_lat].map(Number);
    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite) || maxLng - minLng < 0 || maxLng - minLng > 1 || maxLat - minLat < 0 || maxLat - minLat > 1) {
      throw raise('INVALID_BBOX: área do mapa inválida ou grande demais');
    }
    const inside = (id: string) => {
      const c = cellCenter(id);
      return c.lng >= minLng && c.lng <= maxLng && c.lat >= minLat && c.lat <= maxLat;
    };
    const acc = new Map<string, { runs: number; flips: number; users: Set<string> }>();
    const get = (id: string) => {
      let a = acc.get(id);
      if (!a) acc.set(id, (a = { runs: 0, flips: 0, users: new Set() }));
      return a;
    };
    for (const az of db.tables.activity_zones) {
      const id = String(az.zone_id);
      if ((msOf(az.created_at as string | null) ?? 0) < from || !inside(id)) continue;
      const a = get(id);
      a.runs += 1;
      a.users.add(String(az.user_id));
      if ((az.owner_before ?? null) !== (az.owner_after ?? null)) a.flips += 1;
    }
    const scale = DEMO_SCALE[period] ?? 1;
    for (const z of db.zones.values()) {
      if (z.blocked || !inside(z.id)) continue;
      const c = cellCenter(z.id);
      const base = DEMO_HOTSPOTS.reduce((s, h) => s + h.runs * Math.exp(-((distanceMeters(c, h.at) / h.radius) ** 2)), 0);
      const runs = Math.round(base * scale);
      if (runs <= 0) continue;
      const a = get(z.id);
      a.runs += runs;
      a.users.add('demo-a').add('demo-b'); // corredores fictícios do mundo de demonstração
      if (z.attack_started_at) a.flips += period === '24h' ? 0 : 1;
    }
    return [...acc.entries()]
      .map(([id, a]) => ({ id, runs: a.users.size >= 2 ? a.runs : 0, flips: a.flips }))
      .filter((h) => h.runs > 0 || h.flips > 0)
      .sort((x, y) => (x.id < y.id ? -1 : 1))
      .slice(0, 2000);
  },
};
