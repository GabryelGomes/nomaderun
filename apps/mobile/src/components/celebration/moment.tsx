import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { CSSAnimationKeyframes, CSSAnimationTimingFunction } from 'react-native-reanimated';

import { haptic } from '@/components/motion/haptics';
import { celebrationLevels, cssEasings, durations, type CelebrationLevel, type HapticPattern } from '@/theme/motion';

import { MOMENT_SPECS, type CelebrationKind } from './queue';

/** Props comuns a todos os momentos de celebração. */
export type MomentBaseProps = {
  testID: string;
  /**
   * Controlado pelo orquestrador: `playing` toca a coreografia; `done` mostra o estado final com um fade
   * curto (é o que o "Pular" faz). Sem orquestrador, o momento toca sozinho ao montar.
   */
  state?: 'playing' | 'done';
  /** Versão curta (dentro do resumo). */
  compact?: boolean;
  /** Vibra sozinho (padrão `true`; o orquestrador passa `false` e vibra pelo relógio dele). */
  haptics?: boolean;
  /** Preferência "Vibração" da pessoa (padrão ligada). */
  hapticsEnabled?: boolean;
  /** Anuncia ao leitor de tela ao aparecer (padrão `true`; o orquestrador faz um anúncio só). */
  announce?: boolean;
  /** Chamado quando a coreografia termina. */
  onDone?: () => void;
};

export type MomentInfo = {
  /** Sem coreografia: movimento reduzido ou estado final. Tudo aparece com fade curto. */
  still: boolean;
  reduced: boolean;
  /** Atraso de um passo (encolhe na versão curta). */
  at: (ms: number) => number;
  durationMs: number;
};

/**
 * Ciclo de vida de um momento: duração (completa/curta), vibrações no tempo do catálogo (ou 1 só com
 * movimento reduzido), anúncio ao leitor de tela e `onDone`. Os temporizadores são JS de baixa frequência
 * (≤ 4 por momento); a animação em si roda na thread de UI.
 */
export function useMoment(
  kind: CelebrationKind,
  level: CelebrationLevel,
  props: MomentBaseProps,
  announcement: string,
  /** "Reduzir movimento" do momento (`useReducedMotionSetting()` no componente que chama). */
  reduced: boolean,
  /** Duração e vibrações próprias (ex.: o toast, que fica parado 2,25 s). */
  custom?: { durationMs?: number; beats?: { offsetMs: number; pattern: HapticPattern }[] },
): MomentInfo {
  const { state = 'playing', compact = false, haptics = true, hapticsEnabled = true, announce = true, onDone } = props;
  const still = reduced || state === 'done';
  const spec = { ...MOMENT_SPECS[kind], ...(custom?.beats ? { haptics: custom.beats } : null) };
  const full = custom?.durationMs ?? spec.full;
  const durationMs = still ? durations.reducedFade : (custom?.durationMs ?? Math.min(compact ? spec.compact : full, celebrationLevels[level].maxMs));
  const ratio = durationMs / full;
  const announced = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (announce && !announced.current && announcement) {
      announced.current = true;
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announce, announcement]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (haptics && state === 'playing') {
      const beats: { offsetMs: number; pattern: HapticPattern }[] = reduced ? [{ offsetMs: 0, pattern: celebrationLevels[level].haptic }] : spec.haptics;
      for (const b of beats) {
        const atMs = reduced ? 0 : Math.round(b.offsetMs * (compact ? ratio : 1));
        timers.push(setTimeout(() => haptic(b.pattern, { enabled: hapticsEnabled }), atMs));
      }
    }
    timers.push(setTimeout(() => done.current?.(), durationMs));
    return () => timers.forEach(clearTimeout);
    // roda uma vez por estado (tocar / mostrar o fim)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced]);

  return { still, reduced, at: (ms: number) => (compact ? Math.round(ms * ratio) : ms), durationMs };
}

/** Fade curto (estado final e movimento reduzido). */
export const FADE_IN: CSSAnimationKeyframes = { from: { opacity: 0 }, to: { opacity: 1 } };

const KEYFRAMES = new Map<string, object>();
/** O mesmo objeto de quadros-chave para o mesmo conteúdo (a animação não reinicia a cada render). */
export function kf<T extends object>(keyframes: T): T {
  const key = JSON.stringify(keyframes);
  let k = KEYFRAMES.get(key);
  if (!k) {
    k = keyframes;
    KEYFRAMES.set(key, k);
  }
  return k as T;
}

/**
 * Animação CSS de um passo: com `still`, só fade de 150 ms sem atraso; senão os quadros-chave pedidos.
 * Só transform e opacidade.
 */
export function step(still: boolean, keyframes: CSSAnimationKeyframes, duration: number, delay: number, easing: CSSAnimationTimingFunction = cssEasings.enter) {
  if (still) {
    return { animationName: FADE_IN, animationDuration: durations.reducedFade, animationDelay: 0, animationTimingFunction: cssEasings.standard, animationFillMode: 'both' as const };
  }
  return { animationName: kf(keyframes), animationDuration: duration, animationDelay: Math.max(0, delay), animationTimingFunction: easing, animationFillMode: 'both' as const };
}

/** Sobe `distance` pt com fade (entrada de texto). */
export function rise(distance: number) {
  return { from: { opacity: 0, transform: [{ translateY: distance }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } };
}

/** Cresce de `from` até 1 com fade (selo, emblema, item). */
export function pop(from: number) {
  return { from: { opacity: 0, transform: [{ scale: from }] }, to: { opacity: 1, transform: [{ scale: 1 }] } };
}
