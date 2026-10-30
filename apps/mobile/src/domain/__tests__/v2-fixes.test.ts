/**
 * T7.1.4 — correções do domain atual, cada uma com teste de regressão. As funções v1 (usadas pela gravação
 * que está na nuvem) continuam iguais: os testes antigos seguem valendo e aqui o bug v1 aparece documentado.
 */
import '../h3-runtime';

import { describe, expect, it } from '@jest/globals';
import { cellToChildren } from 'h3-js';

import { validateActivity } from '../anti-cheat';
import {
  atlasMilestonesCrossed,
  districtExploration,
  districtsExploration,
  ghostGap,
  ghostPaceAllowedV2,
  ghostPaceV2,
  GHOST_NO_HISTORY_PACE,
  GHOST_TIE_METERS,
  revealFog,
} from '../games';
import { offset } from '../geo';
import { districtOf, FOG_RES, fogCellOf, fogCellsInDistrict } from '../grid';
import { addPoint, appendPoint, finishRun, finishRunV2, startRun, type LiveRun } from '../run-engine';
import { DAILY_ZONE_CAP, PACK_BONUS, scoreRunV2, scoreZone, scoreZoneV2 } from '../scoring';
import {
  applyRunPoints,
  applyRunPointsV2,
  attackExpired,
  clearExpiredAttack,
  DEFENSE_WINDOW_MS,
  emptyInfluence,
  isUnderAttack,
  isUnderAttackAt,
  newZone,
  resolveZone,
  resolveZoneV2,
  seasonReset,
  seasonResetV2,
  strongestRivalV2,
  type Influence,
  type Zone,
} from '../territory';
import { FACTION_IDS, type FactionId, type GeoPoint } from '../types';
import { ORIGIN, track } from './helpers';
import { forAll, type Rng } from './prop';

const NOW = 1_790_000_000_000;
const inf = (partial: Partial<Influence>): Influence => ({ ...emptyInfluence(), ...partial });
const zone = (partial: Partial<Zone>): Zone => ({ ...newZone('z1'), ...partial });

describe('E-03 — ataque que nunca expira', () => {
  const attacked = zone({ owner: 'owls', influence: inf({ owls: 100, volt: 60 }), attackStartedAt: NOW, attacker: 'volt' });

  it('v2: sob ataque só por 24 h; o job limpa o vencido', () => {
    expect(isUnderAttackAt(attacked, NOW + DEFENSE_WINDOW_MS)).toBe(true);
    expect(isUnderAttackAt(attacked, NOW + DEFENSE_WINDOW_MS + 1)).toBe(false);
    expect(attackExpired(attacked, NOW + DEFENSE_WINDOW_MS + 1)).toBe(true);
    expect(attackExpired(zone({}), NOW)).toBe(false);
    expect(clearExpiredAttack(attacked, NOW + 2 * DEFENSE_WINDOW_MS)).toMatchObject({ attackStartedAt: null, attacker: null });
    expect(clearExpiredAttack(attacked, NOW + 1000)).toBe(attacked);
    // v1 continua igual (deprecated): o ataque "dura para sempre".
    expect(isUnderAttack(attacked)).toBe(true);
  });

  it('v2: ataque novo depois do vencido dispara o alerta de novo (a v1 não dispara)', () => {
    const later = NOW + 3 * DEFENSE_WINDOW_MS;
    expect(resolveZone(attacked, later).events).toEqual([]);
    const r = resolveZoneV2(attacked, later, 'volt');
    expect(r.events).toEqual([{ type: 'under_attack', zoneId: 'z1', owner: 'owls', attacker: 'volt' }]);
    expect(r.zone.attackStartedAt).toBe(later);
  });

  it('v2: defesa limpa o ataque como na v1', () => {
    const r = applyRunPointsV2(attacked, 'owls', 60, NOW + 1000);
    expect(r.events).toEqual([{ type: 'defended', zoneId: 'z1', owner: 'owls' }]);
  });
});

