/**
 * T7.2.5 — `<FeedSettings>`: "Mostrar minhas corridas para a crew" e "Mostrar o mapa das minhas corridas"
 * (`my_feed_settings` / `set_feed_settings`). A E6 encaixa em Você → Privacidade. Desligar as corridas apaga
 * os itens; desligar o mapa tira as rotas já publicadas (o servidor faz).
 */
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { getFeedSettings, isFeedUnavailable, setFeedSettings, type FeedSettings as Settings } from '@/services/api/feed-repo';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ROWS = [
  { key: 'shareRunsToFeed', title: 'Mostrar minhas corridas para a crew', body: 'Desligar tira as que já estão no feed.', testID: 'feed-config-corridas' },
  { key: 'feedShowMap', title: 'Mostrar o mapa das minhas corridas', body: 'Sempre sem o começo, o fim e suas zonas de privacidade.', testID: 'feed-config-mapa' },
] as const;

export function FeedSettings({ testID = 'feed-config' }: { testID?: string }) {
  const { colors } = useTheme();
  const [value, setValue] = useState<Settings | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  useEffect(() => {
    let alive = true;
    void getFeedSettings().then((r) => {
      if (!alive) return;
      if (r.ok) {
        setValue(r.data);
        setStatus('ready');
      } else setStatus(isFeedUnavailable(r.error) ? 'unavailable' : 'error');
    });
    return () => {
      alive = false;
    };
  }, []);

  const change = async (key: keyof Settings, v: boolean) => {
    if (!value) return;
    const before = value;
    setValue({ ...value, [key]: v });
    const r = await setFeedSettings({ [key]: v });
    if (r.ok) setValue(r.data);
    else {
      setValue(before);
      setStatus('error');
    }
  };

  if (status === 'unavailable') return null;
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      {ROWS.map((row) => (
        <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{row.title}</Text>
            <Text variant="small" muted>
              {row.body}
            </Text>
          </View>
          <Switch
            testID={row.testID}
            accessibilityLabel={row.title}
            value={value?.[row.key] ?? true}
            disabled={!value}
            onValueChange={(v) => void change(row.key, v)}
            trackColor={{ true: colors.action, false: colors.lineControl }}
          />
        </View>
      ))}
      {status === 'error' ? (
        <Text variant="small" color={colors.danger} testID={`${testID}-erro`}>
          Não deu para salvar agora. Tente de novo.
        </Text>
      ) : null}
    </View>
  );
}
