import { useColorScheme } from 'react-native';

import { dark, light, type ThemeColors } from './tokens';

/** Light by day, dark at night or when the system asks (RNF-010). */
export function useTheme(): { colors: ThemeColors; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: scheme === 'dark' ? dark : light, scheme };
}
