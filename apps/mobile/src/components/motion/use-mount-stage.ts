import { useEffect, useState } from 'react';

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/**
 * Montagem em etapas (F8-D, QA da onda D): um momento pesado (mascote em SVG neon, ondas, confete) montado inteiro no
 * toque fazia um quadro de 150–316 ms a 4× de CPU na cerimônia do time. Com esta trava, a etapa 0 sai no quadro do
 * toque e cada etapa seguinte só monta depois que a anterior foi pintada (dois `requestAnimationFrame`).
 *
 * `lag(s)` = milissegundos entre a 1ª renderização e a montagem da etapa `s` (0 para a etapa 0 e para as que ainda
 * não montaram): quem monta depois desconta isso do próprio atraso de animação, para a coreografia seguir no mesmo
 * tempo de relógio. Sem `requestAnimationFrame` (renderização estática), tudo monta de uma vez.
 */
export function useMountStage(last: number): { stage: number; lag: (s: number) => number } {
  const [state, setState] = useState(() => ({
    t0: now(),
    stage: typeof requestAnimationFrame === 'function' ? 0 : last,
    lags: [0] as readonly number[],
  }));

  useEffect(() => {
    if (state.stage >= last) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        setState((s) => (s.stage >= last ? s : { ...s, stage: s.stage + 1, lags: [...s.lags, Math.max(0, now() - s.t0)] })),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [state.stage, last]);

  return { stage: state.stage, lag: (s) => state.lags[s] ?? 0 };
}
