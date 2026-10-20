import { beforeEach, describe, expect, it } from '@jest/globals';

import { DEFAULT_NOTIFICATION_PREFS } from '@/services/api/types';
import { toNotification, zoneTarget } from '@/services/api/notifications-repo';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';

import { prefAllows } from '../local-alert';

const n = (id: string, created: number, extra: Record<string, unknown> = {}) =>
  toNotification({ id, type: 'invasion', title: 'Invasão', body: 'Coyotes atacam', data: { zoneId: '89a8c0e24a3ffff', lat: -16.7, lng: -49.2 }, read_at: null, created_at: new Date(created).toISOString(), ...extra });

beforeEach(() => useNotifications.getState().reset());

describe('notificações (RF-019, RF-009)', () => {
  it('converte a linha e acha o destino no mapa', () => {
    const x = n('a', 1000);
    expect(x).toMatchObject({ id: 'a', type: 'invasion', readAt: null, createdAt: 1000 });
    expect(zoneTarget(x)).toEqual({ zoneId: '89a8c0e24a3ffff', lat: -16.7, lng: -49.2 });
    expect(zoneTarget(toNotification({ id: 'b', type: 'moderation', data: { activityId: 'x' } }))).toBeNull();
    expect(toNotification({ id: 'c', type: 'desconhecido' }).type).toBe('system');
  });

  it('store: ordena, não duplica o que chega pelo Realtime e conta as não lidas', () => {
    const s = useNotifications.getState();
    s.setItems([n('a', 1000), n('b', 3000)]);
    expect(useNotifications.getState().items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(s.add(n('c', 5000))).toBe(true);
    expect(s.add(n('c', 5000))).toBe(false);
    expect(selectUnreadCount(useNotifications.getState())).toBe(3);
    s.markReadLocal(['a']);
    expect(selectUnreadCount(useNotifications.getState())).toBe(2);
    s.markReadLocal(null);
    expect(selectUnreadCount(useNotifications.getState())).toBe(0);
  });

  it('notificação local respeita as preferências do perfil', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, invasions: false };
    expect(prefAllows(n('a', 1), prefs)).toBe(false);
    expect(prefAllows(toNotification({ id: 'b', type: 'conquest' }), prefs)).toBe(true);
    expect(prefAllows(toNotification({ id: 'c', type: 'moderation' }), { ...prefs, moderation: false })).toBe(false);
    expect(prefAllows(n('a', 1), null)).toBe(true);
  });
});
