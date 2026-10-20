import { cssEasings, durations, distances, type CurveName } from '@/theme/motion';

/**
 * Estilos de animação CSS (Reanimated 4) puros e testáveis, usados pelas primitivas de motion.
 * Regra da D-54/RNF-011: com "Reduzir movimento" a entrada vira só opacidade, curta e sem atraso.
 */

type Keyframes = { from: Record<string, unknown>; to: Record<string, unknown> };

const FADE: Keyframes = { from: { opacity: 0 }, to: { opacity: 1 } };
/** Cache por distância: o mesmo objeto de keyframes entre renders (a animação não reinicia à toa). */
const RISE = new Map<number, Keyframes>();

export function riseKeyframes(distance: number): Keyframes {
  let k = RISE.get(distance);
  if (!k) {
    k = { from: { opacity: 0, transform: [{ translateY: distance }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };
    RISE.set(distance, k);
  }
  return k;
}

/** Subida sem fade (texto saindo de dentro da máscara: a máscara já esconde). */
const MASK = new Map<number, Keyframes>();
export function maskKeyframes(distance: number): Keyframes {
  let k = MASK.get(distance);
  if (!k) {
    k = { from: { transform: [{ translateY: distance }] }, to: { transform: [{ translateY: 0 }] } };
    MASK.set(distance, k);
  }
  return k;
}

export type EnterOptions = {
  reduced: boolean;
  /** Deslocamento inicial em pt (positivo = vem de baixo). */
  distance?: number;
  duration?: number;
  delay?: number;
  curve?: CurveName;
  /** `rise` = sobe com fade (cards); `mask` = sobe sem fade (texto dentro da máscara). */
  kind?: 'rise' | 'mask';
};

export function enterAnimation({ reduced, distance = distances.enter, duration = durations.enter, delay = 0, curve = 'enter', kind = 'rise' }: EnterOptions) {
  if (reduced) {
    return {
      animationName: FADE,
      animationDuration: durations.reducedFade,
      animationDelay: 0,
      animationTimingFunction: cssEasings.standard,
      animationFillMode: 'both' as const,
    };
  }
  return {
    animationName: kind === 'mask' ? maskKeyframes(distance) : riseKeyframes(distance),
    animationDuration: duration,
    animationDelay: Math.max(0, delay),
    animationTimingFunction: cssEasings[curve],
    animationFillMode: 'both' as const,
  };
}

/** Separa um texto em palavras (ou linhas, por `\n`) sem perder nada que o leitor de tela precise. */
export function splitReveal(text: string, by: 'words' | 'lines'): string[] {
  if (by === 'lines') return text.split('\n').map((l) => l.trim()).filter(Boolean);
  return text.split(/\s+/).filter(Boolean);
}
