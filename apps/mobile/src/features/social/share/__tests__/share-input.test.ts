import { describe, expect, it } from '@jest/globals';

import { forAll } from '@/domain/__tests__/prop';
import { distanceMeters, offset } from '@/domain/geo';
import type { RunSummary } from '@/features/run/summary-model';

import { buildCarousel, pickCardModels } from '../../card';
import { DEMO_HOME, DEMO_ROUTE } from '../../card/__tests__/fixtures';
import { buildShareRunInput, cardDateOf, PRIVACY_NOTICE_NO_ZONES, randomSeed, shareCaption, type ShareSource } from '../share-input';

function demoSummary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    source: 'official',
    status: 'valid',
    meters: 2020,
    movingSeconds: 629,
    avgPace: 311,
    rpTotal: 183,
    xp: 60,
    flags: [],
    invalidSegments: [],
    zones: [
      { zoneId: 'z1', name: 'Jardim Goiás', meters: 900, rp: 46, outcome: 'conquered', ownerBefore: 'coyotes', ownerAfter: 'striders' },
      { zoneId: 'z2', name: 'Setor Sul', meters: 600, rp: 30, outcome: 'influence', ownerBefore: 'striders', ownerAfter: 'striders' },
    ],
    newFogCells: 3,
    beatGhost: null,
    trust: 96,
    review: null,
    ...over,
  };
}

const AT = new Date(2026, 9, 23, 7, 42).getTime();

function source(over: Partial<ShareSource> = {}): ShareSource {
  return {
    summary: demoSummary(),
    official: true,
    path: DEMO_ROUTE,
    at: AT,
    faction: 'striders',
    username: '@voce.demo',
    city: 'Goiânia',
    privacyZones: [DEMO_HOME],
    seed: 11,
    isDemo: true,
    ...over,
  };
}

describe('resumo → entrada do card', () => {
  it('data local sem hora; status oficial; zonas e pontos do resumo', () => {
    const { input, notice } = buildShareRunInput(source());
    expect(input.date).toEqual({ year: 2026, month: 10, day: 23 });
    expect(Object.keys(input.date)).toEqual(['year', 'month', 'day']); // nada de hora
    expect(input.status).toBe('valid');
    expect(input.points).toBe(183);
    expect(input.zones.map((z) => z.outcome)).toEqual(['conquered', 'influence']);
    expect(input.route.mode).toBe('route');
    expect(notice).toBeNull();
  });

  it('resumo ainda não confirmado vira "provisório" (só o card Corrida, sem pontos)', () => {
    const { input } = buildShareRunInput(source({ official: false }));
    expect(input.status).toBe('provisional');
    expect(pickCardModels(input).kinds).toEqual(['run']);
  });

  it('sem as zonas de privacidade (sem internet), a rota não sai e há aviso', () => {
    const { input, notice } = buildShareRunInput(source({ privacyZones: null }));
    expect(input.route.mode).toBe('noRoute');
    expect(input.route.pieces).toHaveLength(0);
    expect(notice).toBe(PRIVACY_NOTICE_NO_ZONES);
    expect(buildCarousel(input).every((m) => !('route' in m) || m.route === null)).toBe(true);
  });

  it('o mais raro primeiro quando o resumo traz chefão e nível', () => {
    const { input } = buildShareRunInput(
      source({
        level: { reached: 8, xpToNext: 1900, progressToNext: 0.1, totals: { meters: 86000, zones: 14, runs: 23 } },
        boss: { name: 'Mormaço de Outubro', defeated: true, myDamageMeters: 6300, cityName: 'Goiânia', cityMeters: 3_600_000, days: 5 },
      }),
    );
    expect(pickCardModels(input).kinds).toEqual(['boss', 'level', 'zone', 'run']);
  });

  it('propriedade (300 casos): nenhum ponto do card dentro de uma zona de privacidade', () => {
    forAll(
      (r) => {
        const k = r.int(0, DEMO_ROUTE.length - 1);
        const zones = Array.from({ length: r.int(1, 3) }, () => ({ ...offset(DEMO_ROUTE[r.int(0, DEMO_ROUTE.length - 1)], r.float(0, 120), r.float(0, 360)), radiusM: r.float(50, 400) }));
        return { zones, seed: r.int(0, 2 ** 31), home: k };
      },
      ({ zones, seed }) => {
        const { input } = buildShareRunInput(source({ privacyZones: zones, seed }));
        for (const piece of input.route.pieces) for (const p of piece) for (const z of zones) expect(distanceMeters(p, z)).toBeGreaterThan(z.radiusM);
      },
      300,
    );
  }, 60_000);

  it('semente de 32 bits', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.999999999)).toBeLessThanOrEqual(0xffffffff);
    expect(cardDateOf(AT)).toEqual({ year: 2026, month: 10, day: 23 });
  });
});

describe('legenda', () => {
  it('conquista, cidade e o aviso de demonstração', () => {
    const { input } = buildShareRunInput(source());
    expect(shareCaption(input, { showCity: true })).toBe('Corri 2,02 km e conquistei Jardim Goiás no NOMADE RUN. Bora pintar Goiânia! (dados de demonstração)');
    expect(shareCaption(input, { showCity: false })).not.toContain('Goiânia');
  });

  it('provisória não promete conquista; chefão e nível têm frase própria', () => {
    const prov = buildShareRunInput(source({ official: false, isDemo: false })).input;
    expect(shareCaption(prov, { showCity: false })).toBe('Corri 2,02 km em 10:29 no NOMADE RUN.');
    const boss = buildShareRunInput(source({ isDemo: false, boss: { name: 'Mormaço', defeated: true, myDamageMeters: 2020, cityName: 'Goiânia', cityMeters: 1, days: 1 } })).input;
    expect(shareCaption(boss, { showCity: false })).toBe('Ajudei a derrubar Mormaço correndo 2,02 km no NOMADE RUN.');
    const level = buildShareRunInput(source({ isDemo: false, level: { reached: 8, xpToNext: 1, progressToNext: 0, totals: { meters: 1, zones: 1, runs: 1 } } })).input;
    expect(shareCaption(level, { showCity: false })).toBe('Cheguei ao nível 8 no NOMADE RUN com 2,02 km hoje.');
  });
});
