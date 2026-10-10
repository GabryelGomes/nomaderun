import type { FactionId } from '@/domain/types';

/**
 * Design system "Asfalto & Giz" (Product Book §5).
 * The city is the track: cool concrete map, territories painted like chalk and road paint,
 * road-marking yellow for the main action. Faction colors are the Okabe-Ito palette
 * (color-blind safe) and every faction also has its own hatch pattern.
 */
export const palette = {
  asfalto: '#252A31',
  concreto: '#E8EBEE',
  giz: '#FFFFFF',
  sinalizacao: '#FFD23F',
  meioFio: '#6B7380',
  alerta: '#C62828',
  /** Lines and dividers on light surfaces. */
  linha: '#D5DAE0',
  /** Dark theme surfaces. */
  asfaltoElevado: '#30363F',
  noite: '#1B1F25',
} as const;

export const light = {
  background: palette.concreto,
  surface: palette.giz,
  surfaceSunken: '#F3F5F7',
  text: palette.asfalto,
  textSecondary: palette.meioFio,
  line: palette.linha,
  action: palette.sinalizacao,
  onAction: palette.asfalto,
  danger: palette.alerta,
} as const;

export const dark = {
  background: palette.noite,
  surface: palette.asfaltoElevado,
  surfaceSunken: '#262B33',
  text: '#F1F3F5',
  textSecondary: '#A9B0BA',
  line: '#3D444E',
  action: palette.sinalizacao,
  onAction: palette.asfalto,
  danger: '#FF6B6B',
} as const;

export type ThemeColors = { [K in keyof typeof light]: string };

export type Pattern = 'listras' | 'pontos' | 'ondas' | 'xadrez';

export const factions: Record<
  FactionId,
  { name: string; color: string; soft: string; pattern: Pattern; motto: string; dash: number[] | undefined }
> = {
  striders: { name: 'Neon Striders', color: '#0072B2', soft: '#D6E8F4', pattern: 'listras', motto: 'Ritmo e precisão', dash: undefined },
  coyotes: { name: 'Urban Coyotes', color: '#D55E00', soft: '#F8E1D1', pattern: 'pontos', motto: 'Correm em matilha', dash: [8, 6] },
  owls: { name: 'Night Owls', color: '#CC79A7', soft: '#F5E4EE', pattern: 'ondas', motto: 'Donos da madrugada', dash: [2, 5] },
  volt: { name: 'Volt Runners', color: '#009E73', soft: '#D2EEE5', pattern: 'xadrez', motto: 'Resistência sem fim', dash: [14, 5] },
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  displayMedium: 'BigShouldersDisplay_600SemiBold',
  text: 'Figtree_400Regular',
  textMedium: 'Figtree_500Medium',
  textBold: 'Figtree_700Bold',
} as const;

/** Type scale in points (Product Book §5.3). */
export const type = {
  caption: 12,
  small: 14,
  body: 16,
  lead: 20,
  title: 24,
  headline: 32,
  metric: 48,
  hero: 72,
  giant: 96,
} as const;

/** The one elevation shadow, only for things floating over the map. */
export const floating = '0 2px 12px rgba(37, 42, 49, 0.12)';

/** Motion values from the expo-animation skill tables — never approximated. */
export const motion = {
  press: { duration: 120, scale: 0.97 },
  small: 200,
  enter: 250,
  holdToConfirm: 600,
  spring: { duration: 400, dampingRatio: 0.8 },
  stagger: 60,
} as const;
