// T7.2.1 — gravação v2: depois da v1 (sem mudá-la), pintura (applyPaint), pontos v2, raid, engajamento (E7 §8),
// recordes e feed atrás das flags; bloco opcional `extras`; com as flags desligadas, nada muda (nem chamada a mais).
import assert from 'node:assert/strict';
import {
  cellCenter,
  type GeoPoint,
  offset,
  paintZoneOf,
  raidDamage,
  validateActivity,
  zoneOf,
} from '../_shared/domain.ts';
import type { FinishResponse, StoredPoint } from '../_shared/scoring.ts';
import { DbError } from '../_shared/supabase.ts';
import {
  buildExtras,
  engagementBlock,
  paintCellsOf,
  planPaint,
  planV2,
  unscoredExtras,
  type V2Context,
  v2On,
  type V2Raw,
  v2Territory,
  v2Xp,
} from '../_shared/v2.ts';
import { runV2, safeRunV2, withExtras } from '../_shared/v2-run.ts';

const ACT = 'e9e9e9e9-0000-4000-8000-000000000001';
const USER = 'e9e9e9e9-0000-4000-8000-0000000000aa';
const T0 = Date.UTC(2026, 9, 21, 12); // quarta 21/10/2026 09:00 BRT
const START = cellCenter(zoneOf({ lat: -16.69, lng: -49.27 }));

/** Corrida reta a 3 m/s, 1 Hz, com passos. */
function run(meters: number, bearing = 90): GeoPoint[] {
  const n = Math.round(meters / 3);
  return Array.from({ length: n + 1 }, (_, i) => ({ ...offset(START, i * 3, bearing), t: T0 + i * 1000, accuracy: 5, steps: i ? 3 : 0 }));
}
const stored = (g: GeoPoint[]): StoredPoint[] =>
  g.map((p, i) => ({ seq: i, lat: p.lat, lng: p.lng, t: p.t, accuracy: 5, speed: 3, altitude: null, mocked: false, steps: p.steps ?? null }));

function response(over: Partial<FinishResponse> = {}): FinishResponse {
  return {
    activityId: ACT, status: 'valid', meters: 5000, movingSeconds: 1500, avgPace: 300, rpTotal: 120, xp: 0, flags: [],
    invalidSegments: [], zones: [{ zoneId: zoneOf(START), name: 'Setor Sul 4', meters: 900, rp: 60, outcome: 'influence', ownerBefore: null, ownerAfter: null }],
    newFogCells: 4, beatGhost: null, trust: 100, review: null, chests: [], group: null, ...over,
  };
}

const FLAGS_OFF = { territoryRule: 'v1' as const, features: { raid: false, league: false, missions: false, dailyChest: false, records: false, feed: false } };
const flags = (f: Record<string, boolean>, rule: 'v1' | 'v2' = 'v1') => ({ territoryRule: rule, features: { ...FLAGS_OFF.features, ...f } });

function ctx(over: Partial<V2Context> = {}): V2Context {
  return {
    flags: flags({}),
    done: null,
    activity: { status: 'valid', scored: true, endedAt: T0 + 1_500_000, mission: 'livre' },
    day: '2026-10-21',
    recentPaces: [330, 320, 310],
    profile: { faction: 'striders', trust: 100, xp: 0, lifetimeMeters: 0, city: 'Goiânia', crewId: null, streakWeeks: 2, bestStreak: 3, freezesLeft: 1, paused: false },
    earnedTodayV2: {},
    ...over,
  };
}

Deno.test('flags: v2On, v2Territory e v2Xp', () => {
  assert.equal(v2On(null), false);
  assert.equal(v2On(FLAGS_OFF), false);
  assert.equal(v2On({ ...FLAGS_OFF, features: { ...FLAGS_OFF.features, telemetry: true, medals: true, track: true } }), false);
  for (const f of ['raid', 'league', 'missions', 'dailyChest', 'records', 'feed']) assert.equal(v2On(flags({ [f]: true })), true, f);
  assert.equal(v2On(flags({}, 'v2')), true);
  assert.equal(v2Territory(flags({}, 'v2')), true);
  assert.equal(v2Xp(flags({ missions: true })), true);
  assert.equal(v2Xp(FLAGS_OFF), false);
});

