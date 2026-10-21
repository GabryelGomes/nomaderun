import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { dark, light, type ThemeColors } from './tokens';

type Scheme = 'light' | 'dark';

/** Força um esquema numa parte da árvore (ex.: telas neon de entrada, sempre escuras). */
const SchemeOverride = createContext<Scheme | null>(null);

export function ForceScheme({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return createElement(SchemeOverride.Provider, { value: scheme }, children);
}

/** Light by day, dark at night or when the system asks (RNF-010). */
export function useTheme(): { colors: ThemeColors; scheme: Scheme } {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const scheme = useContext(SchemeOverride) ?? system;
  return { colors: scheme === 'dark' ? dark : light, scheme };
}
