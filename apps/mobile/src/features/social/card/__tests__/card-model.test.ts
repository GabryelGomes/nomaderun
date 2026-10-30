/** T7.1.9 — modelo do card (puro): textos, privacidade (data sem hora, @ e cidade opcionais) e casos de borda. */
import { describe, expect, it } from '@jest/globals';

import { clipRouteForSharing } from '@/domain/share-privacy';

import {
  buildBossCard,
  buildCardModel,
  buildLevelCard,
  buildRunCard,
  buildWeekCard,
  buildZoneCard,
  cardDateLabel,
  DEFAULT_CARD_CHOICES,
  featuredZone,
  formatThousands,
  weekdayOf,
} from '../card-model';
import { DEMO_ROUTE, demoRunInput, demoSharedRoute, demoWeekInput } from './fixtures';

const all = { withRoute: true, showCity: true, showUsername: true };

describe('datas e números', () => {
  it('dia da semana sem relógio nem fuso', () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 23 })).toBe(5); // sexta
    expect(weekdayOf({ year: 2025, month: 10, day: 23 })).toBe(4); // quinta
    expect(weekdayOf({ year: 2024, month: 2, day: 29 })).toBe(4);
    expect(weekdayOf({ year: 2000, month: 1, day: 1 })).toBe(6);
  });

  it('rótulo da data sem hora, com a cidade só quando permitido', () => {
    expect(cardDateLabel({ year: 2026, month: 10, day: 23 }, 'Goiânia', true)).toBe('SEXTA · 23 OUT · GOIÂNIA');
    expect(cardDateLabel({ year: 2026, month: 10, day: 23 }, 'Goiânia', false)).toBe('SEXTA · 23 OUT');
    expect(cardDateLabel({ year: 2026, month: 11, day: 1 }, '   ', true)).toBe('DOMINGO · 1 NOV');
    expect(cardDateLabel({ year: 2026, month: 3, day: 3 }, null, true)).toBe('TERÇA · 3 MAR');
  });

  it('milhar com ponto', () => {
    expect(formatThousands(3600)).toBe('3.600');
    expect(formatThousands(1_234_567.4)).toBe('1.234.567');
    expect(formatThousands(-1200)).toBe('-1.200');
    expect(formatThousands(12)).toBe('12');
  });
});

describe('card Corrida', () => {
  it('textos certos com os dados de demonstração', () => {
    const m = buildRunCard(demoRunInput(), all);
    expect(m).toMatchObject({ kind: 'run', km: '2,02', time: '10:29', pace: '5:12', points: '+183', zonesChip: '1 zona conquistada · 3 reforçadas', dateLabel: 'SEXTA · 23 OUT · GOIÂNIA', username: '@gabryel', statusTag: null, isDemo: true });
    expect(m.route?.mode).toBe('route');
    expect(m.a11yLabel).toBe('Card de corrida: 2,02 quilômetros, 10 minutos e 29 segundos, ritmo 5:12 por quilômetro, +183 pontos, 1 zona conquistada · 3 reforçadas.');
  });

  it('padrão: sem @ e com cidade; "Mostrar rota" desligado tira a rota', () => {
    expect(buildRunCard(demoRunInput()).username).toBeNull();
    expect(buildRunCard(demoRunInput(), { ...DEFAULT_CARD_CHOICES, withRoute: false }).route).toBeNull();
    expect(buildRunCard(demoRunInput({ username: '  @@ana ' }), all).username).toBe('@ana');
    expect(buildRunCard(demoRunInput({ username: null }), all).username).toBeNull();
  });

  it('rota "sem rota" vira arte sem rota', () => {
    const none = clipRouteForSharing(DEMO_ROUTE.slice(0, 2), [], { seed: 1 });
    expect(buildRunCard(demoRunInput({ route: none })).route).toBeNull();
  });

  it('provisória e em revisão: sem pontos e com selo', () => {
    const p = buildRunCard(demoRunInput({ status: 'provisional' }));
    expect(p.points).toBeNull();
    expect(p.statusTag).toBe('PROVISÓRIO');
    expect(p.a11yLabel).not.toContain('pontos');
    expect(buildRunCard(demoRunInput({ status: 'review' })).statusTag).toBe('EM REVISÃO');
    expect(buildRunCard(demoRunInput({ status: 'partial' })).points).toBe('+183');
  });

  it('ficha de zonas: só conquista, só reforço, nenhuma', () => {
    const z = demoRunInput().zones;
    expect(buildRunCard(demoRunInput({ zones: [z[0], { ...z[0], name: 'B' }] })).zonesChip).toBe('2 zonas conquistadas');
    expect(buildRunCard(demoRunInput({ zones: [z[1]] })).zonesChip).toBe('1 zona reforçada');
    expect(buildRunCard(demoRunInput({ zones: [z[1], z[2]] })).zonesChip).toBe('2 zonas reforçadas');
    expect(buildRunCard(demoRunInput({ zones: [z[0], z[1]] })).zonesChip).toBe('1 zona conquistada · 1 reforçada');
    expect(buildRunCard(demoRunInput({ zones: [{ ...z[0], outcome: 'none' }] })).zonesChip).toBeNull();
    expect(buildRunCard(demoRunInput({ zones: [] })).a11yLabel).toBe('Card de corrida: 2,02 quilômetros, 10 minutos e 29 segundos, ritmo 5:12 por quilômetro, +183 pontos.');
  });

  it('leitura de duração longa e zerada', () => {
    expect(buildRunCard(demoRunInput({ movingSeconds: 3725, meters: 10_000 })).a11yLabel).toContain('1 hora, 2 minutos e 5 segundos');
    expect(buildRunCard(demoRunInput({ movingSeconds: 7200, meters: 10_000 })).a11yLabel).toContain('2 horas,');
    expect(buildRunCard(demoRunInput({ movingSeconds: 0, meters: 0 })).a11yLabel).toContain('0 segundos, ritmo --:--');
    expect(buildRunCard(demoRunInput({ points: -5 })).points).toBe('-5');
  });
});

