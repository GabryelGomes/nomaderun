/**
 * Economia de XP atual: quanto vem da Neblina (10 XP por célula nova) e quanto da distância (1 XP por 100 m),
 * semana a semana, com o `revealFog` do domain. Mostra o "XP que despenca" quando o bairro já foi revelado.
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/xp-neblina.ts
 */
import { FOG_XP_PER_CELL, revealFog, XP_PER_100M } from '../../../../../apps/mobile/src/domain/games';

import { montarAgenda, PERFIS, TOTAL_DIAS, type Perfil } from './agentes';
import { mapaBairro271 } from './base';

const g = mapaBairro271();
const { corredores, corridas } = montarAgenda(g, { semente: 1, times: 'equilibrados', densidade: 90 });
const revelado = corredores.map(() => new Set<string>());
const semanas = Math.ceil(TOTAL_DIAS / 7);
const xp: Record<Perfil, { fog: number[]; dist: number[]; n: number[] }> = {
  iniciante: { fog: Array(semanas).fill(0), dist: Array(semanas).fill(0), n: Array(semanas).fill(0) },
  regular: { fog: Array(semanas).fill(0), dist: Array(semanas).fill(0), n: Array(semanas).fill(0) },
  avancado: { fog: Array(semanas).fill(0), dist: Array(semanas).fill(0), n: Array(semanas).fill(0) },
};
for (const c of corridas) {
  const k = corredores[c.corredor];
  if (k.novato) continue;
  const novas = revealFog(c.rota.pontos, revelado[k.id]);
  for (const x of novas) revelado[k.id].add(x);
  const w = Math.floor(c.dia / 7);
  xp[k.perfil].fog[w] += novas.length * FOG_XP_PER_CELL;
  xp[k.perfil].dist[w] += Math.floor(c.rota.metros / 100) * XP_PER_100M;
  xp[k.perfil].n[w]++;
}
console.log('| Perfil | Semana | XP/corrida da Neblina | XP/corrida da distância | % do XP vindo da Neblina |');
console.log('|---|---:|---:|---:|---:|');
for (const p of Object.keys(PERFIS) as Perfil[]) {
  for (const w of [0, 1, 3, 7, 11]) {
    const n = xp[p].n[w] || 1;
    const f = xp[p].fog[w] / n;
    const d = xp[p].dist[w] / n;
    console.log(`| ${p} | ${w + 1} | ${f.toFixed(0)} | ${d.toFixed(0)} | ${((100 * f) / (f + d)).toFixed(0)}% |`);
  }
}
