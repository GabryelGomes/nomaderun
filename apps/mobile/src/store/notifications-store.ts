import { create } from 'zustand';

import type { AppError } from '@/services/api/errors';
import type { AppNotification } from '@/services/api/notifications-repo';

/** Central de notificações (RF-019). Só dados; quem fala com o servidor é `features/notifications/controller`. */
type NotificationsState = {
  items: AppNotification[];
  loading: boolean;
  error: AppError | null;
  loadedAt: number | null;
  setLoading: (on: boolean) => void;
  setItems: (items: AppNotification[]) => void;
  setError: (e: AppError | null) => void;
  /** Notificação nova (Realtime/consulta): entra no topo sem duplicar. Devolve true se era nova. */
  add: (n: AppNotification) => boolean;
  markReadLocal: (ids: string[] | null, at?: number) => void;
  reset: () => void;
};

const initial = { items: [] as AppNotification[], loading: false, error: null as AppError | null, loadedAt: null as number | null };

export const useNotifications = create<NotificationsState>((set, get) => ({
  ...initial,
  setLoading: (loading) => set({ loading }),
  setItems: (items) => set({ items: [...items].sort((a, b) => b.createdAt - a.createdAt), loading: false, error: null, loadedAt: Date.now() }),
  setError: (error) => set({ error, loading: false }),
  add: (n) => {
    if (get().items.some((i) => i.id === n.id)) return false;
    set((s) => ({ items: [n, ...s.items].sort((a, b) => b.createdAt - a.createdAt) }));
    return true;
  },
  markReadLocal: (ids, at = Date.now()) =>
    set((s) => ({ items: s.items.map((i) => (i.readAt === null && (ids === null || ids.includes(i.id)) ? { ...i, readAt: at } : i)) })),
  reset: () => set({ ...initial }),
}));

export const selectUnreadCount = (s: NotificationsState) => s.items.reduce((n, i) => n + (i.readAt === null ? 1 : 0), 0);
