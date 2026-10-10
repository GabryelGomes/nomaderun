import { create } from 'zustand';

import type { RunResult } from '@/domain/run-engine';
import { basePace } from '@/domain/scoring';
import type { Zone } from '@/domain/territory';
import { applyTrust, TRUST_START } from '@/domain/trust';
import type { FactionId, LatLng } from '@/domain/types';
import { seedZones } from '@/demo/demo-data';

export type MissionId = 'livre' | 'fuga' | 'caca' | 'rabisco';

export type RunRecord = {
  id: string;
  endedAt: number;
  meters: number;
  movingSeconds: number;
  avgPace: number;
  rp: number;
  xp: number;
  mission: MissionId;
  path: LatLng[];
  result: RunResult;
  simulated: boolean;
};

type GameState = {
  name: string;
  faction: FactionId | null;
  onboarded: boolean;
  xp: number;
  trust: number;
  streakWeeks: number;
  freezesLeft: number;
  recentPaces: number[];
  zones: Record<string, Zone>;
  fog: string[];
  openedChests: string[];
  history: RunRecord[];
  mission: MissionId;
  ghostPace: number;
  escortOn: boolean;
  stopAlertOn: boolean;
  contacts: string[];
  completeOnboarding: (name: string, faction: FactionId) => void;
  setMission: (m: MissionId) => void;
  setGhostPace: (secPerKm: number) => void;
  toggleEscort: () => void;
  toggleStopAlert: () => void;
  openChest: (id: string, xp: number) => void;
  commitRun: (record: Omit<RunRecord, 'id'>) => RunRecord;
};

export const useGame = create<GameState>((set, get) => ({
  name: 'Corredor',
  faction: null,
  onboarded: false,
  xp: 0,
  trust: TRUST_START,
  streakWeeks: 3,
  freezesLeft: 1,
  recentPaces: [],
  zones: seedZones(),
  fog: [],
  openedChests: [],
  history: [],
  mission: 'livre',
  ghostPace: 330,
  escortOn: false,
  stopAlertOn: true,
  contacts: ['Mãe', 'Mateus'],
  completeOnboarding: (name, faction) => set({ name: name.trim() || 'Corredor', faction, onboarded: true }),
  setMission: (mission) => set({ mission }),
  setGhostPace: (ghostPace) => set({ ghostPace }),
  toggleEscort: () => set((s) => ({ escortOn: !s.escortOn })),
  toggleStopAlert: () => set((s) => ({ stopAlertOn: !s.stopAlertOn })),
  openChest: (id, xp) => set((s) => (s.openedChests.includes(id) ? s : { openedChests: [...s.openedChests, id], xp: s.xp + xp })),
  commitRun: (rec) => {
    const record: RunRecord = { ...rec, id: `run-${rec.endedAt}` };
    const s = get();
    const v = rec.result.validation;
    set({
      zones: { ...s.zones, ...rec.result.updatedZones },
      fog: [...s.fog, ...rec.result.newFogCells],
      xp: s.xp + rec.result.xp,
      trust: applyTrust(s.trust, v.flags, v.status === 'valid'),
      recentPaces: Number.isFinite(rec.avgPace) ? [...s.recentPaces, rec.avgPace].slice(-10) : s.recentPaces,
      history: [record, ...s.history],
    });
    return record;
  },
}));

export const selectBasePace = (s: GameState) => basePace(s.recentPaces);
