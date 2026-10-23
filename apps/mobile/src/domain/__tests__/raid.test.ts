/**
 * T7.1.3 — Raid real semanal (D-67): exemplos e propriedades.
 */
import { describe, expect, it } from '@jest/globals';

import {
  applyRaidHit,
  closeRaid,
  newRaid,
  RAID_BOSS_IDS,
  RAID_BOSSES,
  RAID_DAILY_DAMAGE_CAP,
  RAID_MIN_HP,
  RAID_ROTATION_EPOCH,
  RAID_RUN_CAP_KM,
  raidAdvancePhase,
  raidBossForWeek,
  raidCritRoll,
  raidDamage,
  raidDamageSince,
  raidHpFor,
  raidNextFactor,
  raidPhase,
  raidRewardEligible,
  raidRewardTier,
  raidShare,
  raidStatusAt,
  raidWeakPoints,
  raidWeekWindow,
  seededUnit,
  type RaidPhase,
  type RaidState,
} from '../raid';
import { forAll } from './prop';

const H = 60 * 60 * 1000;
const D = 24 * H;
/** Brasília = UTC−3. */
const brt = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h + 3, min);
const MON = brt(2026, 10, 19, 6); // segunda 19/10/2026 06:00
const WED = brt(2026, 10, 21, 12);

/** Sementes com e sem crítico, achadas pela própria função (determinística). */
const seeds = Array.from({ length: 200 }, (_, i) => `act-${i}`);
const NO_CRIT = seeds.find((s) => !raidCritRoll(s))!;
const CRIT = seeds.find((s) => raidCritRoll(s))!;

describe('calendário e chefões', () => {
  it('janela: segunda 06:00 → domingo 21:00 (Brasília)', () => {
    expect(raidWeekWindow(WED)).toEqual({ startsAt: MON, endsAt: brt(2026, 10, 25, 21) });
    expect(raidWeekWindow(brt(2026, 10, 25, 23, 30)).startsAt).toBe(MON);
    expect(raidWeekWindow(brt(2026, 10, 26, 3)).startsAt).toBe(brt(2026, 10, 26, 6));
  });

  it('ids dos 5 chefões (arte da E4 e tabelas da E9) e rotação semanal', () => {
    expect(RAID_BOSS_IDS).toEqual(['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao']);
    for (const id of RAID_BOSS_IDS) expect(RAID_BOSSES[id].weakness.length).toBeLessThanOrEqual(30);
    expect(RAID_ROTATION_EPOCH).toBe(MON);
    expect(raidBossForWeek(MON)).toBe('soneca');
    expect(raidBossForWeek(MON + 7 * D)).toBe('rei-buzina');
    expect(raidBossForWeek(MON - 7 * D)).toBe('paredao');
    expect(raidBossForWeek(MON + 35 * D)).toBe('soneca');
  });
});

describe('vida, fator e fases', () => {
  it('vida = max(500, 0,75 × mediana das 4 últimas semanas × 10 × fator)', () => {
    expect(raidHpFor([])).toBe(RAID_MIN_HP);
    expect(raidHpFor([10, 20])).toBe(RAID_MIN_HP);
    expect(raidHpFor([2000, 2200, 2400, 2600, 9999])).toBe(Math.round(0.75 * 2500 * 10));
    expect(raidHpFor([2000, 2200, 2400], 1.2)).toBe(19800);
    expect(raidHpFor([2000], 9)).toBe(22500);
    expect(raidHpFor([2000], NaN)).toBe(15000);
    expect(raidHpFor([2000, NaN, -5, Infinity])).toBe(15000);
  });

  it('fator: caiu antes de sábado +10%; fugiu −10%; limites 0,7–1,5', () => {
    expect(raidNextFactor(1, brt(2026, 10, 23, 18), MON)).toBe(1.1);
    expect(raidNextFactor(1.1, brt(2026, 10, 23, 18), MON)).toBe(1.2);
    expect(raidNextFactor(1, brt(2026, 10, 24, 9), MON)).toBe(1);
    expect(raidNextFactor(1, null, MON)).toBe(0.9);
    expect(raidNextFactor(1.5, MON + H, MON)).toBe(1.5);
    expect(raidNextFactor(0.7, null, MON)).toBe(0.7);
    expect(raidNextFactor(NaN, null, MON)).toBe(0.9);
  });

  it('fases 100/67/33% e só avançam', () => {
    expect(raidPhase(1000, 1000)).toBe(1);
    expect(raidPhase(680, 1000)).toBe(1);
    expect(raidPhase(670, 1000)).toBe(2);
    expect(raidPhase(340, 1000)).toBe(2);
    expect(raidPhase(330, 1000)).toBe(3);
    expect(raidPhase(0, 1000)).toBe(3);
    expect(raidPhase(10, 0)).toBe(3);
    expect(raidAdvancePhase(3, 1000, 1000)).toBe(3);
    expect(raidAdvancePhase(1, 500, 1000)).toBe(2);
  });

  it('abre, mostra situação e fecha', () => {
    const raid = newRaid('r1', WED, [2000]);
    expect(raid).toEqual({
      id: 'r1',
      bossId: 'soneca',
      startsAt: MON,
      endsAt: brt(2026, 10, 25, 21),
      hpMax: 15000,
      hp: 15000,
      phase: 1,
      status: 'active',
      defeatedAt: null,
      finalBlowBy: null,
    });
    expect(raidStatusAt(raid, MON - 1)).toBe('upcoming');
    expect(raidStatusAt(raid, WED)).toBe('active');
    expect(raidStatusAt(raid, raid.endsAt)).toBe('escaped');
    expect(closeRaid(raid, WED)).toBe(raid);
    expect(closeRaid(raid, raid.endsAt).status).toBe('escaped');
    const done: RaidState = { ...raid, status: 'defeated', hp: 0 };
    expect(raidStatusAt(done, raid.endsAt)).toBe('defeated');
    expect(closeRaid(done, raid.endsAt)).toBe(done);
  });
});