describe('card Conquista de zona', () => {
  it('escolhe a conquista de mais pontos e monta "de → para"', () => {
    const z = demoRunInput().zones;
    const zones = [z[0], { ...z[0], name: 'Vila Nova', rp: 80, ownerBefore: null }];
    expect(featuredZone(zones)?.name).toBe('Vila Nova');
    const m = buildZoneCard(demoRunInput({ zones }));
    expect(m).toMatchObject({ kind: 'zone', zoneName: 'Vila Nova', from: null, to: 'striders', points: '+80', statsLine: '2,02 km · 10:29 · 5:12 /km' });
    expect(m?.a11yLabel).toContain('Vila Nova para Neon Striders');
    const d = buildZoneCard(demoRunInput());
    expect(d).toMatchObject({ zoneName: 'Jardim Goiás', from: 'coyotes', points: '+46' });
    expect(d?.a11yLabel).toContain('tomada de Urban Coyotes');
  });

  it('sem conquista não tem card; nome vazio vira "Zona"; dono igual não aparece como "de"', () => {
    const z = demoRunInput().zones;
    expect(buildZoneCard(demoRunInput({ zones: [z[1]] }))).toBeNull();
    expect(featuredZone([])).toBeNull();
    const m = buildZoneCard(demoRunInput({ zones: [{ ...z[0], name: '  ', ownerBefore: 'striders' }] }));
    expect(m?.zoneName).toBe('Zona');
    expect(m?.from).toBeNull();
    expect(buildZoneCard(demoRunInput({ zones: [{ ...z[0], ownerAfter: null }] }))).toBeNull();
  });
});

describe('card Nível novo', () => {
  it('textos e totais', () => {
    const m = buildLevelCard(demoRunInput());
    expect(m).toMatchObject({ kind: 'level', level: 8, headline: 'Cheguei ao nível 8', next: 'Faltam 1.900 XP para o nível 9', progress: 0.05 });
    expect(m?.totals).toEqual([
      { value: '86', label: 'KM NO TOTAL' },
      { value: '14', label: 'ZONAS' },
      { value: '23', label: 'CORRIDAS' },
    ]);
  });

  it('sem nível não tem card; progresso fica entre 0 e 1', () => {
    expect(buildLevelCard(demoRunInput({ level: null }))).toBeNull();
    expect(buildLevelCard(demoRunInput({ level: { reached: 0, xpToNext: 1, progressToNext: 0, totals: { meters: 0, zones: 0, runs: 0 } } }))).toBeNull();
    const lv = demoRunInput().level!;
    expect(buildLevelCard(demoRunInput({ level: { ...lv, progressToNext: 3 } }))?.progress).toBe(1);
    expect(buildLevelCard(demoRunInput({ level: { ...lv, progressToNext: -1 } }))?.progress).toBe(0);
  });
});

