import { View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './motion/pressable';
import { Text } from './text';

export type SettingsRowProps = {
  testID: string;
  icon: IconName;
  title: string;
  /** Valor atual à direita (ex.: "2 contatos"). */
  value?: string;
  onPress: () => void;
  /** Ação destrutiva (ex.: "Sair"): texto em vermelho, sem seta. */
  destructive?: boolean;
  accessibilityLabel?: string;
};

/** Linha de Ajustes: ícone, título e valor, sem subtítulo (D-74). Alvo de 56 pt. */
export function SettingsRow({ testID, icon, title, value, onPress, destructive, accessibilityLabel }: SettingsRowProps) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : colors.text;
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      onPress={onPress}
      hitSlop={0}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] }}>
      <Icon name={icon} size={22} color={tint} />
      <Text variant="bodyBold" color={tint} style={{ flex: 1 }}>
        {title}
      </Text>
      {value ? (
        <Text variant="small" muted numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Text>
      ) : null}
      {destructive ? null : (
        <View aria-hidden>
          <Icon name="chevron" size={18} color={colors.textSecondary} />
        </View>
      )}
    </PressableScale>
  );
}