Deno.test('flags desligadas: runV2 não chama o banco e a resposta é exatamente a da v1', async () => {
  let calls = 0;
  const deps = { rpc: () => { calls++; return Promise.resolve(null as never); }, now: () => T0, seed: () => 1 };
  const r = response();
  for (const f of [null, FLAGS_OFF]) {
    const extras = await runV2({ activityId: ACT, userId: USER, points: stored(run(500)), response: r, flags: f }, deps);
    assert.equal(extras, null);
    assert.equal(withExtras(r, extras), r);
    assert.equal(JSON.stringify(withExtras(r, extras)), JSON.stringify(r));
  }
  assert.equal(calls, 0);
});

Deno.test('pintura: applyPaint sobre o mundo do banco conquista a zona, versiona e cria a zona nova', () => {
  const geo = run(600);
  const { cells, zoneIds } = paintCellsOf(geo, validateActivity(geo));
  assert.ok(cells.length >= 5);
  const z0 = zoneIds[0];
  const inZone = cells.filter((c) => paintZoneOf(c) === z0);
  // a zona já existe, com dono coiote por 2 trechos fora da rota (abaixo do mínimo de 3 → sem dono)
  const plan = planPaint({
    cells,
    faction: 'striders',
    now: T0,
    ctx: {
      zones: [{ id: z0, version: 7, owner: null, blocked: false, inheritFaction: null, inheritCells: null, inheritUntil: null,
                attacker: null, attackStartedAt: null, attackLastAt: null, attackFlips: 0, name: 'Setor Sul 4' }],
      cells: [],
      paintedToday: [],
    },
  });
  const zw = plan.plan.zones.find((z) => z.zoneId === z0)!;
  assert.equal(zw.expectedVersion, 7);
  assert.equal(zw.geom, undefined);
  if (inZone.length >= 3) {
    assert.equal(zw.owner, 'striders');
    assert.ok(plan.plan.events.some((e) => e.type === 'captured' && e.zoneId === z0));
    assert.equal(plan.plan.summary.zones.find((z) => z.zoneId === z0)?.outcome, 'conquistada');
  }
  for (const z of plan.plan.zones.filter((z) => z.zoneId !== z0)) {
    assert.equal(z.expectedVersion, null, 'zona que ainda não existe: criada pela v2');
    assert.ok(z.geom && JSON.parse(z.geom).type === 'Polygon');
  }
  assert.equal(plan.plan.summary.new, cells.length);
  assert.deepEqual(plan.plan.marks, cells);
  for (const c of plan.plan.cells) {
    assert.equal(c.layers, 1);
    assert.equal(c.paintedAt, T0);
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lng));
    assert.ok(!('user' in c) && !('userId' in c), 'trecho sem autor');
  }
  // já pintou hoje: nada muda (1 camada por corredor por trecho por dia)
  const again = planPaint({ cells, faction: 'striders', now: T0 + 60_000, ctx: { zones: [], cells: plan.plan.cells, paintedToday: cells } });
  assert.equal(again.plan.summary.cells, 0);
});

