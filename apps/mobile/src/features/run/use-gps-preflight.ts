/**
 * Antes de correr com GPS real (UC-01 passo 2, E3; RNF-013): confere permissão e GPS do aparelho,
 * explica antes de pedir, oferece Ajustes/simulação quando negado e espera um sinal ≤ 30 m.
 * Com sinal fraco por mais de 15 s, avisa e permite iniciar mesmo assim.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { checkLocationAccess, requestLocationAccess, type LocationAccess } from '@/services/location/permissions';
import { createSignalMonitor, type SignalState } from '@/services/location/signal';
import { watchFixes, type FixSubscription } from '@/services/location/tracker';

export type PreflightStep = { kind: 'checking' } | { kind: 'access'; access: LocationAccess } | { kind: 'signal'; signal: SignalState; accuracy: number | null } | { kind: 'ready' };

export function useGpsPreflight(enabled: boolean) {
  const [step, setStep] = useState<PreflightStep>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const subRef = useRef<FixSubscription | null>(null);

  const evaluate = useCallback((access: LocationAccess) => {
    setStep(access.status === 'granted' ? { kind: 'signal', signal: 'searching', accuracy: null } : { kind: 'access', access });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void checkLocationAccess().then((a) => alive && evaluate(a));
    return () => {
      alive = false;
    };
  }, [enabled, attempt, evaluate]);

  // Espera o sinal: bom → pronto; ruim por mais de 15 s → "fraco" (continua ouvindo).
  const searching = step.kind === 'signal';
  useEffect(() => {
    if (!enabled || !searching) return;
    let alive = true;
    const monitor = createSignalMonitor(Date.now());
    const tick = setInterval(() => {
      const s = monitor.tick(Date.now());
      if (alive) setStep((cur) => (cur.kind === 'signal' ? { ...cur, signal: s } : cur));
    }, 1000);
    void watchFixes(
      (f) => {
        if (!alive) return;
        const s = monitor.feed(f.accuracy, Date.now());
        setStep(s === 'good' ? { kind: 'ready' } : { kind: 'signal', signal: s, accuracy: f.accuracy });
      },
      () => undefined,
    ).then((sub) => {
      if (alive) subRef.current = sub;
      else sub?.remove();
    });
    return () => {
      alive = false;
      clearInterval(tick);
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled, searching]);

  return {
    step,
    /** Pedido do sistema, depois da explicação na tela. */
    request: async () => evaluate(await requestLocationAccess()),
    retry: () => {
      setStep({ kind: 'checking' });
      setAttempt((n) => n + 1);
    },
    startAnyway: () => setStep({ kind: 'ready' }),
  };
}
