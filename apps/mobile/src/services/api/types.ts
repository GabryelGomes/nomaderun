import { FACTION_IDS, type FactionId } from '@/domain/types';

export type DistanceUnit = 'km' | 'mi';
export type ProfileRole = 'runner' | 'moderator' | 'admin';

/**
 * Preferências de notificação (RF-002) e dos lembretes v2 (D-69, E7): cada tipo pode ser desligado. As chaves v2
 * são opcionais porque, no banco (`profiles.notification_prefs`), **chave ausente = ligada** (`private.notify_pref`
 * da E9) e têm o mesmo nome no jsonb. Silêncio e "pausar por 7 dias" ficam no aparelho (`features/notifications`).
 */
export type NotificationPrefs = {
  invasions: boolean;
  conquests: boolean;
  missions: boolean;
  moderation: boolean;
  /** Baú do dia guardado (3 de 3). */
  chests?: boolean;
  /** Falta 1 atividade para garantir a semana. */
  streak?: boolean;
  league?: boolean;
  raid?: boolean;
  /** Temporada nova (dia 1). */
  season?: boolean;
  /** Resumo da semana (segunda de manhã). */
  recap?: boolean;
  /** Volta depois de 7, 14, 21 e 30 dias (depois, silêncio). */
  comeback?: boolean;
  /** Aplausos ("Bora!") da crew, agrupados em 1 aviso por dia (D-69; o servidor lê a chave `kudos`). */
  kudos?: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { invasions: true, conquests: true, missions: true, moderation: true };

/** Perfil do próprio usuário como o app usa (a tabela `profiles` é do A2; ver `toProfile`). */
export type Profile = {
  id: string;
  username: string;
  birthdate: string | null;
  faction: FactionId | null;
  city: string | null;
  unit: DistanceUnit;
  notificationPrefs: NotificationPrefs;
  xp: number;
  trust: number;
  role: ProfileRole;
  status: string;
  avatarUrl: string | null;
  /** Temporada ('YYYY-MM') da última troca de facção; a próxima troca só na temporada seguinte (RF-003). */
  factionChangedSeason: string | null;
};

/** Campos que o próprio usuário pode alterar (o resto só o servidor muda). */
export type ProfilePatch = Partial<Pick<Profile, 'username' | 'city' | 'unit' | 'notificationPrefs'>>;

type Row = Record<string, unknown>;

const asString = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const asNumber = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const asBool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export function isFaction(v: unknown): v is FactionId {
  return typeof v === 'string' && (FACTION_IDS as readonly string[]).includes(v);
}

/**
 * Chaves do jsonb `profiles.notification_prefs` no banco (migration do A2):
 * `{ invasion, conquest, missions, moderation }` e, desde a v2 (E7/E9), as chaves dos lembretes com o mesmo nome.
 */
const PREF_DB_KEYS: Record<keyof NotificationPrefs, string> = {
  invasions: 'invasion',
  conquests: 'conquest',
  missions: 'missions',
  moderation: 'moderation',
  chests: 'chests',
  streak: 'streak',
  league: 'league',
  raid: 'raid',
  season: 'season',
  recap: 'recap',
  comeback: 'comeback',
  kudos: 'kudos',
};

/**
 * Converte a linha do banco para `Profile`. A coluna de unidade é `units`; aceita também
 * `unit`/`distance_unit` e colunas `notify_*` para não quebrar se o esquema mudar.
 */
export function toProfile(row: Row): Profile {
  const prefsJson = (row.notification_prefs && typeof row.notification_prefs === 'object' ? row.notification_prefs : {}) as Row;
  const pick = (key: keyof NotificationPrefs, column: string) =>
    asBool(prefsJson[PREF_DB_KEYS[key]], asBool(prefsJson[key], asBool(row[column], DEFAULT_NOTIFICATION_PREFS[key] ?? true)));
  const unitRaw = row.units ?? row.unit ?? row.distance_unit;
  const role = row.role === 'moderator' || row.role === 'admin' ? row.role : 'runner';
  return {
    id: String(row.id ?? ''),
    username: asString(row.username) ?? '',
    birthdate: asString(row.birthdate),
    faction: isFaction(row.faction) ? row.faction : null,
    city: asString(row.city ?? row.home_city),
    unit: unitRaw === 'mi' ? 'mi' : 'km',
    // As 4 da v1 sempre vêm; as da v2 só quando gravadas (ausente = ligada).
    notificationPrefs: Object.fromEntries(
      (Object.keys(PREF_DB_KEYS) as (keyof NotificationPrefs)[])
        .map((k) => [k, k in DEFAULT_NOTIFICATION_PREFS ? pick(k, `notify_${k}`) : prefsJson[PREF_DB_KEYS[k]]] as const)
        .filter(([, v]) => typeof v === 'boolean'),
    ) as NotificationPrefs,
    xp: asNumber(row.xp, 0),
    trust: asNumber(row.trust, 100),
    role,
    status: asString(row.status) ?? 'active',
    avatarUrl: asString(row.avatar_url),
    factionChangedSeason: asString(row.faction_changed_season),
  };
}

/** Converte o patch editável para as colunas do banco. */
export function toProfileRow(patch: ProfilePatch): Row {
  const row: Row = {};
  if (patch.username !== undefined) row.username = patch.username.trim();
  if (patch.city !== undefined) row.city = patch.city?.trim() || null;
  if (patch.unit !== undefined) row.units = patch.unit;
  if (patch.notificationPrefs !== undefined) {
    const prefs: Row = {};
    for (const k of Object.keys(PREF_DB_KEYS) as (keyof NotificationPrefs)[]) prefs[PREF_DB_KEYS[k]] = patch.notificationPrefs[k];
    row.notification_prefs = prefs;
  }
  return row;
}
