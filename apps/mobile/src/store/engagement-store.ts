import { create } from 'zustand';

import type { AppError } from '@/services/api/errors';
import type {
  DailyChestState,
  EngagementMission,
  EngagementMissions,
  EngagementStatus,
  RunEngagement,
  SeasonTrack,
  Unavailable,
} from '@/services/api/engagement-repo';
import type { TelemetryConsent } from '@/services/api/telemetry-repo';

/**
 * Engajamento v2 (E7, T7.2.4): o que o servidor diz sobre missões, baú do dia, trilha e a situação da pessoa
 * (nível, sequência, pausa). Só guarda dados; quem conversa com o servidor é `features/engagement/controller`.
 *
 * Cada parte tem o próprio estado, porque o servidor liga os recursos um a um (`game_config.features`):
 * `unavailable` = servidor antigo ou recurso desligado (a tela mostra "em breve", não erro).
 */
export type SlotStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export type Slot<T> = {
  status: SlotStatus;
  data: T | null;
  error: AppError | null;
  reason: Unavailable['reason'] | null;
};

export const emptySlot = <T>(): Slot<T> => ({ status: 'idle', data: null, error: null, reason: null });

export type EngagementSlots = {
  status: Slot<EngagementStatus>;
  missions: Slot<EngagementMissions>;
  chest: Slot<DailyChestState>;
  track: Slot<SeasonTrack>;
  /** Consentimento da telemetria (D-82). Sem leitura do servidor, nada é enviado. */
  telemetry: Slot<TelemetryConsent>;
};

export type SlotKey = keyof EngagementSlots;

type EngagementState = EngagementSlots & {
  /** Dono dos dados (troca de conta limpa tudo). */
  userId: string | null;
  loadedAt: number | null;
  /** Bloco `extras.engagement` da última corrida confirmada (o resumo mostra). */
  lastRun: { activityId: string; block: RunEngagement } | null;
  /**
   * A pessoa já conquistou alguma zona (T7.3.6, "Sua 1ª zona!" no HUD). `null` = ainda não se sabe; só `false`
   * conta como "nunca conquistou" (o HUD nunca promete uma 1ª zona por falta de dado).
   */
  everConquered: boolean | null;
  setEverConquered: (v: boolean | null) => void;
  setUser: (userId: string | null) => void;
  setLoading: (key: SlotKey) => void;
  setReady: <K extends SlotKey>(key: K, data: NonNullable<EngagementSlots[K]['data']>) => void;
  setUnavailable: (key: SlotKey, reason: Unavailable['reason']) => void;
  setError: (key: SlotKey, error: AppError) => void;
  setLoadedAt: (at: number) => void;
  /** Troca uma missão pelo id da atribuição (troca do dia, conclusão vista na tela). */
  replaceMission: (m: EngagementMission) => void;
  setLastRun: (activityId: string, block: RunEngagement) => void;
  reset: () => void;
};

const initial = {
  userId: null,
  loadedAt: null,
  lastRun: null,
  everConquered: null,
  status: emptySlot<EngagementStatus>(),
  missions: emptySlot<EngagementMissions>(),
  chest: emptySlot<DailyChestState>(),
  track: emptySlot<SeasonTrack>(),
  telemetry: emptySlot<TelemetryConsent>(),
};

export const useEngagement = create<EngagementState>((set) => ({
  ...initial,
  setUser: (userId) => set((s) => (s.userId === userId ? s : { ...initial, userId })),
  // Recarregar mantém o dado anterior na tela (sem piscar o esqueleto).
  setLoading: (key) => set((s) => ({ [key]: { ...s[key], status: s[key].data ? s[key].status : 'loading', error: null } })),
  setReady: (key, data) => set({ [key]: { status: 'ready', data, error: null, reason: null } }),
  setUnavailable: (key, reason) => set({ [key]: { status: 'unavailable', data: null, error: null, reason } }),
  setError: (key, error) => set((s) => ({ [key]: { ...s[key], status: s[key].data ? s[key].status : 'error', error } })),
  setLoadedAt: (at) => set({ loadedAt: at }),
  replaceMission: (m) =>
    set((s) => {
      const data = s.missions.data;
      if (!data) return s;
      const swap = (list: EngagementMission[]) => list.map((x) => (x.id === m.id ? m : x));
      const rerolled = data.daily.some((x) => x.id === m.id && !x.rerolled) && m.rerolled;
      return {
        missions: {
          ...s.missions,
          data: {
            ...data,
            daily: swap(data.daily),
            weekly: swap(data.weekly),
            ftue: swap(data.ftue),
            comeback: data.comeback?.id === m.id ? m : data.comeback,
            rerollsLeft: rerolled ? Math.max(0, data.rerollsLeft - 1) : data.rerollsLeft,
          },
        },
      };
    }),
  setLastRun: (activityId, block) => set({ lastRun: { activityId, block } }),
  // Depois de uma conquista, nunca volta a "nunca conquistou" (só a troca de conta limpa).
  setEverConquered: (v) => set((s) => (s.everConquered === true && v !== true ? s : { everConquered: v })),
  reset: () => set({ ...initial }),
}));

/** Missões abertas de hoje e da semana, da mais adiantada para a menos (a "em destaque" é a primeira). */
export function selectOpenMissions(s: Pick<EngagementState, 'missions'>): EngagementMission[] {
  const m = s.missions.data;
  if (!m) return [];
  return [...m.daily, ...m.weekly].filter((x) => x.completedAt === null).sort((a, b) => b.progress / b.target - a.progress / a.target || a.slot - b.slot);
}

/**
 * `firstConquestEver` (T7.3.6, pedido da E6b): `true` só quando o servidor confirmou que a pessoa nunca
 * conquistou zona. Lido na largada, vai para `createLiveTracker({ firstConquestEver })`.
 */
export function selectFirstConquestEver(s: Pick<EngagementState, 'everConquered'>): boolean {
  return s.everConquered === false;
}

/** Telemetria ligada: só com o consentimento lido do servidor e `optIn === true` (D-82). */
export function selectTelemetryOn(s: Pick<EngagementState, 'telemetry'>): boolean {
  return s.telemetry.status === 'ready' && s.telemetry.data?.optIn === true;
}
