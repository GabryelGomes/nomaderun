/**
 * Roda a simulação de território e imprime as tabelas (markdown) + grava resultados/*.json.
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/rodar.ts            # tudo (3 sementes, 2 mapas, 2 divisões de times)
 *   npx -y tsx docs/melhoria/F1/jogo/sim/rodar.ts --rapido   # 1 semente, só o bairro de 271 zonas
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FACTION_IDS, type FactionId } from '../../../../../apps/mobile/src/domain/types';

import { AQUECIMENTO_DIAS, montarAgenda, TOTAL_DIAS, VIRADAS_TEMPORADA, type Cenario, type Corredor, type Corrida, type Perfil } from './agentes';
import { AQUI, mapaBairro271, mapaFlamboyant, type Grafo } from './base';
import { RegraAtual, RegraBarra, RegraPintura, type Regra } from './regras';

const rapido = process.argv.includes('--rapido');

type Fabrica = { id: string; criar: (k: Corredor[]) => Regra };
export const REGRAS: Fabrica[] = [
  { id: 'A', criar: (k) => new RegraAtual(k) },
  { id: 'A0', criar: (k) => new RegraAtual(k, { decaimento: false }) },
  { id: 'B', criar: (k) => new RegraBarra(k) },
  { id: 'B300', criar: (k) => new RegraBarra(k, { CAP: 300, MIN: 60, NOVO: 1.5 }) },
  { id: 'C', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true }) },
  { id: 'C+p', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: true, protecaoH: 24 }) },
  { id: 'C0', criar: (k) => new RegraPintura(k, { miolo: false, azarao: false, desbotar: false }) },
  { id: 'D', criar: (k) => new RegraPintura(k, { miolo: true, azarao: false, desbotar: true }) },
  { id: 'D+az', criar: (k) => new RegraPintura(k, { miolo: true, azarao: true, desbotar: true }) },
];

const gini = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  const n = v.length;
  const s = v.reduce((a, b) => a + b, 0);
  if (n === 0 || s === 0) return 0;
  let acc = 0;
  v.forEach((x, i) => (acc += (2 * (i + 1) - n - 1) * x));
  return acc / (n * s);
};
const mediana = (xs: number[]) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function simular(g: Grafo, agenda: ReturnType<typeof montarAgenda>, regra: Regra) {
  const { corredores, corridas } = agenda;
  const zonas = g.zonas;
  const zIdx = new Map(zonas.map((z, i) => [z, i]));
  const porDia: Corrida[][] = Array.from({ length: TOTAL_DIAS }, () => []);
  for (const c of corridas) porDia[c.dia].push(c);
  // donos ao fim de cada dia (o que o jogador vê na manhã seguinte); -1 = neutra
  const snaps: Int8Array[] = [];
  const caps: { corrida: number; corredor: number; dia: number; zona: string; de: FactionId | null; marca: number }[] = [];
  const outros: { dia: number; zona: string }[] = [];
  for (let dia = 0; dia < TOTAL_DIAS; dia++) {
    for (const c of porDia[dia]) {
      const k = corredores[c.corredor];
      for (const cap of regra.correr(c, k)) {
        if (!zIdx.has(cap.zona)) continue;
        if (cap.para === k.time) caps.push({ corrida: c.idx, corredor: k.id, dia, zona: cap.zona, de: cap.de, marca: cap.marca });
        else outros.push({ dia, zona: cap.zona });
      }
    }
    regra.fimDoDia(dia, VIRADAS_TEMPORADA.includes(dia + 1));
    const s = new Int8Array(zonas.length);
    zonas.forEach((z, i) => {
      const o = regra.dono(z);
      s[i] = o ? FACTION_IDS.indexOf(o) : -1;
    });
    snaps.push(s);
  }
  return { caps, outros, snaps, credito: regra.credito(), custos: zonas.map((z) => regra.custoTomar(z)).filter((x): x is number => x !== null) };
}

export function metricas(g: Grafo, agenda: ReturnType<typeof montarAgenda>, r: ReturnType<typeof simular>) {
  const { corredores, corridas } = agenda;
  const Z = g.zonas.length;
  const ini = AQUECIMENTO_DIAS - 1; // snapshot do fim do aquecimento
  const semanas = 8;
  const fimSemana = (w: number) => ini + 7 * w; // w = 0..8

  // rotatividade: zonas cujo dono no fim da semana w difere do fim da semana w-1
  const giro: number[] = [];
  for (let w = 1; w <= semanas; w++) {
    const a = r.snaps[fimSemana(w - 1)];
    const b = r.snaps[fimSemana(w)];
    let n = 0;
    for (let i = 0; i < Z; i++) if (a[i] !== b[i]) n++;
    giro.push(n / Z);
  }
  // zonas eternas: mesmo dono (não neutro) em todos os fins de dia das 8 semanas medidas
  let eternas = 0;
  let longevas = 0;
  for (let i = 0; i < Z; i++) {
    const o = r.snaps[ini][i];
    let mesma = o >= 0;
    let run = 0;
    let best = 0;
    let prev = -2;
    for (let d = ini; d < TOTAL_DIAS; d++) {
      const v = r.snaps[d][i];
      if (v !== o) mesma = false;
      run = v >= 0 && v === prev ? run + 1 : v >= 0 ? 1 : 0;
      prev = v;
      best = Math.max(best, run);
    }
    if (mesma) eternas++;
    if (best >= 42) longevas++;
  }
  const fim = r.snaps[TOTAL_DIAS - 1];
  const porTime = FACTION_IDS.map((_, t) => fim.filter((v) => v === t).length);
  const donas = porTime.reduce((a, b) => a + b, 0);
  const jogadoresPorTime = FACTION_IDS.map((f) => corredores.filter((k) => k.time === f).length);
  const maior = jogadoresPorTime.indexOf(Math.max(...jogadoresPorTime));

  // retomada: perda (dono X → outro) com X dono de novo em até 7 dias
  let perdas = 0;
  let retomadas = 0;
  for (let i = 0; i < Z; i++) {
    for (let d = ini + 1; d < TOTAL_DIAS - 7; d++) {
      const x = r.snaps[d - 1][i];
      if (x >= 0 && r.snaps[d][i] !== x) {
        perdas++;
        for (let e = d + 1; e <= d + 7; e++) if (r.snaps[e][i] === x) (retomadas++, (e = 99999));
      }
    }
  }

  // jogadores
  const credito = new Map<number, number>();
  for (const k of r.credito.values()) credito.set(k, (credito.get(k) ?? 0) + 1);
  const ativos = corredores; // todos correram em algum momento
  const giniJog = gini(ativos.map((k) => credito.get(k.id) ?? 0));
  const comZona = (p: Perfil) => {
    const ks = ativos.filter((k) => k.perfil === p);
    return ks.filter((k) => (credito.get(k.id) ?? 0) > 0).length / ks.length;
  };

  // conquistas por corredor
  const corridasDe = new Map<number, Corrida[]>();
  for (const c of corridas) {
    const l = corridasDe.get(c.corredor) ?? [];
    l.push(c);
    corridasDe.set(c.corredor, l);
  }
  const capsDe = new Map<number, typeof r.caps>();
  for (const cp of r.caps) {
    const l = capsDe.get(cp.corredor) ?? [];
    l.push(cp);
    capsDe.set(cp.corredor, l);
  }
  // novatos chegando num mapa já ocupado
  const novatos = corredores.filter((k) => k.novato);
  const prim = novatos.map((k) => {
    const cs = corridasDe.get(k.id) ?? [];
    const cp = (capsDe.get(k.id) ?? [])[0];
    if (!cp) return { k, conquistou: false, dias: Infinity, corridas: Infinity, km: Infinity, naPrimeira: false, ate1km: false };
    const n = cs.findIndex((c) => c.idx === cp.corrida);
    const km = (cs.slice(0, n).reduce((s, c) => s + c.rota.metros, 0) + cp.marca) / 1000;
    return { k, conquistou: true, dias: cp.dia - k.entraDia, corridas: n + 1, km, naPrimeira: n === 0, ate1km: n === 0 && cp.marca <= 1000 };
  });
  const primPor = (p: Perfil) => prim.filter((x) => x.k.perfil === p);
  const resumoPrim = (xs: typeof prim) => ({
    n: xs.length,
    naPrimeira: xs.filter((x) => x.naPrimeira).length / (xs.length || 1),
    ate1km: xs.filter((x) => x.ate1km).length / (xs.length || 1),
    medianaKm: mediana(xs.map((x) => x.km)),
    medianaCorridas: mediana(xs.map((x) => x.corridas)),
    nunca: xs.filter((x) => !x.conquistou).length / (xs.length || 1),
  });

  // semanas com ≥ 1 conquista (todos os corredores ativos naquela semana)
  const semanaComVitoria = (p: Perfil) => {
    let tot = 0;
    let com = 0;
    for (const k of ativos.filter((x) => x.perfil === p)) {
      for (let w = 0; w < semanas; w++) {
        const d0 = AQUECIMENTO_DIAS + 7 * w;
        const correu = (corridasDe.get(k.id) ?? []).some((c) => c.dia >= d0 && c.dia < d0 + 7);
        if (!correu) continue;
        tot++;
        if ((capsDe.get(k.id) ?? []).some((c) => c.dia >= d0 && c.dia < d0 + 7)) com++;
      }
    }
    return com / (tot || 1);
  };
  const conquistasPorSemana = (p: Perfil) => {
    const ks = ativos.filter((x) => x.perfil === p);
    const n = r.caps.filter((c) => c.dia >= AQUECIMENTO_DIAS && corredores[c.corredor].perfil === p).length;
    return n / ks.length / semanas;
  };
  // conquista que evapora: a zona já não é do time quando o iniciante volta a correr
  let capsIni = 0;
  let evaporou = 0;
  for (const cp of r.caps) {
    if (cp.dia < AQUECIMENTO_DIAS || corredores[cp.corredor].perfil !== 'iniciante') continue;
    const prox = (corridasDe.get(cp.corredor) ?? []).find((c) => c.dia > cp.dia);
    const dia = prox ? prox.dia - 1 : cp.dia + 4;
    if (dia >= TOTAL_DIAS) continue;
    capsIni++;
    const zi = g.zonas.indexOf(cp.zona);
    if (r.snaps[dia][zi] !== FACTION_IDS.indexOf(corredores[cp.corredor].time)) evaporou++;
  }
  // de onde vêm as conquistas dos iniciantes: zona neutra ou tomada de rival
  const capsIniMed = r.caps.filter((c) => c.dia >= AQUECIMENTO_DIAS && corredores[c.corredor].perfil === 'iniciante');

  return {
    giroSemanal: media(giro),
    giroMin: Math.min(...giro),
    giroMax: Math.max(...giro),
    zonasComDono: donas / Z,
    eternas: eternas / Z,
    longevas: longevas / Z,
    parteMaiorTime: donas ? porTime[maior] / donas : 0,
    parteJogadoresMaiorTime: jogadoresPorTime[maior] / corredores.length,
    giniTimes: gini(porTime),
    giniJogadores: giniJog,
    comZona: { iniciante: comZona('iniciante'), regular: comZona('regular'), avancado: comZona('avancado') },
    semanaComVitoria: { iniciante: semanaComVitoria('iniciante'), regular: semanaComVitoria('regular'), avancado: semanaComVitoria('avancado') },
    conquistasPorSemana: { iniciante: conquistasPorSemana('iniciante'), regular: conquistasPorSemana('regular'), avancado: conquistasPorSemana('avancado') },
    novatoIniciante: resumoPrim(primPor('iniciante')),
    novatoRegular: resumoPrim(primPor('regular')),
    evaporaIniciante: capsIni ? evaporou / capsIni : NaN,
    iniciantesTomandoDeRival: capsIniMed.length ? capsIniMed.filter((c) => c.de !== null).length / capsIniMed.length : NaN,
    retomada7d: perdas ? retomadas / perdas : NaN,
    custoTomarMedianaM: mediana(r.custos),
    custoTomarAcima3km: r.custos.length ? r.custos.filter((x) => x > 3000).length / r.custos.length : NaN,
    corridas: corridas.length,
  };
}

type M = ReturnType<typeof metricas>;

function mediaDe(ms: M[]): M {
  const rec = (vals: unknown[]): unknown => {
    const v0 = vals[0];
    if (typeof v0 === 'number') {
      const nums = (vals as number[]).filter((x) => Number.isFinite(x));
      return nums.length ? media(nums) : (v0 as number);
    }
    if (v0 && typeof v0 === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v0)) out[k] = rec(vals.map((v) => (v as Record<string, unknown>)[k]));
      return out;
    }
    return v0;
  };
  return rec(ms) as M;
}

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : '—');
const num = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '∞');
const km = (m: number) => (Number.isFinite(m) ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : '—');

export function tabela(titulo: string, ids: string[], ms: Record<string, M>) {
  const linhas: [string, (m: M) => string][] = [
    ['Novato iniciante: conquista na 1ª corrida', (m) => pct(m.novatoIniciante.naPrimeira)],
    ['Novato iniciante: conquista nos primeiros 1 km', (m) => pct(m.novatoIniciante.ate1km)],
    ['Novato iniciante: km até a 1ª conquista (mediana)', (m) => num(m.novatoIniciante.medianaKm)],
    ['Novato iniciante: nunca conquistou', (m) => pct(m.novatoIniciante.nunca)],
    ['Novato regular: conquista na 1ª corrida', (m) => pct(m.novatoRegular.naPrimeira)],
    ['Semanas com ≥ 1 conquista — iniciante', (m) => pct(m.semanaComVitoria.iniciante)],
    ['Semanas com ≥ 1 conquista — regular', (m) => pct(m.semanaComVitoria.regular)],
    ['Semanas com ≥ 1 conquista — avançado', (m) => pct(m.semanaComVitoria.avancado)],
    ['Conquistas por semana — iniciante', (m) => num(m.conquistasPorSemana.iniciante)],
    ['Conquistas por semana — avançado', (m) => num(m.conquistasPorSemana.avancado)],
    ['Conquista do iniciante que já evaporou na volta', (m) => pct(m.evaporaIniciante)],
    ['Conquistas do iniciante tomadas de rival', (m) => pct(m.iniciantesTomandoDeRival)],
    ['Zonas que mudam de dono por semana (média)', (m) => `${pct(m.giroSemanal)} (${pct(m.giroMin)}–${pct(m.giroMax)})`],
    ['Zonas com dono no fim', (m) => pct(m.zonasComDono)],
    ['Zonas eternas (mesmo dono nas 8 semanas)', (m) => pct(m.eternas)],
    ['Zonas com ≥ 6 semanas seguidas no mesmo dono', (m) => pct(m.longevas)],
    ['Zona perdida retomada em ≤ 7 dias (defesa)', (m) => pct(m.retomada7d)],
    ['Custo para 1 rival tomar a zona (mediana, metros dentro dela)', (m) => km(m.custoTomarMedianaM)],
    ['Zonas que exigem > 3 km dentro delas para tomar', (m) => pct(m.custoTomarAcima3km)],
    ['Gini por jogador (zonas creditadas)', (m) => num(m.giniJogadores, 2)],
    ['Iniciantes com ≥ 1 zona no fim', (m) => pct(m.comZona.iniciante)],
    ['Avançados com ≥ 1 zona no fim', (m) => pct(m.comZona.avancado)],
    ['Gini por time (zonas)', (m) => num(m.giniTimes, 2)],
    ['Parte das zonas do maior time (tem X% dos jogadores)', (m) => `${pct(m.parteMaiorTime)} (${pct(m.parteJogadoresMaiorTime)})`],
  ];
  let s = `\n### ${titulo}\n\n| Métrica | ${ids.join(' | ')} |\n|---|${ids.map(() => '---:').join('|')}|\n`;
  for (const [nome, f] of linhas) s += `| ${nome} | ${ids.map((id) => f(ms[id])).join(' | ')} |\n`;
  return s;
}

function main() {
  const sementes = rapido ? [1] : [1, 2, 3];
  const bairro = mapaBairro271();
  const real = rapido ? null : mapaFlamboyant();
  const lista: { g: Grafo; times: Cenario['times']; densidade: number }[] = [
    { g: bairro, times: 'equilibrados', densidade: 90 },
    { g: bairro, times: 'desequilibrados', densidade: 90 },
    { g: bairro, times: 'equilibrados', densidade: 30 },
  ];
  if (real) lista.push({ g: real, times: 'equilibrados', densidade: 90 }, { g: real, times: 'desequilibrados', densidade: 90 });
  const saida: Record<string, Record<string, M>> = {};
  let md = `# Resultados da simulação de território\n\nGerado por \`rodar.ts\` (sementes ${sementes.join(', ')}; média entre sementes). 4 semanas de aquecimento + 8 semanas medidas. Densidade = corredores veteranos por 271 zonas (+25 novatos por 271 zonas chegando nas semanas 1–6).\n`;
  for (const { g, times, densidade } of lista) {
    const porRegra: Record<string, M[]> = {};
    for (const semente of sementes) {
      const t = Date.now();
      const agenda = montarAgenda(g, { semente, times, densidade });
      for (const f of REGRAS) {
        const res = simular(g, agenda, f.criar(agenda.corredores));
        (porRegra[f.id] ??= []).push(metricas(g, agenda, res));
      }
      process.stderr.write(`${g.nome} · ${times} · densidade ${densidade} · semente ${semente}: ${agenda.corridas.length} corridas, ${agenda.corredores.length} corredores, ${((Date.now() - t) / 1000).toFixed(1)} s\n`);
    }
    const chave = `${g.nome} · times ${times} · densidade ${densidade}`;
    saida[chave] = Object.fromEntries(Object.entries(porRegra).map(([id, ms]) => [id, mediaDe(ms)]));
    md += tabela(`${chave} (${g.zonas.length} zonas)`, REGRAS.map((r) => r.id), saida[chave]);
  }
  const dir = resolve(AQUI, 'resultados');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, rapido ? 'rapido.json' : 'completo.json'), JSON.stringify(saida, null, 2));
  writeFileSync(resolve(dir, rapido ? 'rapido.md' : 'completo.md'), md);
  console.log(md);
}

if (process.argv[1] && process.argv[1].endsWith('rodar.ts')) main();
