/**
 * Raid semanal (D-67, contrato v2): `rpc('raid_current')` — o chefão da semana com vida, fase, pontos fracos do
 * dia, "Sua parte", o dano da cidade desde a última visita e os rankings da Raid. Tudo atrás da flag `raid`.
 *
 * Servidor antigo (a RPC não existe: `PGRST202`) ou feature desligada (`FEATURE_DISABLED`) NÃO são erro: a
 * resposta é `{ available: false }` e a tela mostra o estado "indisponível"/"em breve" ilustrado (D-76).
 * Equipe E3 (T7.2.3).
 */
import { RAID_BOSS_IDS, raidShare, type RaidBossId, type RaidPhase } from '@/domain/raid';
import { FACTION_IDS, type FactionId, type LatLng } from '@/domain/types';

import { fail, ok, toAppError, type AppError, type Result } from './errors';
import { requireSupabase } from './supabase';

/* ---------- disponibilidade (compartilhado com league-repo e paint-repo) ---------- */

/** Por que a feature v2 não está disponível: servidor sem a RPC (contrato 1) ou flag desligada. */
export type UnavailableReason = 'servidor-antigo' | 'desligada';
export type Unavailable = { available: false; reason: UnavailableReason };

/** `PGRST202`/`42883` = RPC inexistente (servidor antigo); `FEATURE_DISABLED` = flag desligada. Outros: erro de verdade. */
export function unavailableReason(error: AppError): UnavailableReason | null {
  if (error.detail === 'PGRST202' || error.detail === '42883') return 'servidor-antigo';
  if (error.detail === 'FEATURE_DISABLED') return 'desligada';
  return null;
}

/** Chama uma RPC v2 sem parâmetros obrigatórios e converte "indisponível" em resposta normal. */
export async function callFeatureRpc<T>(call: () => PromiseLike<{ data: unknown; error: unknown }>, parse: (data: unknown) => T): Promise<Result<T | Unavailable>> {
  try {
    const { data, error } = await call();
    if (error) throw error;
    return ok(parse(data));
  } catch (e) {
    const err = toAppError(e);
    const reason = unavailableReason(err);
    return reason ? ok({ available: false, reason }) : fail(err);
  }
}

/* ---------- tipos da Raid ---------- */

export type RaidStatusV2 = 'active' | 'defeated' | 'escaped';

export type RaidWeakPoint = { zoneId: string; name: string | null; center: LatLng };

export type RaidBoss = {
  id: string;
  /** Id do chefão (arte da E4); `null` se o servidor mandar um id que este app ainda não conhece. */
  bossId: RaidBossId | null;
  name: string;
  theme: string;
  weakness: string;
  introLine: string;
  defeatLine: string;
  artKey: string;
  city: string | null;
  /** Segunda-feira da semana ('AAAA-MM-DD', Brasília). */
  weekStart: string;
  startsAt: number;
  endsAt: number;
  hp: number;
  hpMax: number;
  phase: RaidPhase;
  status: RaidStatusV2;
  participants: number;
  defeatedAt: number | null;
  /** Linha marcada como demonstração no servidor (seed v2) ou servidor de demonstração do app. */
  isDemo: boolean;
  weakPoints: RaidWeakPoint[];
};

export type RaidRewardKind = 'participacao' | 'derrota' | 'top10' | 'golpe_final';

export type RaidReward = {
  kind: RaidRewardKind;
  xp: number;
  chestRarity: 'comum' | 'raro' | 'lendario' | null;
  cosmeticId: string | null;
  medalTier: 'bronze' | 'prata' | 'ouro' | null;
};

export type RaidMe = {
  damage: number;
  meters: number;
  hits: number;
  /** Metros que já contaram hoje (teto de 30 km por dia). */
  todayMeters: number;
  /** Posição no ranking de dano (null sem golpe). */
  rank: number | null;
  rewards: RaidReward[];
};

export type RaidTopRunner = { position: number; username: string; faction: FactionId | null; avatarUrl: string | null; damage: number; you: boolean };
export type RaidTopCrew = { name: string; tag: string; faction: FactionId | null; damage: number };

export type RaidCurrent = {
  available: true;
  /** `null` = nenhum chefão aberto ainda (a semana abre segunda 06:00). */
  raid: RaidBoss | null;
  me: RaidMe;
  /** "Sua parte" (0 a 1) do dano da cidade (`raidShare`). */
  share: number;
  /** "Dano da cidade desde a sua última visita" (null na 1ª visita da semana). */
  sinceLastVisit: { damage: number; since: number } | null;
  topRunners: RaidTopRunner[];
  topCrews: RaidTopCrew[];
  /** Números públicos da Raid (`game_config.raid`): chance de crítico, tetos… para a tela mostrar a verdade. */
  params: Record<string, unknown>;
};

