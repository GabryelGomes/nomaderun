import { create } from 'zustand';

import type { Zone } from '@/domain/territory';
import type { AppError } from '@/services/api/errors';
import { readCachedZones, writeCachedZones } from '@/services/api/zones-cache';
import * as zonesRepo from '@/services/api/zones-repo';
import type { Bbox, ServerZone, ZoneMeta } from '@/services/api/zones-repo';

/**
 * Zonas do mapa vindas do servidor (T2.6, RF-007). Fonte única do mapa, da folha da zona e da
 * estimativa da corrida (A4 lê `zones` e chama `upsertZones` depois de cada corrida confirmada).
 *
 * - `loadBbox(bbox)`: `GET /zones?bbox=` e mescla (zonas fora da caixa continuam no cache).
 * - `subscribe()`: Realtime em `zones`; devolve a função para cancelar (contagem de referências).
 * - Sem internet: mantém o último cache (memória + kv-store) e marca `offline`.
 *
 * Exceção consciente à regra "store não importa serviço" (D-28): o contrato combinado com o A4
 * pede `loadBbox`/assinatura no próprio store. O repositório é injetável (`setZonesApi`) nos testes.
 */
export type ZonesApi = {
  fetchZonesInBbox: typeof zonesRepo.fetchZonesInBbox;
  subscribeZones: typeof zonesRepo.subscribeZones;
  readCache: typeof readCachedZones;
  writeCache: typeof writeCachedZones;
};

const defaultApi: ZonesApi = {
  fetchZonesInBbox: zonesRepo.fetchZonesInBbox,
  subscribeZones: zonesRepo.subscribeZones,
  readCache: readCachedZones,
  writeCache: writeCachedZones,
};
let api: ZonesApi = defaultApi;
/** Só para testes. */
export function setZonesApi(next: Partial<ZonesApi> | null) {
  api = next ? { ...defaultApi, ...next } : defaultApi;
}

type ZonesState = {
  zones: Record<string, Zone>;
  meta: Record<string, ZoneMeta>;
  loading: boolean;
  error: AppError | null;
  /** Última carga falhou por falta de rede: o mapa mostra o cache. */
  offline: boolean;
  /** Realtime conectado. */
  live: boolean;
  lastLoadedAt: number | null;
  lastBbox: Bbox | null;
  /** Mescla zonas (resultado oficial de corrida, Realtime). Não apaga nada. */
  upsertZones: (zones: Record<string, Zone>, meta?: Record<string, ZoneMeta>) => void;
  loadBbox: (bbox: Bbox) => Promise<void>;
  subscribe: () => () => void;
  /** Lê o cache salvo (abre o mapa sem internet). */
  hydrate: () => Promise<void>;
  reset: () => void;
};

const initial = {
  zones: {} as Record<string, Zone>,
  meta: {} as Record<string, ZoneMeta>,
  loading: false,
  error: null as AppError | null,
  offline: false,
  live: false,
  lastLoadedAt: null as number | null,
  lastBbox: null as Bbox | null,
};

/** Mantém o tamanho do cache salvo limitado (zonas mais recentes por último). */
const CACHE_MAX = 2500;
let refCount = 0;
let sub: zonesRepo.ZonesSubscription | null = null;
let loadSeq = 0;

function persist(zones: Record<string, Zone>, meta: Record<string, ZoneMeta>) {
  const ids = Object.keys(zones).slice(-CACHE_MAX);
  const z: Record<string, Zone> = {};
  const m: Record<string, ZoneMeta> = {};
  for (const id of ids) {
    z[id] = zones[id];
    if (meta[id]) m[id] = meta[id];
  }
  void api.writeCache({ savedAt: Date.now(), zones: z, meta: m });
}

export function mergeServerZones(
  state: Pick<ZonesState, 'zones' | 'meta'>,
  list: ServerZone[],
): Pick<ZonesState, 'zones' | 'meta'> {
  const zones = { ...state.zones };
  const meta = { ...state.meta };
  for (const { zone, meta: m } of list) {
    zones[zone.id] = zone;
    const prev = meta[zone.id];
    // Realtime pode trazer `name` nulo (zona nova): não apaga um nome já conhecido.
    meta[zone.id] = { name: m.name ?? prev?.name ?? null, city: m.city ?? prev?.city ?? null };
  }
  return { zones, meta };
}

export const useZones = create<ZonesState>((set, get) => ({
  ...initial,
  upsertZones: (incoming, meta) =>
    set((s) => {
      const next = { zones: { ...s.zones, ...incoming }, meta: meta ? { ...s.meta, ...meta } : s.meta };
      persist(next.zones, next.meta);
      return next;
    }),
  loadBbox: async (bbox) => {
    const seq = ++loadSeq;
    set({ loading: true, lastBbox: bbox });
    const res = await api.fetchZonesInBbox(bbox);
    if (seq !== loadSeq) return; // uma carga mais nova já começou
    if (res.ok) {
      const merged = mergeServerZones(get(), res.data);
      set({ ...merged, loading: false, error: null, offline: false, lastLoadedAt: Date.now() });
      persist(merged.zones, merged.meta);
      return;
    }
    set({ loading: false, error: res.error, offline: res.error.code === 'NETWORK' });
  },
  subscribe: () => {
    refCount += 1;
    if (!sub) {
      const res = api.subscribeZones(
        (z) => set((s) => mergeServerZones(s, [z])),
        (status) => set({ live: status === 'SUBSCRIBED' }),
      );
      if (res.ok) sub = res.data;
    }
    let done = false;
    return () => {
      if (done) return;
      done = true;
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0 && sub) {
        sub.unsubscribe();
        sub = null;
        set({ live: false });
      }
    };
  },
  hydrate: async () => {
    if (Object.keys(get().zones).length > 0) return;
    const snap = await api.readCache();
    if (snap && Object.keys(get().zones).length === 0) set({ zones: snap.zones, meta: snap.meta, lastLoadedAt: snap.savedAt });
  },
  reset: () => {
    sub?.unsubscribe();
    sub = null;
    refCount = 0;
    loadSeq += 1;
    set({ ...initial });
  },
}));

/** Nome da zona vindo do servidor, ou `null` (a tela usa o nome local como fallback). */
export const selectZoneName = (id: string) => (s: ZonesState) => s.meta[id]?.name ?? null;