Deno.test('planV2: corrida em revisão não grava nada; aceita monta pontos, raid, XP, semana e missões', () => {
  const geo = run(5000);
  const validation = validateActivity(geo);
  const base = { activityId: ACT, userId: USER, faction: 'striders' as const, now: T0 + 1_600_000, geo, validation, paintCells: [], seed: 5 };
  const review = planV2({ ...base, v1: response({ status: 'review' }), ctx: ctx({ flags: flags({ league: true, raid: true, missions: true }) }) });
  assert.equal(review.points, null);
  assert.equal(review.raid, null);
  assert.equal(review.xpLines, null);

  const c = ctx({
    flags: flags({ league: true, raid: true, missions: true, records: true }),
    raid: { id: 'r1', bossId: 'soneca', phase: 1, hp: 1000, hpMax: 1000, weakZones: [], damageToday: 0, metersToday: 0 },
    engagement: {
      xpDay: { meters: 0, atlasXp: 0, completed: false, ghost: false },
      weekId: '2026-W43',
      weekBefore: 1,
      seasonId: '2026-10',
      seasonXp: 100,
      missions: [{
        id: 'um-1', defId: 'd-1500m', kind: 'diaria', slot: 0, variant: 'base', title: 'Caminhe ou corra 1,5 km', progress: 0,
        target: 1500, xp: 20, periodKey: '2026-10-21', availableFrom: T0 - 3_600_000, availableUntil: T0 + 86_400_000,
        completedAt: null, rerolled: false,
      }],
      evidence: [],
      dailyChest: { on: true, stored: 1, openedToday: false, pity: 0 },
    },
  });
  const p = planV2({ ...base, v1: response(), ctx: c });
  assert.ok(p.points && p.points.total > 0);
  assert.equal(p.points.zones[0].zoneId, zoneOf(START));
  const expected = raidDamage({ validMeters: 5000, weakPointMeters: 0, phase: 1, inPack: false, seed: ACT, damageToday: 0, kmToday: 0 });
  assert.deepEqual(p.raid, { meters: 5000, damage: expected.damage, weakMeters: 0, pack: false });
  // 5 km no dia = 50 XP de distância + 30 de concluída + 4 trechos do Atlas × 2
  assert.deepEqual(p.xpLines, [{ source: 'run_distance', amount: 50 }, { source: 'run_complete', amount: 30 }, { source: 'fog', amount: 8 }]);
  assert.deepEqual(p.weekKept, { ref: '2026-W43', amount: 50 });
  assert.deepEqual(p.missionProgress, { 'um-1': 1500 });
  assert.ok(p.records && p.records.splits.length === 5);
  assert.equal(p.feed, null, 'sem crew: sem feed');
  assert.equal(p.paint, null, 'regra v1: sem pintura');
});

Deno.test('planV2 + feed: item só com crew e opção ligada; rota cortada e sem horário', () => {
  const geo = run(3000);
  const c = ctx({
    flags: flags({ feed: true }),
    feed: { crewId: 'crew-1', shareRunsToFeed: true, showMap: true, privacyZones: [{ ...offset(START, 1500, 90), radiusM: 200 }] },
  });
  const p = planV2({ activityId: ACT, userId: USER, faction: 'striders', now: T0, geo, validation: validateActivity(geo), paintCells: [], v1: response(), ctx: c, seed: 9 });
  assert.ok(p.feed);
  assert.ok(!JSON.stringify(p.feed).match(/"t"|time|hora|endedAt|startedAt/i));
  const off = planV2({ activityId: ACT, userId: USER, faction: 'striders', now: T0, geo, validation: validateActivity(geo), paintCells: [],
    v1: response(), ctx: { ...c, feed: { ...c.feed!, shareRunsToFeed: false } }, seed: 9 });
  assert.equal(off.feed, null);
});

