import { create } from 'zustand';

import { basePace } from '@/domain/scoring';
import { TRUST_START } from '@/domain/trust';
import type { FactionId, LatLng } from '@/domain/types';
import type { ActivitySummary, ServerProgress } from '@/services/api/activities-repo';
import type { QueueRunState } from '@/services/offline/types';
import type { SafetyContact } from '@/services/safety/contacts-repo';
import type { RunSummary } from '@/features/run/summary-model';

export type MissionId = 'livre' | 'fuga' | 'caca' | 'rabisco';

/**
 * Corrida guardada no aparelho (espelho da fila SQLite para a interface): em gravação, pendente de
 * envio (resumo provisório), sincronizada (resumo oficial) ou com erro definitivo.
 */
export type LocalRun = {
  id: string;
  state: QueueRunState;
  mission: MissionId;
  startedAt: number;
  endedAt: number | null;
  simulated: boolean;
  summary: RunSummary | null;
  path: LatLng[];
  error: string | null;
};

/** Recorte do perfil do servidor que o jogo usa (evita depender do formato completo do perfil). */
export type ProfileSnapshot = { username: string; faction: FactionId | null; xp?: number; trust?: number };

type GameState = {
  name: string;
  faction: FactionId | null;
  onboarded: boolean;
  /** XP, confiança e sequência vêm do servidor (`applyServerProgress`). */
  xp: number;
  trust: number;
  streakWeeks: number;
  freezesLeft: number;
  /** Ritmos das últimas corridas pontuadas (ritmo-base da estimativa, RN-001). */
  recentPaces: number[];
  /** Células de neblina reveladas (servidor: `fog_cells`). */
  fog: string[];
  /** Baús abertos (local até o servidor gravar baús, P-12). */
  openedChests: string[];
  /** Corridas da fila local (pendentes, provisórias e recém-confirmadas). */
  localRuns: LocalRun[];
  /** Corridas já no servidor (histórico, RF-006). */
  serverRuns: ActivitySummary[];
  mission: MissionId;
  ghostPace: number;
  escortOn: boolean;
  stopAlertOn: boolean;
  /** Contatos da Corrida Segura (servidor: `safety_contacts`). */
  safetyContacts: SafetyContact[];
  /** Nomes dos contatos (usado no texto do perfil). */
  contacts: string[];
  completeOnboarding: (name: string, faction: FactionId) => void;
  /** Dados que vêm do perfil do servidor (nome, facção, XP, confiança). */
  applyProfile: (p: ProfileSnapshot) => void;
  /** XP, confiança, sequência e ritmos recentes calculados pelo servidor. */
  applyServerProgress: (p: Partial<ServerProgress>) => void;
  /** Logout / exclusão de conta: volta ao estado inicial (a fila SQLite não é apagada). */
  resetForSignOut: () => void;
  setMission: (m: MissionId) => void;
  setGhostPace: (secPerKm: number) => void;
  toggleEscort: () => void;
  setEscort: (on: boolean) => void;
  toggleStopAlert: () => void;
  openChest: (id: string, xp: number) => void;
  setOpenedChests: (ids: string[]) => void;
  setFog: (cells: string[]) => void;
  addFog: (cells: string[]) => void;
  setLocalRuns: (runs: LocalRun[]) => void;
  upsertLocalRun: (run: LocalRun) => void;
  setServerRuns: (runs: ActivitySummary[]) => void;
  setSafetyContacts: (contacts: SafetyContact[]) => void;
};

type GameActions =
  | 'completeOnboarding'
  | 'applyProfile'
  | 'applyServerProgress'
  | 'resetForSignOut'
  | 'setMission'
  | 'setGhostPace'
  | 'toggleEscort'
  | 'setEscort'
  | 'toggleStopAlert'
  | 'openChest'
  | 'setOpenedChests'
  | 'setFog'
  | 'addFog'
  | 'setLocalRuns'
  | 'upsertLocalRun'
  | 'setServerRuns'
  | 'setSafetyContacts';

const initialGame = (): Omit<GameState, GameActions> => ({
  name: 'Corredor',
  faction: null,
  onboarded: false,
  xp: 0,
  trust: TRUST_START,
  streakWeeks: 0,
  freezesLeft: 1,
  recentPaces: [],
  fog: [],
  openedChests: [],
  localRuns: [],
  serverRuns: [],
  mission: 'livre',
  ghostPace: 330,
  escortOn: false,
  stopAlertOn: true,
  safetyContacts: [],
  contacts: [],
});

const uniq = (a: string[]) => [...new Set(a)];

export const useGame = create<GameState>((set) => ({
  ...initialGame(),
  completeOnboarding: (name, faction) => set({ name: name.trim() || 'Corredor', faction, onboarded: true }),
  applyProfile: (p) =>
    set((s) => ({
      name: p.username.trim() || s.name,
      faction: p.faction,
      onboarded: p.faction !== null,
      xp: p.xp ?? s.xp,
      trust: p.trust ?? s.trust,
    })),
  applyServerProgress: (p) =>
    set((s) => ({
      xp: p.xp ?? s.xp,
      trust: p.trust ?? s.trust,
      streakWeeks: p.streakWeeks ?? s.streakWeeks,
      freezesLeft: p.freezesLeft ?? s.freezesLeft,
      recentPaces: p.recentPaces ?? s.recentPaces,
    })),
  resetForSignOut: () => set(initialGame()),
  setMission: (mission) => set({ mission }),
  setGhostPace: (ghostPace) => set({ ghostPace }),
  toggleEscort: () => set((s) => ({ escortOn: !s.escortOn })),
  setEscort: (escortOn) => set({ escortOn }),
  toggleStopAlert: () => set((s) => ({ stopAlertOn: !s.stopAlertOn })),
  openChest: (id, xp) => set((s) => (s.openedChests.includes(id) ? s : { openedChests: [...s.openedChests, id], xp: s.xp + xp })),
  setOpenedChests: (ids) => set((s) => ({ openedChests: uniq([...s.openedChests, ...ids]) })),
  setFog: (cells) => set({ fog: uniq(cells) }),
  addFog: (cells) => set((s) => ({ fog: uniq([...s.fog, ...cells]) })),
  setLocalRuns: (localRuns) => set({ localRuns: [...localRuns].sort((a, b) => b.startedAt - a.startedAt) }),
  upsertLocalRun: (run) =>
    set((s) => ({ localRuns: [run, ...s.localRuns.filter((r) => r.id !== run.id)].sort((a, b) => b.startedAt - a.startedAt) })),
  setServerRuns: (serverRuns) => set({ serverRuns }),
  setSafetyContacts: (safetyContacts) => set({ safetyContacts, contacts: safetyContacts.map((c) => c.name) }),
}));

export const selectBasePace = (s: GameState) => basePace(s.recentPaces);
