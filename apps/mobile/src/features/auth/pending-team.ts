import { create } from 'zustand';

import type { FactionId } from '@/domain/types';
import { FACTION_IDS } from '@/domain/types';
import { readLocal, writeLocal } from '@/features/engagement/local-store';

/**
 * Time escolhido **antes** da conta (D-91: valor antes do cadastro). Fica na memória e no aparelho
 * (`features/engagement/local-store`, chave separada na demonstração) até o cadastro terminar: aí o onboarding
 * grava no servidor (`choose_faction`) e apaga. Se o app for fechado entre a cerimônia e o cadastro (ex.: confirmação
 * de e-mail), a escolha sobrevive no aparelho. Nunca guarda dado de pessoa: só o id do time, a hora e a origem.
 *
 * F8-D · B3 (aparelho compartilhado): a escolha tem **validade** (`PENDING_TEAM_TTL_MS`) e **origem**. Ela é apagada
 * ao abrir "Entrar" (menos quando a mesma pessoa acabou de se cadastrar e foi confirmar o e-mail), ao abrir o cadastro
 * sem ter vindo da escolha, ao sair da conta e na troca do modo demonstração. Assim o time de quem desistiu não vai
 * parar na conta de outra pessoa.
 */
const KEY = 'pending-team';

/** Parâmetro `origem` do cadastro quando ele vem da escolha de times (`/cadastro?origem=times`). */
export const PENDING_TEAM_FROM_CHOICE = 'times';

/** Validade da escolha feita antes da conta: 24 h. */
export const PENDING_TEAM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * De onde veio a escolha: `escolha` = a tela de times antes da conta; `cadastro` = a mesma pessoa já enviou o cadastro
 * (e pode estar confirmando o e-mail para depois entrar).
 */
export type PendingTeamOrigin = 'escolha' | 'cadastro';

export type PendingTeamRecord = { team: FactionId; at: number; origin: PendingTeamOrigin };

type PendingTeamState = {
  team: FactionId | null;
  /** Hora (ms) e origem da escolha; `null` sem escolha. */
  record: PendingTeamRecord | null;
  /** Já leu o aparelho nesta sessão do app. */
  hydrated: boolean;
  set: (record: PendingTeamRecord | null) => void;
  markHydrated: (record: PendingTeamRecord | null) => void;
  /** Esquece a memória (troca do modo demonstração): a próxima leitura volta ao aparelho. */
  reset: () => void;
};

export const usePendingTeam = create<PendingTeamState>((set) => ({
  team: null,
  record: null,
  hydrated: false,
  set: (record) => set({ record, team: record?.team ?? null, hydrated: true }),
  markHydrated: (record) => set((s) => (s.hydrated ? s : { record, team: record?.team ?? null, hydrated: true })),
  reset: () => set({ record: null, team: null, hydrated: false }),
}));

function isFaction(x: unknown): x is FactionId {
  return typeof x === 'string' && (FACTION_IDS as readonly string[]).includes(x);
}

/** Vencida (24 h) ou com hora no futuro (relógio mexido): não vale. */
function isExpired(at: number, now: number): boolean {
  return now - at >= PENDING_TEAM_TTL_MS || at - now > 60_000;
}

/** Valida o que veio do aparelho. Formato antigo (só o id do time, sem hora nem origem) não vale mais. */
export function parsePendingTeam(x: unknown, now: number): PendingTeamRecord | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (!isFaction(r.team) || typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  if (r.origin !== 'escolha' && r.origin !== 'cadastro') return null;
  if (isExpired(r.at, now)) return null;
  return { team: r.team, at: r.at, origin: r.origin };
}

async function write(record: PendingTeamRecord | null): Promise<void> {
  usePendingTeam.getState().set(record);
  await writeLocal(KEY, record);
}

/** Guarda a escolha feita na tela de times (memória + aparelho), com a hora e a origem `escolha`. */
export async function savePendingTeam(team: FactionId): Promise<void> {
  await write({ team, at: Date.now(), origin: 'escolha' });
}

/** Apaga a escolha pendente (depois de gravar no servidor, ou ao desistir). */
export async function clearPendingTeam(): Promise<void> {
  await write(null);
}

/** O registro pendente: o da memória ou, na 1ª vez, o do aparelho. Vencido = apagado dos dois. */
async function getRecord(): Promise<PendingTeamRecord | null> {
  if (!usePendingTeam.getState().hydrated) {
    const stored = await readLocal<unknown>(KEY);
    const parsed = parsePendingTeam(stored, Date.now());
    // Formato antigo, inválido ou vencido: some também do aparelho.
    if (!parsed && stored !== null && stored !== undefined) await writeLocal(KEY, null);
    usePendingTeam.getState().markHydrated(parsed);
  }
  const record = usePendingTeam.getState().record;
  if (record && isExpired(record.at, Date.now())) {
    await clearPendingTeam();
    return null;
  }
  return record;
}

/** Lê a escolha pendente: a da memória ou, na 1ª vez, a do aparelho. Vencida (24 h) = nenhuma. */
export async function getPendingTeam(): Promise<FactionId | null> {
  return (await getRecord())?.team ?? null;
}

/** O cadastro feito a partir da escolha foi enviado: a escolha passa a ser desta pessoa (vale ao entrar depois). */
export async function markPendingTeamSignedUp(): Promise<void> {
  const record = await getRecord();
  if (record) await write({ team: record.team, at: Date.now(), origin: 'cadastro' });
}

/**
 * Tela "Entrar" aberta: a escolha de antes só continua se a mesma pessoa acabou de se cadastrar (origem `cadastro`,
 * ex.: voltou do e-mail de confirmação). Senão, é de alguém que desistiu e não pode ir para a conta de quem entra.
 */
export async function clearPendingTeamOnSignIn(): Promise<void> {
  const record = await getRecord();
  if (record && record.origin !== 'cadastro') await clearPendingTeam();
}

/** Cadastro aberto sem ter vindo da escolha de times (ex.: Entrar → "Criar conta"): a escolha de antes não vale. */
export async function clearPendingTeamOutsideChoice(): Promise<void> {
  if (await getRecord()) await clearPendingTeam();
}

/**
 * Troca do modo demonstração e saída da conta: zera a memória e apaga a escolha do aparelho no modo atual (o que
 * sobrou de uma sessão antiga não entra na conta nova).
 */
export async function resetPendingTeam(): Promise<void> {
  usePendingTeam.getState().reset();
  usePendingTeam.getState().markHydrated(null);
  await writeLocal(KEY, null);
}

/** Hidrata a memória a partir do aparelho (telas que mostram o time escolhido, como o cadastro). */
export function hydratePendingTeam(): void {
  if (!usePendingTeam.getState().hydrated) void getRecord();
}
