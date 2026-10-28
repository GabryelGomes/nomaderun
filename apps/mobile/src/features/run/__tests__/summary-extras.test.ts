/**
 * T7.3.2 (E6b) — encaixes do resumo: resposta oficial crua (com `extras`), nível novo e chefão derrotado para
 * o card da E8. Só verdades: sem dado, `null`.
 */
import { describe, expect, it } from '@jest/globals';

import { levelProgress } from '@/domain/progression';
import type { RunEngagement } from '@/services/api/engagement-repo';
import type { RaidBoss, RaidCurrent } from '@/services/api/raid-repo';

import { officialFor, rememberOfficial } from '../official-cache';
import { careerTotals, raidExtraOf, shareBossFrom, shareLevelFrom } from '../summary-extras';

const block = (before: number, after: number): RunEngagement => ({
  xp: { total: 80, lines: [] },
  level: { before, after, titleAfter: null },
  band: null,
  dailyChests: { opened: [], pityLeft: null, reason: 'distance', stored: 0 },
  missions: [],
  streak: null,
  season: null,
  ftue: null,
  comeback: null,
});

describe('official-cache', () => {
  it('guarda a resposta crua por corrida e ignora o que não é objeto', () => {
    rememberOfficial('a', { activityId: 'a', extras: { contract: 2 } });
    rememberOfficial('b', null);
    expect(officialFor('a')).toEqual({ activityId: 'a', extras: { contract: 2 } });
    expect(officialFor('b')).toBeNull();
    expect(officialFor(undefined)).toBeNull();
  });

  it('guarda no máximo 10 corridas (as mais antigas saem)', () => {
    for (let i = 0; i < 12; i++) rememberOfficial(`r${i}`, { i });
    expect(officialFor('r0')).toBeNull();
    expect(officialFor('r11')).toEqual({ i: 11 });
  });
});

describe('careerTotals', () => {
  const rows = [
    { id: 'x', status: 'valid', meters: 5000, result: { zones: [{ outcome: 'conquered' }, { outcome: 'influence' }] } },
    { id: 'y', status: 'rejected', meters: 9000, result: null },
    { id: 'z', status: 'partial', meters: 1000, result: null },
  ];

  it('só corridas válidas ou parciais; esta corrida entra uma vez', () => {
    expect(careerTotals(rows, { id: 'novo', meters: 3000, conquered: 2 })).toEqual({ meters: 9000, zones: 3, runs: 3 });
    expect(careerTotals(rows, { id: 'x', meters: 5000, conquered: 1 })).toEqual({ meters: 6000, zones: 1, runs: 2 });
  });
});

describe('shareLevelFrom (nível novo da E7)', () => {
  const totals = { meters: 1, zones: 0, runs: 1 };

  it('sem bloco ou sem subir de nível: nada', () => {
    expect(shareLevelFrom(null, 500, totals)).toBeNull();
    expect(shareLevelFrom(block(3, 3), 500, totals)).toBeNull();
  });

  it('subiu: o nível do servidor e o progresso do XP quando o aparelho já está no mesmo nível', () => {
    const xp = 400;
    const p = levelProgress(xp);
    const l = shareLevelFrom(block(p.level - 1, p.level), xp, totals);
    expect(l).toMatchObject({ reached: p.level, xpToNext: p.needed - p.intoLevel, totals });
    expect(l!.progressToNext).toBeCloseTo(p.intoLevel / p.needed);
    // XP do aparelho atrasado: o card não inventa progresso.
    expect(shareLevelFrom(block(8, 9), 0, totals)).toMatchObject({ reached: 9, xpToNext: 0, progressToNext: 0 });
  });
});

const raidBoss = (patch: Partial<RaidBoss> = {}): RaidBoss => ({
  id: 'raid-1',
  bossId: 'soneca',
  name: 'Soneca',
  theme: '',
  weakness: '',
  introLine: '',
  defeatLine: '',
  artKey: '',
  city: 'Goiânia',
  weekStart: '2026-10-26',
  startsAt: Date.UTC(2026, 9, 26, 9),
  endsAt: 0,
  hp: 0,
  hpMax: 15000,
  phase: 3,
  status: 'defeated',
  participants: 40,
  defeatedAt: Date.UTC(2026, 9, 30, 20),
  isDemo: false,
  weakPoints: [],
  ...patch,
});
const current = (b: RaidBoss | null): RaidCurrent => ({
  available: true,
  raid: b,
  me: { damage: 0, meters: 0, hits: 0, todayMeters: 0, rank: null, rewards: [] },
  share: 0,
  sinceLastVisit: null,
  topRunners: [],
  topCrews: [],
  params: {},
});

describe('chefão derrotado (extras.raid + Raid atual)', () => {
  const official = { extras: { raid: { raidId: 'raid-1', bossId: 'soneca', countedKm: 5.2, hpMax: 15000, defeated: true } } };

  it('lê o extras.raid; sem ele, nada', () => {
    expect(raidExtraOf(official)).toEqual({ raidId: 'raid-1', defeated: true, countedKm: 5.2, hpMax: 15000 });
    expect(raidExtraOf({ extras: { raid: null } })).toBeNull();
    expect(raidExtraOf(null)).toBeNull();
  });

  it('monta o card com nome, cidade, metros da cidade (10 de dano por km) e dias', () => {
    expect(shareBossFrom(raidExtraOf(official), current(raidBoss()), null)).toEqual({
      name: 'Soneca',
      defeated: true,
      myDamageMeters: 5200,
      cityName: 'Goiânia',
      cityMeters: 1_500_000,
      days: 5,
    });
  });

  it('não derrotado, outro chefão, sem data ou sem cidade: nada', () => {
    const ex = raidExtraOf(official)!;
    expect(shareBossFrom({ ...ex, defeated: false }, current(raidBoss()), null)).toBeNull();
    expect(shareBossFrom(ex, current(raidBoss({ id: 'outro' })), null)).toBeNull();
    expect(shareBossFrom(ex, current(raidBoss({ defeatedAt: null })), null)).toBeNull();
    expect(shareBossFrom(ex, current(raidBoss({ city: null })), null)).toBeNull();
    expect(shareBossFrom(ex, current(raidBoss({ city: null })), 'Anápolis')?.cityName).toBe('Anápolis');
    expect(shareBossFrom(ex, null, 'Goiânia')).toBeNull();
  });
});
