/** Contas puras das telas de jogo (T6.3): testadas em Jest, usadas pelos componentes de `game-motion.tsx` e pelo mapa. */

/** Fração 0–1 limitada (barras de vida/influência). */
export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Texto do contador do sino: nada sem não lidas, "9+" acima de 9. */
export function badgeText(unread: number): string | null {
  if (!Number.isFinite(unread) || unread <= 0) return null;
  return unread > 9 ? '9+' : String(Math.floor(unread));
}

/**
 * Topo da coluna de controles do mapa (sino e camadas): abaixo da pílula de status (8 + 56) e da linha de
 * filtros (8 + 44), com 12 pt de respiro. Assim a zona do polegar fica só com o alerta e o "Correr".
 */
export function mapControlsTop(insetTop: number): number {
  return Math.max(0, insetTop) + 8 + 56 + 8 + 44 + 12;
}

/** Ordem visual do pódio (2º · 1º · 3º) a partir das linhas já ordenadas por posição. */
export function podiumOrder<T>(lines: readonly T[]): T[] {
  return [lines[1], lines[0], lines[2]].filter((x): x is T => x !== undefined);
}
