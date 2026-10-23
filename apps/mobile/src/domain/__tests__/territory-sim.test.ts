/**
 * @jest-environment node
 *
 * T7.2.3 / T7.3.6 — a simulação do território como TESTE DE REGRESSÃO (roda na CI).
 *
 * Corredores sintéticos jogam 4 semanas de aquecimento + 8 semanas medidas num bairro de 91 zonas, com a
 * regra REAL da pintura (`applyPaint`, desbotar e virada de temporada — `sim/paint-sim.ts`). Se uma mudança
 * no domain estragar o equilíbrio do jogo (D-62), este teste quebra mostrando os números.
 *
 * Alvos (PLANO-MESTRE §0 e relatório da E3 na F1):
 *  - novato iniciante que conquista na 1ª corrida ≥ 50%;
 *  - zonas "eternas" (mesmo dono nas 8 semanas medidas) ≤ 15%;
 *  - custo mediano para 1 rival tomar uma zona ≤ 1,5 km dentro dela.
 *
 * O "novato na 1ª corrida" é medido por sondas: a cada 4 dias medidos, 40 primeiras corridas hipotéticas de
 * novatos iniciantes (3 km, casa e time sorteados) são aplicadas ao mapa do momento sem gravar nada — 560
 * amostras por semente, em vez dos ~7 novatos de verdade que caberiam num bairro pequeno.
 *
 * Amostra pequena e sementes fixas: os números são sempre os mesmos (~10 s). A versão completa (271 zonas,
 * 3 sementes, times desequilibrados) é `docs/melhoria/F1/jogo/sim/regressao.ts`.
 */
import { describe, expect, it } from '@jest/globals';

import { simulateTerritory, syntheticNeighborhood, type SimMetrics } from './sim/territorio-sim';

const SEEDS = [1, 2, 3];
const RINGS = 5; // 91 zonas
const PROBES = { routes: 40, everyDays: 4 };

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

describe('simulação do território v2 (regressão do equilíbrio, D-62)', () => {
  const map = syntheticNeighborhood(RINGS);
  const runs: SimMetrics[] = SEEDS.map((seed) => simulateTerritory({ seed, rings: RINGS, density: 90, probes: PROBES }, map));

  const probes = runs.reduce((s, m) => s + m.probes, 0);
  const firstRun = runs.reduce((s, m) => s + m.probeFirstRun * m.probes, 0) / probes;
  const eternal = runs.reduce((s, m) => s + m.eternal, 0) / runs.length;
  const cost = runs.reduce((s, m) => s + m.costToTakeMedianM, 0) / runs.length;
  const newcomers = runs.reduce((s, m) => s + m.newcomers, 0);
  const never = runs.reduce((s, m) => s + m.newcomerNever * m.newcomers, 0) / newcomers;
  const summary = runs
    .map(
      (m, i) =>
        `semente ${SEEDS[i]}: novato na 1ª corrida ${pct(m.probeFirstRun)} (${m.probes} sondas; agentes ${pct(m.newcomerFirstRun)} de ${m.newcomers}), ` +
        `eternas ${pct(m.eternal)}, custo ${m.costToTakeMedianM} m, giro semanal ${pct(m.weeklyTurnover)}, ${m.runs} corridas`,
    )
    .join('\n');
  const explain = (what: string) => `${what}\n${summary}`;

  it('a amostra é de verdade: 91 zonas, mais de 3 mil corridas, 1.680 sondas e o mapa ocupado', () => {
    expect(map.zones).toHaveLength(91);
    expect(runs.reduce((s, m) => s + m.runs, 0)).toBeGreaterThan(3000);
    expect(probes).toBe(SEEDS.length * PROBES.routes * 14);
    for (const m of runs) expect(m.owned).toBeGreaterThan(0.5);
  });

  it('novato iniciante que conquista na 1ª corrida ≥ 50%', () => {
    if (firstRun < 0.5) throw new Error(explain(`novato na 1ª corrida = ${pct(firstRun)} (alvo ≥ 50%)`));
    expect(firstRun).toBeGreaterThanOrEqual(0.5);
  });

  it('zonas eternas (mesmo dono nas 8 semanas) ≤ 15%', () => {
    if (eternal > 0.15) throw new Error(explain(`zonas eternas = ${pct(eternal)} (alvo ≤ 15%)`));
    expect(eternal).toBeLessThanOrEqual(0.15);
  });

  it('custo mediano para 1 rival tomar uma zona ≤ 1,5 km', () => {
    if (cost > 1500) throw new Error(explain(`custo para tomar = ${cost} m (alvo ≤ 1.500 m)`));
    expect(cost).toBeLessThanOrEqual(1500);
  });

  it('ninguém fica sem chance: no máximo 10% dos novatos passam as 8 semanas sem conquistar, e o mapa gira', () => {
    if (never > 0.1) throw new Error(explain(`novatos que nunca conquistaram = ${pct(never)}`));
    for (const m of runs) expect(m.weeklyTurnover).toBeGreaterThan(0.1);
  });
});
