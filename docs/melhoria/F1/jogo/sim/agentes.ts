/**
 * Corredores sintéticos e agenda de corridas. A agenda é gerada UMA vez por semente e reaproveitada
 * por todas as regras (números aleatórios comuns): a diferença entre as regras vem só da regra.
 */
import { basePace, effortMultiplier } from '../../../../../apps/mobile/src/domain/scoring';
import type { FactionId } from '../../../../../apps/mobile/src/domain/types';

import { criarDijkstra, gerarRota, rng, type Grafo, type Rota } from './base';

export type Perfil = 'iniciante' | 'regular' | 'avancado';

export const PERFIS: Record<Perfil, { km: number; porSemana: number; ritmo: number; ritmoSd: number }> = {
  iniciante: { km: 3, porSemana: 2, ritmo: 435, ritmoSd: 25 }, // ~7:15/km
  regular: { km: 5, porSemana: 4, ritmo: 360, ritmoSd: 20 }, // ~6:00/km
  avancado: { km: 15, porSemana: 6, ritmo: 300, ritmoSd: 15 }, // ~5:00/km
};

export const AQUECIMENTO_DIAS = 28; // o mapa já existe quando a medição começa
export const MEDIDOS_DIAS = 56; // 8 semanas
export const TOTAL_DIAS = AQUECIMENTO_DIAS + MEDIDOS_DIAS;
export const DIA_MS = 86_400_000;
/** 05/10/2026 00:00 em Brasília (segunda-feira). Viradas de temporada: 01/11 (dia 27) e 01/12 (dia 57). */
export const T0 = Date.UTC(2026, 9, 5, 3);
export const VIRADAS_TEMPORADA = [27, 57];

export type Corredor = {
  id: number;
  perfil: Perfil;
  time: FactionId;
  casa: number;
  ritmo: number;
  entraDia: number;
  novato: boolean;
};

export type Corrida = {
  idx: number;
  corredor: number;
  dia: number;
  agora: number;
  rota: Rota;
  ritmo: number;
  /** Multiplicador de esforço do domain (ritmo-base = mediana das 10 últimas; 360 s/km sem histórico). */
  esforco: number;
  ritmoBase: number;
  sequenciaSemanas: number;
};

export type Cenario = {
  semente: number;
  times: 'equilibrados' | 'desequilibrados';
  /** corredores veteranos (já correm no aquecimento) para 271 zonas; escala com o nº de zonas do mapa */
  densidade: number;
};

const ORDEM_TIMES: FactionId[] = ['volt', 'owls', 'coyotes', 'striders'];
const PESOS = { equilibrados: [0.25, 0.25, 0.25, 0.25], desequilibrados: [0.45, 0.3, 0.15, 0.1] };

export function montarAgenda(g: Grafo, c: Cenario) {
  const r = rng(c.semente * 7919 + (c.times === 'equilibrados' ? 1 : 2) * 31 + c.densidade);
  const dij = criarDijkstra(g);
  const escala = g.zonas.length / 271;
  const veteranos = Math.round(c.densidade * escala);
  const novatos = { iniciante: Math.round(20 * escala), regular: Math.round(5 * escala) };
  const corredores: Corredor[] = [];
  const add = (perfil: Perfil, novato: boolean) => {
    const p = PERFIS[perfil];
    corredores.push({
      id: corredores.length,
      perfil,
      time: r.weighted(ORDEM_TIMES, PESOS[c.times]),
      casa: r.int(g.nos.length),
      ritmo: Math.max(250, r.normal(p.ritmo, p.ritmoSd)),
      entraDia: novato ? AQUECIMENTO_DIAS + r.int(42) : 0,
      novato,
    });
  };
  for (let i = 0; i < veteranos; i++) add(i < veteranos * 0.5 ? 'iniciante' : i < veteranos * 0.85 ? 'regular' : 'avancado', false);
  for (let i = 0; i < novatos.iniciante; i++) add('iniciante', true);
  for (let i = 0; i < novatos.regular; i++) add('regular', true);

  let rotaId = 0;
  const favoritas = corredores.map((k) => [0, 1].map(() => gerarRota(g, dij, k.casa, PERFIS[k.perfil].km * 1000, r, rotaId++, true)));
  const historico = corredores.map(() => [] as number[]);
  const sequencia = corredores.map(() => ({ semanas: 0, congel: 1, nestaSemana: 0 }));

  const corridas: Corrida[] = [];
  for (let semana = 0; semana * 7 < TOTAL_DIAS; semana++) {
    // fecha a semana anterior (RN-014: 2 corridas valem a semana; 1 congelamento por mês)
    for (const s of sequencia) {
      if (semana === 0) break;
      if (s.nestaSemana >= 2) s.semanas++;
      else if (s.congel > 0) s.congel--;
      else s.semanas = 0;
      s.nestaSemana = 0;
    }
    if (VIRADAS_TEMPORADA.some((d) => d >= semana * 7 && d < semana * 7 + 7)) for (const s of sequencia) s.congel = 1;
    const doDia: { k: Corredor; dia: number; hora: number }[] = [];
    for (const k of corredores) {
      const n = PERFIS[k.perfil].porSemana;
      const dias = [0, 1, 2, 3, 4, 5, 6].sort(() => r.next() - 0.5).slice(0, n);
      for (const d of dias) {
        const dia = semana * 7 + d;
        if (dia >= TOTAL_DIAS || dia < k.entraDia) continue;
        if (r.next() < 0.08) continue; // 8% das corridas planejadas não acontecem (chuva, cansaço)
        doDia.push({ k, dia, hora: 6 + r.next() * 14 });
      }
    }
    doDia.sort((a, b) => a.dia - b.dia || a.hora - b.hora);
    for (const { k, dia, hora } of doDia) {
      const p = PERFIS[k.perfil];
      const alvo = p.km * 1000 * Math.max(0.6, 1 + r.normal(0, 0.1));
      const rota = r.next() < 0.65 ? r.pick(favoritas[k.id]) : gerarRota(g, dij, k.casa, alvo, r, rotaId++, true);
      const ritmo = k.ritmo * Math.max(0.85, 1 + r.normal(0, 0.04));
      const base = basePace(historico[k.id]);
      corridas.push({
        idx: corridas.length,
        corredor: k.id,
        dia,
        agora: T0 + dia * DIA_MS + hora * 3_600_000,
        rota,
        ritmo,
        esforco: effortMultiplier(base, ritmo),
        ritmoBase: base,
        sequenciaSemanas: Math.min(10, sequencia[k.id].semanas),
      });
      historico[k.id].push(ritmo);
      sequencia[k.id].nestaSemana++;
    }
  }
  return { corredores, corridas };
}
