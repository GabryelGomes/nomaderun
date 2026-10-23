/**
 * Contas puras das coreografias dos momentos (T7.1.14): tempos de cada passo (catálogo da F1, §4 e §7),
 * escala da cor que inunda a tela e cores provisórias de raridade. Sem React.
 */
import type { ChestRarity } from './queue';

/** Zona conquistada no resumo (§4.1): anel fecha, selo, título, faíscas e confete, pontos. */
export const ZONE_TIMELINE = { ring: 0, ringMs: 720, badge: 540, title: 660, peak: 720, points: 820, chips: 1000 } as const;

/** Baú abrindo (§4.2). */
export const CHEST_TIMELINE = { shake: 0, shakeMs: 600, squash: 600, squashMs: 300, burst: 750, item: 800, rarity: 1050, xp: 1150, odds: 1400 } as const;

/** Golpe no chefão (§4.3). */
export const BOSS_HIT_TIMELINE = { flashMs: 160, shakeMs: 320, squashMs: 420, bar: 80, mine: 280 } as const;

/** Chefão derrotado (§4.4). */
export const BOSS_DEFEATED_TIMELINE = { tremble: 300, trembleMs: 400, explode: 700, stamp: 900, city: 1100, mine: 1350, mineCount: 1400, reward: 1800 } as const;

/** Nível novo (§3, item 22). */
export const LEVEL_TIMELINE = { dim: 0, rays: 100, number: 300, title: 700, reward: 900 } as const;

/** Escolha de time (§7): versão da primeira abertura e versão curta da troca de time. */
export const TEAM_TIMELINE = {
  ftue: { flood: 150, floodMs: 560, content: 450, vignette: 600, waves: 710, name: 750, quote: 1150, cta: 1600 },
  switch: { flood: 100, floodMs: 400, content: 300, vignette: 400, waves: -1, name: 450, quote: 700, cta: 950 },
} as const;

/** Atraso de um passo na versão curta: os tempos encolhem na mesma proporção da duração. */
export function scaleDelay(ms: number, compact: boolean, ratio: number): number {
  if (!compact) return ms;
  const r = Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : 1;
  return Math.round(ms * r);
}

/**
 * Escala de um círculo de diâmetro `base`, centrado em `origin`, para cobrir uma tela `width × height`
 * (até o canto mais distante). Pelo menos 1.
 */
export function floodScale(origin: { x: number; y: number }, width: number, height: number, base: number): number {
  const dx = Math.max(origin.x, width - origin.x);
  const dy = Math.max(origin.y, height - origin.y);
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (!(base > 0)) return 1;
  return Math.max(1, Math.ceil(((2 * radius) / base) * 100) / 100);
}

/**
 * Cores de raridade — PROVISÓRIAS até a E4 confirmar. O raro deixou de ser violeta (proposta da F1) porque a
 * D-67 reserva o violeta `#B15CFF` para os vilões.
 */
export const RARITY_COLORS: Record<ChestRarity, string> = { comum: '#C9C6BF', raro: '#5FA8FF', lendario: '#FFB800' };

export const RARITY_NAMES: Record<ChestRarity, string> = { comum: 'Comum', raro: 'Raro', lendario: 'Lendário' };

/** Confete por raridade: comum nenhum, raro 24, lendário 60 (escala de celebração). */
export const RARITY_CONFETTI: Record<ChestRarity, number> = { comum: 0, raro: 24, lendario: 60 };

/** "Chances: comum 70% · raro 25% · lendário 5%" (ética §5.4: chances sempre visíveis). */
export function oddsLabel(odds: Record<ChestRarity, number>): string {
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  return `Chances: comum ${pct(odds.comum)} · raro ${pct(odds.raro)} · lendário ${pct(odds.lendario)}`;
}

/** Vida em porcentagem inteira (0–100), à prova de máximo zero. */
export function hpPercent(hp: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(hp)) return 0;
  return Math.round(Math.max(0, Math.min(1, hp / max)) * 100);
}

/** Posição (pt) de cada linha do ranking: só `translateY`, nada de layout animado. */
export function rankOffsets(order: readonly string[], rowHeight: number): Record<string, number> {
  const out: Record<string, number> = {};
  order.forEach((id, i) => {
    out[id] = i * rowHeight;
  });
  return out;
}