describe('card Chefão derrotado', () => {
  it('textos certos', () => {
    expect(buildBossCard(demoRunInput())).toMatchObject({ kind: 'boss', bossName: 'Mormaço de Outubro', cityLine: 'Goiânia correu 3.600 km em 5 dias', damage: '6,3', crewChip: 'Flamboyant Runners · 1º lugar · 412 km' });
  });

  it('só quando o chefão caiu e a pessoa ajudou', () => {
    const b = demoRunInput().boss!;
    expect(buildBossCard(demoRunInput({ boss: null }))).toBeNull();
    expect(buildBossCard(demoRunInput({ boss: { ...b, defeated: false } }))).toBeNull();
    expect(buildBossCard(demoRunInput({ boss: { ...b, myDamageMeters: 0 } }))).toBeNull();
    const m = buildBossCard(demoRunInput({ boss: { ...b, crew: null, cityName: '', days: 1 } }));
    expect(m?.crewChip).toBeNull();
    expect(m?.cityLine).toBe('A cidade correu 3.600 km em 1 dia');
  });
});

describe('card Minha semana', () => {
  it('intervalo, barras, totais, sequência e mini-rotas', () => {
    const m = buildWeekCard(demoWeekInput(), all);
    expect(m).toMatchObject({ kind: 'week', rangeLabel: '19 – 25 OUT', dateLabel: '19 – 25 OUT', km: '12,4', streakChip: 'Sequência de 4 semanas', username: '@gabryel' });
    expect(m.bars.map((b) => b.label)).toEqual(['', '4,1', '', '3,6', '', '4,7', '']);
    expect(m.bars.map((b) => b.day).join('')).toBe('STQQSSD');
    expect(m.totals).toEqual([
      { value: '3', label: 'CORRIDAS' },
      { value: '1h04', label: 'EM MOVIMENTO' },
      { value: '4', label: 'ZONAS' },
    ]);
    expect(m.routes).toHaveLength(3);
    expect(m.a11yLabel).toBe('Card da semana 19 – 25 OUT: 12,4 quilômetros em 3 corridas.');
  });

  it('virada de mês e de ano; ano bissexto', () => {
    expect(buildWeekCard(demoWeekInput({ weekStart: { year: 2026, month: 10, day: 26 } })).rangeLabel).toBe('26 OUT – 1 NOV');
    expect(buildWeekCard(demoWeekInput({ weekStart: { year: 2026, month: 12, day: 28 } })).rangeLabel).toBe('28 DEZ – 3 JAN');
    expect(buildWeekCard(demoWeekInput({ weekStart: { year: 2028, month: 2, day: 24 } })).rangeLabel).toBe('24 FEV – 1 MAR');
    expect(buildWeekCard(demoWeekInput({ weekStart: { year: 2026, month: 2, day: 23 } })).rangeLabel).toBe('23 FEV – 1 MAR');
  });

  it('singular, menos de 1 hora, sem sequência, sem rota', () => {
    const none = clipRouteForSharing([], [], { seed: 0 });
    const m = buildWeekCard(demoWeekInput({ runs: 1, zones: 1, movingSeconds: 3000, streakWeeks: 1, routes: [none, demoSharedRoute(), demoSharedRoute(2), demoSharedRoute(3), demoSharedRoute(4)], dayMeters: [-5, 100] }));
    expect(m.totals.map((t) => `${t.value} ${t.label}`)).toEqual(['1 CORRIDA', '50 min EM MOVIMENTO', '1 ZONA']);
    expect(m.streakChip).toBeNull();
    expect(m.routes).toHaveLength(3);
    expect(m.bars[0].meters).toBe(0);
    expect(m.bars[6].meters).toBe(0);
    expect(buildWeekCard(demoWeekInput(), { ...DEFAULT_CARD_CHOICES, withRoute: false }).routes).toEqual([]);
  });
});

describe('buildCardModel', () => {
  it('encaminha cada tipo', () => {
    const input = demoRunInput();
    expect(buildCardModel('run', input)?.kind).toBe('run');
    expect(buildCardModel('zone', input)?.kind).toBe('zone');
    expect(buildCardModel('level', input)?.kind).toBe('level');
    expect(buildCardModel('boss', input)?.kind).toBe('boss');
  });
});
