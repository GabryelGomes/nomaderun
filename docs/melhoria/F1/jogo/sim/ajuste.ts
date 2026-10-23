/**
 * Ajuste fino da pintura (C): margem para virar o dono e "reforço na conquista".
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/ajuste.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { montarAgenda, type Cenario, type Corredor } from './agentes';
import { AQUI, mapaBairro271, mapaFlamboyant, type Grafo } from './base';
import { RegraAtual, RegraPintura, type Regra } from './regras';
import { metricas, simular, tabela } from './rodar';

const VARIANTES: { id: string; criar: (k: Corredor[]) => Regra }[] = [
  { id: 'A', criar: (k) => new RegraAtual(k) },
  { id: 'C', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true }) },
  { id: 'C+m2', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true, margem: 2 }) },
  { id: 'C+r', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true, reforcoConquista: true }) },
  { id: 'C+m2+r', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true, margem: 2, reforcoConquista: true }) },
];

type M = ReturnType<typeof metricas>;
const media = (xs: number[]) => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : xs[0];
};
function mediaDe(ms: M[]): M {
  const rec = (vals: unknown[]): unknown =>
    typeof vals[0] === 'number'
      ? media(vals as number[])
      : vals[0] && typeof vals[0] === 'object'
        ? Object.fromEntries(Object.keys(vals[0] as object).map((k) => [k, rec(vals.map((v) => (v as Record<string, unknown>)[k]))]))
        : vals[0];
  return rec(ms) as M;
}

const bairro = mapaBairro271();
const real = mapaFlamboyant();
const lista: { g: Grafo; times: Cenario['times']; densidade: number }[] = [
  { g: bairro, times: 'equilibrados', densidade: 90 },
  { g: bairro, times: 'desequilibrados', densidade: 90 },
  { g: bairro, times: 'equilibrados', densidade: 30 },
  { g: real, times: 'equilibrados', densidade: 90 },
];
let md = '# Ajuste fino da pintura (sementes 1, 2, 3)\n';
const saida: Record<string, Record<string, M>> = {};
for (const { g, times, densidade } of lista) {
  const por: Record<string, M[]> = {};
  for (const semente of [1, 2, 3]) {
    const agenda = montarAgenda(g, { semente, times, densidade });
    for (const v of VARIANTES) (por[v.id] ??= []).push(metricas(g, agenda, simular(g, agenda, v.criar(agenda.corredores))));
  }
  const chave = `${g.nome} · times ${times} · densidade ${densidade}`;
  saida[chave] = Object.fromEntries(Object.entries(por).map(([id, ms]) => [id, mediaDe(ms)]));
  md += tabela(`${chave} (${g.zonas.length} zonas)`, VARIANTES.map((v) => v.id), saida[chave]);
  process.stderr.write(`${chave} ok\n`);
}
const dir = resolve(AQUI, 'resultados');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'ajuste.md'), md);
writeFileSync(resolve(dir, 'ajuste.json'), JSON.stringify(saida, null, 2));
console.log(md);
