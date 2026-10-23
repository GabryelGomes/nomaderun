/**
 * T7.1.14 — orquestrador de celebrações (parte pura): ordem pico-fim, limites (1 épica, 3 médias, grupo),
 * tempos, vibrações com ≥ 150 ms, teto do resumo, movimento reduzido, leitor de tela e "Pular".
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  cubicBezier: (...p: number[]) => ({ css: p }),
  linear: (...p: number[]) => ({ linear: p }),
  Easing: { bezier: (...p: number[]) => ({ factory: p }), bezierFn: () => (t: number) => t, linear: (t: number) => t },
}));

/* eslint-disable import/first */
import { floodScale, hpPercent, oddsLabel, rankOffsets, RARITY_COLORS, scaleDelay } from '../choreography';
import {
  a11ySummary,
  A11Y_MAX_ITEMS,
  defaultLevel,
  joinPt,
  MOMENT_RANK,
  MOMENT_SPECS,
  momentState,
  nextStepAt,
  planCelebrations,
  skipHaptic,
  skipTo,
  spaceHaptics,
  startedCount,
  type CelebrationEvent,
  type CelebrationPlan,
} from '../queue';
import { celebration, celebrationLevels, durations, HAPTIC_MIN_GAP_MS } from '@/theme/motion';
/* eslint-enable import/first */

const zone = (id: string, name = id): CelebrationEvent => ({ id, kind: 'zone-captured', level: 'medium', label: `conquistou ${name}`, payload: { zone: name, faction: 'owls', points: 120 } });
const chest = (id: string, rarity: 'comum' | 'raro' | 'lendario'): CelebrationEvent => ({
  id,
  kind: 'chest',
  level: defaultLevel({ kind: 'chest', payload: { rarity, xp: 40 } }),
  label: `abriu um baú ${rarity}`,
  payload: { rarity, xp: 40 },
});
const hit = (id: string): CelebrationEvent => ({ id, kind: 'boss-hit', level: 'small', label: 'causou 8,4 km de dano no chefão', payload: { boss: 'Mormaço', damageKm: 8.4, hpBefore: 1200, hpAfter: 1191.6, hpMax: 3600 } });
const level = (id: string, n = 7): CelebrationEvent => ({ id, kind: 'level-up', level: 'epic', label: `chegou ao nível ${n}`, payload: { level: n } });
const defeated = (id: string): CelebrationEvent => ({ id, kind: 'boss-defeated', level: 'epic', label: 'derrotou o chefão', payload: { boss: 'Mormaço', city: 'Goiânia', myKm: 42.3 } });
const xp = (id: string): CelebrationEvent => ({ id, kind: 'xp', level: 'small', label: 'ganhou 215 XP', payload: { gained: 215, from: 0.7, to: 1 } });
const streak = (id: string): CelebrationEvent => ({ id, kind: 'streak', level: 'small', label: 'manteve a sequência', payload: { weeks: 4, state: 'kept' } });
const pr = (id: string): CelebrationEvent => ({ id, kind: 'personal-record', level: 'medium', label: 'bateu um recorde', payload: { metric: '5 km', value: '24:10' } });

const FULL = { reduced: false, screenReader: false } as const;

function gaps(plan: CelebrationPlan) {
  const out: number[] = [];
  for (let i = 1; i < plan.haptics.length; i++) out.push(plan.haptics[i].atMs - plan.haptics[i - 1].atMs);
  return out;
}

