import type { FactionId } from '@/domain/types';

/**
 * "Pit Lane Neon" — o mesmo design system da apresentação (`docs/apresentacao/design-tokens.json`),
 * usado nas telas de entrada do app (D-58): base quase preta, um neon só (laranja) com brilho em
 * camadas da mesma cor, nunca sombra preta.
 */
export const neon = {
  bg: '#070708',
  bgDeep: '#050506',
  surface: '#0F1013',
  line: '#24252B',
  ink: '#F3F1ED',
  ink2: '#A8A6A1',
  orange: '#FF6A13',
  orangeText: '#FF7A2A',
  glowBg: '#2B1407',
  /** Brilho de texto (aproximação das 3 camadas do CSS: 18/60/120 px). */
  textGlow: { color: 'rgba(255,106,19,0.85)', radius: 22 },
  /** Brilho de botão/campo focado. */
  buttonGlow: '0 0 28px rgba(255,106,19,0.55), 0 0 8px rgba(255,106,19,0.6)',
  focusGlow: '0 0 0 1px rgba(255,106,19,0.9), 0 0 18px rgba(255,106,19,0.35)',
  dangerGlow: '0 0 22px rgba(255,77,69,0.5)',
  /** Card "aceso" (selecionado/destaque): borda laranja e brilho suave. */
  cardGlow: '0 0 30px rgba(255,106,19,0.22)',
  /** Fundo do chip/cartão selecionado (laranja a 14%). */
  activeFill: 'rgba(255,106,19,0.14)',
  routeDrawMs: 2800,
  pulseMs: 2200,
} as const;

/** Cores neon dos times (mesmas da apresentação) para o brilho dos selos. */
export const neonTeam: Record<FactionId, string> = {
  striders: '#2FA8FF',
  volt: '#19E6A8',
  owls: '#FF4FD8',
  coyotes: '#FFD60A',
};