const RAW: V2Raw = {
  version: 1,
  scored: true,
  points: { total: 90, zones: [] },
  league: { weekStart: '2026-10-19', points: 90, total: 300, rank: 4, groupSize: 12 },
  raid: { raidId: 'r1', bossId: 'soneca', damage: 50, crit: false, critChance: 0.1, hpAfter: 950, hpMax: 1000, phaseAfter: 1, finalBlow: false },
  engagement: {
    xpBefore: 640, xpAfter: 760, runXp: 80, lines: [{ source: 'run_distance', amount: 50 }, { source: 'run_complete', amount: 30 },
      { source: 'daily_chest', amount: 15 }, { source: 'mission', amount: 25 }],
    lifetimeBefore: 9000, lifetimeAfter: 14000, seasonId: '2026-10', seasonXpBefore: 900, seasonXpAfter: 1000,
    dailyChests: { opened: true, prizes: [{ n: 1, rarity: 'comum', xp: 15, cosmeticId: null, duplicate: false, guaranteed: false }], pityLeft: 19 },
    missions: [{ id: 'um-9', defId: 'f1-dominio', kind: 'ftue', title: 'Pinte sua primeira zona', xp: 25, slot: 1 }],
    streak: { weeks: 2, best: 3, freezesLeft: 1, activitiesThisWeek: 2, weekKept: true, paused: false },
    comeback: 'v-7',
  },
  records: { new: [{ kind: 'longest', value: 5000, previous: 4000 }] },
  feed: { itemId: 'f1' },
};

Deno.test('extras: bloco de engajamento do contrato E7 §8 a partir do que o banco aplicou', () => {
  const e = buildExtras(RAW, T0);
  assert.equal(e.contract, 2);
  assert.deepEqual(e.league, RAW.league);
  assert.deepEqual(e.raid, RAW.raid);
  const g = e.engagement!;
  assert.equal(g.xp.total, 120);
  assert.deepEqual(g.xp.lines.map((l) => l.label), ['Distância', 'Atividade concluída', 'Baú do dia', 'Missão']);
  assert.deepEqual(g.level, { before: 4, after: 4, titleAfter: null }); // 530 XP = nível 4; 880 = nível 5
  assert.deepEqual(g.band, { before: 'asfalto', after: 'bronze' });
  assert.deepEqual(g.dailyChests, { opened: [{ n: 1, rarity: 'comum', xp: 15, cosmeticDrop: false, cosmeticId: null, guaranteed: false }], pityLeft: 19 });
  assert.deepEqual(g.missions, [{ id: 'f1-dominio', userMissionId: 'um-9', cadence: 'ftue', text: 'Pinte sua primeira zona', xp: 25 }]);
  assert.deepEqual(g.season, { stepBefore: 7, stepAfter: 8, medal: 'bronze' });
  assert.equal(g.ftue?.stepDone, 1);
  assert.equal(g.ftue?.nextUnlocksAt, Date.UTC(2026, 9, 22, 3));
  assert.deepEqual(g.comeback, { missionId: 'v-7' });
  assert.deepEqual(e.records, RAW.records);
  // título novo quando sobe para o nível 5
  const up = engagementBlock({ ...RAW.engagement!, xpBefore: 0, xpAfter: 900 }, T0);
  assert.equal(up.level.before, 1);
  assert.equal(up.level.after, 5);
  assert.deepEqual(up.level.titleAfter, { id: 'pe-na-rua', name: 'Pé na Rua' });
  // sem engajamento ligado, não há bloco
  assert.equal(buildExtras({ version: 1, scored: true, raid: null }, T0).engagement, undefined);
});

Deno.test('extras de corrida em revisão: sem XP, baú guardado e o motivo', () => {
  const c = ctx({
    flags: flags({ missions: true, dailyChest: true, raid: true }),
    activity: { status: 'review', scored: false, endedAt: T0, mission: 'livre' },
    engagement: { xpDay: { meters: 0, atlasXp: 0, completed: false, ghost: false }, weekId: '2026-W43', weekBefore: 0, seasonId: '2026-10',
      seasonXp: 0, missions: [], evidence: [], dailyChest: { on: true, stored: 2, openedToday: false, pity: 3 } },
  });
  const e = unscoredExtras(c, response({ status: 'review' }));
  assert.equal(e.raid, null);
  assert.equal(e.engagement?.xp.total, 0);
  assert.deepEqual(e.engagement?.dailyChests, { opened: [], reason: 'review', stored: 2 });
  assert.equal(e.engagement?.streak.weeks, 2);
});