describe('dano', () => {
  it('crítico determinístico pela semente, ~10% das atividades', () => {
    expect(raidCritRoll(CRIT)).toBe(true);
    expect(raidCritRoll(CRIT)).toBe(true);
    expect(raidCritRoll(NO_CRIT)).toBe(false);
    expect(seededUnit('x')).toBe(seededUnit('x'));
    const n = 20_000;
    let crits = 0;
    for (let i = 0; i < n; i++) if (raidCritRoll(`atividade-${i}`)) crits++;
    expect(crits / n).toBeGreaterThan(0.09);
    expect(crits / n).toBeLessThan(0.11);
  });

  it('10 por km; ponto fraco ×2 a partir da fase 2; crítico ×2; grupo ×1,25 na fase 3', () => {
    expect(raidDamage({ validMeters: 5000, phase: 1, seed: NO_CRIT })).toEqual({ damage: 50, countedKm: 5, weakKm: 0, crit: false, pack: false, capped: false });
    expect(raidDamage({ validMeters: 5000, weakPointMeters: 2000, phase: 1, seed: NO_CRIT }).damage).toBe(50);
    expect(raidDamage({ validMeters: 5000, weakPointMeters: 2000, phase: 2, seed: NO_CRIT }).damage).toBe(70);
    expect(raidDamage({ validMeters: 5000, weakPointMeters: 9000, phase: 2, seed: NO_CRIT }).weakKm).toBe(5);
    expect(raidDamage({ validMeters: 5000, phase: 1, seed: CRIT })).toMatchObject({ damage: 100, crit: true });
    expect(raidDamage({ validMeters: 4000, phase: 3, inPack: true, seed: NO_CRIT })).toMatchObject({ damage: 50, pack: true });
    expect(raidDamage({ validMeters: 4000, phase: 2, inPack: true, seed: NO_CRIT })).toMatchObject({ damage: 40, pack: false });
    expect(raidDamage({ validMeters: 3333, phase: 1, seed: NO_CRIT }).damage).toBe(33);
  });

  it('tetos: 21 km por corrida, 30 km e 300 de dano por dia; entrada inválida vira 0', () => {
    expect(raidDamage({ validMeters: 42_000, phase: 1, seed: NO_CRIT })).toMatchObject({ damage: 210, countedKm: RAID_RUN_CAP_KM });
    expect(raidDamage({ validMeters: 10_000, phase: 1, seed: NO_CRIT, kmToday: 25 })).toMatchObject({ damage: 50, countedKm: 5 });
    expect(raidDamage({ validMeters: 10_000, phase: 1, seed: NO_CRIT, damageToday: 280 })).toMatchObject({ damage: 20, capped: true });
    expect(raidDamage({ validMeters: 21_000, phase: 1, seed: CRIT })).toMatchObject({ damage: RAID_DAILY_DAMAGE_CAP, capped: true });
    expect(raidDamage({ validMeters: NaN, weakPointMeters: -3, phase: 2, seed: NO_CRIT, damageToday: NaN, kmToday: -4 }).damage).toBe(0);
    expect(raidDamage({ validMeters: -500, phase: 1, seed: NO_CRIT }).damage).toBe(0);
  });

  it('golpe: vida cai, fase muda, golpe final; fora da janela não muda nada', () => {
    const raid = newRaid('r1', WED, [100]); // vida 750
    const a = applyRaidHit(raid, 300, WED, 'u1');
    expect(a).toMatchObject({ applied: 300, phaseChanged: true, finalBlow: false, raid: { hp: 450, phase: 2 } });
    const b = applyRaidHit(a.raid, 1000, WED + H, 'u2');
    expect(b).toMatchObject({ applied: 450, finalBlow: true, raid: { hp: 0, phase: 3, status: 'defeated', defeatedAt: WED + H, finalBlowBy: 'u2' } });
    expect(applyRaidHit(b.raid, 50, WED + 2 * H, 'u3')).toEqual({ raid: b.raid, applied: 0, phaseChanged: false, finalBlow: false });
    expect(applyRaidHit(raid, 50, raid.endsAt, 'u3').applied).toBe(0);
    expect(applyRaidHit(raid, 50, MON - 1, 'u3').applied).toBe(0);
    expect(applyRaidHit(raid, -50, WED, 'u3')).toMatchObject({ applied: 0, raid: { hp: 750 } });
    expect(applyRaidHit(raid, NaN, WED, 'u3').applied).toBe(0);
  });
});

