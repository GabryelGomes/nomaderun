import type { ThemeColors } from '@/theme/tokens';

/**
 * Cores do interruptor nos tokens (UX-36): trilho laranja (`action`) ligado, cinza desligado, bolinha no branco quente
 * do texto. Sem isto, a web pintava a bolinha de verde-azulado (`#009688`, padrão do react-native-web) sobre o laranja.
 * `activeThumbColor` só existe no react-native-web; o aparelho usa `thumbColor`.
 */
export function switchColors(colors: Pick<ThemeColors, 'action' | 'lineControl' | 'text'>) {
  return {
    trackColor: { true: colors.action, false: colors.lineControl },
    thumbColor: colors.text,
    ios_backgroundColor: colors.lineControl,
    activeThumbColor: colors.text,
  };
}