describe('planCelebrations — ordem e limites', () => {
  it('pico-fim: pequenas primeiro, médias depois, a épica por último', () => {
    const plan = planCelebrations([level('n'), zone('z'), hit('h'), chest('c', 'raro'), xp('x')], FULL);
    expect(plan.mode).toBe('full');
    expect(plan.moments.map((m) => m.id)).toEqual(['h', 'x', 'z', 'c', 'n']);
    expect(plan.moments.map((m) => m.level)).toEqual(['small', 'small', 'medium', 'medium', 'epic']);
  });

  it('no máximo 1 épica: fica a de maior peso; as outras viram média', () => {
    const plan = planCelebrations([level('n'), defeated('d'), chest('c', 'lendario')], FULL);
    const epics = plan.moments.filter((m) => m.level === 'epic');
    expect(epics.map((m) => m.id)).toEqual(['d']);
    expect(plan.moments[plan.moments.length - 1].id).toBe('d');
    expect(plan.moments.find((m) => m.id === 'n')?.level).toBe('medium');
  });

  it('no máximo 3 médias; o excedente vira um momento agrupado antes das médias', () => {
    const plan = planCelebrations([zone('a'), zone('b'), zone('c'), zone('d'), zone('e'), pr('p'), hit('h')], FULL);
    const mediums = plan.moments.filter((m) => m.level === 'medium');
    expect(mediums).toHaveLength(celebration.maxMedium);
    const group = plan.moments.find((m) => m.kind === 'group');
    expect(group).toBeDefined();
    expect(group?.events.map((e) => e.id)).toEqual(['c', 'd', 'e']);
    expect(group?.id).toBe('grupo:c+d+e');
    // o PR pesa mais que as zonas: fica com o lugar mais perto do fim
    expect(mediums.map((m) => m.id)).toEqual(['a', 'b', 'p']);
    expect(plan.moments.map((m) => m.kind)).toEqual(['boss-hit', 'group', 'zone-captured', 'zone-captured', 'personal-record']);
  });

  it('nunca mais de 1 épica nem de 3 médias, para qualquer mistura (propriedade)', () => {
    const makers = [zone, (id: string) => chest(id, 'lendario'), (id: string) => chest(id, 'comum'), hit, level, defeated, xp, streak, pr];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 200; run++) {
      const n = 1 + Math.floor(rnd() * 12);
      const events = Array.from({ length: n }, (_, i) => makers[Math.floor(rnd() * makers.length)](`e${run}-${i}`));
      const plan = planCelebrations(events, FULL);
      expect(plan.moments.filter((m) => m.level === 'epic').length).toBeLessThanOrEqual(1);
      expect(plan.moments.filter((m) => m.level === 'medium').length).toBeLessThanOrEqual(3);
      // todo evento aparece exatamente uma vez
      expect(plan.moments.flatMap((m) => m.events.map((e) => e.id)).sort()).toEqual(events.map((e) => e.id).sort());
      // momentos em sequência, sem sobreposição, com o respiro
      for (let i = 1; i < plan.moments.length; i++) expect(plan.moments[i].startMs).toBe(plan.moments[i - 1].endMs + celebration.gapMs);
      for (const g of gaps(plan)) expect(g).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
      expect(plan.totalMs).toBeLessThanOrEqual(celebration.summaryBudgetMs + MOMENT_SPECS['boss-defeated'].full);
      // a épica (se houver) é a última
      const epicIdx = plan.moments.findIndex((m) => m.level === 'epic');
      if (epicIdx >= 0) expect(epicIdx).toBe(plan.moments.length - 1);
    }
  });

  it('sem eventos: plano vazio', () => {
    const plan = planCelebrations([], { ...FULL, startAtMs: 500 });
    expect(plan.moments).toEqual([]);
    expect(plan.totalMs).toBe(500);
    expect(plan.announcement).toBe('');
  });
});