describe('E-06 — desempate a favor dos Striders', () => {
  it('zona neutra empatada: v1 dá aos Striders; v2 não dá a ninguém', () => {
    const tied = zone({ influence: inf({ striders: 40, coyotes: 40 }) });
    expect(resolveZone(tied, NOW).zone.owner).toBe('striders');
    expect(resolveZoneV2(tied, NOW).zone.owner).toBeNull();
    expect(strongestRivalV2(tied.influence, null)).toEqual({ faction: null, value: 40, tied: ['striders', 'coyotes'] });
    expect(strongestRivalV2(emptyInfluence(), null)).toEqual({ faction: null, value: 0, tied: [] });
  });

  it('zona com dono: dois rivais empatados não tomam; o atacante é quem correu', () => {
    const z = zone({ owner: 'volt', influence: inf({ volt: 100, striders: 120, coyotes: 120 }) });
    expect(resolveZone(z, NOW).zone.owner).toBe('striders');
    const r = resolveZoneV2(z, NOW, 'coyotes');
    expect(r.zone.owner).toBe('volt');
    expect(r.events).toEqual([{ type: 'under_attack', zoneId: 'z1', owner: 'volt', attacker: 'coyotes' }]);
    expect(resolveZoneV2(z, NOW, 'owls').zone.attacker).toBeNull();
    expect(resolveZoneV2(z, NOW).zone.attacker).toBeNull();
  });

  it('propriedade: trocar os rótulos dos times troca o resultado (simetria)', () => {
    forAll(
      (r: Rng) => {
        const influence = emptyInfluence();
        for (const f of FACTION_IDS) influence[f] = r.bool(0.3) ? 40 : r.pick([0, 20, 35, 60, 120]);
        const owner = r.bool(0.4) ? null : r.pick(FACTION_IDS);
        return { z: zone({ influence, owner }), actor: r.pick(FACTION_IDS), order: [...FACTION_IDS].sort(() => r.next() - 0.5) };
      },
      ({ z, actor, order }) => {
        const sigma = Object.fromEntries(FACTION_IDS.map((f, i) => [f, order[i]])) as Record<FactionId, FactionId>;
        const permuted: Zone = {
          ...z,
          owner: z.owner && sigma[z.owner],
          influence: Object.fromEntries(FACTION_IDS.map((f) => [sigma[f], z.influence[f]])) as Influence,
        };
        const a = resolveZoneV2(z, NOW, actor).zone;
        const b = resolveZoneV2(permuted, NOW, sigma[actor]).zone;
        expect(b.owner).toBe(a.owner && sigma[a.owner]);
        expect(b.attacker).toBe(a.attacker && sigma[a.attacker]);
      },
    );
  });
});

describe('E-07 — zona neutra que vai para quem não correu', () => {
  it('v1 entrega ao rival mais forte; v2 só quem correu conquista', () => {
    const z = zone({ influence: inf({ owls: 32 }) });
    expect(applyRunPoints(z, 'volt', 5, NOW).zone.owner).toBe('owls');
    const v2 = applyRunPointsV2(z, 'volt', 5, NOW);
    expect(v2.zone.owner).toBeNull();
    expect(v2.events).toEqual([]);
    const later = applyRunPointsV2(v2.zone, 'volt', 30, NOW);
    expect(later.events).toEqual([{ type: 'captured', zoneId: 'z1', faction: 'volt', from: null }]);
  });

  it('bloqueada, rp ≤ 0 ou NaN não muda nada', () => {
    const z = zone({ influence: inf({ owls: 32 }) });
    expect(applyRunPointsV2({ ...z, blocked: true }, 'owls', 50, NOW).zone).toEqual({ ...z, blocked: true });
    expect(applyRunPointsV2(z, 'owls', 0, NOW).zone).toBe(z);
    expect(applyRunPointsV2(z, 'owls', NaN, NOW).zone).toBe(z);
    expect(resolveZoneV2({ ...z, blocked: true, owner: 'owls' }, NOW).zone.owner).toBeNull();
  });

  it('propriedade: na v2 só o time que correu conquista', () => {
    forAll(
      (r: Rng) => {
        const influence = emptyInfluence();
        for (const f of FACTION_IDS) influence[f] = r.bool(0.4) ? 0 : r.float(0, 300);
        return { z: zone({ influence, owner: r.bool(0.5) ? null : r.pick(FACTION_IDS), shield: r.int(0, 3) }), f: r.pick(FACTION_IDS), rp: r.float(-10, 200) };
      },
      ({ z, f, rp }) => {
        for (const e of applyRunPointsV2(z, f, rp, NOW).events) if (e.type === 'captured') expect(e.faction).toBe(f);
      },
    );
  });
});

