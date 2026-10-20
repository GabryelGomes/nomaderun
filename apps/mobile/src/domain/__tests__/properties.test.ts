/**
 * T4.1 — testes de propriedade das regras do domain (RN-001, RN-002/003, RN-005, RN-007/008, RN-009).
 * Gerador próprio com semente fixa (`prop.ts`); NOMADE_PROP_SEED / NOMADE_PROP_RUNS mudam a exploração.
 */
import { describe, expect, it } from '@jest/globals';

import { MAX_POINT_KMH, TELEPORT_METERS, TELEPORT_SECONDS, validateActivity, type CheatFlag } from '../anti-cheat';
import { offset } from '../geo';
import { finishRun, startRun, addPoint } from '../run-engine';
import { DAILY_ZONE_CAP, EFFORT_MAX, EFFORT_MIN, scoreZone } from '../scoring';
import {
  applyRunPoints,
  ATTACK_CLEAR_RATIO,
  CAPTURE_THRESHOLD,
  decayZone,
  DECAY_FLOOR,
  emptyInfluence,
  fortifyZone,
  newZone,
  resolveZone,
  SHIELD_MAX,
  TAKEOVER_RATIO,
  type Zone,
} from '../territory';
import { applyTrust, TRUST_START } from '../trust';
import { FACTION_IDS, type FactionId, type GeoPoint } from '../types';
import { ORIGIN } from './helpers';
import { forAll, type Rng } from './prop';

/* ---------- geradores ---------- */
const weird = [0, -1, -360, NaN, Infinity, -Infinity];
const pace = (r: Rng) => (r.bool(0.15) ? r.pick(weird) : r.float(120, 900));
const faction = (r: Rng): FactionId => r.pick(FACTION_IDS);

function zoneGen(r: Rng): Zone {
  const influence = emptyInfluence();
  for (const f of FACTION_IDS) influence[f] = r.bool(0.3) ? 0 : r.float(0, 600);
  const owner = r.bool(0.25) ? null : faction(r);
  const attacker = owner && r.bool(0.3) ? r.pick(FACTION_IDS.filter((f) => f !== owner)) : null;
  return {
    ...newZone('8981a4c8a4bffff'),
    influence,
    owner,
    shield: r.int(0, SHIELD_MAX),
    attackStartedAt: attacker ? r.int(0, 1_000_000) : null,
    attacker,
  };
}

/** Trajeto com trechos de 0 a 120 km/h, saltos, timestamps repetidos/fora de ordem e precisão variável. */
function trackGen(r: Rng): GeoPoint[] {
  const pts: GeoPoint[] = [];
  let pos = ORIGIN;
  let t = 1_760_000_000_000;
  const n = r.int(2, 160);
  const withSteps = r.bool(0.7);
  for (let i = 0; i < n; i++) {
    pts.push({
      ...pos,
      t,
      accuracy: r.bool(0.1) ? r.float(31, 200) : r.bool(0.1) ? undefined : r.float(2, 30),
      steps: withSteps ? r.int(0, 6) : undefined,
    });
    const dt = r.bool(0.05) ? r.pick([0, -1000, 200]) : r.int(1, 5) * 1000;
    const kmh = r.bool(0.1) ? r.float(40, 130) : r.float(0, 30);
    const meters = r.bool(0.03) ? r.float(50, 400) : (kmh / 3.6) * Math.max(dt, 1000) / 1000;
    pos = offset(pos, meters, r.float(0, 360));
    t += dt;
  }
  return pts;
}