describe('planCelebrations — tempos', () => {
  it('começa em startAtMs; durações do catálogo limitadas ao teto do nível', () => {
    const plan = planCelebrations([hit('h'), zone('z')], { ...FULL, startAtMs: 2700 });
    expect(plan.moments[0]).toMatchObject({ startMs: 2700, durationMs: MOMENT_SPECS['boss-hit'].full, compact: false });
    const z = plan.moments[1];
    expect(z.startMs).toBe(2700 + 800 + celebration.gapMs);
    // zona completa = 1600 ms > teto da média (1500): versão curta
    expect(z.durationMs).toBe(Math.min(MOMENT_SPECS['zone-captured'].full, celebrationLevels.medium.maxMs));
    expect(z.compact).toBe(true);
    expect(plan.totalMs).toBe(z.endMs);
  });

  it('baú comum (pequena) usa a versão curta dentro do teto da pequena', () => {
    const plan = planCelebrations([chest('c', 'comum')], FULL);
    expect(plan.moments[0].durationMs).toBeLessThanOrEqual(celebrationLevels.small.maxMs);
    expect(plan.moments[0].compact).toBe(true);
  });

  it('vibrações nos tempos do catálogo (baú: leve, médio, forte a cada 200 ms + sucesso)', () => {
    const plan = planCelebrations([chest('c', 'raro')], FULL);
    const m = plan.moments[0];
    expect(m.durationMs).toBe(MOMENT_SPECS.chest.full > celebrationLevels.medium.maxMs ? celebrationLevels.medium.maxMs : MOMENT_SPECS.chest.full);
    const scale = m.durationMs / MOMENT_SPECS.chest.full;
    expect(plan.haptics.map((h) => h.pattern)).toEqual(['tap', 'impact', 'heavy', 'success']);
    expect(plan.haptics.map((h) => h.atMs)).toEqual([0, 200, 400, 750].map((t) => Math.round(t * scale)));
    for (const g of gaps(plan)) expect(g).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
    expect(m.haptics).toEqual(plan.haptics);
  });

  it('teto do resumo: encurta, depois agrupa as pequenas', () => {
    const many = [hit('h1'), xp('x1'), streak('s1'), hit('h2'), xp('x2'), streak('s3'), zone('z1'), zone('z2'), pr('p'), level('n')];
    const loose = planCelebrations(many, { ...FULL, budgetMs: 100_000 });
    expect(loose.moments.some((m) => m.kind === 'group')).toBe(false);
    const tight = planCelebrations(many, FULL);
    expect(tight.totalMs).toBeLessThanOrEqual(celebration.summaryBudgetMs);
    expect(tight.moments.some((m) => m.kind === 'group')).toBe(true);
    expect(tight.moments.filter((m) => m.level !== 'epic').every((m) => m.compact)).toBe(true);
    // ninguém some: todos os eventos continuam no plano
    expect(tight.moments.flatMap((m) => m.events).length).toBe(many.length);
  });

  it('com excedente de médias e teto apertado, as pequenas entram no grupo que já existe', () => {
    const events = [hit('h'), xp('x'), zone('a'), zone('b'), zone('c'), zone('d')];
    const plan = planCelebrations(events, { ...FULL, budgetMs: 4000 });
    const groups = plan.moments.filter((m) => m.kind === 'group');
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.id)).toEqual(expect.arrayContaining(['d', 'h']));
  });

  it('só pequenas acima do teto: viram um grupo no fim', () => {
    const smalls = Array.from({ length: 8 }, (_, i) => hit(`h${i}`));
    const plan = planCelebrations(smalls, { ...FULL, budgetMs: 2000 });
    expect(plan.totalMs).toBeLessThanOrEqual(2000);
    expect(plan.moments[plan.moments.length - 1].kind).toBe('group');
    expect(plan.moments.flatMap((m) => m.events)).toHaveLength(8);
  });

  it('teto impossível: tudo vira versão curta, inclusive a épica', () => {
    const plan = planCelebrations([zone('a'), level('n')], { ...FULL, budgetMs: 10 });
    expect(plan.moments.every((m) => m.compact)).toBe(true);
    expect(plan.moments[plan.moments.length - 1].durationMs).toBe(MOMENT_SPECS['level-up'].compact);
  });

  it('respiro configurável e start negativo vira 0', () => {
    const plan = planCelebrations([hit('a'), hit('b')], { ...FULL, gapMs: 0, startAtMs: -50 });
    expect(plan.moments[0].startMs).toBe(0);
    expect(plan.moments[1].startMs).toBe(plan.moments[0].endMs);
  });
});

describe('spaceHaptics — nunca em cascata', () => {
  it('a mais forte vence dentro da janela; a mais fraca some', () => {
    expect(
      spaceHaptics([
        { atMs: 0, pattern: 'tap' },
        { atMs: 100, pattern: 'success' },
        { atMs: 120, pattern: 'selection' },
        { atMs: 400, pattern: 'impact' },
      ]),
    ).toEqual([
      { atMs: 100, pattern: 'success' },
      { atMs: 400, pattern: 'impact' },
    ]);
  });

  it('a mais forte assume o lugar sem colar na anterior (entrada fora de ordem)', () => {
    const out = spaceHaptics([
      { atMs: 200, pattern: 'error' },
      { atMs: 0, pattern: 'tap' },
      { atMs: 150, pattern: 'tap' },
    ]);
    expect(out).toEqual([
      { atMs: 0, pattern: 'tap' },
      { atMs: 200, pattern: 'error' },
    ]);
    for (let i = 1; i < out.length; i++) expect(out[i].atMs - out[i - 1].atMs).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
  });
});

