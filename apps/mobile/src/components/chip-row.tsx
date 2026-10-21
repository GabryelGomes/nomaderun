import { type ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { neon } from '@/theme/neon';
import { useTheme } from '@/theme/use-theme';

import { PressableScale } from './motion/pressable';
import { layout } from './screen';
import { Text } from './text';

/** Espaço em volta da linha de chips para o brilho do selecionado não ser recortado. */
export const GLOW_ROOM = 14;

export type ChipSize = 'sm' | 'md';

/** Alturas atuais dos chips do app: 36 (filtros do Clube, texto `caption`) e 40 (período, ritmo; texto `bodyBold`). */
const CHIP = {
  sm: { height: 36, variant: 'caption' as const, slop: 8 },
  md: { height: 40, variant: 'bodyBold' as const, slop: 4 },
} as const;

export type ChipProps = {
  testID: string;
  accessibilityLabel: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: ChipSize;
  /** `radio` em grupos de escolha única (padrão), `button` em filtros soltos. */
  role?: 'radio' | 'button';
  tabular?: boolean;
};

/**
 * Chip em pílula. Selecionado (neon, D-59): contorno e brilho laranja, texto laranja sobre laranja a 14%. O alvo de toque passa de 44 pt
 * com `hitSlop` sem mudar o desenho. Retorno de toque do `PressableScale`.
 */
export function Chip({ testID, accessibilityLabel, label, selected, onPress, size = 'sm', role = 'radio', tabular }: ChipProps) {
  const { colors } = useTheme();
  const c = CHIP[size];
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      hitSlop={{ top: c.slop, bottom: c.slop, left: 2, right: 2 }}
      onPress={onPress}
      style={{
        paddingHorizontal: space[4],
        height: c.height,
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: selected ? neon.activeFill : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.action : colors.line,
        boxShadow: selected ? '0 0 14px rgba(255,106,19,0.35)' : undefined,
      }}>
      <Text variant={c.variant} tabular={tabular} color={selected ? colors.accentText : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

export type ChipOption<T extends string> = readonly [T, string] | { key: T; label: string; accessibilityLabel?: string };

export type ChipRowProps<T extends string> = {
  /** Opções `[chave, rótulo]` ou `{ key, label, accessibilityLabel }`. Alternativa: `children` com `Chip`s. */
  options?: readonly ChipOption<T>[];
  value?: T;
  onChange?: (v: T) => void;
  /** Prefixo dos testIDs: cada chip recebe `${testID}-${chave}` (mesmo padrão das telas atuais). */
  testID: string;
  /** Nome do grupo para o leitor de tela (ex.: "Período"). */
  accessibilityLabel: string;
  /** Monta o accessibilityLabel de cada chip (padrão: o rótulo). Ex.: `(l) => \`Período: ${l}\``. */
  chipLabel?: (label: string) => string;
  size?: ChipSize;
  role?: 'radio' | 'button';
  tabular?: boolean;
  /** Sangra até as bordas da tela (rola de ponta a ponta); padrão: sim, assumindo a margem de 16 pt. */
  bleed?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Linha de chips que **rola na horizontal** em vez de quebrar em duas linhas (bug "filtros quebram em
 * 2 linhas" em 360 pt). Visual dos chips mantido.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testID,
  accessibilityLabel,
  chipLabel,
  size = 'sm',
  role = 'radio',
  tabular,
  bleed = true,
  children,
  style,
}: ChipRowProps<T>) {
  const items = (options ?? []).map((o) => (Array.isArray(o) ? { key: o[0] as T, label: o[1] as string, accessibilityLabel: undefined } : (o as { key: T; label: string; accessibilityLabel?: string })));
  const g = layout.gutter;
  // Folga para o brilho do chip selecionado: no iOS a ScrollView recorta o que passa das bordas e o brilho
  // (14 px) aparecia cortado em linhas retas (revisão nº 1, M-1). A margem negativa mantém o layout.
  const room = GLOW_ROOM;
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole={role === 'radio' ? 'radiogroup' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ flexGrow: 0, marginVertical: -room, marginHorizontal: bleed ? -g : -room }, style]}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: bleed ? g : room, paddingVertical: room, alignItems: 'center' }}>
      {items.map((o) => (
        <Chip
          key={o.key}
          testID={`${testID}-${o.key}`}
          accessibilityLabel={o.accessibilityLabel ?? (chipLabel ? chipLabel(o.label) : o.label)}
          label={o.label}
          selected={o.key === value}
          onPress={() => onChange?.(o.key)}
          size={size}
          role={role}
          tabular={tabular}
        />
      ))}
      {children}
    </ScrollView>
  );
}
