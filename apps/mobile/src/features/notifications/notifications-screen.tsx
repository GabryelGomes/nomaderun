import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { FadeUp, Pressable, staggerDelay } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { EmptyState, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useNow } from '@/features/use-now';
import { zoneTarget, type AppNotification, type NotificationType } from '@/services/api/notifications-repo';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { markRead, refreshNotifications } from './controller';

const TYPE_ICON: Record<NotificationType, IconName> = {
  invasion: 'warning',
  territory_lost: 'territory',
  conquest: 'flag',
  moderation: 'shield',
  mission: 'trophy',
  system: 'bell',
};

export function timeAgo(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Abre o destino da notificação: zona no mapa (UC-02 passo 4) ou nada além de marcar como lida. */
export function openNotification(n: AppNotification) {
  if (n.readAt === null) void markRead([n.id]);
  const target = zoneTarget(n);
  if (target) {
    router.navigate({
      pathname: '/',
      params: { zona: target.zoneId, t: String(Date.now()), ...(target.lat !== null && target.lng !== null ? { lat: String(target.lat), lng: String(target.lng) } : {}) },
    });
  }
}

/** Central de notificações (RF-019): lidas e não lidas, marcar como lida, chegada sem recarregar. */
export function NotificationsScreen() {
  const { colors } = useTheme();
  const items = useNotifications((s) => s.items);
  const loading = useNotifications((s) => s.loading);
  const error = useNotifications((s) => s.error);
  const unread = useNotifications(selectUnreadCount);
  const now = useNow(60_000);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refreshNotifications();
  }, []);

  const pull = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  return (
    <ScreenScroll testID="tela-notificacoes" edges={['bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
      <Stack.Screen options={{ title: 'Notificações' }} />

      {unread > 0 ? (
        <FadeUp style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
          <Text muted testID="notificacoes-nao-lidas">
            {unread === 1 ? '1 não lida' : `${unread} não lidas`}
          </Text>
          <Button testID="notificacoes-marcar-todas" label="Marcar todas como lidas" kind="ghost" onPress={() => void markRead(null)} />
        </FadeUp>
      ) : null}

      {error && items.length === 0 ? (
        <EmptyState
          title={error.code === 'NETWORK' ? 'Sem internet' : 'Não foi possível carregar'}
          body={error.message}
          action={<Button testID="notificacoes-tentar" label="Tentar de novo" kind="secondary" onPress={() => void refreshNotifications()} />}
        />
      ) : loading && items.length === 0 ? (
        <View style={{ paddingVertical: space[8] }}>
          <ActivityIndicator color={colors.action} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState title="Nada por aqui ainda" body="Avisos de invasão, zonas conquistadas e resultados da moderação aparecem nesta lista." />
      ) : (
        <Surface>
          {items.map((n, index) => {
            const isUnread = n.readAt === null;
            const hasZone = zoneTarget(n) !== null;
            return (
              <FadeUp key={n.id} delay={staggerDelay(index)}>
                <Pressable
                  testID={`notificacao-${n.id}`}
                  hitSlop={0}
                  accessibilityLabel={`${isUnread ? 'Não lida. ' : ''}${n.title}. ${n.body}${hasZone ? ' Toque para ver a zona no mapa.' : ''}`}
                  onPress={() => openNotification(n)}
                  style={{ minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isUnread ? colors.action : colors.surfaceSunken,
                    }}>
                    <Icon name={TYPE_ICON[n.type]} size={16} color={isUnread ? colors.onAction : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant={isUnread ? 'bodyBold' : 'body'}>{n.title}</Text>
                    <Text variant="small" muted>
                      {n.body}
                    </Text>
                    <Text variant="caption" muted>
                      {timeAgo(n.createdAt, now)}
                    </Text>
                  </View>
                  {hasZone ? <Icon name="chevron" size={18} color={colors.textSecondary} /> : null}
                </Pressable>
              </FadeUp>
            );
          })}
        </Surface>
      )}
    </ScreenScroll>
  );
}