describe('movimento reduzido e leitor de tela', () => {
  it('reduzido: fades de 150 ms em cascata de 60 ms e 1 vibração (a do maior nível)', () => {
    const plan = planCelebrations([zone('z'), hit('h'), level('n')], { reduced: true, screenReader: false, startAtMs: 100 });
    expect(plan.mode).toBe('reduced');
    expect(plan.moments.map((m) => m.startMs)).toEqual([100, 160, 220]);
    for (const m of plan.moments) expect(m.durationMs).toBe(durations.reducedFade);
    expect(plan.haptics).toEqual([{ atMs: 100, pattern: celebrationLevels.epic.haptic }]);
    expect(plan.moments[0].haptics).toEqual(plan.haptics);
    expect(plan.totalMs).toBe(220 + durations.reducedFade);
  });

  it('reduzido sem eventos: nenhuma vibração', () => {
    const plan = planCelebrations([], { reduced: true, screenReader: false });
    expect(plan.haptics).toEqual([]);
    expect(plan.totalMs).toBe(0);
  });

  it('leitor de tela: nada roteirizado, nenhuma vibração e 1 anúncio com tudo', () => {
    const plan = planCelebrations([zone('z', 'Setor Bueno'), chest('c', 'raro'), level('n')], { reduced: false, screenReader: true, intro: 'Corrida concluída: 8,42 km em 47 minutos.' });
    expect(plan.mode).toBe('screen-reader');
    expect(plan.haptics).toEqual([]);
    for (const m of plan.moments) expect(m.durationMs).toBe(0);
    expect(plan.totalMs).toBe(0);
    expect(plan.announcement).toBe('Corrida concluída: 8,42 km em 47 minutos. Você conquistou Setor Bueno, abriu um baú raro e chegou ao nível 7.');
  });
});

describe('a11ySummary e joinPt', () => {
  it('lista em português, com "e" antes do último', () => {
    expect(joinPt([])).toBe('');
    expect(joinPt(['a'])).toBe('a');
    expect(joinPt(['a', 'b'])).toBe('a e b');
    expect(joinPt(['a', 'b', 'c'])).toBe('a, b e c');
  });

  it('sem conquistas, só a introdução; frases vazias são ignoradas', () => {
    expect(a11ySummary([], 'Corrida concluída.')).toBe('Corrida concluída.');
    expect(a11ySummary([{ label: '  ' }])).toBe('');
    expect(a11ySummary([{ label: 'conquistou A' }])).toBe('Você conquistou A.');
  });

  it(`mais de ${A11Y_MAX_ITEMS} conquistas: o resto vira "mais N conquistas"`, () => {
    const ev = Array.from({ length: 9 }, (_, i) => ({ label: `fez ${i}` }));
    expect(a11ySummary(ev)).toBe('Você fez 0, fez 1, fez 2, fez 3, fez 4 e mais 4 conquistas.');
  });
});

describe('skipTo, estados e "Pular"', () => {
  const plan = planCelebrations([hit('h'), zone('z'), level('n')], FULL);
  const [a, b, c] = plan.moments;

  it('estado de cada momento no tempo', () => {
    expect(momentState(a, a.startMs - 1)).toBe('waiting');
    expect(momentState(a, a.startMs)).toBe('playing');
    expect(momentState(a, a.endMs)).toBe('done');
  });

  it('no meio do 2º: o 1º terminou, o 2º toca, o 3º espera', () => {
    expect(skipTo(plan, b.startMs + 10)).toEqual({ finishedIds: ['h'], currentId: 'z', pendingIds: ['n'] });
    expect(skipTo(plan, 0)).toEqual({ finishedIds: [], currentId: 'h', pendingIds: ['z', 'n'] });
    expect(skipTo(plan, plan.totalMs)).toEqual({ finishedIds: ['h', 'z', 'n'], currentId: null, pendingIds: [] });
  });

  it('próximo passo e contagem de passos iniciados', () => {
    expect(nextStepAt(plan, 0)).toBe(b.startMs);
    expect(nextStepAt(plan, b.startMs)).toBe(c.startMs);
    expect(nextStepAt(plan, c.startMs)).toBe(plan.totalMs);
    const starts = plan.moments.map((m) => m.startMs);
    expect(startedCount(starts, -1)).toBe(0);
    expect(startedCount(starts, b.startMs)).toBe(2);
  });

  it('"Pular" vibra sucesso só se ainda havia média/épica por mostrar', () => {
    expect(skipHaptic(plan, 0)).toBe('success');
    expect(skipHaptic(plan, plan.totalMs)).toBeNull();
    const smalls = planCelebrations([hit('h'), xp('x')], FULL);
    expect(skipHaptic(smalls, 0)).toBeNull();
    expect(skipHaptic(planCelebrations([zone('z')], { reduced: false, screenReader: true }), 0)).toBeNull();
  });
});

