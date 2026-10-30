import { create } from 'zustand';

import type { FactionId } from '@/domain/types';
import { FACTION_IDS } from '@/domain/types';
import { readLocal, writeLocal } from '@/features/engagement/local-store';

/**
 * Time escolhido **antes** da conta (D-91: valor antes do cadastro). Fica na memória e no aparelho
 * (`features/engagement/local-store`, chave separada na demonstração) até o cadastro terminar: aí o onboarding
 * grava no servidor (`choose_faction`) e apaga. Se o app for fechado entre a cerimônia e o cadastro (ex.: confirmação
 * de e-mail), a escolha sobrevive no aparelho. Nunca guarda dado de pessoa: só o id do time.
 */
const KEY = 'pending-team';

type PendingTeamState = {
  team: FactionId | null;
  /** Já leu o aparelho nesta sessão do app. */
  hydrated: boolean;
  set: (team: FactionId | null) => void;
  markHydrated: (team: FactionId | null) => void;
};

export const usePendingTeam = create<PendingTeamState>((set) => ({
  team: null,
  hydrated: false,
  set: (team) => set({ team, hydrated: true }),
  markHydrated: (team) => set((s) => (s.hydrated ? s : { team, hydrated: true })),
}));

function isFaction(x: unknown): x is FactionId {
  return typeof x === 'string' && (FACTION_IDS as readonly string[]).includes(x);
}

/** Guarda a escolha (memória + aparelho). */
export async function savePendingTeam(team: FactionId): Promise<void> {
  usePendingTeam.getState().set(team);
  await writeLocal(KEY, team);
}

/** Apaga a escolha pendente (depois de gravar no servidor, ou ao desistir). */
export async function clearPendingTeam(): Promise<void> {
  usePendingTeam.getState().set(null);
  await writeLocal(KEY, null);
}

/** Lê a escolha pendente: a da memória ou, na 1ª vez, a do aparelho. */
export async function getPendingTeam(): Promise<FactionId | null> {
  const s = usePendingTeam.getState();
  if (s.hydrated) return s.team;
  const stored = await readLocal<unknown>(KEY);
  const team = isFaction(stored) ? stored : null;
  usePendingTeam.getState().markHydrated(team);
  return usePendingTeam.getState().team;
}

/** Hidrata a memória a partir do aparelho (telas que mostram o time escolhido, como o cadastro). */
export function hydratePendingTeam(): void {
  if (!usePendingTeam.getState().hydrated) void getPendingTeam();
}
