import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Text } from '@/components/text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { echoText, useCrewEcho } from './crew-echo';
import { readLocal, writeLocal } from './local-store';

/** Dia do eco (AAAA-MM-DD) que a pessoa fechou no Clube: o card some até o eco do dia seguinte (1×/dia). */
const DISMISSED_KEY = 'crew-echo-dismissed-day';

export async function readEchoDismissedDay(): Promise<string | null> {
  const v = await readLocal<unknown>(DISMISSED_KEY).catch(() => null);
  return typeof v === 'string' ? v : null;
}

/**
 * Eco da crew na central de avisos (F8 · 5.7): "Rafa reforçou 3 trechos que você pintou". 1 por dia (o servidor
 * agrega o dia anterior), só entre 07h e 22h. Relação, não cobrança: nada de "e você?". Sem eco, nada.
 */
export function CrewEchoCard({ now, testID = 'eco-da-crew', dismissible = false }: { now: number; testID?: string; dismissible?: boolean }) {
  const { colors } = useTheme();
  const echo = useCrewEcho(now);
  // C2 (E8): no topo do feed do Clube, 1 vez por dia — fechar esconde o eco deste dia (a central continua com ele).
  const [dismissed, setDismissed] = useState<string | null | undefined>(dismissible ? undefined : null);
  useEffect(() => {
    if (!dismissible) return;
    let alive = true;
    void readEchoDismissedDay().then((d) => alive && setDismissed(d));
    return () => {
      alive = false;
    };
  }, [dismissible]);
  if (!echo || dismissed === undefined || (dismissible && dismissed === echo.day)) return null;
  const text = echoText(echo);
  const label = `Eco da crew, ontem: ${text}.${echo.isDemo ? ' Demonstração.' : ''}`;
  const close = () => {
    setDismissed(echo.day);
    void writeLocal(DISMISSED_KEY, echo.day).catch(() => undefined);
  };
  return (
    <View
      testID={testID}
      accessible={!dismissible}
      accessibilityLabel={dismissible ? undefined : label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.action, backgroundColor: colors.surface }}>
      <View aria-hidden style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken }}>
        <Icon name="brush" size={16} color={colors.accentText} />
      </View>
      {/* Com o botão de fechar, o rótulo vai no bloco de texto (o botão continua alcançável pelo leitor de tela). */}
      <View accessible={dismissible} accessibilityLabel={dismissible ? label : undefined} style={{ flex: 1, gap: 2 }}>
        <Text variant="label" muted style={{ textTransform: 'uppercase' }}>
          Eco da crew · ontem
        </Text>
        <Text variant="body">{text}</Text>
        {echo.isDemo ? <DemoBadge /> : null}
      </View>
      {dismissible ? (
        <PressableScale
          testID={`${testID}-fechar`}
          accessibilityRole="button"
          accessibilityLabel="Fechar o eco da crew de hoje"
          onPress={close}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </PressableScale>
      ) : null}
    </View>
  );
}