describe('defaultLevel e catálogo', () => {
  it('níveis sugeridos por tipo', () => {
    expect(defaultLevel({ kind: 'chest', payload: { rarity: 'comum', xp: 1 } })).toBe('small');
    expect(defaultLevel({ kind: 'chest', payload: { rarity: 'raro', xp: 1 } })).toBe('medium');
    expect(defaultLevel({ kind: 'chest', payload: { rarity: 'lendario', xp: 1 } })).toBe('epic');
    expect(defaultLevel({ kind: 'level-up', payload: { level: 2 } })).toBe('epic');
    expect(defaultLevel({ kind: 'boss-defeated', payload: { boss: 'x', city: 'y', myKm: 1 } })).toBe('epic');
    expect(defaultLevel({ kind: 'team-confirm', payload: { faction: 'volt' } })).toBe('epic');
    expect(defaultLevel({ kind: 'zone-captured', payload: { zone: 'z', faction: 'volt', points: 1 } })).toBe('medium');
    expect(defaultLevel({ kind: 'league-up', payload: { position: 1, previous: 3 } })).toBe('medium');
    expect(defaultLevel({ kind: 'medal', payload: { name: 'x' } })).toBe('medium');
    expect(defaultLevel({ kind: 'personal-record', payload: { metric: 'x', value: 'y' } })).toBe('medium');
    expect(defaultLevel({ kind: 'xp', payload: { gained: 1, from: 0, to: 1 } })).toBe('small');
  });

  it('todo tipo tem duração (curta ≤ completa), peso e vibrações dentro da duração', () => {
    for (const [kind, spec] of Object.entries(MOMENT_SPECS)) {
      expect(spec.compact).toBeLessThanOrEqual(spec.full);
      expect(MOMENT_RANK[kind as keyof typeof MOMENT_RANK]).toBeGreaterThanOrEqual(0);
      for (const h of spec.haptics) expect(h.offsetMs).toBeLessThan(spec.full);
    }
  });
});

describe('coreografias (contas puras)', () => {
  it('a cor do time cobre a tela a partir do botão', () => {
    // botão no centro de baixo de um iPhone 15 (393 × 852)
    const s = floodScale({ x: 196.5, y: 780 }, 393, 852, 100);
    const radius = (s * 100) / 2;
    expect(radius).toBeGreaterThanOrEqual(Math.hypot(196.5, 780));
    expect(floodScale({ x: 0, y: 0 }, 10, 10, 0)).toBe(1);
    expect(floodScale({ x: 5, y: 5 }, 10, 10, 1000)).toBe(1);
  });

  it('versão curta encolhe os atrasos na proporção', () => {
    expect(scaleDelay(1000, false, 0.5)).toBe(1000);
    expect(scaleDelay(1000, true, 0.5)).toBe(500);
    expect(scaleDelay(1000, true, 3)).toBe(1000);
    expect(scaleDelay(1000, true, Number.NaN)).toBe(1000);
  });

  it('chances visíveis e vida em %', () => {
    expect(oddsLabel({ comum: 0.7, raro: 0.25, lendario: 0.05 })).toBe('Chances: comum 70% · raro 25% · lendário 5%');
    expect(oddsLabel({ comum: 2, raro: -1, lendario: 0.004 })).toBe('Chances: comum 100% · raro 0% · lendário 0%');
    expect(hpPercent(1104, 3600)).toBe(31);
    expect(hpPercent(10, 0)).toBe(0);
    expect(hpPercent(Number.NaN, 10)).toBe(0);
    expect(hpPercent(20, 10)).toBe(100);
  });

  it('raridade: o raro não usa o violeta dos vilões (D-67)', () => {
    expect(Object.values(RARITY_COLORS)).not.toContain('#B15CFF');
  });

  it('ranking posicionado só por translateY', () => {
    expect(rankOffsets(['a', 'b', 'c'], 48)).toEqual({ a: 0, b: 48, c: 96 });
  });
});
