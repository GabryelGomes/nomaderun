import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/use-theme';

import { APP_TABS, RUN_ROUTE } from './app-tabs-config';
import { tabIcon } from './icon';

const [mapa, arena, correr, clube, voce] = APP_TABS;

/**
 * Barra de abas nativa do sistema (expo-router skill), D-73: Mapa · Arena · Correr · Clube · Você. Troca de aba
 * nunca anima (expo-animation).
 *
 * **Correr** é uma aba comum (as abas nativas não têm botão central elevado): o toque abre a Nova corrida por cima
 * de tudo; a tela da aba fica como ponto de partida quando a corrida fecha. O ícone é laranja quando selecionado
 * (a cor do ícone não selecionado é a mesma das outras abas no nativo; a versão sempre laranja depende de um
 * ícone em PNG da E4, pedido no relatório E6a-onda2).
 */
export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      labelStyle={{ selected: { color: colors.action } }}
      tintColor={colors.action}
      screenListeners={({ route }) => (route.name === correr.name ? { tabPress: () => router.push(RUN_ROUTE) } : {})}>
      <NativeTabs.Trigger name={mapa.name} testID={mapa.testID}>
        <NativeTabs.Trigger.Icon {...tabIcon(mapa.icon)} />
        <NativeTabs.Trigger.Label>{mapa.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={arena.name} testID={arena.testID}>
        <NativeTabs.Trigger.Icon {...tabIcon(arena.icon)} />
        <NativeTabs.Trigger.Label>{arena.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={correr.name} testID={correr.testID} accessibilityLabel="Correr: abrir a Nova corrida">
        <NativeTabs.Trigger.Icon
          src={{ default: require('../../assets/art/aba-correr.png'), selected: require('../../assets/art/aba-correr-selecionado.png') }}
          renderingMode="original"
        />
        <NativeTabs.Trigger.Label>{correr.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={clube.name} testID={clube.testID}>
        <NativeTabs.Trigger.Icon {...tabIcon(clube.icon)} />
        <NativeTabs.Trigger.Label>{clube.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={voce.name} testID={voce.testID}>
        <NativeTabs.Trigger.Icon {...tabIcon(voce.icon)} />
        <NativeTabs.Trigger.Label>{voce.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
