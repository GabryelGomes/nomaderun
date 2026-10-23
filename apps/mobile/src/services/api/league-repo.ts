/**
 * Liga semanal (D-68, contrato v2): `rpc('league_current')` — o grupo da semana (até 30 pessoas com volume
 * parecido), a divisão, as vagas de subida e descida e o resultado da semana anterior. Atrás da flag `league`.
 *
 * Servidor antigo (`PGRST202`) ou feature desligada (`FEATURE_DISABLED`) viram `{ available: false }`, sem erro
 * na tela (D-76). Equipe E3 (T7.2.3).
 */
import { LEAGUE_DIVISIONS } from '@/domain/games';
import type { FactionId } from '@/domain/types';

import { callFeatureRpc, factionOrNull, type Unavailable } from './raid-repo';
import type { Result } from './errors';
import { requireSupabase } from './supabase';

export type LeagueZone = 'promote' | 'relegate' | null;
export type LeagueOutcomeV2 = 'promoted' | 'stays' | 'relegated';

export type LeagueMemberRow = {
  position: number;
  username: string;
  faction: FactionId | null;
  avatarUrl: string | null;
  points: number;
  you: boolean;
  /** Faixa de subida ou de descida em que a pessoa está agora. */
  zone: LeagueZone;
};

export type LeagueLastResult = {
  weekStart: string;
  division: number;
  divisionName: string;
  finalRank: number | null;
  outcome: LeagueOutcomeV2;
};

export type LeagueCurrent = {
  available: true;
  /** Segunda-feira da semana ('AAAA-MM-DD', Brasília). */
  weekStart: string;
  /** Fechamento: segunda seguinte às 03:20 (epoch ms). */
  closesAt: number;
  division: number;
  divisionName: string;
  /** A pessoa já entrou na liga desta semana (entra na 1ª corrida da semana). */
  joined: boolean;
  groupSize: number;
  /** Grupo com menos de 6: só o 1º sobe (se pontuou) e ninguém desce. */
  smallGroup: boolean;
  promoteSlots: number;
  relegateSlots: number;
  members: LeagueMemberRow[];
  /** A linha da própria pessoa no grupo (atalho para o cartão "você está em 7º"). */
  me: LeagueMemberRow | null;
  lastResult: LeagueLastResult | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object') : []);
const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

const divisionName = (division: number, name: unknown) => str(name) || LEAGUE_DIVISIONS[division] || `Divisão ${division + 1}`;
const OUTCOMES: readonly LeagueOutcomeV2[] = ['promoted', 'stays', 'relegated'];

/** Converte a resposta de `league_current`. Membros sem nome são descartados; a ordem é a posição. */
export function parseLeagueCurrent(data: unknown): LeagueCurrent {
  const b = obj(data);
  const division = Math.max(0, Math.round(num(b.division)));
  const members = arr(b.members)
    .filter((m) => typeof m.username === 'string')
    .map(
      (m): LeagueMemberRow => ({
        position: Math.max(1, Math.round(num(m.position, 1))),
        username: m.username as string,
        faction: factionOrNull(m.faction),
        avatarUrl: typeof m.avatarUrl === 'string' && m.avatarUrl ? m.avatarUrl : null,
        points: Math.max(0, num(m.points)),
        you: m.you === true,
        zone: m.zone === 'promote' || m.zone === 'relegate' ? m.zone : null,
      }),
    )
    .sort((x, y) => x.position - y.position);
  const last = b.lastResult ? obj(b.lastResult) : null;
  const lastDivision = last ? Math.max(0, Math.round(num(last.division))) : 0;
  const outcome = last && (OUTCOMES as readonly unknown[]).includes(last.outcome) ? (last.outcome as LeagueOutcomeV2) : null;
  return {
    available: true,
    weekStart: str(b.weekStart),
    closesAt: num(b.closesAt),
    division,
    divisionName: divisionName(division, b.divisionName),
    joined: b.joined === true,
    groupSize: Math.max(members.length, Math.round(num(b.groupSize))),
    smallGroup: b.smallGroup === true,
    promoteSlots: Math.max(0, Math.round(num(b.promoteSlots))),
    relegateSlots: Math.max(0, Math.round(num(b.relegateSlots))),
    members,
    me: members.find((m) => m.you) ?? null,
    lastResult:
      last && outcome
        ? {
            weekStart: str(last.weekStart),
            division: lastDivision,
            divisionName: divisionName(lastDivision, last.divisionName),
            finalRank: last.finalRank === null || last.finalRank === undefined ? null : Math.round(num(last.finalRank)),
            outcome,
          }
        : null,
  };
}

/** O grupo da liga desta semana do usuário logado. */
export async function fetchLeagueCurrent(): Promise<Result<LeagueCurrent | Unavailable>> {
  return callFeatureRpc(() => requireSupabase().rpc('league_current'), parseLeagueCurrent);
}
