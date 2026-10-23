/**
 * @jest-environment node
 *
 * T7.2.3 — repositórios da Raid (D-67), da Liga (D-68) e da pintura (D-62), contra o servidor de demonstração
 * (costura real `getSupabase()` com `EXPO_PUBLIC_DEMO=1`, sem rede), e o tratamento de "indisponível":
 * servidor antigo (`PGRST202`) e feature desligada (`FEATURE_DISABLED`) não são erro na tela.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { distanceMeters } from '@/domain/geo';
import { cellCenter } from '@/domain/grid';
import { createLiveTracker } from '@/domain/live-events';
import { emptyPaintCounts, paintZoneOf, zoneOwnerByCells, type PaintCounts } from '@/domain/paint';
import { RAID_BOSS_IDS, raidBossForWeek, raidPhase, raidWeekWindow } from '@/domain/raid';
import { DEMO_CENTER } from '@/demo/demo-data';
import { DEMO_USERNAME } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { createDemoClient, setDemoClient } from '../demo';
import { DEMO_RPC_HANDLERS } from '../demo/rpc';
import { fetchLeagueCurrent, parseLeagueCurrent, type LeagueCurrent } from '../league-repo';
import { fetchPaintNear, parsePaintNear, PAINT_NEAR_MAX_RADIUS_M, type PaintNear } from '../paint-repo';
import { callFeatureRpc, fetchRaidCurrent, isRaidAvailable, parseRaidCurrent, unavailableReason, type RaidCurrent } from '../raid-repo';
import { AppError } from '../errors';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z'); // sexta 09:00 em Brasília
const realFetch = globalThis.fetch;
const fetchSpy = jest.fn(() => Promise.reject(new Error('rede proibida no modo demonstração')));

beforeAll(() => {
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  expect(fetchSpy).not.toHaveBeenCalled();
});

function data<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.error.message}`);
  return r.data;
}

function available<T extends { available: true }>(v: T | { available: false }): T {
  if (!v.available) throw new Error('esperava a feature disponível');
  return v as T;
}

describe('Raid (raid_current) no modo demonstração', () => {
  beforeEach(() => setDemoClient(createDemoClient({ clock: () => NOW })));

  it('chefão da semana pelo rodízio real, com vida, fase coerente e "Sua parte"', async () => {
    const r = available(data(await fetchRaidCurrent()) as RaidCurrent);
    const raid = r.raid!;
    const { startsAt, endsAt } = raidWeekWindow(NOW);
    expect(raid).toMatchObject({ startsAt, endsAt, status: 'active', isDemo: true, weekStart: '2026-10-19', city: null });
    expect(raid.bossId).toBe(raidBossForWeek(startsAt));
    expect(RAID_BOSS_IDS).toContain(raid.bossId);
    expect(raid.name).toBeTruthy();
    expect(raid.introLine).toBeTruthy();
    expect(raid.hp).toBeGreaterThan(0);
    expect(raid.hp).toBeLessThan(raid.hpMax);
    expect(raid.phase).toBe(raidPhase(raid.hp, raid.hpMax));
    // o corredor de demonstração tem corridas nesta semana: dano, metros, golpes e posição no ranking
    expect(r.me.damage).toBeGreaterThan(0);
    expect(r.me.hits).toBeGreaterThan(0);
    expect(r.me.rank).not.toBeNull();
    expect(r.share).toBeGreaterThan(0);
    expect(r.share).toBeLessThan(1);
    expect(r.topRunners.length).toBe(10);
    expect(r.topRunners.every((t) => t.username.endsWith('.demo'))).toBe(true);
    expect(r.topCrews.length).toBeGreaterThan(0);
    expect(r.params).toMatchObject({ critChance: 0.1, runCapKm: 21, dayCapKm: 30 });
    // fase 2 em diante: pontos fracos do dia com nome e centro
    if (raid.phase >= 2) expect(raid.weakPoints).toHaveLength(3);
    expect(r.sinceLastVisit).toBeNull();
  });

  it('"desde a sua última visita": a 2ª visita mostra o dano da cidade no intervalo; a vida só cai', async () => {
    let now = NOW;
    setDemoClient(createDemoClient({ clock: () => now }));
    const first = available(data(await fetchRaidCurrent()) as RaidCurrent);
    now += 6 * 3600_000;
    const second = available(data(await fetchRaidCurrent()) as RaidCurrent);
    expect(second.raid!.hp).toBeLessThan(first.raid!.hp);
    expect(second.raid!.phase).toBeGreaterThanOrEqual(first.raid!.phase);
    expect(second.sinceLastVisit).toEqual({ damage: first.raid!.hp - second.raid!.hp, since: NOW });
  });

  it('no domingo à noite a cidade derruba o chefão: vida 0, derrotado e recompensas', async () => {
    setDemoClient(createDemoClient({ clock: () => Date.parse('2026-10-26T00:30:00Z') })); // domingo 21:30
    const r = available(data(await fetchRaidCurrent()) as RaidCurrent);
    expect(r.raid).toMatchObject({ hp: 0, status: 'defeated', phase: 3 });
    expect(r.raid!.defeatedAt).not.toBeNull();
    expect(r.me.rewards.map((x) => x.kind)).toEqual(['participacao', 'derrota']);
  });

  it('roteiro vazio (conta nova): o chefão existe, a sua parte é zero', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'vazio' }));
    const r = available(data(await fetchRaidCurrent()) as RaidCurrent);
    expect(r.raid).not.toBeNull();
    expect(r.me).toMatchObject({ damage: 0, hits: 0, rank: null, rewards: [] });
    expect(r.share).toBe(0);
  });
});

describe('Liga (league_current) no modo demonstração', () => {
  beforeEach(() => setDemoClient(createDemoClient({ clock: () => NOW })));

  it('grupo da semana com 30 pessoas de demonstração, a própria linha e as faixas de subida e descida', async () => {
    const l = available(data(await fetchLeagueCurrent()) as LeagueCurrent);
    expect(l).toMatchObject({ weekStart: '2026-10-19', joined: true, groupSize: 30, smallGroup: false, division: 1, divisionName: 'Rua', promoteSlots: 5, relegateSlots: 5 });
    expect(l.members).toHaveLength(30);
    expect(l.members.map((m) => m.position)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(l.members.every((m) => m.username.endsWith('.demo'))).toBe(true);
    expect(l.me?.username).toBe(DEMO_USERNAME);
    expect(l.members.filter((m) => m.zone === 'promote')).toHaveLength(5);
    expect(l.members.filter((m) => m.zone === 'relegate')).toHaveLength(5);
    for (let i = 1; i < 30; i++) expect(l.members[i - 1].points).toBeGreaterThanOrEqual(l.members[i].points);
    expect(l.closesAt).toBe(Date.parse('2026-10-26T06:20:00Z')); // segunda 03:20 em Brasília
    expect(l.lastResult).toMatchObject({ weekStart: '2026-10-12', outcome: 'promoted', divisionName: 'Calçada' });
  });

  it('conta nova: ainda não entrou na liga (entra na 1ª corrida da semana)', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'vazio' }));
    const l = available(data(await fetchLeagueCurrent()) as LeagueCurrent);
    expect(l).toMatchObject({ joined: false, groupSize: 0, members: [], me: null, lastResult: null, division: 0 });
  });
});

describe('Pintura (zone_paint_near) no modo demonstração', () => {
  beforeEach(() => setDemoClient(createDemoClient({ clock: () => NOW })));

  it('retrato coerente: o dono de cada zona lidera os trechos; zona neutra sem líder; nada nas zonas de privacidade', async () => {
    const client = createDemoClient({ clock: () => NOW });
    setDemoClient(client);
    const privacy = client.db.tables.privacy_zones.map((z) => ({ center: { lat: Number(z.lat), lng: Number(z.lng) }, radius: Number(z.radius_m) }));
    expect(privacy.length).toBeGreaterThan(0);
    const p = available(data(await fetchPaintNear(DEMO_CENTER, 2500)) as PaintNear);
    expect(p.radiusM).toBe(2500);
    const counts = new Map<string, PaintCounts>();
    for (const [cell, v] of Object.entries(p.snapshot.cells)) {
      const z = paintZoneOf(cell);
      const c = counts.get(z) ?? emptyPaintCounts();
      c[v.faction]++;
      counts.set(z, c);
      expect(v.layers).toBeGreaterThanOrEqual(1);
      expect(v.layers).toBeLessThanOrEqual(3);
      // nenhum trecho dentro da zona de privacidade "Casa (demonstração)"
      for (const z of privacy) expect(distanceMeters(cellCenter(cell), z.center)).toBeGreaterThan(z.radius);
    }
    const zones = Object.entries(p.snapshot.zones);
    expect(zones.length).toBeGreaterThan(50);
    let owned = 0;
    let coherent = 0;
    for (const [id, z] of zones) {
      const c = counts.get(id) ?? emptyPaintCounts();
      if (z.owner) {
        owned++;
        if (zoneOwnerByCells(c, z.owner) === z.owner) coherent++;
      } else expect(zoneOwnerByCells(c, null)).toBeNull();
    }
    expect(owned).toBeGreaterThan(10);
    expect(coherent / owned).toBeGreaterThan(0.9);
    expect(p.paintedToday).toEqual([]);
  });

  it('o retrato alimenta a previsão ao vivo (createLiveTracker) sem erro', async () => {
    const p = available(data(await fetchPaintNear(DEMO_CENTER)) as PaintNear);
    const tracker = createLiveTracker({ runId: 'r1', faction: 'owls', snapshot: p.snapshot, paintedToday: new Set(p.paintedToday) });
    for (let i = 0; i < 300; i++) tracker.push({ lat: DEMO_CENTER.lat + i * 0.00003, lng: DEMO_CENTER.lng, t: NOW + i * 1000, accuracy: 5 });
    expect(tracker.summary().meters).toBeGreaterThan(900);
    expect(tracker.summary().current).not.toBeNull();
  });

  it('raio limitado a 3 km e posição inválida recusada antes de chamar o servidor', async () => {
    expect(available(data(await fetchPaintNear(DEMO_CENTER, 99_999)) as PaintNear).radiusM).toBe(PAINT_NEAR_MAX_RADIUS_M);
    const bad = await fetchPaintNear({ lat: Number.NaN, lng: 0 });
    expect(bad.ok).toBe(false);
  });
});

describe('indisponível não é erro (servidor antigo e feature desligada)', () => {
  it('RPC que não existe no servidor (PGRST202) → { available: false, reason: "servidor-antigo" }', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    const saved = { raid: DEMO_RPC_HANDLERS.raid_current, league: DEMO_RPC_HANDLERS.league_current, paint: DEMO_RPC_HANDLERS.zone_paint_near };
    delete DEMO_RPC_HANDLERS.raid_current;
    delete DEMO_RPC_HANDLERS.league_current;
    delete DEMO_RPC_HANDLERS.zone_paint_near;
    try {
      expect(data(await fetchRaidCurrent())).toEqual({ available: false, reason: 'servidor-antigo' });
      expect(data(await fetchLeagueCurrent())).toEqual({ available: false, reason: 'servidor-antigo' });
      expect(data(await fetchPaintNear(DEMO_CENTER))).toEqual({ available: false, reason: 'servidor-antigo' });
    } finally {
      DEMO_RPC_HANDLERS.raid_current = saved.raid;
      DEMO_RPC_HANDLERS.league_current = saved.league;
      DEMO_RPC_HANDLERS.zone_paint_near = saved.paint;
    }
  });

  it('flag desligada (FEATURE_DISABLED) → "desligada"; erro de rede continua erro', async () => {
    const disabled = await callFeatureRpc(async () => ({ data: null, error: { code: 'P0001', message: 'FEATURE_DISABLED: raid ainda não está ligada' } }), parseRaidCurrent);
    expect(data(disabled)).toEqual({ available: false, reason: 'desligada' });
    const oldPg = await callFeatureRpc(async () => ({ data: null, error: { code: '42883', message: 'function public.league_current() does not exist' } }), parseLeagueCurrent);
    expect(data(oldPg)).toEqual({ available: false, reason: 'servidor-antigo' });
    const offline = await callFeatureRpc(async () => ({ data: null, error: { message: 'TypeError: Network request failed' } }), parseRaidCurrent);
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(offline.error.code).toBe('NETWORK');
    expect(unavailableReason(new AppError('VALIDATION', 'x', { detail: 'RAID_CLOSED' }))).toBeNull();
  });

  it('roteiro "erro" do modo demonstração: falha de servidor continua sendo erro (a tela mostra tentar de novo)', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'erro', latencyMs: 0 }));
    const r = await fetchRaidCurrent();
    expect(r.ok).toBe(false);
  });
});

describe('leitura tolerante das respostas', () => {
  it('raid_current sem chefão aberto, ou com lixo, vira valores seguros', () => {
    const empty = parseRaidCurrent({ raid: null, params: { critChance: 0.1 } });
    expect(empty).toMatchObject({ available: true, raid: null, share: 0, topRunners: [], sinceLastVisit: null, me: { damage: 0, rank: null, rewards: [] } });
    expect(isRaidAvailable(empty)).toBe(true);
    expect(parseRaidCurrent(null).raid).toBeNull();
    const odd = parseRaidCurrent({
      raid: { id: 'r', bossId: 'dragao', hp: 999, hpMax: 500, phase: 9, status: '?', weakPoints: [{ zoneId: 'z', center: [-49.2, -16.7] }, { zoneId: 'y' }] },
      me: { damage: '50', rank: null, rewards: [{ kind: 'derrota', xp: 200, chestRarity: 'raro' }, { kind: 'x' }] },
      topRunners: [{ position: 1, username: 'a.demo', faction: 'roxo', damage: 10 }],
    });
    expect(odd.raid).toMatchObject({ bossId: null, hp: 500, phase: 3, status: 'active', weakPoints: [{ zoneId: 'z', name: null, center: { lat: -16.7, lng: -49.2 } }] });
    expect(odd.me.rewards).toEqual([{ kind: 'derrota', xp: 200, chestRarity: 'raro', cosmeticId: null, medalTier: null }]);
    expect(odd.topRunners[0].faction).toBeNull();
    expect(parseRaidCurrent({ raid: { id: 'r', hpMax: 0 } }).raid).toBeNull();
  });

  it('league_current com divisão sem nome, membros sem nome e resultado inválido', () => {
    const l = parseLeagueCurrent({
      division: 2,
      members: [{ position: 2, username: 'b.demo', points: 5, zone: 'promote' }, { position: 1, username: 'a.demo', points: 9, you: true }, { position: 3 }],
      lastResult: { outcome: 'sumiu' },
    });
    expect(l.divisionName).toBe('Avenida');
    expect(l.members.map((m) => m.username)).toEqual(['a.demo', 'b.demo']);
    expect(l.me?.username).toBe('a.demo');
    expect(l.groupSize).toBe(2);
    expect(l.lastResult).toBeNull();
    expect(parseLeagueCurrent({ division: 9, lastResult: { outcome: 'stays', division: 7, finalRank: null } })).toMatchObject({ divisionName: 'Divisão 10', lastResult: { divisionName: 'Divisão 8', finalRank: null } });
  });

  it('zone_paint_near em snake_case, com trechos inválidos descartados', () => {
    const p = parsePaintNear(
      {
        cells: [{ cell: 'a', faction: 'owls', layers: 2 }, { cell: 'b', faction: 'roxo', layers: 1 }, { cell: 'c', faction: 'volt', layers: 0 }, { cell: 'd', faction: 'volt', layers: 7 }],
        zones: [{ zone_id: 'z1', owner: 'owls', name: 'Setor 1', inherited: 3, blocked: true, under_attack: true }, { owner: 'volt' }],
        painted_today: ['a', 3],
      },
      DEMO_CENTER,
      1000,
    );
    expect(p.snapshot.cells).toEqual({ a: { faction: 'owls', layers: 2 }, d: { faction: 'volt', layers: 3 } });
    expect(p.snapshot.zones).toEqual({ z1: { owner: 'owls', name: 'Setor 1', inherited: 3, blocked: true, underAttack: true } });
    expect(p.paintedToday).toEqual(['a']);
    expect(parsePaintNear(undefined, DEMO_CENTER, 1000).snapshot).toEqual({ cells: {}, zones: {} });
  });
});
