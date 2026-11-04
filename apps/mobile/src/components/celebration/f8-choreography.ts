/**
 * Contas puras das animações da Fase 8 (onda C, frente C1 da E5): tempos, escalas e a ordem das zonas que
 * acendem. Sem React. Guia: `docs/melhoria/F8/02-direcao-de-arte.md` §3.3 e `01-PROMPT-FINALIZACAO-100.md` §4 C1.
 * Tudo aqui vale para o modo completo; com "Reduzir movimento" cada componente troca por um fade de 150 ms.
 */
import { RAID_PHASE2_AT, RAID_PHASE3_AT, raidPhase } from '@/domain/raid';
import type { FactionId } from '@/domain/types';
import { durations } from '@/theme/motion';

/* ------------------------------------------------------------------ capa do time (§3.3) */

/** Toque no card da capa: mola 0,98 → 1,02 → 1, flash do lema e o "pulo" do corredor (fica junto da arte). */
export { COVER_TAP } from '@/components/art/team/cover-art';

/** Confirmar o time: a capa em foco cresce e some enquanto a cor do time inunda a tela a partir dela. */
export const COVER_CONFIRM = { scale: 1.12, ms: 450 } as const;

/** A vibração por time (Striders 1 toque, Volt 2 curtos, Owls 1 longo, Coyotes 3 curtos) é `teamHaptic` (motion). */

/* ------------------------------------------------------------------ cerimônia "Seu rastro" */

/** A rota se desenha em 600 ms na cor do time; a moldura Recruta entra com mola de 0,9 → 1 ao fim do traço. */
export const TRAIL_REVEAL = { drawMs: 600, frameFrom: 0.9 } as const;

/* ------------------------------------------------------------------ "Primeiro trecho!" (corrida) */

/**
 * Selo do 1º trecho na corrida ativa: desce do topo, fica e sai em 1,5 s no total; o brilho corre pela linha do
 * rastro (opacidade 0 → 1 → 0 em 400 ms) logo depois de o selo chegar. 1 vibração leve.
 */
export const FIRST_PAINT = { lifeMs: 1500, enterMs: 350, exitMs: durations.exit, slideFrom: -72, glowAt: 200, glowMs: 400 } as const;

/** Quanto tempo o selo fica parado: o que sobra de 1,5 s depois de entrar e antes de sair. */
export function firstPaintHoldMs(t: { lifeMs: number; enterMs: number; exitMs: number } = FIRST_PAINT): number {
  return Math.max(0, t.lifeMs - t.enterMs - t.exitMs);
}

/* ------------------------------------------------------------------ "Antes e depois do bairro" (resumo) */

/** Transição de 800 ms do antes para o depois; as zonas viradas acendem uma a uma (120 ms), no máximo 5. */
export const NEIGHBORHOOD_FLIP = { crossMs: 800, firstLightAt: 400, stepMs: 120, maxLit: 5, lightMs: 520 } as const;

/**
 * Atraso (ms, a partir do início da transição) de cada zona virada que acende; `null` para as que passam do teto
 * (essas só trocam de cor junto com o mapa). Com "Reduzir movimento", nenhuma acende (o mapa só troca com fade).
 */
export function flipLightDelays(count: number, reduced: boolean, t: { firstLightAt: number; stepMs: number; maxLit: number } = NEIGHBORHOOD_FLIP): (number | null)[] {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return Array.from({ length: n }, (_, i) => (reduced || i >= t.maxLit ? null : t.firstLightAt + i * t.stepMs));
}

/** Duração total da cena (o mapa troca e a última zona acesa termina). */
export function flipTotalMs(count: number, reduced: boolean): number {
  if (reduced) return durations.reducedFade;
  const lit = flipLightDelays(count, false).filter((d): d is number => d !== null);
  const last = lit.length > 0 ? lit[lit.length - 1] + NEIGHBORHOOD_FLIP.lightMs : 0;
  return Math.max(NEIGHBORHOOD_FLIP.crossMs, last);
}

export type FlipZone = { id: string; before: FactionId | null; after: FactionId | null };

/** Zonas que mudaram de dono nesta corrida (o "depois" tem dono e é outro). A ordem é a do resultado oficial. */
export function flippedZones<T extends FlipZone>(zones: readonly T[]): T[] {
  return zones.filter((z) => z.after !== null && z.after !== z.before);
}

/* ------------------------------------------------------------------ "Golpe que abre fase" (chefão) */

/** Tarja "Você abriu a fase N!" e os pontos fracos surgindo, depois do cambaleio (`BOSS_HIT_TIMELINE`). */
export const BOSS_PHASE = { bannerAt: 480, bannerMs: 400, weakAt: 700, weakStep: 110, weakCount: 3, totalMs: 1400 } as const;

/**
 * Fase que a corrida abriu: 2 quando a vida passou de > 67% para ≤ 67%; 3 quando passou para ≤ 33%. Se pulou as
 * duas de uma vez, vale a maior. `null` se a fase não mudou (ou dado inválido). Mesma regra do servidor (`raidPhase`).
 */
export function bossPhaseOpened(hpFrom: number, hpTo: number, hpMax: number): 2 | 3 | null {
  if (!(hpMax > 0) || !Number.isFinite(hpFrom) || !Number.isFinite(hpTo) || hpTo >= hpFrom) return null;
  const before = raidPhase(hpFrom, hpMax);
  const after = raidPhase(hpTo, hpMax);
  return after > before ? (after as 2 | 3) : null;
}

/** Limiares das fases em % (para o texto e os testes). */
export const BOSS_PHASE_THRESHOLDS = { 2: Math.round(RAID_PHASE2_AT * 100), 3: Math.round(RAID_PHASE3_AT * 100) } as const;

/** Onde os pontos fracos surgem em volta do chefão (fração da caixa de 200 × 170; ordem de aparição). */
export const WEAK_POINT_SPOTS: readonly { x: number; y: number }[] = [
  { x: 0.16, y: 0.3 },
  { x: 0.86, y: 0.42 },
  { x: 0.3, y: 0.86 },
];

/* ------------------------------------------------------------------ resumo e mapa */

/** "A semana do time": a faixa entra com mola, o mascote salta com `bouncy` e some com 1 toque ou 4 s. */
export const TEAM_WEEK = { holdMs: 4000, mascotAt: 120, slideFrom: -16, mascotFrom: 0.6 } as const;

/** Carimbo de bairro novo: escala 1,3 → 1 com a mola `stamp` e leve rotação −6° → 0. */
export const DISTRICT_STAMP = { fromScale: 1.3, fromRotate: -6 } as const;

/** Recorde de trechos: o número conta de 0 ao valor e o selo pulsa 2× depois do carimbo. */
export const RECORD_COUNT = { countMs: 900, countAt: 200, pulses: 2, pulseMs: 260, pulseScale: 1.08 } as const;

/** Quando o número do recorde termina de contar (o líder comenta 300 ms depois). */
export function recordCountEndMs(t: { countAt: number; countMs: number } = RECORD_COUNT): number {
  return t.countAt + t.countMs;
}

/** O líder comenta: balão entra 300 ms depois dos números (fade + translateY 8). */
export const LEADER_COMMENT = { afterNumbersMs: 300, rise: 8, ms: 400 } as const;

/** Atraso do balão do líder: 300 ms depois do fim da contagem (ou 300 ms, sem número contando). */
export function leaderCommentDelay(numbersEndMs: number | null): number {
  const end = numbersEndMs !== null && Number.isFinite(numbersEndMs) && numbersEndMs > 0 ? numbersEndMs : 0;
  return end + LEADER_COMMENT.afterNumbersMs;
}
