import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

export type DemoBadgeProps = {
  label?: string;
  testID?: string;
};

/**
 * Selo padrão de dado de demonstração (regra do projeto: demonstração sempre identificada).
 * Neutro e tracejado de propósito: não parece botão nem conquista.
 */
export function DemoBadge({ label = 'Demonstração', testID }: DemoBadgeProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: dados de exemplo, não são reais`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space[1],
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.lineControl,
      }}>
      <Icon name="eye" size={12} color={colors.textSecondary} />
      <Text variant="label" muted style={{ textTransform: 'uppercase' }} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}

/** Altura que o selo fixo "Demonstração" (DemoSeal: topo + 2 e ~20 px) ocupa abaixo do `insets.top`. */
export const DEMO_SEAL_SPACE = 22;

let seals = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** O selo fixo avisa que está na tela (devolve a função que desfaz). Usado pelo `DemoSeal`. */
export function registerDemoSeal(): () => void {
  seals++;
  emit();
  return () => {
    seals--;
    emit();
  };
}

/**
 * E10 (onda 4): espaço a deixar no alto enquanto o selo fixo "Demonstração" está na tela (0 fora da demonstração).
 * O selo fica no alto e no centro, por cima de tudo: sem esta folga ele cobria o nome do time no Mapa, a faixa da
 * corrida, o "Zona conquistada" do resumo e os títulos das telas sem cabeçalho.
 */
export function useDemoSealSpace(): number {
  return useSyncExternalStore(subscribe, () => (seals > 0 ? DEMO_SEAL_SPACE : 0), () => 0);
}
