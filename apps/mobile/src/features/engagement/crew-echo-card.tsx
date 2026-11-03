import { View } from 'react-native';

import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { echoText, useCrewEcho } from './crew-echo';

/**
 * Eco da crew na central de avisos (F8 · 5.7): "Rafa reforçou 3 trechos que você pintou". 1 por dia (o servidor
 * agrega o dia anterior), só entre 07h e 22h. Relação, não cobrança: nada de "e você?". Sem eco, nada.
 */
export function CrewEchoCard({ now, testID = 'eco-da-crew' }: { now: number; testID?: string }) {
  const { colors } = useTheme();
  const echo = useCrewEcho(now);
  if (!echo) return null;
  const text = echoText(echo);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Eco da crew, ontem: ${text}.${echo.isDemo ? ' Demonstração.' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.action, backgroundColor: colors.surface }}>
      <View aria-hidden style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken }}>
        <Icon name="brush" size={16} color={colors.accentText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" muted style={{ textTransform: 'uppercase' }}>
          Eco da crew · ontem
        </Text>
        <Text variant="body">{text}</Text>
        {echo.isDemo ? <DemoBadge /> : null}
      </View>
    </View>
  );
}
