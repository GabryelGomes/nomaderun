/**
 * T7.2.7 (E6b) — Mapa v2: faixa de hoje, espaço único de alerta, "o que mudou desde ontem" e missão de
 * boas-vindas. Regra principal: sem dado verdadeiro, o bloco não existe.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { pickAlert } from '@/components/alert-slot';
import { DEFENSE_WINDOW_MS, newZone, type Zone } from '@/domain/territory';

import { changesSinceYesterday, changesText, defenseEndsAt, expiredAttackKey, mapAlerts, todayChips, welcomeMission, zonesUnderAttack } from '../map-screen.model';
/* eslint-enable import/first */

const NOW = Date.UTC(2026, 9, 23, 12);
const HOUR = 3600_000;
const z = (id: string, patch: Partial<Zone> = {}): Zone => ({ ...newZone(id), ...patch });

describe('todayChips (faixa de hoje)', () => {
  it('sem dado nenhum: nada (a faixa some)', () => {
    expect(todayChips(null, 0)).toEqual([]);
    expect(todayChips({}, 0)).toEqual([]);
  });

  it('a sequência v1 do servidor (semanas) aparece enquanto a v2 da E7 não chega', () => {
    expect(todayChips(null, 3)).toEqual([expect.objectContaining({ key: 'streak', value: '3', label: 'semanas' })]);
    expect(todayChips(null, 1)[0].label).toBe('semana');
  });

  it('com o hook da E7: sequência "1/2", baú do dia com créditos e chefão em violeta', () => {
    const chips = todayChips({ streak: { done: 1, goal: 2 }, chest: { credits: 2 }, boss: { name: 'Soneca', hp: 0.364 } }, 5);
    expect(chips.map((c) => [c.key, c.value, c.tone])).toEqual([
      ['streak', '1/2', 'action'],
      ['chest', '2', 'action'], // T7.3.2: "2 Baús" (o "2× Baú do dia" cortava na faixa de 3 chips)
      ['boss', '36%', 'villain'],
    ]);
    expect(chips.map((c) => c.testID)).toEqual(['mapa-hoje-sequencia', 'mapa-hoje-bau', 'mapa-hoje-chefao']);
  });

  it('baú sem crédito não aparece (não promete o que não existe)', () => {
    expect(todayChips({ chest: { credits: 0 } }, 0)).toEqual([]);
  });
});

describe('alerta único com prioridade', () => {
  const names = { zoneName: (id: string) => `Zona ${id}`, attackerName: () => 'Night Owls' };

  it('ataque só dentro da janela (isUnderAttackAt), o mais recente primeiro, com a hora em que a defesa fecha', () => {
    const zones = {
      a: z('a', { owner: 'striders', attacker: 'owls', attackStartedAt: NOW - 2 * HOUR }),
      b: z('b', { owner: 'striders', attacker: 'owls', attackStartedAt: NOW - HOUR }),
      velho: z('velho', { owner: 'striders', attacker: 'owls', attackStartedAt: NOW - DEFENSE_WINDOW_MS - 1 }),
      rival: z('rival', { owner: 'volt', attacker: 'owls', attackStartedAt: NOW - HOUR }),
    };
    const attacked = zonesUnderAttack(zones, 'striders', NOW);
    expect(attacked.map((x) => x.id)).toEqual(['b', 'a']);
    const alerts = mapAlerts({ attacked, ...names, timeZone: 'America/Sao_Paulo' });
    expect(alerts[0]).toMatchObject({ kind: 'attack', zoneId: 'b', title: 'Zona b sob ataque' });
    expect(alerts[0].body).toBe(`Night Owls · dobro até ${defenseEndsAt(zones.b, 'America/Sao_Paulo')}`);
    expect(defenseEndsAt(zones.b, 'America/Sao_Paulo')).toBe('08:00');
  });

  it('ordem: ataque > missão > baú > chefão > sequência; o AlertSlot mostra 1', () => {
    const today = {
      mission: { id: 'm', title: 'Corra 1 km', steps: ['a', 'b'], done: 0 },
      chest: { credits: 1, meters: 604 },
      boss: { name: 'Soneca', hp: 0.18 },
      streak: { done: 1, goal: 2, atRisk: true },
    };
    const all = mapAlerts({ attacked: [], ...names, today });
    expect(all.map((a) => a.kind)).toEqual(['mission', 'chest', 'boss', 'streak']);
    expect(all.find((a) => a.kind === 'chest')?.title).toBe('Baú do dia a 600 m');
    expect(all.find((a) => a.kind === 'boss')?.title).toBe('Soneca com 18% de vida');
    expect(all.find((a) => a.kind === 'streak')?.title).toBe('1 corrida mantém a sequência');
    const slot = all.map((a) => ({ ...a, onPress: () => {} }));
    expect(pickAlert(slot)?.kind).toBe('mission');
  });

  it('sem os gatilhos verdadeiros, nada: baú longe, chefão com vida, sequência fora de risco, missão concluída', () => {
    const today = {
      mission: { id: 'm', title: 'x', steps: ['a'], done: 1 },
      chest: { credits: 1, meters: 2400 },
      boss: { name: 'Soneca', hp: 0.5 },
      streak: { done: 2, goal: 2, atRisk: true },
    };
    expect(mapAlerts({ attacked: [], ...names, today })).toEqual([]);
  });
});

describe('"o que mudou desde ontem"', () => {
  it('conta as conquistas e perdas das últimas 24 h; sem nada, não aparece', () => {
    const items = [
      { type: 'conquest' as const, createdAt: NOW - HOUR },
      { type: 'conquest' as const, createdAt: NOW - 3 * HOUR },
      { type: 'territory_lost' as const, createdAt: NOW - 5 * HOUR },
      { type: 'conquest' as const, createdAt: NOW - 30 * HOUR },
      { type: 'invasion' as const, createdAt: NOW - HOUR },
    ];
    const c = changesSinceYesterday(items, NOW);
    expect(c).toEqual({ gained: 2, lost: 1 });
    expect(changesText(c!)).toBe('Desde ontem: +2 zonas · 1 perdida');
    expect(changesSinceYesterday([{ type: 'invasion', createdAt: NOW }], NOW)).toBeNull();
    expect(changesText({ gained: 1, lost: 0 })).toBe('Desde ontem: +1 zona');
  });
});

describe('missão de boas-vindas (D-72)', () => {
  it('só quando o servidor confirmou que não há nenhuma corrida', () => {
    expect(welcomeMission(null)).toBeNull();
    expect(welcomeMission(3)).toBeNull();
    expect(welcomeMission(0)).toMatchObject({ done: 2, steps: ['Conta', 'Time', '1ª corrida'] });
  });
});

describe('ataque vencido sai do desenho', () => {
  it('a assinatura muda só quando um ataque vence', () => {
    const zones = { a: z('a', { attackStartedAt: NOW - HOUR, attacker: 'volt', owner: 'owls' }), b: z('b') };
    expect(expiredAttackKey(zones, NOW)).toBe('');
    expect(expiredAttackKey(zones, NOW + DEFENSE_WINDOW_MS)).toBe('a');
  });
});
