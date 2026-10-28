/**
 * E6a (onda 3, T7.3.1): contas puras de "Você" e das Corridas, e o agrupamento das notificações por dia.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() }, Stack: { Screen: () => null } }));

/* eslint-disable import/first */
import { brtCalendar } from '@/domain/progression';
import { dayGroupOf, groupByDay } from '@/features/notifications/notifications-screen';

import { conqueredZones, initialsOf, medalShelf, runBadges, runsThisWeek, weekKm } from '../profile-screen.model';

// Sexta-feira, 23/10/2026, 9h em Brasília.
const NOW = brtCalendar.at('2026-10-23', 9);
const at = (day: string, hour = 7) => brtCalendar.at(day, hour);

describe('medalShelf', () => {
  it('sem nada: 4 medalhas bloqueadas, 0 de 4', () => {
    const s = medalShelf({ runs: 0, zones: 0, atlasCells: 0, streakWeeks: 0 });
    expect(s.earned).toBe(0);
    expect(s.total).toBe(4);
    expect(s.medals.every((m) => m.locked)).toBe(true);
  });
  it('níveis por degrau e conquistadas primeiro (nível mais alto antes)', () => {
    const s = medalShelf({ runs: 12, zones: 0, atlasCells: 2500, streakWeeks: 2 });
    expect(s.earned).toBe(3);
    expect(s.medals.map((m) => [m.kind, m.tier, m.locked])).toEqual([
      ['explorador', 3, false],
      ['primeiros-passos', 2, false],
      ['sequencia', 1, false],
      ['conquistador', 1, true],
    ]);
  });
  it('valor inválido conta como zero', () => {
    expect(medalShelf({ runs: Number.NaN, zones: -3, atlasCells: 0, streakWeeks: 0 }).earned).toBe(0);
  });
});

describe('weekKm e runsThisWeek', () => {
  const history = [
    { startedAt: at('2026-10-19'), meters: 5000, tag: null, counts: true }, // segunda
    { startedAt: at('2026-10-23', 6), meters: 3200, tag: null, counts: true }, // hoje
    { startedAt: at('2026-10-23', 7), meters: 1000, tag: 'rejeitada' as const, counts: false },
    { startedAt: at('2026-10-18'), meters: 9000, tag: null, counts: true }, // domingo anterior
  ];
  it('soma por dia de segunda a domingo, sem rejeitadas nem a semana passada', () => {
    const w = weekKm(history, NOW);
    expect(w.today).toBe(4);
    expect(w.days).toEqual([5, 0, 0, 0, 3.2, 0, 0]);
    expect(w.total).toBeCloseTo(8.2);
  });
  it('conta só as corridas válidas desta semana', () => {
    expect(runsThisWeek(history, NOW)).toBe(2);
  });
});

describe('cards e cartão', () => {
  it('zonas conquistadas das corridas oficiais', () => {
    expect(conqueredZones([{ result: { zones: [{ outcome: 'conquered' }, { outcome: 'defended' }] } }, { result: null }])).toBe(1);
  });
  it('selos: estado do envio primeiro e no máximo 3', () => {
    const b = runBadges({ rp: 1130, tag: 'revisao', simulated: true }, { zones: [{ outcome: 'conquered' }, { outcome: 'conquered' }], beatGhost: true }, (t) => `[${t}]`);
    expect(b).toEqual(['[revisao]', 'simulada', '2 zonas']);
    expect(runBadges({ rp: 497, tag: null, simulated: false }, null, String)).toEqual(['+497 pontos']);
  });
  it('iniciais do avatar', () => {
    expect(initialsOf('voce.demo')).toBe('VD');
    expect(initialsOf('ana')).toBe('AN');
    expect(initialsOf('  ')).toBe('?');
  });
});

describe('notificações por dia', () => {
  it('hoje, ontem, esta semana e antes (em Brasília)', () => {
    expect(dayGroupOf(at('2026-10-23', 1), NOW)).toBe('Hoje');
    expect(dayGroupOf(at('2026-10-22', 23), NOW)).toBe('Ontem');
    expect(dayGroupOf(at('2026-10-17'), NOW)).toBe('Esta semana');
    expect(dayGroupOf(at('2026-10-16'), NOW)).toBe('Antes');
  });
  it('mantém a ordem e tira os grupos vazios', () => {
    const items = [{ createdAt: at('2026-10-23') }, { createdAt: at('2026-10-10') }, { createdAt: at('2026-10-23', 5) }];
    expect(groupByDay(items, NOW).map((g) => [g.group, g.items.length])).toEqual([
      ['Hoje', 2],
      ['Antes', 1],
    ]);
  });
});
