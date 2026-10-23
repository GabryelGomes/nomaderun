/**
 * T7.2.6 (E6a) — primeira abertura: quiz "Não sei escolher", "A cidade está dividida" e a missão de boas-vindas.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRanking = jest.fn<() => Promise<{ ok: true; data: { faction: string; zones: number }[] } | { ok: false; error: Error }>>();
jest.mock('@/services/api/leaderboard-repo', () => ({ getFactionRanking: () => mockRanking() }));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render } from '@/components/__tests__/render-helpers';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { MISSION_TEXT_MAX } from '@/domain/missions';

import { CITY_STEP_MS, cityDividedNodes, cityShares, DEMO_CITY_SHARES, percentages, regionPath, regionRadius } from '../city-divided';
import { CityDividedStep } from '../city-divided-step';
import { quizResult, TEAM_QUIZ } from '../quiz';
import { TeamQuiz } from '../team-quiz';
import { welcomeMissionCopy } from '../welcome-mission';
/* eslint-enable import/first */

const sum = (r: Record<FactionId, number>) => FACTION_IDS.reduce((n, f) => n + r[f], 0);

describe('quiz "Não sei escolher" (3 perguntas, 4 respostas, 1 por time)', () => {
  it('cada pergunta tem os 4 times, uma vez cada, com textos curtos (D-74)', () => {
    expect(TEAM_QUIZ).toHaveLength(3);
    for (const q of TEAM_QUIZ) {
      expect(q.options.map((o) => o.team).sort()).toEqual([...FACTION_IDS].sort());
      expect(q.title.length).toBeLessThanOrEqual(30);
      for (const o of q.options) expect(o.label.length).toBeLessThanOrEqual(40);
    }
  });

  it('a mesma posição não aponta sempre o mesmo time', () => {
    const first = TEAM_QUIZ.map((q) => q.options[0].team);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it('o mais votado vence; empate fica com a pergunta 1; sem respostas, nada', () => {
    expect(quizResult(['owls', 'owls', 'volt'])).toBe('owls');
    expect(quizResult(['volt', 'owls', 'owls'])).toBe('owls');
    expect(quizResult(['coyotes', 'striders', 'volt'])).toBe('coyotes');
    expect(quizResult([])).toBeNull();
  });

  it('todo conjunto de respostas sugere um time que alguém escolheu (nenhum time é imposto)', () => {
    for (const a of FACTION_IDS) for (const b of FACTION_IDS) for (const c of FACTION_IDS) expect([a, b, c]).toContain(quizResult([a, b, c]));
  });

  it('na tela: 3 toques levam à sugestão, "Ver os …" devolve o time e dá para responder de novo', () => {
    const picked: FactionId[] = [];
    const r = render(<TeamQuiz onPick={(t) => picked.push(t)} onClose={() => {}} />);
    expect(r.text()).toContain('1 de 3');
    r.press('onboarding-quiz-corrida-owls');
    r.press('onboarding-quiz-fim-owls');
    r.press('onboarding-quiz-superpoder-volt');
    expect(r.text()).toContain('Sugerimos os Night Owls');
    expect(r.text()).toContain('A escolha é sua.');
    r.press('onboarding-quiz-ver');
    expect(picked).toEqual(['owls']);
    r.press('onboarding-quiz-refazer');
    expect(r.text()).toContain('1 de 3');
  });
});

describe('"A cidade está dividida" (D-72)', () => {
  it('porcentagens inteiras que somam 100', () => {
    expect(sum(percentages({ striders: 1, volt: 1, owls: 1, coyotes: 0 }))).toBe(100);
    expect(percentages({ striders: 10, volt: 30, owls: 40, coyotes: 20 })).toEqual({ striders: 10, volt: 30, owls: 40, coyotes: 20 });
    for (let i = 0; i < 200; i++) {
      const c = { striders: (i * 7) % 13, volt: (i * 3) % 11, owls: (i * 5) % 17, coyotes: i % 5 };
      const p = percentages(c);
      if (sum(c) > 0) expect(sum(p)).toBe(100);
      for (const f of FACTION_IDS) expect(p[f]).toBeGreaterThanOrEqual(0);
    }
  });

  it('dado do servidor vira "servidor"; sem zonas (ou sem dado) vira a divisão de exemplo marcada', () => {
    expect(cityShares([{ faction: 'owls', zones: 3 }, { faction: 'volt', zones: 1 }])).toEqual({ shares: { striders: 0, volt: 25, owls: 75, coyotes: 0 }, source: 'servidor' });
    expect(cityShares([])).toEqual({ shares: DEMO_CITY_SHARES, source: 'demonstracao' });
    expect(cityShares(null).source).toBe('demonstracao');
    expect(sum(DEMO_CITY_SHARES)).toBe(100);
  });

  it('regiões arredondadas (curvas, nunca hexágonos) e área que cresce com a fatia', () => {
    const d = regionPath(100, 100, 40, [1, 1, 1, 1, 1, 1, 1, 1]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/Q /g) ?? []).length).toBe(8);
    expect(d).not.toMatch(/ L /);
    expect(regionRadius(40)).toBeGreaterThan(regionRadius(20));
    expect(regionRadius(0)).toBeGreaterThan(0);
    // ruas + (preenchimento, traço, forma) por time
    expect(cityDividedNodes(DEMO_CITY_SHARES)).toHaveLength(1 + 3 * FACTION_IDS.length);
  });

  describe('tela', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    const flush = async () => {
      await act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
      });
    };

    it('mostra a fatia de cada time e passa sozinha para os times em até 6 s', async () => {
      mockRanking.mockResolvedValue({ ok: true, data: [{ faction: 'striders', zones: 2 }, { faction: 'coyotes', zones: 2 }] });
      const next = jest.fn();
      const r = render(<CityDividedStep onNext={next} />);
      await flush();
      expect(r.text()).toContain('A cidade está dividida');
      expect(r.host('onboarding-cidade-striders').props.accessibilityLabel).toBe('Neon Striders: 50% das zonas');
      expect(r.has('onboarding-cidade-demonstracao')).toBe(false);
      act(() => {
        jest.advanceTimersByTime(CITY_STEP_MS - 1);
      });
      expect(next).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('sem dado do servidor, a divisão de exemplo vem com o selo "Demonstração"', async () => {
      mockRanking.mockResolvedValue({ ok: false, error: new Error('offline') });
      const r = render(<CityDividedStep onNext={() => {}} />);
      await flush();
      expect(r.has('onboarding-cidade-demonstracao')).toBe(true);
      expect(r.host('onboarding-cidade-striders').props.accessibilityLabel).toBe(`Neon Striders: ${DEMO_CITY_SHARES.striders}% das zonas`);
    });
  });
});

describe('missão de boas-vindas (D-72)', () => {
  it('vem do catálogo da E7, cabe no limite e mostra o progresso honesto (Conta ✓ · Time ✓ · Correr)', () => {
    const m = welcomeMissionCopy();
    expect(m.title).toBe('Corra 500 m e pinte sua 1ª zona');
    expect(m.title.length).toBeLessThanOrEqual(MISSION_TEXT_MAX);
    expect(m.steps).toEqual(['Conta', 'Time', 'Correr 500 m']);
    expect(m.done).toBe(2);
  });
});