describe('E-08 — temporada que não reavalia o dono', () => {
  it('v1 deixa o dono com < 30 até as 03:00; v2 neutraliza na hora', () => {
    const z = zone({ owner: 'owls', shield: 2, influence: inf({ owls: 90, volt: 50 }), attackStartedAt: NOW, attacker: 'volt' });
    expect(seasonReset(z).owner).toBe('owls');
    const r = seasonResetV2(z, NOW + 1000);
    expect(r.zone).toMatchObject({ owner: null, shield: 0, attackStartedAt: null, attacker: null });
    expect(r.zone.influence.owls).toBeCloseTo(27);
    expect(r.events).toEqual([{ type: 'neutralized', zoneId: 'z1', from: 'owls' }]);
  });

  it('dono forte continua; ataque vencido some na virada', () => {
    const z = zone({ owner: 'owls', influence: inf({ owls: 200 }), attackStartedAt: NOW, attacker: 'volt' });
    const r = seasonResetV2(z, NOW + 2 * DEFENSE_WINDOW_MS);
    expect(r).toMatchObject({ events: [], zone: { owner: 'owls', attackStartedAt: null } });
    expect(seasonResetV2(zone({ influence: inf({ volt: 100 }) }), NOW).zone.owner).toBeNull();
  });
});