describe('RN-001 — RP nunca negativo e ≤ 300 por zona por dia', () => {
  it('scoreZone: RP inteiro, 0 ≤ RP ≤ 300 − já ganho, para qualquer entrada', () => {
    forAll(
      (r) => ({
        meters: r.bool(0.1) ? r.float(-5000, 0) : r.float(0, 30_000),
        paceSecPerKm: pace(r),
        basePaceSecPerKm: pace(r),
        streakDays: r.bool(0.1) ? r.pick(weird.filter(Number.isFinite)) : r.float(0, 40),
        beatGhost: r.bool(),
        inPack: r.bool(),
        defending: r.bool(),
        // RP já ganho é soma de RPs inteiros (activity_zones.rp)
        earnedTodayInZone: r.bool(0.2) ? r.int(250, 500) : r.int(0, 300),
      }),
      (input) => {
        const s = scoreZone(input);
        expect(Number.isInteger(s.rp)).toBe(true);
        expect(s.rp).toBeGreaterThanOrEqual(0);
        expect(s.rp).toBeLessThanOrEqual(Math.max(0, DAILY_ZONE_CAP - (input.earnedTodayInZone ?? 0)));
        expect(s.multipliers.effort).toBeGreaterThanOrEqual(EFFORT_MIN);
        expect(s.multipliers.effort).toBeLessThanOrEqual(EFFORT_MAX);
      },
    );
  });

  it('várias corridas no mesmo dia na mesma zona somam no máximo 300 RP', () => {
    forAll(
      (r) => Array.from({ length: r.int(1, 12) }, () => ({ meters: r.float(0, 8000), pace: r.float(150, 700), defending: r.bool(), ghost: r.bool() })),
      (runs) => {
        let earned = 0;
        for (const run of runs) {
          const { rp } = scoreZone({ meters: run.meters, paceSecPerKm: run.pace, basePaceSecPerKm: 360, streakDays: 10, defending: run.defending, beatGhost: run.ghost, inPack: true, earnedTodayInZone: earned });
          expect(rp).toBeGreaterThanOrEqual(0);
          earned += rp;
        }
        expect(earned).toBeLessThanOrEqual(DAILY_ZONE_CAP);
      },
    );
  });

  it('finishRun: cada zona recebe 0..300 − ganho do dia, total = soma das zonas, XP ≥ 0', () => {
    forAll(
      (r) => ({ points: trackGen(r), earned: r.int(0, 320), faction: faction(r), streak: r.int(0, 15) }),
      ({ points, earned, faction: f, streak }) => {
        let live = startRun(points[0].t);
        for (const p of points) live = addPoint(live, p);
        const zones = new Set<string>();
        const res = finishRun(live, { faction: f, basePace: 360, streakDays: streak, zones: {}, revealedFog: new Set(), now: points[0].t, ghostPace: 330, earnedTodayByZone: new Proxy({}, { get: () => earned }) as Record<string, number> });
        let sum = 0;
        for (const z of res.zones) {
          expect(zones.has(z.zoneId)).toBe(false);
          zones.add(z.zoneId);
          expect(z.rp).toBeGreaterThanOrEqual(0);
          expect(z.rp).toBeLessThanOrEqual(Math.max(0, DAILY_ZONE_CAP - earned));
          sum += z.rp;
        }
        expect(res.rpTotal).toBe(sum);
        expect(res.xp).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(res.meters)).toBe(true);
        expect(live.meters).toBeGreaterThanOrEqual(0);
      },
    );
  });
});

describe('RN-002/RN-003 — conquista com histerese', () => {
  it('rival abaixo de 110% do dono (ou < 30) nunca toma a zona; acima de ambos, sempre toma', () => {
    forAll(
      (r) => {
        const owner = faction(r);
        const rival = r.pick(FACTION_IDS.filter((f) => f !== owner));
        const ownerValue = r.float(CAPTURE_THRESHOLD, 500);
        const rivalBefore = r.float(0, ownerValue * 0.9);
        const rp = r.float(0.5, 400);
        return { owner, rival, ownerValue, rivalBefore, rp, shield: r.int(0, SHIELD_MAX) };
      },
      ({ owner, rival, ownerValue, rivalBefore, rp, shield }) => {
        const zone: Zone = { ...newZone('z'), owner, shield, influence: { ...emptyInfluence(), [owner]: ownerValue, [rival]: rivalBefore } };
        const { zone: after, events } = applyRunPoints(zone, rival, rp, 0);
        const rivalAfter = after.influence[rival];
        const wins = rivalAfter >= ownerValue * TAKEOVER_RATIO && rivalAfter >= CAPTURE_THRESHOLD;
        expect(after.owner).toBe(wins ? rival : owner);
        expect(events.some((e) => e.type === 'captured')).toBe(wins);
        // o escudo (RN-004) reduz o RP do rival, nunca aumenta
        expect(rivalAfter - rivalBefore).toBeLessThanOrEqual(rp + 1e-9);
      },
    );
  });

  it('somar RP nunca diminui influência; o dono só muda para quem somou; o dono nunca perde por somar', () => {
    forAll(
      (r) => ({ zone: resolveZone(zoneGen(r), 0).zone, f: faction(r), rp: r.bool(0.1) ? r.pick([0, -10]) : r.float(0, 500), now: r.int(0, 2_000_000) }),
      ({ zone, f, rp, now }) => {
        const { zone: after } = applyRunPoints(zone, f, rp, now);
        for (const g of FACTION_IDS) expect(after.influence[g]).toBeGreaterThanOrEqual(zone.influence[g]);
        if (after.owner !== zone.owner) expect(after.owner).toBe(f);
        if (zone.owner === f) expect(after.owner).toBe(f);
        if (rp <= 0) expect(after).toBe(zone);
      },
    );
  });

  it('resolver de novo não troca o dono (sem oscilação)', () => {
    forAll(
      (r) => ({ zone: zoneGen(r), now: r.int(0, 1_000_000) }),
      ({ zone, now }) => {
        const once = resolveZone(zone, now).zone;
        const twice = resolveZone(once, now).zone;
        expect(twice.owner).toBe(once.owner);
      },
    );
  });

  it('ataque termina só abaixo de 40% (histerese 50%/40%)', () => {
    forAll(
      (r) => ({ ratio: r.float(0, 1.05), owner: r.float(CAPTURE_THRESHOLD, 400) }),
      ({ ratio, owner }) => {
        const zone: Zone = { ...newZone('z'), owner: 'owls', attackStartedAt: 1, attacker: 'volt', influence: { ...emptyInfluence(), owls: owner, volt: owner * ratio } };
        const { zone: after, events } = resolveZone(zone, 2);
        const clears = ratio < ATTACK_CLEAR_RATIO;
        expect(after.attackStartedAt === null).toBe(clears);
        expect(events.some((e) => e.type === 'defended')).toBe(clears);
      },
    );
  });

  it('zona bloqueada nunca tem dono nem recebe influência', () => {
    forAll(
      (r) => ({ zone: { ...zoneGen(r), blocked: true }, f: faction(r), rp: r.float(0, 1000) }),
      ({ zone, f, rp }) => {
        const { zone: after, events } = applyRunPoints(zone, f, rp, 0);
        expect(after.influence).toEqual(zone.influence);
        expect(events).toEqual([]);
        expect(resolveZone(zone, 0).zone.owner).toBeNull();
      },
    );
  });
});

