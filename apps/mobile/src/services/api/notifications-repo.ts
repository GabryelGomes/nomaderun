import { attempt, fail, ok, toAppError, type Result } from './errors';
import { requireSupabase } from './supabase';

/**
 * Central de notificações (RF-019) e alertas de invasão (RF-009): tabela `notifications`
 * (RLS: só as próprias), `rpc('mark_notifications_read', { ids })` e Realtime (INSERT do próprio usuário).
 */
export type NotificationType = 'invasion' | 'territory_lost' | 'conquest' | 'moderation' | 'mission' | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { zoneId?: string; lat?: number; lng?: number; activityId?: string; [k: string]: unknown };
  readAt: number | null;
  createdAt: number;
};

const TYPES: NotificationType[] = ['invasion', 'territory_lost', 'conquest', 'moderation', 'mission', 'system'];

type Row = Record<string, unknown>;

const ms = (v: unknown) => {
  if (typeof v === 'number') return v;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

export function toNotification(row: Row): AppNotification {
  const data = row.data && typeof row.data === 'object' ? (row.data as AppNotification['data']) : {};
  return {
    id: String(row.id ?? ''),
    type: TYPES.includes(row.type as NotificationType) ? (row.type as NotificationType) : 'system',
    title: typeof row.title === 'string' ? row.title : '',
    body: typeof row.body === 'string' ? row.body : '',
    data,
    readAt: ms(row.read_at),
    createdAt: ms(row.created_at) ?? 0,
  };
}

/** Destino no mapa de uma notificação de zona (UC-02 passo 4), ou null. */
export function zoneTarget(n: AppNotification): { zoneId: string; lat: number | null; lng: number | null } | null {
  const zoneId = typeof n.data.zoneId === 'string' ? n.data.zoneId : null;
  if (!zoneId) return null;
  return { zoneId, lat: typeof n.data.lat === 'number' ? n.data.lat : null, lng: typeof n.data.lng === 'number' ? n.data.lng : null };
}

export async function listNotifications(limit = 50): Promise<Result<AppNotification[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase()
      .from('notifications')
      .select('id,type,title,body,data,read_at,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toNotification);
  });
}

/** `ids` nulo marca todas como lidas. Devolve quantas foram marcadas. */
export async function markNotificationsRead(ids: string[] | null): Promise<Result<number>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('mark_notifications_read', { ids });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  });
}

export type NotificationsSubscription = { unsubscribe: () => void };

/**
 * Realtime das notificações novas do usuário (`notifications` está na publicação `supabase_realtime`
 * com RLS, P-13). `onStatus` recebe o status do canal (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`,
 * `CLOSED`): o controller liga a consulta periódica só quando o canal não está `SUBSCRIBED` (P-24).
 */
export function subscribeNotifications(
  userId: string,
  onNew: (n: AppNotification) => void,
  onStatus?: (status: string) => void,
): Result<NotificationsSubscription> {
  try {
    const supabase = requireSupabase();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: { new?: Row }) => {
        if (payload.new && typeof payload.new.id === 'string') onNew(toNotification(payload.new));
      })
      .subscribe((status: string) => onStatus?.(status));
    return ok({ unsubscribe: () => void supabase.removeChannel(channel) });
  } catch (e) {
    return fail(toAppError(e));
  }
}
