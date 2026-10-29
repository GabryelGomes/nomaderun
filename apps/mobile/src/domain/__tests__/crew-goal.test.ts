/**
 * D-88 — meta semanal de km da crew (mesma conta do `private.crew_week_goal_m` do servidor, pgTAP 30).
 */
import { describe, expect, it } from '@jest/globals';

import { CREW_GOAL_MAX_KM, CREW_GOAL_MIN_KM, crewWeekGoalMeters, crewWeekProgress } from '../crew-goal';
import { forAll } from './prop';

describe('meta semanal da crew', () => {
  it('10 km por membro, piso 20 km, teto 300 km (os mesmos valores do pgTAP 30)', () => {
    expect([-5, 0, 1, 2, 3, 12, 30, 31].map(crewWeekGoalMeters)).toEqual([20000, 20000, 20000, 20000, 30000, 120000, 300000, 300000]);
    expect(crewWeekGoalMeters(Number.NaN)).toBe(CREW_GOAL_MIN_KM * 1000);
    expect(crewWeekGoalMeters(2.9)).toBe(20000);
  });

  it('progresso entre 0 e 1; valores inválidos contam 0', () => {
    expect(crewWeekProgress(8000, 20000)).toBe(0.4);
    expect(crewWeekProgress(50000, 20000)).toBe(1);
    expect(crewWeekProgress(-1, 20000)).toBe(0);
    expect(crewWeekProgress(Number.NaN, 20000)).toBe(0);
    expect(crewWeekProgress(1000, 0)).toBe(0);
  });

  it('propriedade: a meta não diminui com mais membros e fica no intervalo', () => {
    forAll(
      (r) => r.int(0, 40),
      (n) => {
        const g = crewWeekGoalMeters(n);
        expect(g).toBeGreaterThanOrEqual(CREW_GOAL_MIN_KM * 1000);
        expect(g).toBeLessThanOrEqual(CREW_GOAL_MAX_KM * 1000);
        expect(crewWeekGoalMeters(n + 1)).toBeGreaterThanOrEqual(g);
      },
    );
  });
});