/* ---------- leitura tolerante ---------- */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object') : []);
const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);
export const factionOrNull = (v: unknown): FactionId | null => ((FACTION_IDS as readonly unknown[]).includes(v) ? (v as FactionId) : null);
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | null => ((options as readonly unknown[]).includes(v) ? (v as T) : null);

const STATUSES: readonly RaidStatusV2[] = ['active', 'defeated', 'escaped'];
const REWARD_KINDS: readonly RaidRewardKind[] = ['participacao', 'derrota', 'top10', 'golpe_final'];

function parseBoss(b: Obj): RaidBoss | null {
  const hpMax = Math.max(0, Math.round(num(b.hpMax)));
  if (typeof b.id !== 'string' || hpMax <= 0) return null;
  const phase = Math.min(3, Math.max(1, Math.round(num(b.phase, 1)))) as RaidPhase;
  return {
    id: b.id,
    bossId: oneOf(b.bossId, RAID_BOSS_IDS),
    name: str(b.name, 'Chefão'),
    theme: str(b.theme),
    weakness: str(b.weakness),
    introLine: str(b.introLine),
    defeatLine: str(b.defeatLine),
    artKey: str(b.artKey),
    city: strOrNull(b.city),
    weekStart: str(b.weekStart),
    startsAt: num(b.startsAt),
    endsAt: num(b.endsAt),
    hp: Math.min(hpMax, Math.max(0, Math.round(num(b.hp)))),
    hpMax,
    phase,
    status: oneOf(b.status, STATUSES) ?? 'active',
    participants: Math.max(0, Math.round(num(b.participants))),
    defeatedAt: numOrNull(b.defeatedAt),
    isDemo: b.isDemo === true,
    weakPoints: arr(b.weakPoints).flatMap((w) => {
      const c = Array.isArray(w.center) ? w.center : [];
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      return typeof w.zoneId === 'string' && Number.isFinite(lat) && Number.isFinite(lng) ? [{ zoneId: w.zoneId, name: strOrNull(w.name), center: { lat, lng } }] : [];
    }),
  };
}

/** Converte a resposta de `raid_current` (camelCase, epoch ms). Campos estranhos viram valores seguros. */
export function parseRaidCurrent(data: unknown): RaidCurrent {
  const body = obj(data);
  const raid = body.raid ? parseBoss(obj(body.raid)) : null;
  const m = obj(body.me);
  const me: RaidMe = {
    damage: Math.max(0, num(m.damage)),
    meters: Math.max(0, num(m.meters)),
    hits: Math.max(0, num(m.hits)),
    todayMeters: Math.max(0, num(m.todayMeters)),
    rank: numOrNull(m.rank),
    rewards: arr(m.rewards).flatMap((r) => {
      const kind = oneOf(r.kind, REWARD_KINDS);
      return kind
        ? [{ kind, xp: Math.max(0, num(r.xp)), chestRarity: oneOf(r.chestRarity, ['comum', 'raro', 'lendario'] as const), cosmeticId: strOrNull(r.cosmeticId), medalTier: oneOf(r.medalTier, ['bronze', 'prata', 'ouro'] as const) }]
        : [];
    }),
  };
  const since = body.sinceLastVisit ? obj(body.sinceLastVisit) : null;
  return {
    available: true,
    raid,
    me,
    share: raid ? raidShare(me.damage, raid.hpMax - raid.hp) : 0,
    sinceLastVisit: since ? { damage: Math.max(0, num(since.damage)), since: num(since.since) } : null,
    topRunners: arr(body.topRunners).map((r) => ({
      position: Math.max(1, Math.round(num(r.position, 1))),
      username: str(r.username, '—'),
      faction: factionOrNull(r.faction),
      avatarUrl: strOrNull(r.avatarUrl),
      damage: Math.max(0, num(r.damage)),
      you: r.you === true,
    })),
    topCrews: arr(body.topCrews).map((c) => ({ name: str(c.name, '—'), tag: str(c.tag), faction: factionOrNull(c.faction), damage: Math.max(0, num(c.damage)) })),
    params: obj(body.params),
  };
}

/** O chefão da semana e a "Sua parte" do usuário logado (também registra a visita, para o "desde a última visita"). */
export async function fetchRaidCurrent(): Promise<Result<RaidCurrent | Unavailable>> {
  return callFeatureRpc(() => requireSupabase().rpc('raid_current'), parseRaidCurrent);
}

/** Estreita o tipo para a tela: há Raid no servidor (mesmo que ainda sem chefão aberto). */
export const isRaidAvailable = (r: RaidCurrent | Unavailable): r is RaidCurrent => r.available;
