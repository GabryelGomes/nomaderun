import type { FactionId } from '@/domain/types';

/**
 * Design system "Pista" (Product Book §5, pesquisa 06).
 * The look of a serious running app: light, warm neutrals, one orange accent for action and route,
 * big tabular numbers. The game lives in the team colors on the map, never in the chrome.
 * Team colors are color-blind safe (Okabe-Ito based) and each team also has a shape.
 */
export const palette = {
  orange: '#FF5A1F',
  orangePressed: '#E24A12',
  /** Orange that passes 4.5:1 as text on white. */
  orangeText: '#C93F00',
  ink: '#242428',
  ink2: '#5E5E66',
  ink3: '#A5A5AE',
  bg: '#F7F6F3',
  white: '#FFFFFF',
  surface2: '#F0EFEC',
  line: '#E4E3DF',
  success: '#1F9D55',
  danger: '#D92D20',
  warning: '#E8A317',
  night: '#121214',
  nightSurface: '#1C1C1F',
} as const;

export const light = {
  background: palette.bg,
  surface: palette.white,
  surfaceSunken: palette.surface2,
  text: palette.ink,
  textSecondary: palette.ink2,
  line: palette.line,
  action: palette.orange,
  onAction: palette.white,
  accentText: palette.orangeText,
  danger: palette.danger,
} as const;

/**
 * Tema escuro = "Pit Lane Neon" da apresentação (D-59, `docs/apresentacao/design-tokens.json`):
 * base quase preta, superfícies grafite com borda fina, um neon só (laranja) para ação e destaque.
 */
export const dark = {
  background: '#070708',
  surface: '#111215',
  surfaceSunken: '#1A1B20',
  text: '#F3F1ED',
  textSecondary: '#A8A6A1',
  line: '#24252B',
  action: '#FF6A13',
  onAction: palette.white,
  accentText: '#FF7A2A',
  danger: '#FF4D45',
} as const;

export type ThemeColors = { [K in keyof typeof light]: string };

/** Redundant cue for color-blind runners: every team badge carries its shape. */
export type TeamShape = 'circulo' | 'triangulo' | 'losango' | 'quadrado';

export const factions: Record<FactionId, { name: string; color: string; tint: string; onColor: string; shape: TeamShape; motto: string }> = {
  striders: { name: 'Neon Striders', color: '#0072B2', tint: '#E3EEF6', onColor: palette.white, shape: 'circulo', motto: 'Ritmo e precisão' },
  volt: { name: 'Volt Runners', color: '#009E73', tint: '#E0F2EC', onColor: palette.white, shape: 'triangulo', motto: 'Resistência sem fim' },
  owls: { name: 'Night Owls', color: '#C0559A', tint: '#F6E6F0', onColor: palette.white, shape: 'losango', motto: 'Donos da madrugada' },
  coyotes: { name: 'Urban Coyotes', color: '#D9B200', tint: '#FBF3D2', onColor: palette.ink, shape: 'quadrado', motto: 'Correm em matilha' },
};

/** Map fill of a team region: a bit stronger for your own team. */
export const territoryOpacity = { other: 0.2, mine: 0.3, selected: 0.42 } as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

/** Inter for the interface, Inter Tight for the big numbers. */
export const fonts = {
  display: 'InterTight_800ExtraBold',
  displayMedium: 'InterTight_600SemiBold',
  text: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textBold: 'Inter_700Bold',
} as const;

/** Type scale in points (Product Book §5.3). */
export const type = {
  caption: 12,
  small: 14,
  body: 16,
  lead: 20,
  title: 24,
  headline: 32,
  metric: 40,
  hero: 72,
  giant: 96,
} as const;

/** The one elevation shadow, only for things floating over the map. */
export const floating = '0 4px 18px rgba(0, 0, 0, 0.45)';

/**
 * Valores de motion da fase anterior (expo-animation), mantidos por compatibilidade.
 * Fase 6 (D-54): a fonte dos tokens novos é `@/theme/motion` (curvas, durações, staggers, distâncias).
 * `press` é o mesmo nos dois arquivos (0,97 em 120 ms).
 */
export const motion = {
  press: { duration: 120, scale: 0.97 },
  small: 200,
  enter: 250,
  holdToConfirm: 600,
  spring: { duration: 400, dampingRatio: 0.8 },
  stagger: 60,
} as const;
