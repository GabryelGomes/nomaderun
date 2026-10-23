import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { getMotionPrefs } from '@/store/motion-prefs-store';
import { HAPTIC_MIN_GAP_MS, HAPTIC_PATTERNS, type HapticPattern } from '@/theme/motion';

/**
 * Vibração do app (T7.1.13, D-71): um módulo só, 8 padrões. As telas chamam `haptic('success')`, nunca o
 * `expo-haptics` direto.
 *  - iOS: `impactAsync`/`notificationAsync`/`selectionAsync`;
 *  - Android: `performAndroidHapticsAsync` (háptica do sistema, sem permissão de vibração);
 *  - web: nada.
 * Intervalo mínimo de 150 ms entre vibrações (portão puro, testado). Respeita a preferência "Vibração"
 * salva (`useMotionPrefs`, T7.2.9) e a `enabled` de quem chama — as duas precisam estar ligadas —, exceto
 * alertas de segurança (`force`).
 */
export { HAPTIC_MIN_GAP_MS, HAPTIC_PATTERNS, type HapticPattern };

/** Padrões simples (o `crescendo` é uma sequência deles). */
export type SingleHaptic = Exclude<HapticPattern, 'crescendo'>;

/** Prioridade: quando duas vibrações disputam a mesma janela, a maior ganha. */
export const HAPTIC_PRIORITY: Record<SingleHaptic, number> = { selection: 0, tap: 1, impact: 2, heavy: 3, success: 4, warning: 5, error: 6 };

/** Padrões de notificação: dentro da janela, não são descartados; esperam o fim dela (se forem mais fortes). */
const NOTIFY: ReadonlySet<SingleHaptic> = new Set(['success', 'warning', 'error']);

/** Intervalo entre os toques do `crescendo` (leve → médio → forte). */
export const CRESCENDO_STEP_MS = 200;

/** Passos de um padrão: os simples têm 1 passo; o `crescendo` tem 3, a 0/200/400 ms. */
export function expandHaptic(pattern: HapticPattern): { pattern: SingleHaptic; offsetMs: number }[] {
  if (pattern === 'crescendo') {
    return [
      { pattern: 'tap', offsetMs: 0 },
      { pattern: 'impact', offsetMs: CRESCENDO_STEP_MS },
      { pattern: 'heavy', offsetMs: CRESCENDO_STEP_MS * 2 },
    ];
  }
  return [{ pattern, offsetMs: 0 }];
}

export type HapticDecision = { kind: 'fire'; pattern: SingleHaptic } | { kind: 'defer'; pattern: SingleHaptic; atMs: number } | { kind: 'drop' };

/**
 * Portão de vibração (lógica pura: o tempo entra por parâmetro). Regras:
 *  - fora da janela de `minGapMs` desde a última vibração → vibra;
 *  - dentro da janela → descarta, exceto `success`/`warning`/`error` mais fortes que a última, que esperam o
 *    fim da janela (uma só fica pendente: a mais forte).
 */
export class HapticGate {
  private lastAt = Number.NEGATIVE_INFINITY;
  private lastPattern: SingleHaptic | null = null;
  private pending: { pattern: SingleHaptic; atMs: number } | null = null;
  private due: SingleHaptic | null = null;

  constructor(readonly minGapMs: number = HAPTIC_MIN_GAP_MS) {}

  /** Pede uma vibração no instante `nowMs`. */
  request(pattern: SingleHaptic, nowMs: number): HapticDecision {
    this.settle(nowMs);
    if (nowMs - this.lastAt >= this.minGapMs) {
      this.lastAt = nowMs;
      this.lastPattern = pattern;
      return { kind: 'fire', pattern };
    }
    // dentro da janela: compara com a mais forte entre a pendente e a última que tocou
    const against = this.pending ? this.pending.pattern : this.lastPattern;
    const beats = against === null || HAPTIC_PRIORITY[pattern] > HAPTIC_PRIORITY[against];
    if (NOTIFY.has(pattern) && beats) {
      this.pending = { pattern, atMs: this.lastAt + this.minGapMs };
      return { kind: 'defer', pattern, atMs: this.pending.atMs };
    }
    return { kind: 'drop' };
  }

  /** Vibração adiada que deve tocar agora (chamada pelo temporizador). `null` se foi substituída. */
  take(pattern: SingleHaptic, nowMs: number): SingleHaptic | null {
    this.settle(nowMs);
    if (this.due !== pattern) return null;
    this.due = null;
    return pattern;
  }

