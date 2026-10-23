/**
 * T7.2.3 — versão completa da simulação de regressão do território (a do Jest é a amostra pequena):
 * a regra REAL (`applyPaint`) no bairro de 271 zonas da F1 e no de 91 zonas do teste, 3 sementes, times
 * equilibrados e desequilibrados. Grava `resultados/regressao.{md,json}`.
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/regressao.ts
 *
 * Alvos (D-62): novato iniciante que conquista na 1ª corrida ≥ 50%; zonas eternas ≤ 15%; custo para tomar ≤ 1,5 km.
 * O motor é o mesmo do teste `apps/mobile/src/domain/__tests__/territory-sim.test.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  simulateTerritory,
  syntheticNeighborhood,
  type SimMetrics,
  type SimScenario,
} from '../../../../../apps/mobile/src/domain/__tests__/sim/territorio-sim';
import { AQUI } from './base';

const SEEDS = [1, 2, 3];
const PROBES = { routes: 40, everyDays: 4 };
const CENARIOS: { nome: string; rings: number; teams: NonNullable<SimScenario['teams']> }[] = [
  { nome: 'Teste do Jest (91 zonas) · times equilibrados', rings: 5, teams: 'equilibrados' },
  { nome: 'Bairro da F1 (271 zonas) · times equilibrados', rings: 9, teams: 'equilibrados' },
  { nome: 'Bairro da F1 (271 zonas) · times desequilibrados (45/30/15/10%)', rings: 9, teams: 'desequilibrados' },
];

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
const km = (m: number) => `${(m / 1000).toFixed(2).replace('.', ',')} km`;
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function main() {
  const saida: Record<string, SimMetrics[]> = {};
  let md = `# Regressão do território v2 (regra real: \`applyPaint\`)\n\nGerado por \`regressao.ts\` (sementes ${SEEDS.join(', ')}; 4 semanas de aquecimento + 8 medidas; densidade 90 veteranos por 271 zonas; sondas do novato: ${PROBES.routes} primeiras corridas hipotéticas a cada ${PROBES.everyDays} dias medidos).\n\n`;
  md += '| Cenário | Novato na 1ª corrida (sondas) | … nos primeiros 1 km | Novatos (agentes) na 1ª corrida | Novatos que nunca conquistaram | Zonas eternas | Giro semanal | Custo para tomar (mediana) |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
  for (const c of CENARIOS) {
    const map = syntheticNeighborhood(c.rings);
    const ms: SimMetrics[] = [];
    for (const seed of SEEDS) {
      const t = Date.now();
      ms.push(simulateTerritory({ seed, rings: c.rings, density: 90, teams: c.teams, probes: PROBES }, map));
      process.stderr.write(`${c.nome} · semente ${seed}: ${((Date.now() - t) / 1000).toFixed(1)} s\n`);
    }
    saida[c.nome] = ms;
    const probes = ms.reduce((s, m) => s + m.probes, 0);
    const novatos = ms.reduce((s, m) => s + m.newcomers, 0);
    const pond = (f: (m: SimMetrics) => number, w: (m: SimMetrics) => number, tot: number) => ms.reduce((s, m) => s + f(m) * w(m), 0) / tot;
    md += `| ${c.nome} | ${pct(pond((m) => m.probeFirstRun, (m) => m.probes, probes))} | ${pct(pond((m) => m.probeFirstKm, (m) => m.probes, probes))} | ${pct(pond((m) => m.newcomerFirstRun, (m) => m.newcomers, novatos))} (${novatos}) | ${pct(pond((m) => m.newcomerNever, (m) => m.newcomers, novatos))} | ${pct(media(ms.map((m) => m.eternal)))} | ${pct(media(ms.map((m) => m.weeklyTurnover)))} | ${km(media(ms.map((m) => m.costToTakeMedianM)))} |\n`;
  }
  const dir = resolve(AQUI, 'resultados');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'regressao.json'), JSON.stringify(saida, null, 2));
  writeFileSync(resolve(dir, 'regressao.md'), md);
  console.log(md);
}

main();
