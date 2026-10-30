import { Text as RNText, type TextProps } from 'react-native';

import { fonts, type as scale } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type TextVariant = Variant;
type Variant = 'hero' | 'metric' | 'headline' | 'title' | 'lead' | 'body' | 'bodyBold' | 'small' | 'caption' | 'label';

const VARIANTS: Record<Variant, { fontFamily: string; fontSize: number; lineHeight?: number; letterSpacing?: number }> = {
  hero: { fontFamily: fonts.display, fontSize: scale.giant, lineHeight: scale.giant, letterSpacing: -2 },
  metric: { fontFamily: fonts.display, fontSize: scale.metric, lineHeight: scale.metric * 1.05, letterSpacing: -1 },
  headline: { fontFamily: fonts.display, fontSize: scale.headline, lineHeight: scale.headline * 1.1, letterSpacing: -0.5 },
  title: { fontFamily: fonts.textBold, fontSize: scale.lead, lineHeight: scale.lead * 1.3 },
  lead: { fontFamily: fonts.textMedium, fontSize: scale.lead, lineHeight: scale.lead * 1.35 },
  body: { fontFamily: fonts.text, fontSize: scale.body, lineHeight: scale.body * 1.45 },
  bodyBold: { fontFamily: fonts.textBold, fontSize: scale.body, lineHeight: scale.body * 1.45 },
  small: { fontFamily: fonts.text, fontSize: scale.small, lineHeight: scale.small * 1.4 },
  caption: { fontFamily: fonts.textMedium, fontSize: scale.caption, lineHeight: scale.caption * 1.35 },
  label: { fontFamily: fonts.textBold, fontSize: scale.caption, lineHeight: scale.caption * 1.3, letterSpacing: 0.6 },
};

/**
 * Teto da fonte do sistema por variante (acessibilidade, fonte grande): os números de display têm altura de linha
 * fixa e estouram a largura com 200%; os textos corridos crescem sem teto.
 */
export const FONT_SCALE_MAX: Partial<Record<Variant, number>> = { hero: 1.2, metric: 1.3, headline: 1.3 };

/** Métricas de cada variante (usadas pelo `RevealText` para medir a máscara). */
export const TEXT_VARIANTS: Readonly<typeof VARIANTS> = VARIANTS;

export type AppTextProps = TextProps & { variant?: Variant; color?: string; muted?: boolean; tabular?: boolean };

export function Text({ variant = 'body', color, muted, tabular, style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? FONT_SCALE_MAX[variant]}
      style={[
        VARIANTS[variant],
        { color: color ?? (muted ? colors.textSecondary : colors.text) },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