describe('RN-005 — decaimento monotônico', () => {
  it('decair nunca aumenta influência, nunca fica negativo nem entre 0 e o piso, e nunca troca o dono por outra facção', () => {
    forAll(
      (r) => ({ zone: zoneGen(r), days: r.int(1, 60) }),
      ({ zone, days }) => {
        let z = zone;
        for (let d = 0; d < days; d++) {
          const { zone: next, events } = decayZone(z);
          for (const f of FACTION_IDS) {
            expect(next.influence[f]).toBeLessThanOrEqual(z.influence[f]);
            expect(next.influence[f]).toBeGreaterThanOrEqual(0);
            expect(next.influence[f] === 0 || next.influence[f] >= DECAY_FLOOR).toBe(true);
          }
          expect(next.owner === z.owner || next.owner === null).toBe(true);
          if (next.owner === null && z.owner !== null) expect(events).toEqual([{ type: 'neutralized', zoneId: z.id, from: z.owner }]);
          if (next.owner) expect(next.influence[next.owner]).toBeGreaterThanOrEqual(CAPTURE_THRESHOLD);
          z = next;
        }
      },
    );
  });

  it('sem corridas, toda zona fica neutra e zerada em no máximo 60 dias', () => {
    forAll(zoneGen, (zone) => {
      let z = zone;
      for (let d = 0; d < 60; d++) z = decayZone(z).zone;
      expect(z.owner).toBeNull();
      expect(Object.values(z.influence).every((v) => v === 0)).toBe(true);
    });
  });

  it('RN-004: fortificação mantém o escudo entre 0 e 3', () => {
    forAll(
      (r) => ({ zone: zoneGen(r), meters: r.float(-100, 2000) }),
      ({ zone, meters }) => {
        const s = fortifyZone(zone, meters).shield;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(SHIELD_MAX);
        expect(Math.abs(s - zone.shield)).toBeLessThanOrEqual(1);
      },
    );
  });
});

describe('RN-007/RN-008 — antifraude', () => {
  it('nenhum trecho válido passa de 40 km/h nem é salto de > 50 m em ≤ 1 s; metros válidos + inválidos = soma dos trechos', () => {
    forAll(trackGen, (points) => {
      const v = validateActivity(points);
      let total = 0;
      for (const s of v.steps) {
        total += s.meters;
        if (s.valid) {
          expect(s.kmh).toBeLessThanOrEqual(MAX_POINT_KMH);
          expect(s.meters > TELEPORT_METERS && s.seconds <= TELEPORT_SECONDS).toBe(false);
        } else {
          expect(s.reason).toBeDefined();
        }
      }
      expect(v.validMeters + v.invalidMeters).toBeCloseTo(total, 6);
      expect(v.status === 'rejected').toBe(false);
      if (v.invalidMeters > 0) expect(v.status === 'valid').toBe(false);
    });
  });

  it('qualquer ponto marcado como simulado rejeita a corrida inteira', () => {
    forAll(
      (r) => {
        const pts = trackGen(r);
        pts[r.int(0, pts.length - 1)].mocked = true;
        return pts;
      },
      (points) => {
        const v = validateActivity(points);
        expect(v.status).toBe('rejected');
        expect(v.flags).toEqual(['MOCK_LOCATION']);
        let live = startRun(0);
        for (const p of points) live = addPoint(live, p);
        const res = finishRun(live, { faction: 'volt', basePace: 360, streakDays: 0, zones: {}, revealedFog: new Set(), now: 0 });
        expect(res.rpTotal).toBe(0);
        expect(res.xp).toBe(0);
        expect(res.zones).toEqual([]);
      },
    );
  });

  it('RN-009: índice de confiança fica sempre entre 0 e 100', () => {
    const flags: CheatFlag[] = ['MOCK_LOCATION', 'TELEPORT', 'POINT_SPEED', 'VEHICLE_SUSPECTED', 'NO_STEPS', 'NO_PEDOMETER'];
    forAll(
      (r) => ({ score: r.float(-50, 150), flags: Array.from({ length: r.int(0, 8) }, () => r.pick(flags)), valid: r.bool() }),
      ({ score, flags: fl, valid }) => {
        const next = applyTrust(score, fl, valid);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(TRUST_START);
      },
    );
  });
});
