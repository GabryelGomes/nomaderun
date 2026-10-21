import { createContext, createElement, useContext, type ReactNode } from 'react';

import { dark, light, type ThemeColors } from './tokens';

type Scheme = 'light' | 'dark';

/** Força um esquema numa parte da árvore (ex.: telas neon de entrada, sempre escuras). */
const SchemeOverride = createContext<Scheme | null>(null);

export function ForceScheme({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return createElement(SchemeOverride.Provider, { value: scheme }, children);
}

/**
 * O app é sempre escuro, no visual neon da apresentação (D-59). O tema claro continua em `tokens.ts`
 * para quem quiser voltar (troque `APP_SCHEME`).
 */
export const APP_SCHEME: Scheme = 'dark';

export function useTheme(): { colors: ThemeColors; scheme: Scheme } {
  const scheme = useContext(SchemeOverride) ?? APP_SCHEME;
  return { colors: scheme === 'dark' ? dark : light, scheme };
}
