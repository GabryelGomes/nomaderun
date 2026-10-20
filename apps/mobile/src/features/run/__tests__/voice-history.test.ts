import { describe, expect, it, jest } from '@jest/globals';

import type { ActivitySummary } from '@/services/api/activities-repo';
import type { LocalRun } from '@/store/game-store';

import { mergeHistory, periodStart } from '../history-model';
import { officialSummary, simplifyPath, invalidReasons } from '../summary-model';
import { createVoiceGuide } from '../voice-guide';

describe('Guia por voz (RF-025)', () => {
  const names = { striders: 'Neon Striders', coyotes: 'Urban Coyotes', owls: 'Night Owls', volt: 'Volt Runners' } as const;

  it('quilômetro com ritmo, uma vez por km', () => {
    const say = jest.fn();
    const g = createVoiceGuide(say, (f) => names[f]);
    g.distance(999, 300);
    g.distance(1001, 312);
    g.distance(1500, 312);
    g.distance(2004, Infinity);
    expect(say.mock.calls.map((c) => c[0])).toEqual(['1 quilômetro. Ritmo 5 e 12.', '2 quilômetros.']);
  });

  it('"Território dos {facção}" ao entrar em zona rival, sem repetir na mesma zona', () => {
    const say = jest.fn();
    const g = createVoiceGuide(say, (f) => names[f]);
    g.zone('z1', 'coyotes', 'striders');
    g.zone('z1', 'coyotes', 'striders');
    g.zone('z2', 'striders', 'striders');
    g.zone('z3', null, 'striders');
    g.zone('z1', 'coyotes', 'striders');
    expect(say.mock.calls.map((c) => c[0])).toEqual(['Território dos Urban Coyotes.', 'Território dos Urban Coyotes.']);
  });

  it('fantasma a cada 100 m de diferença', () => {
    const say = jest.fn();
    const g = createVoiceGuide(say, (f) => names[f]);
    for (const gap of [250, 230, 199, 150, 99, 20, -10, -120, -90]) g.ghost(gap);
    expect(say.mock.calls.map((c) => c[0])).toEqual([
      'O fantasma está se aproximando: 100 metros atrás.',
      'O fantasma está chegando: menos de 100 metros.',
      'O fantasma está 100 metros à frente.',
      'Lado a lado com o fantasma.',
    ]);
  });
});

const official = (status: 'valid' | 'review' | 'rejected' = 'valid') =>
  officialSummary({
    activityId: 'x',
    status,
    meters: 1000,
    movingSeconds: 300,
    avgPace: 300,
    rpTotal: 50,
    xp: 10,
    flags: ['NO_PEDOMETER', 'VEHICLE_SUSPECTED'],
    invalidSegments: [{ fromSeq: 3, toSeq: 9, code: 'VEHICLE_SUSPECTED', reason: 'Velocidade de veículo por mais de 30 segundos. O trecho não conta.' }],
    zones: [{ zoneId: '89a8c0000000fff', name: '', meters: 300, rp: 50, outcome: 'conquered', ownerBefore: null, ownerAfter: 'owls' }],
    newFogCells: 2,
    beatGhost: null,
    trust: 90,
    review: null,
  });

describe('resumo e histórico', () => {
  it('nome vazio do servidor vira "Zona XXXX"; trechos inválidos sem repetir', () => {
    const s = official();
    expect(s.zones[0].name).toBe('Zona 0000');
    expect(invalidReasons(s)).toEqual(['Velocidade de veículo por mais de 30 segundos. O trecho não conta.']);
  });

  it('percurso simplificado mantém início e fim', () => {
    const path = Array.from({ length: 2000 }, (_, i) => ({ lat: i, lng: -i }));
    const s = simplifyPath(path, 100);
    expect(s).toHaveLength(100);
    expect(s[0]).toEqual([0, -0]);
    expect(s[99]).toEqual([1999, -1999]);
  });

  it('servidor + fila local, sem repetir, com filtro por período (RF-006)', () => {
    const now = Date.UTC(2026, 9, 20);
    const server: ActivitySummary[] = [
      { id: 'a', status: 'valid', mission: 'livre', startedAt: now - 2 * 86_400_000, endedAt: null, meters: 5000, movingSeconds: 1500, avgPace: 300, rpTotal: 100, xp: 50, flags: [], result: null },
      { id: 'b', status: 'review', mission: 'caca', startedAt: now - 40 * 86_400_000, endedAt: null, meters: 3000, movingSeconds: 900, avgPace: 300, rpTotal: 0, xp: 0, flags: [], result: null },
    ];
    const local: LocalRun[] = [
      { id: 'a', state: 'synced', mission: 'livre', startedAt: now - 2 * 86_400_000, endedAt: null, simulated: true, summary: official(), path: [], error: null },
      { id: 'c', state: 'pending', mission: 'fuga', startedAt: now - 3600_000, endedAt: null, simulated: false, summary: official(), path: [], error: null },
      { id: 'd', state: 'recording', mission: 'livre', startedAt: now, endedAt: null, simulated: false, summary: null, path: [], error: null },
    ];
    const week = mergeHistory(server, local, periodStart('7d', now));
    expect(week.map((h) => [h.id, h.tag, h.simulated])).toEqual([
      ['c', 'provisorio', false],
      ['a', null, true],
    ]);
    expect(week.find((h) => h.id === 'c')?.counts).toBe(false);
    const all = mergeHistory(server, local, periodStart('tudo', now));
    expect(all.map((h) => h.id)).toEqual(['c', 'a', 'b']);
    expect(all[2].tag).toBe('revisao');
    expect(periodStart('ano', now)).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('rota da Simulação', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { simulationRoute, nearestNeutral, DEFAULT_SIM_DETOUR } = require('../simulation') as typeof import('../simulation');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateActivity } = require('@/domain/anti-cheat') as typeof import('@/domain/anti-cheat');

  it('sem saltos nem velocidade de veículo, com ou sem desvio (a corrida simulada é válida)', () => {
    for (const detour of [DEFAULT_SIM_DETOUR, { lat: -16.70157, lng: -49.25038 }, null]) {
      const route = simulationRoute(detour);
      const v = validateActivity(route.map((p, i) => ({ ...p, t: i * 1000, accuracy: 5, steps: 3 })));
      expect(v.status).toBe('valid');
    }
  });

  it('desvio vai até a zona neutra mais próxima (ignora donas e bloqueadas)', () => {
    const z = (id: string, owner: 'owls' | null, blocked = false) => ({ id, owner, blocked, influence: { striders: 0, coyotes: 0, owls: 0, volt: 0 }, shield: 0, attackStartedAt: null, attacker: null });
    expect(nearestNeutral({})).toBeNull();
    expect(nearestNeutral({ '89a8c0ce2cbffff': z('89a8c0ce2cbffff', 'owls') })).toBeNull();
    expect(nearestNeutral({ '89a8c0ce2cbffff': z('89a8c0ce2cbffff', null, true) })).toBeNull();
    expect(nearestNeutral({ '89a8c0ce2cbffff': z('89a8c0ce2cbffff', null) })).not.toBeNull();
  });
});