describe('E-11 e E-12 — run-engine sem O(n²) e sem copiar o vetor', () => {
  const mkTrack = (r: Rng): GeoPoint[] => {
    const pts: GeoPoint[] = [];
    let pos = ORIGIN;
    let t = 0;
    for (let i = 0; i < r.int(2, 120); i++) {
      pts.push({ ...pos, t, accuracy: r.bool(0.1) ? 50 : 5, steps: r.bool(0.9) ? 3 : 0 });
      const kmh = r.bool(0.1) ? r.float(30, 150) : r.float(0, 16);
      const dt = r.int(0, 6);
      pos = offset(pos, (kmh / 3.6) * dt, r.float(0, 360));
      t += dt * 1000;
    }
    return pts;
  };

  it('appendPoint dá os mesmos números que addPoint, sem copiar o vetor (E-12)', () => {
    forAll(mkTrack, (pts) => {
      let a = startRun(0);
      let b: LiveRun = startRun(0);
      const points = b.points;
      for (const p of pts) {
        a = addPoint(a, p);
        b = appendPoint(b, p);
        expect(b.points).toBe(points);
      }
      expect(b).toEqual(a);
    });
  });

  it('finishRun (E-11): o caminho válido é o mesmo da versão O(n²)', () => {
    forAll(
      (r) => ({ pts: mkTrack(r) }),
      ({ pts }) => {
        const run = { ...startRun(0), points: pts };
        const v = validateActivity(pts);
        const reference = v.status === 'rejected' ? [] : pts.filter((_, i) => v.steps.some((s) => s.valid && (s.from === i || s.to === i)));
        const res = finishRun(run, { faction: 'owls', basePace: 360, streakDays: 0, zones: {}, revealedFog: new Set(), now: NOW });
        expect(res.newFogCells).toEqual(revealFog(reference, new Set()));
      },
      100,
    );
  });

  it('15 km a 1 Hz: appendPoint + finishRun rápidos', () => {
    const pts = track({ kmh: 10, seconds: 5400, spm: 170 });
    const started = performance.now();
    let run = startRun(0);
    for (const p of pts) run = appendPoint(run, p);
    const res = finishRun(run, { faction: 'owls', basePace: 360, streakDays: 0, zones: {}, revealedFog: new Set(), now: NOW });
    expect(res.meters).toBeGreaterThan(14_900);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe('D-63 e E-15 — pontos v2 sem sequência e sem fantasma', () => {
  const base = { meters: 1000, paceSecPerKm: 360, basePaceSecPerKm: 360 };

  it('scoreZoneV2 = metros × 0,1 × esforço × grupo × defesa, com teto', () => {
    expect(scoreZoneV2(base)).toEqual({ rp: 100, multipliers: { effort: 1, pack: 1, defense: 1 }, capped: false });
    expect(scoreZoneV2({ ...base, inPack: true }).rp).toBe(Math.round(100 * PACK_BONUS));
    expect(scoreZoneV2({ ...base, defending: true }).rp).toBe(200);
    expect(scoreZoneV2({ ...base, earnedTodayInZone: DAILY_ZONE_CAP - 30 })).toMatchObject({ rp: 30, capped: true });
    expect(scoreZoneV2({ ...base, earnedTodayInZone: NaN }).rp).toBe(100);
    expect(scoreZoneV2({ ...base, meters: NaN }).rp).toBe(0);
    expect(scoreZoneV2({ ...base, meters: -50 }).rp).toBe(0);
    // A v1 multiplicava pela sequência (+50% com 10) e pelo fantasma (×1,5).
    expect(scoreZone({ ...base, streakDays: 10, beatGhost: true }).rp).toBe(225);
  });

  it('scoreRunV2 soma por zona, pula bloqueadas e ordena', () => {
    const r = scoreRunV2({
      zoneMeters: { a: 500, b: 1500, c: 800 },
      paceSecPerKm: 360,
      basePaceSecPerKm: 360,
      packZones: new Set(['c']),
      earnedTodayByZone: { b: 250 },
      blockedZones: new Set(['a']),
    });
    expect(r).toEqual({ total: 150, zones: [{ zoneId: 'c', rp: 100, capped: false }, { zoneId: 'b', rp: 50, capped: true }] });
    expect(scoreRunV2({ zoneMeters: { a: 100 }, paceSecPerKm: 360, basePaceSecPerKm: 360 }).total).toBe(10);
  });

  it('finishRunV2: sem multiplicar sequência e fantasma; fantasma vale 50 XP; trechos para a pintura', () => {
    const pts = track({ kmh: 12, seconds: 600, spm: 170 });
    const run = { ...startRun(0), points: pts };
    const ctx = { faction: 'owls' as const, basePace: 360, streakDays: 10, zones: {}, revealedFog: new Set<string>(), now: NOW, ghostPace: 420 };
    const v1 = finishRun(run, ctx);
    const v2 = finishRunV2(run, ctx);
    expect(v1.beatGhost).toBe(true);
    expect(v2.beatGhost).toBe(true);
    expect(v2.rpTotal).toBeLessThan(v1.rpTotal);
    expect(v2.xp).toBe(v1.xp);
    expect(v2.paintCells.length).toBeGreaterThan(20);
    expect(v2.zones.some((z) => z.outcome === 'conquered')).toBe(true);
    const mocked = { ...run, points: pts.map((p) => ({ ...p, mocked: true })) };
    expect(finishRunV2(mocked, ctx)).toMatchObject({ paintCells: [], rpTotal: 0, xp: 0 });
  });
});

describe('Fuga pelo ritmo-base (parte pura)', () => {
  it('3 níveis: seu ritmo (mediana), desafio (3% mais rápido) e recorde (melhor)', () => {
    const recent = [440, 430, 450, 420, 445];
    expect(ghostPaceV2('seu-ritmo', recent)).toBe(440);
    expect(ghostPaceV2('desafio', recent)).toBe(Math.round(440 * 0.97));
    expect(ghostPaceV2('recorde', recent)).toBe(420);
    expect(ghostPaceV2('seu-ritmo', [400, 420])).toBe(410);
    expect(ghostPaceV2('seu-ritmo', [])).toBe(GHOST_NO_HISTORY_PACE);
    expect(ghostPaceV2('recorde', [NaN, -1])).toBe(GHOST_NO_HISTORY_PACE);
    expect(ghostPaceV2('desafio', [])).toBe(Math.round(GHOST_NO_HISTORY_PACE * 0.97));
  });

  it('o servidor aceita só ±20% do seu ritmo, ou o seu recorde', () => {
    const recent = [440, 430, 450, 300, 445];
    expect(ghostPaceAllowedV2(440, recent)).toBe(true);
    expect(ghostPaceAllowedV2(440 * 1.2, recent)).toBe(true);
    expect(ghostPaceAllowedV2(560, recent)).toBe(false);
    expect(ghostPaceAllowedV2(300, recent)).toBe(true);
    expect(ghostPaceAllowedV2(320, recent)).toBe(false);
    expect(ghostPaceAllowedV2(NaN, recent)).toBe(false);
    expect(ghostPaceAllowedV2(0, recent)).toBe(false);
  });

  it('propriedade: o iniciante a ~7:15 vence o "Seu ritmo" correndo 2% mais rápido que o normal', () => {
    forAll(
      (r) => Array.from({ length: r.int(0, 10) }, () => 435 * r.float(0.96, 1.04)),
      (recent) => {
        const ghost = ghostPaceV2('seu-ritmo', recent);
        const myPace = (recent.length ? ghost : 435) * 0.98;
        const seconds = 3 * myPace;
        expect(ghostGap(3000, seconds, ghost)).toBeGreaterThan(GHOST_TIE_METERS);
      },
    );
  });
});

describe('Atlas por bairro — districtExploration', () => {
  const fog = fogCellOf(ORIGIN);
  const district = districtOf(fog);

  it('% do bairro explorado e marcos de 25%', () => {
    expect(fogCellsInDistrict(district)).toBe(343);
    const all = cellToChildren(district, FOG_RES);
    expect(districtExploration([], district)).toEqual({ district, revealed: 0, total: 343, pct: 0, milestone: 0 });
    expect(districtExploration(all.slice(0, 86), district)).toMatchObject({ pct: 25, milestone: 25 });
    expect(districtExploration([...all.slice(0, 200), ...all.slice(0, 200)], district)).toMatchObject({ revealed: 200, pct: 58, milestone: 50 });
    expect(districtExploration(all.slice(0, 342), district)).toMatchObject({ pct: 99, milestone: 75 });
    expect(districtExploration(all, district)).toMatchObject({ pct: 100, milestone: 100 });
    const elsewhere = fogCellOf(offset(ORIGIN, 20_000, 0));
    expect(districtExploration([elsewhere], district).revealed).toBe(0);
  });

  it('bairros de uma corrida real, do mais explorado para o menos', () => {
    const pts = track({ kmh: 10, seconds: 600 });
    const cells = revealFog(pts, new Set());
    const list = districtsExploration([...cells, fogCellOf(offset(ORIGIN, 20_000, 0)), fogCellOf(offset(ORIGIN, 20_000, 180))]);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list[0].revealed).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].pct).toBeGreaterThanOrEqual(list[i].pct);
    expect(list.reduce((s, d) => s + d.revealed, 0)).toBe(cells.length + 2);
  });

  it('marcos cruzados entre duas leituras', () => {
    expect(atlasMilestonesCrossed(20, 55)).toEqual([25, 50]);
    expect(atlasMilestonesCrossed(50, 50)).toEqual([]);
    expect(atlasMilestonesCrossed(99, 100)).toEqual([100]);
  });
});
