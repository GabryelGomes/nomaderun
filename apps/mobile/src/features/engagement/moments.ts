/**
 * Momentos de prazer do resumo e do Atlas (F8 · B2, ideias 5.1, 5.3, 5.4 e 5.8), puros e testáveis.
 *
 * Regra de ouro: **só com dado real**. Cada função devolve `null` quando não há o que comemorar ou quando o dado
 * não é confiável (servidor antigo, histórico incompleto). `null` = a tela não comemora.
 */
import { districtOf as h3District } from '@/domain/grid';
import type { PaintMilestones } from '@/domain/faction-activity';

import type { LeaderFeat } from './leader-lines';

/** Corrida do histórico como o Atlas lê (só as que contam têm zona com ponto). */
export type StampRun = {
  id: string;
  status: string;
  endedAt: number | null;
  startedAt: number;
  result: { zones?: readonly { zoneId: string; name?: string; rp: number }[] } | null;
};

/** Um carimbo do Atlas: o bairro (distrito H3 res. 7), o nome que a pessoa reconhece e quando ela chegou lá. */
export type DistrictStamp = { district: string; name: string; at: number; runId: string };

/** O histórico do app vem com no máximo 200 corridas: com isso ou mais, não dá para saber o que é "novo". */
export const HISTORY_PAGE = 200;

const COUNTS = new Set(['valid', 'partial']);

/** "Jardim Goiás · perto do Estádio" → "Jardim Goiás" (o bairro, sem a referência da zona). */
export function districtName(zoneName: string | undefined | null): string {
  const n = (zoneName ?? '').split(' · ')[0].trim();
  return n || 'Bairro novo';
}

function safeDistrict(zoneId: string, districtOf: (id: string) => string): string | null {
  try {
    return districtOf(zoneId) || null;
  } catch {
    return null;
  }
}

/**
 * Carimbos de bairro (Atlas): 1 por distrito, na 1ª corrida que pontuou nele, do mais antigo para o mais novo.
 * Corrida rejeitada ou em revisão não carimba.
 */
export function districtStamps(history: readonly StampRun[], districtOf: (id: string) => string = h3District): DistrictStamp[] {
  const sorted = history.filter((r) => COUNTS.has(r.status)).sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt) || (a.id < b.id ? -1 : 1));
  const seen = new Map<string, DistrictStamp>();
  for (const run of sorted) {
    for (const z of run.result?.zones ?? []) {
      if (!(z.rp > 0)) continue;
      const d = safeDistrict(z.zoneId, districtOf);
      if (!d || seen.has(d)) continue;
      seen.set(d, { district: d, name: districtName(z.name), at: run.endedAt ?? run.startedAt, runId: run.id });
    }
  }
  return [...seen.values()];
}

/**
 * Carimbo de bairro novo no resumo: a corrida pontuou num distrito onde nenhuma outra corrida (que conta) pontuou.
 * `null` quando: histórico incompleto (≥ 200 corridas ou não carregado), 1ª corrida com pontos (o momento é o
 * "Primeiro trecho!") ou nenhum distrito novo.
 */
export function newDistrictStamp(
  input: { runId: string; zones: readonly { zoneId: string; name: string; rp: number }[]; history: readonly StampRun[] | null },
  districtOf: (id: string) => string = h3District,
): { district: string; name: string } | null {
  const { history } = input;
  if (!history || history.length >= HISTORY_PAGE) return null;
  const others = history.filter((r) => r.id !== input.runId);
  const before = new Set(districtStamps(others, districtOf).map((s) => s.district));
  if (before.size === 0) return null;
  for (const z of input.zones) {
    if (!(z.rp > 0)) continue;
    const d = safeDistrict(z.zoneId, districtOf);
    if (d && !before.has(d)) return { district: d, name: districtName(z.name) };
  }
  return null;
}

/** Os fatos confirmados de uma corrida que o resumo pode comemorar. */
export type RunFacts = {
  /** Só corrida oficial que conta (válida ou parcial) comemora. */
  counts: boolean;
  milestones: PaintMilestones | null;
  conqueredZone: string | null;
  defendedZone: string | null;
  newDistrict: string | null;
  beatGhost: boolean | null;
  meters: number;
};

const kmText = (m: number) => String(Math.round(m / 100) / 10).replace('.', ',');

/**
 * O feito que o líder comenta no resumo (1 por tela), do mais raro para o mais comum: 1º trecho da vida, recorde,
 * zona conquistada, bairro novo, zona defendida, fantasma vencido, trechos pintados e, por fim, a distância (≥ 1 km).
 */
export function summaryLeaderFeat(f: RunFacts): LeaderFeat | null {
  if (!f.counts) return null;
  const m = f.milestones;
  if (m?.firstPaint) return { kind: 'primeiro-trecho' };
  if (m?.cellsRecord) return { kind: 'recorde', n: m.cellsRecord.value, prev: m.cellsRecord.previous };
  if (f.conqueredZone) return { kind: 'conquista', zone: f.conqueredZone };
  if (f.newDistrict) return { kind: 'bairro-novo', district: f.newDistrict };
  if (f.defendedZone) return { kind: 'defesa', zone: f.defendedZone };
  if (f.beatGhost === true) return { kind: 'fantasma' };
  if (m && m.cells > 0) return { kind: 'trechos', n: m.cells };
  if (f.meters >= 1000) return { kind: 'distancia', km: kmText(f.meters) };
  return null;
}

/** O feito da semana que o líder comenta no recap: zonas, senão corridas. Semana sem corrida: nada. */
export function recapLeaderFeat(week: { runs: number; zones: number }): LeaderFeat | null {
  if (week.zones > 0) return { kind: 'semana-zonas', n: week.zones };
  if (week.runs > 0) return { kind: 'semana', n: week.runs };
  return null;
}

/**
 * "Primeiro trecho!" ao vivo (ideia 5.1): só quando o app sabe que a pessoa **nunca** teve atividade (o servidor
 * diz `lastActivityAt = null`, nada no aparelho) e este aparelho ainda não comemorou. Sem o dado, nada.
 */
export function firstPaintLiveEligible(input: { lastActivityAt: number | null | undefined; statusKnown: boolean; localRuns: number; celebrated: boolean }): boolean {
  return input.statusKnown && input.lastActivityAt === null && input.localRuns === 0 && !input.celebrated;
}
