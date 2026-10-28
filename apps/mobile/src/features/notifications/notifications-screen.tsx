import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { FadeUp, Pressable, staggerDelay } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { EmptyState, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { brtCalendar } from '@/domain/progression';
import { useNow } from '@/features/use-now';
import { zoneTarget, type AppNotification, type NotificationType } from '@/services/api/notifications-repo';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
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

export type DayGroup = 'Hoje' | 'Ontem' | 'Esta semana' | 'Antes';
const GROUP_ORDER: readonly DayGroup[] = ['Hoje', 'Ontem', 'Esta semana', 'Antes'];
const GROUP_ID: Record<DayGroup, string> = { Hoje: 'hoje', Ontem: 'ontem', 'Esta semana': 'semana', Antes: 'antes' };

/** Grupo do dia (em Brasília) de um instante: hoje, ontem, nos últimos 7 dias ou antes. */
export function dayGroupOf(at: number, now: number): DayGroup {
  const days = brtCalendar.daysBetween(brtCalendar.clock(at).dayId, brtCalendar.clock(now).dayId);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return 'Esta semana';
  return 'Antes';
}

/** Notificações agrupadas por dia, na ordem da lista (mais novas primeiro); grupos vazios saem. */
export function groupByDay<T extends { createdAt: number }>(items: readonly T[], now: number): { group: DayGroup; items: T[] }[] {
  const by = new Map<DayGroup, T[]>();
  for (const n of items) {
    const g = dayGroupOf(n.createdAt, now);
    by.set(g, [...(by.get(g) ?? []), n]);
  }
  return GROUP_ORDER.filter((g) => by.has(g)).map((group) => ({ group, items: by.get(group)! }));
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
  const team = useSession((s) => s.profile?.faction ?? undefined);
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
        <EmptyState testID="notificacoes-vazio" art={<EmptyArt kind="sem-notificacoes" team={team} size={200} />} title="Tudo calmo por aqui" body="Ataques e conquistas aparecem aqui." />
      ) : (
        groupByDay(items, now).map(({ group, items: dayItems }) => (
          <View key={group} testID={`notificacoes-grupo-${GROUP_ID[group]}`} style={{ gap: space[2] }}>
            <Text variant="label" muted accessibilityRole="header" style={{ paddingHorizontal: space[1], textTransform: 'uppercase' }}>
              {group}
            </Text>
            <Surface>
              {dayItems.map((n, index) => {
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
          </View>
        ))
      )}
    </ScreenScroll>
  );
}