Deno.test('runV2: repetição devolve o que já foi gravado; conflito de zona tenta de novo; erro não derruba o finish', async () => {
  const geo = run(1200);
  const calls: string[] = [];
  const done = await runV2(
    { activityId: ACT, userId: USER, points: stored(geo), response: response(), flags: flags({ raid: true }) },
    { rpc: (name: string) => { calls.push(name); return Promise.resolve(ctx({ flags: flags({ raid: true }), done: RAW }) as never); }, now: () => T0, seed: () => 1 },
  );
  assert.deepEqual(calls, ['svc_v2_context']);
  assert.equal(done?.engagement?.xp.total, 120);

  let applies = 0;
  const seen: string[] = [];
  const retry = await runV2(
    { activityId: ACT, userId: USER, points: stored(geo), response: response(), flags: flags({ league: true }, 'v2') },
    {
      rpc: (name: string, args: Record<string, unknown>) => {
        seen.push(name);
        if (name === 'svc_v2_context') {
          assert.ok(Array.isArray(args.p_zone_ids) && (args.p_zone_ids as string[]).length > 0, 'manda as zonas da pintura');
          return Promise.resolve(ctx({ flags: flags({ league: true }, 'v2'), paint: { zones: [], cells: [], paintedToday: [] } }) as never);
        }
        applies++;
        if (applies === 1) return Promise.reject(new DbError('P0001', 'ZONE_CONFLICT: zona mudou durante o cálculo', 400));
        const p = (args.p as { paint: { summary: unknown }; points: unknown });
        return Promise.resolve({ version: 1, scored: true, paint: p.paint.summary, points: p.points, league: null } as never);
      },
      now: () => T0,
      seed: () => 1,
    },
  );
  assert.deepEqual(seen, ['svc_v2_context', 'svc_apply_v2', 'svc_v2_context', 'svc_apply_v2']);
  assert.equal((retry?.paint as { rule: string }).rule, 'v2');

  const failed = await safeRunV2(
    { activityId: ACT, userId: USER, points: stored(geo), response: response(), flags: flags({ league: true }) },
    { rpc: () => Promise.reject(new DbError('XX000', 'erro inesperado', 500)), now: () => T0, seed: () => 1 },
  );
  assert.equal(failed, null);
});

Deno.test('B1: o plano leva o carimbo do contexto; a repetição depois do conflito usa o carimbo novo', async () => {
  const geo = run(3000);
  const base = { activityId: ACT, userId: USER, faction: 'striders' as const, now: T0, geo, validation: validateActivity(geo), paintCells: [], v1: response(), seed: 1 };
  assert.equal(planV2({ ...base, ctx: ctx({ flags: flags({ league: true }), stamp: 4 }) }).stamp, 4);
  // servidor antigo (sem carimbo): o plano sai sem o campo, e o banco antigo nem o conhece
  assert.equal('stamp' in planV2({ ...base, ctx: ctx({ flags: flags({ league: true }) }) }), false);

  let stamp = 4;
  const sent: unknown[] = [];
  const extras = await runV2(
    { activityId: ACT, userId: USER, points: stored(geo), response: response(), flags: flags({ league: true }) },
    {
      rpc: (name: string, args: Record<string, unknown>) => {
        if (name === 'svc_v2_context') return Promise.resolve(ctx({ flags: flags({ league: true }), stamp }) as never);
        const p = args.p as { stamp?: number; points: unknown };
        sent.push(p.stamp);
        if (p.stamp !== 5) {
          stamp = 5; // a outra corrida da pessoa terminou no meio
          return Promise.reject(new DbError('P0001', 'ZONE_CONFLICT: outra corrida sua foi gravada durante o cálculo', 400));
        }
        return Promise.resolve({ version: 1, scored: true, points: p.points, league: null } as never);
      },
      now: () => T0,
      seed: () => 1,
    },
  );
  assert.deepEqual(sent, [4, 5]);
  assert.ok(extras);
});
