import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DemoBadge, registerDemoSeal } from '@/components/demo-badge';
import { Text } from '@/components/text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { canLeaveDemo, leaveDemo } from './demo-entry';

/**
 * Selo "Demonstração" fixo no canto de cima (D-77): aparece em toda tela enquanto o modo demonstração está ligado.
 * O selo em si não recebe toque (os botões embaixo dele continuam funcionando) e tem fundo para ficar legível sobre
 * o mapa. Quando a demonstração foi ligada pelo botão (build normal), ganha um "Sair" ao lado.
 * O `testID` contém `demonstracao`: as capturas (`e2e-web/capturas.cjs`) usam o selo do app e não põem o delas.
 */
export function DemoSeal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);
  const exit = canLeaveDemo();
  // As telas (Screen, ScreenScroll, Mapa e corrida) descem a altura do selo enquanto ele está montado.
  useEffect(() => registerDemoSeal(), []);
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        // No alto e no centro: os cantos têm o "voltar", o "fechar" e os botões do cabeçalho.
        // Colado no topo (sem os 2 px de antes): o título dos cabeçalhos com "voltar" começa logo abaixo (E10, onda 4).
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 1000,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: space[1],
      }}>
      <View pointerEvents="none" style={{ borderRadius: radius.pill, backgroundColor: colors.background, opacity: 0.92 }}>
        <DemoBadge testID="selo-demonstracao" />
      </View>
      {exit ? (
        <Pressable
          testID="selo-demonstracao-sair"
          accessibilityRole="button"
          accessibilityLabel="Sair da demonstração"
          disabled={leaving}
          hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
          onPress={async () => {
            setLeaving(true);
            await leaveDemo();
            setLeaving(false);
          }}
          style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.background }}>
          <Text variant="label" color={colors.accentText} maxFontSizeMultiplier={1.3}>
            {leaving ? 'Saindo…' : 'Sair'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
