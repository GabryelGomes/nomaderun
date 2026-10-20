/**
 * Alerta de parada da Corrida Segura (RF-024): parado por mais de 10 minutos → pergunta "Está tudo
 * bem?" com 60 s para responder; sem resposta, dispara o mesmo envio do SOS.
 * Puro (relógio injetado) para testar com timers falsos.
 */
import { distanceMeters } from '@/domain/geo';
import type { LatLng } from '@/domain/types';

export const STOP_ALERT_MS = 10 * 60_000;
export const STOP_ALERT_GRACE_MS = 60_000;
/** Deslocamento abaixo disso conta como "parado" (ruído do GPS parado fica em 5–15 m). */
export const STILL_RADIUS_M = 25;
export const STOP_ALERT_TICK_MS = 1000;

export type StopAlertPhase = 'watching' | 'asking' | 'alerted';

export type StopAlertOptions = {
  onAsk: (deadline: number) => void;
  onAlert: () => void;
  /** A pergunta sumiu (respondeu ou voltou a se mover). */
  onClear?: () => void;
  now?: () => number;
  stillMs?: number;
  graceMs?: number;
  radiusM?: number;
};

export function createStopAlert(opts: StopAlertOptions) {
  const now = opts.now ?? Date.now;
  const stillMs = opts.stillMs ?? STOP_ALERT_MS;
  const graceMs = opts.graceMs ?? STOP_ALERT_GRACE_MS;
  const radius = opts.radiusM ?? STILL_RADIUS_M;
  let anchor: LatLng | null = null;
  let anchorAt = now();
  let phase: StopAlertPhase = 'watching';
  let deadline = 0;

  const clear = () => {
    if (phase === 'asking') opts.onClear?.();
    phase = 'watching';
  };

  const api = {
    /** Nova posição do GPS. Mexeu mais que o raio → zera a contagem (e fecha a pergunta). */
    feed(p: LatLng, t = now()) {
      if (!anchor || distanceMeters(anchor, p) > radius) {
        anchor = p;
        anchorAt = t;
        if (phase === 'asking') clear();
      }
      api.tick(t);
    },
    tick(t = now()) {
      if (phase === 'watching' && t - anchorAt >= stillMs) {
        phase = 'asking';
        deadline = t + graceMs;
        opts.onAsk(deadline);
      } else if (phase === 'asking' && t >= deadline) {
        phase = 'alerted';
        opts.onAlert();
      }
    },
    /** "Estou bem": recomeça a contagem a partir de agora. */
    confirmOk(t = now()) {
      anchorAt = t;
      clear();
    },
    /** Depois do alerta enviado, volta a vigiar do zero. */
    reset(t = now()) {
      anchorAt = t;
      phase = 'watching';
    },
    get phase() {
      return phase;
    },
    get deadline() {
      return deadline;
    },
  };
  return api;
}

export type StopAlert = ReturnType<typeof createStopAlert>;