describe('pontos fracos e recompensas', () => {
  const zones = Array.from({ length: 40 }, (_, i) => `z${i}`);

  it('3 zonas por dia, determinísticas, sem repetição, preferindo parques', () => {
    const a = raidWeakPoints(zones, 'goiania:r1', '2026-10-21');
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(raidWeakPoints([...zones, ...zones], 'goiania:r1', '2026-10-21')).toEqual(a);
    expect(raidWeakPoints(zones, 'goiania:r1', '2026-10-22')).not.toEqual(a);
    const parks = new Set(['z7', 'z30']);
    expect(raidWeakPoints(zones, 'goiania:r1', '2026-10-21', parks).slice(0, 2).sort()).toEqual(['z30', 'z7']);
    expect(raidWeakPoints(['b', 'a'], 's', 'd', new Set(), 5)).toHaveLength(2);
    expect(raidWeakPoints(zones, 's', 'd', new Set(), 0)).toEqual([]);
  });

  it('baú pela hora da queda; recompensa a partir de 10 de dano; "Sua parte"', () => {
    expect(raidRewardTier(null, MON)).toBeNull();
    expect(raidRewardTier(brt(2026, 10, 22, 23, 59), MON)).toEqual({ tier: 'lendario', chances: { lendario: 0.15, raro: 0.85, comum: 0 } });
    expect(raidRewardTier(brt(2026, 10, 23, 0), MON)?.tier).toBe('raro');
    expect(raidRewardTier(brt(2026, 10, 24, 22), MON)?.tier).toBe('raro');
    expect(raidRewardTier(brt(2026, 10, 25, 8), MON)?.tier).toBe('comum');
    const raid = newRaid('r1', WED, [100]);
    expect(raidRewardEligible({ ...raid, status: 'defeated' }, 10)).toBe(true);
    expect(raidRewardEligible({ ...raid, status: 'defeated' }, 9)).toBe(false);
    expect(raidRewardEligible(raid, 100)).toBe(false);
    expect(raidShare(30, 1200)).toBe(0.025);
    expect(raidShare(30, 0)).toBe(0);
    expect(raidShare(NaN, 10)).toBe(0);
    expect(raidShare(50, 10)).toBe(1);
    expect(raidDamageSince(15000, 14200)).toBe(800);
    expect(raidDamageSince(100, 200)).toBe(0);
  });
});

describe('propriedades da Raid', () => {
  it('dano ≥ 0, inteiro, e o teto diário nunca é passado', () => {
    forAll(
      (r) => ({
        day: Array.from({ length: r.int(1, 8) }, () => ({
          meters: r.bool(0.1) ? r.pick([NaN, -100, Infinity]) : r.float(0, 45_000),
          weak: r.float(-1000, 30_000),
          phase: r.int(1, 3) as RaidPhase,
          pack: r.bool(),
          seed: `s${r.int(0, 1e9)}`,
        })),
      }),
      ({ day }) => {
        let damageToday = 0;
        let kmToday = 0;
        for (const run of day) {
          const hit = raidDamage({ validMeters: run.meters, weakPointMeters: run.weak, phase: run.phase, inPack: run.pack, seed: run.seed, damageToday, kmToday });
          expect(hit.damage).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(hit.damage)).toBe(true);
          expect(hit.countedKm).toBeLessThanOrEqual(RAID_RUN_CAP_KM);
          damageToday += hit.damage;
          kmToday += hit.countedKm;
          expect(damageToday).toBeLessThanOrEqual(RAID_DAILY_DAMAGE_CAP);
          expect(kmToday).toBeLessThanOrEqual(30 + 1e-9);
        }
      },
    );
  });

  it('a vida só cai (nunca abaixo de 0) e a fase só avança', () => {
    forAll(
      (r) => ({ km: r.float(0, 5000), hits: Array.from({ length: r.int(1, 60) }, () => (r.bool(0.1) ? r.pick([NaN, -40, Infinity]) : r.int(0, 900))) }),
      ({ km, hits }) => {
        let raid = newRaid('p', WED, [km]);
        for (const [i, dmg] of hits.entries()) {
          const before = raid;
          raid = applyRaidHit(raid, dmg, WED + i * 60_000, `u${i}`).raid;
          expect(raid.hp).toBeLessThanOrEqual(before.hp);
          expect(raid.hp).toBeGreaterThanOrEqual(0);
          expect(raid.phase).toBeGreaterThanOrEqual(before.phase);
          if (before.status === 'defeated') expect(raid).toBe(before);
        }
      },
    );
  });
});
