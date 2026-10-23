import type { FactionId } from '@/domain/types';
import { neon, neonTeam } from '@/theme/neon';
import { factions, type TeamShape } from '@/theme/tokens';

/** Violeta reservado aos vilões (D-67): vem do token `neon.villain` (`theme/neon.ts`). */
export const VILLAIN: string = neon.villain;
/** Laranja em brasa do chefão furioso. */
export const EMBER = '#FF4A1C';

/**
 * Cores da arte. Tudo vem do Pit Lane Neon (`theme/neon.ts`), menos o violeta dos vilões, a brasa e os
 * escuros de preenchimento (interior de boca e de baú), que são tons de fundo e não cores de marca.
 */
export const ART = {
  bg: neon.bg,
  /** Escuro opaco que tapa o que está atrás do traço. */
  panel: '#0A0B0E',
  orange: neon.orange,
  ink: neon.ink,
  ink2: neon.ink2,
  glowBg: neon.glowBg,
  white: '#FFFFFF',
  villain: VILLAIN,
  ember: EMBER,
  team: neonTeam,
  /** Interiores escuros (boca dos vilões, boca dos mascotes, fundo do baú aberto). */
  dark: {
    villain: '#160A1F',
    striders: '#1A0D07',
    volt: '#07160F',
    coyotes: '#171404',
    neutral: '#1D1C1A',
  },
} as const;

/** Cor sentinela do "prisma" (gradiente com as 4 cores dos times): o renderizador troca por `url(#id)`. */
export const PRISM = 'prisma';
export const PRISM_STOPS: readonly (readonly [number, string])[] = [
  [0, neonTeam.striders],
  [0.36, neonTeam.volt],
  [0.68, neonTeam.coyotes],
  [1, neonTeam.owls],
];

export function teamShape(team: FactionId): TeamShape {
  return factions[team].shape;
}

export function teamName(team: FactionId): string {
  return factions[team].name;
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura duas cores hex (t = 0 → a, t = 1 → b). Cores que não são hex voltam como estão. */
export function mix(a: string, b: string, t: number): string {
  if (!a.startsWith('#') || !b.startsWith('#')) return a;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
