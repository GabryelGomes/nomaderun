import { createContext, useContext, type ReactNode } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * "Reduzir movimento" (RNF-011, D-71). As animações CSS do Reanimated ignoram o ajuste do sistema, então
 * cada primitiva v2 decide à mão: com `true`, sem deslocamento, escala, giro, tremor nem partícula; só
 * fade curto. A galeria (`/dev/motion`) força o modo com `ReducedMotionOverride` para comparar os dois.
 */
const Override = createContext<boolean | null>(null);

export function ReducedMotionOverride({ reduced, children }: { reduced: boolean | null; children: ReactNode }) {
  return <Override.Provider value={reduced}>{children}</Override.Provider>;
}

/** O ajuste do sistema (`useReducedMotion`), a menos que uma galeria/teste force outro valor. */
export function useReducedMotionSetting(): boolean {
  const system = useReducedMotion();
  const forced = useContext(Override);
  return forced ?? system;
}