  /** A pendente cujo horário chegou ocupa a janela e fica "devida" até o temporizador tocá-la. */
  private settle(nowMs: number) {
    if (this.pending && nowMs >= this.pending.atMs) {
      this.lastAt = this.pending.atMs;
      this.lastPattern = this.pending.pattern;
      this.due = this.pending.pattern;
      this.pending = null;
    }
  }

  reset() {
    this.lastAt = Number.NEGATIVE_INFINITY;
    this.lastPattern = null;
    this.pending = null;
    this.due = null;
  }
}

/** Mapeamento de cada padrão por plataforma (dados puros, testados). */
export const HAPTIC_IOS: Record<SingleHaptic, { api: 'selection' } | { api: 'impact'; style: Haptics.ImpactFeedbackStyle } | { api: 'notification'; type: Haptics.NotificationFeedbackType }> = {
  selection: { api: 'selection' },
  tap: { api: 'impact', style: Haptics.ImpactFeedbackStyle.Light },
  impact: { api: 'impact', style: Haptics.ImpactFeedbackStyle.Medium },
  heavy: { api: 'impact', style: Haptics.ImpactFeedbackStyle.Heavy },
  success: { api: 'notification', type: Haptics.NotificationFeedbackType.Success },
  warning: { api: 'notification', type: Haptics.NotificationFeedbackType.Warning },
  error: { api: 'notification', type: Haptics.NotificationFeedbackType.Error },
};

export const HAPTIC_ANDROID: Record<SingleHaptic, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  tap: Haptics.AndroidHaptics.Virtual_Key,
  impact: Haptics.AndroidHaptics.Context_Click,
  heavy: Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Reject,
  error: Haptics.AndroidHaptics.Reject,
};

const ignore = () => {};

/** Chama a API nativa do padrão. `os` vem do Expo (`process.env.EXPO_OS`); na web não faz nada. */
export function performHaptic(pattern: SingleHaptic, os: string | undefined = process.env.EXPO_OS): void {
  if (os === 'android') {
    Haptics.performAndroidHapticsAsync(HAPTIC_ANDROID[pattern]).catch(ignore);
    return;
  }
  if (os !== 'ios') return;
  const m = HAPTIC_IOS[pattern];
  if (m.api === 'selection') Haptics.selectionAsync().catch(ignore);
  else if (m.api === 'impact') Haptics.impactAsync(m.style).catch(ignore);
  else Haptics.notificationAsync(m.type).catch(ignore);
}

/** Portão do app inteiro (uma vibração por vez no aparelho). */
const gate = new HapticGate();
const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

function single(pattern: SingleHaptic, os: string | undefined) {
  const d = gate.request(pattern, now());
  if (d.kind === 'fire') performHaptic(pattern, os);
  else if (d.kind === 'defer') {
    setTimeout(() => {
      const p = gate.take(pattern, d.atMs);
      if (p) performHaptic(p, os);
    }, Math.max(0, d.atMs - now()));
  }
}

export type HapticOptions = {
  /** Liga/desliga nesta chamada (padrão ligada). A preferência salva "Vibração" também precisa estar ligada. */
  enabled?: boolean;
  /** Ignora a preferência (só alertas de segurança: SOS, sinal perdido). */
  force?: boolean;
  /** Plataforma (padrão: a do Expo). Útil em testes. */
  os?: string;
};

/**
 * Vibra com o padrão pedido, no mesmo quadro da animação (chame no efeito que a inicia ou via
 * `scheduleOnRN` no pico). Nada na web; nada com a preferência desligada (exceto `force`).
 */
export function haptic(pattern: HapticPattern, { enabled = true, force = false, os = process.env.EXPO_OS }: HapticOptions = {}): void {
  if (os !== 'ios' && os !== 'android') return;
  if (!force && !(enabled && getMotionPrefs().haptics)) return;
  for (const step of expandHaptic(pattern)) {
    if (step.offsetMs === 0) single(step.pattern, os);
    else setTimeout(() => single(step.pattern, os), step.offsetMs);
  }
}

/** Zera o portão global (testes e troca de tela). */
export function resetHaptics() {
  gate.reset();
}

/** `haptic` já com a preferência "Vibração" aplicada. */
export function useHaptics(enabled: boolean = true): (pattern: HapticPattern, force?: boolean) => void {
  return useCallback((pattern: HapticPattern, force?: boolean) => haptic(pattern, { enabled, force }), [enabled]);
}
