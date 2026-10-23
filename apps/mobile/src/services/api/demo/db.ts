/**
 * Banco em memória do servidor de demonstração (D-77, T7.1.18).
 *
 * Imita o que o app enxerga do Postgres pelo PostgREST: as tabelas e views que os repositórios leem
 * (com as colunas do esquema real, para um nome errado falhar aqui como falharia lá), a visibilidade da RLS
 * (cada um só vê o que é seu; staff vê as corridas) e os gatilhos que o app percebe (limites de contatos e
 * zonas de privacidade, líder e convite da crew). Tabelas internas (zonas, eventos, aparelhos, baús) ficam
 * fora do `from()`, como no servidor real, e são usadas pelas functions e RPCs de demonstração.
 */
import { districtOf } from '@/domain/grid';
import type { Zone } from '@/domain/territory';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { createWorld, DEMO_CITY_LABEL, type DemoRunner, type DemoWorld, type WorldOptions } from '@/demo/world';

export type Row = Record<string, unknown>;

/** Erro no formato do PostgREST (`{ code, message, details, hint }`). */
export class DemoPgError extends Error {
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;
  constructor(code: string, message: string, details: string | null = null) {
    super(message);
    this.name = 'PostgrestError';
    this.code = code;
    this.details = details;
    this.hint = null;
  }
  toJSON() {
    return { code: this.code, message: this.message, details: this.details, hint: this.hint };
  }
}

/** `RAISE EXCEPTION 'CODIGO: mensagem'` do backend (errcode P0001). */
export const raise = (codeAndMessage: string) => new DemoPgError('P0001', codeAndMessage);

/**
 * Tudo o que os repositórios podem ler com `from()`: as 18 tabelas e views do PostgREST (o 19º nome do
 * levantamento da F1, `avatars`, é o bucket do Storage, em `DEMO_BUCKETS`). Colunas como no banco real.
 */
export const DEMO_TABLE_COLUMNS = {
  profiles: ['id', 'username', 'birthdate', 'faction', 'city', 'units', 'notification_prefs', 'xp', 'trust', 'role', 'status', 'avatar_url', 'faction_changed_season', 'suspended_until', 'streak_weeks', 'freezes_left', 'created_at', 'is_demo'],
  public_profiles: ['id', 'username', 'faction', 'avatar_url', 'city', 'crew_id'],
  staff_profiles: ['id', 'username', 'role', 'status', 'trust', 'faction', 'city', 'created_at'],
  activities: ['id', 'user_id', 'status', 'mission', 'started_at', 'ended_at', 'finished_at', 'meters', 'moving_seconds', 'avg_pace', 'rp_total', 'xp', 'flags', 'result', 'scored', 'review_reason', 'invalid_segments', 'ghost_pace', 'last_seq', 'device_id', 'beat_ghost', 'created_at'],
  activity_points: ['activity_id', 'seq', 'lat', 'lng', 't', 'accuracy', 'speed', 'altitude', 'mocked', 'steps'],
  activity_zones: ['activity_id', 'user_id', 'zone_id', 'faction', 'meters', 'rp', 'outcome', 'owner_before', 'owner_after', 'created_at'],
  fog_cells: ['user_id', 'cell', 'created_at'],
  chest_opens: ['user_id', 'chest_id', 'activity_id', 'rarity', 'xp', 'created_at'],
  crews: ['id', 'name', 'tag', 'faction', 'invite_code', 'leader_id', 'created_at'],
  crew_members: ['crew_id', 'user_id', 'role', 'joined_at'],
  notifications: ['id', 'user_id', 'type', 'title', 'body', 'data', 'read_at', 'created_at'],
  privacy_zones: ['id', 'user_id', 'label', 'lat', 'lng', 'radius_m', 'created_at'],
  safety_contacts: ['id', 'user_id', 'name', 'phone', 'created_at'],
  moderation_reviews: ['id', 'activity_id', 'moderator_id', 'decision', 'justification', 'created_at'],
  leaderboard_individual: ['position', 'user_id', 'username', 'faction', 'city', 'crew_tag', 'rp', 'meters', 'runs'],
  leaderboard_crews: ['position', 'crew_id', 'name', 'tag', 'faction', 'rp', 'members'],
  leaderboard_factions: ['position', 'faction', 'rp', 'runners', 'zones'],
  leaderboard_cities: ['position', 'city', 'rp', 'active_runners', 'eligible', 'score'],
  // Engajamento v2 (E7): cosméticos da pessoa (escritos pelos pares em `engagement.ts`).
  user_cosmetics: ['user_id', 'cosmetic_id', 'variant', 'source', 'unlocked_at'],
} as const satisfies Record<string, readonly string[]>;

export type DemoTable = keyof typeof DEMO_TABLE_COLUMNS;
export const DEMO_TABLES = Object.keys(DEMO_TABLE_COLUMNS) as DemoTable[];
export const DEMO_BUCKETS = ['avatars'] as const;

const VIEWS = new Set<DemoTable>(['public_profiles', 'staff_profiles', 'leaderboard_individual', 'leaderboard_crews', 'leaderboard_factions', 'leaderboard_cities']);
type BaseTable = Exclude<DemoTable, 'public_profiles' | 'staff_profiles' | 'leaderboard_individual' | 'leaderboard_crews' | 'leaderboard_factions' | 'leaderboard_cities'>;

export const iso = (ms: number | null | undefined) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);
export const msOf = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

export type ZoneRow = {
  id: string;
  name: string | null;
  city: string | null;
  owner: FactionId | null;
  influence: Record<FactionId, number>;
  shield: number;
  attacker: FactionId | null;
  attack_started_at: string | null;
  blocked: boolean;
  updated_at: string;
  version: number;
};

export const zoneFromRow = (r: ZoneRow): Zone => ({
  id: r.id,
  influence: { ...r.influence },
  owner: r.owner,
  shield: r.shield,
  attackStartedAt: msOf(r.attack_started_at),
  attacker: r.attacker,
  blocked: r.blocked,
});

export type ZoneEventRow = { zone_id: string; type: string; faction: FactionId | null; from_faction: FactionId | null; created_at: string };
export type DeviceRow = { device_id: string; user_id: string; secret: string; platform: string; model: string | null };
export type ChestRow = { id: string; user_id: string; day: string; lat: number; lng: number; rarity: 'comum' | 'raro' | 'lendario'; xp: number; opened_at: string | null; created_at: string };

export type DemoDbOptions = Omit<WorldOptions, 'now'> & { now?: number };

export type ChangeListener = (table: 'zones' | 'notifications', event: 'INSERT' | 'UPDATE', row: Row) => void;

const DEFAULT_PREFS = { invasion: true, conquest: true, missions: true, moderation: true };

export class DemoDb {
  readonly world: DemoWorld;
  private clock: () => number;
  private seq = 0;
  readonly tables: Record<BaseTable, Row[]>;
  readonly zones = new Map<string, ZoneRow>();
  readonly zoneEvents: ZoneEventRow[] = [];
  readonly devices = new Map<string, DeviceRow>();
  readonly chests: ChestRow[] = [];
  /** Estatísticas da temporada/semana dos outros corredores (o "passado" que o servidor teria). */
  readonly runners = new Map<string, DemoRunner>();
  private listeners = new Set<ChangeListener>();

  constructor(opts: DemoDbOptions & { clock?: () => number }) {
    this.clock = opts.clock ?? (() => opts.now ?? Date.now());
    this.world = createWorld({ ...opts, now: opts.now ?? this.clock() });
    this.tables = {
      profiles: [],
      activities: [],
      activity_points: [],
      activity_zones: [],
      fog_cells: [],
      chest_opens: [],
      crews: [],
      crew_members: [],
      notifications: [],
      privacy_zones: [],
      safety_contacts: [],
      moderation_reviews: [],
      user_cosmetics: [],
    };
    this.seed();
  }

  now() {
    return this.clock();
  }

  nextId(prefix: string) {
    this.seq += 1;
    return `demo-${prefix}-${this.now().toString(36)}-${this.seq.toString(36)}`;
  }

  onChange(l: ChangeListener) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  emit(table: 'zones' | 'notifications', event: 'INSERT' | 'UPDATE', row: Row) {
    for (const l of this.listeners) {
      try {
        l(table, event, row);
      } catch {
        // Um ouvinte com erro não derruba o servidor de demonstração.
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Semente
  // ---------------------------------------------------------------------------------------------
  private profileRow(r: DemoRunner): Row {
    return {
      id: r.id,
      username: r.username,
      birthdate: '1998-05-10',
      faction: r.faction,
      city: r.city,
      units: 'km',
      notification_prefs: { ...DEFAULT_PREFS },
      xp: r.xp,
      trust: r.trust,
      role: r.role,
      status: r.status,
      avatar_url: null,
      faction_changed_season: null,
      suspended_until: null,
      streak_weeks: r.id === this.world.me.id && r.xp > 0 ? 2 : 0,
      freezes_left: 1,
      created_at: iso(r.createdAt),
      is_demo: true,
    };
  }

  private seed() {
    const w = this.world;
    for (const r of w.runners) this.runners.set(r.id, r);
    this.tables.profiles.push(this.profileRow(w.me), ...w.runners.map((r) => this.profileRow(r)));
    for (const c of w.crews) this.tables.crews.push({ id: c.id, name: c.name, tag: c.tag, faction: c.faction, invite_code: c.inviteCode, leader_id: c.leaderId, created_at: iso(c.createdAt) });
    for (const m of w.memberships) this.tables.crew_members.push({ crew_id: m.crewId, user_id: m.userId, role: m.role, joined_at: iso(m.joinedAt) });
    const updated = iso(w.now - 3600_000)!;
    for (const [id, z] of Object.entries(w.zones)) {
      this.zones.set(id, {
        id,
        name: w.zoneNames[id] ?? null,
        city: DEMO_CITY_LABEL,
        owner: z.owner,
        influence: { ...z.influence },
        shield: z.shield,
        attacker: z.attacker,
        attack_started_at: iso(z.attackStartedAt),
        blocked: z.blocked,
        updated_at: updated,
        version: 1,
      });
      if (z.attackStartedAt !== null && z.owner) {
        this.zoneEvents.push({ zone_id: id, type: 'under_attack', faction: z.attacker, from_faction: z.owner, created_at: iso(z.attackStartedAt)! });
      }
    }
    for (const n of w.notifications) {
      this.tables.notifications.push({ id: n.id, user_id: w.me.id, type: n.type, title: n.title, body: n.body, data: n.data, read_at: iso(n.readAt), created_at: iso(n.createdAt) });
    }
    for (const p of w.privacyZones) this.tables.privacy_zones.push({ id: p.id, user_id: w.me.id, label: p.label, lat: p.lat, lng: p.lng, radius_m: p.radiusM, created_at: iso(p.createdAt) });
    for (const c of w.contacts) this.tables.safety_contacts.push({ id: c.id, user_id: w.me.id, name: c.name, phone: c.phone, created_at: iso(c.createdAt) });
    for (const run of [...w.myRuns, ...w.reviewRuns]) {
      this.tables.activities.push(this.activityRow(run.id, run.userId, run.startedAt, run.mission));
      for (const p of run.points) this.tables.activity_points.push({ activity_id: run.id, ...p });
      const act = this.tables.activities[this.tables.activities.length - 1];
      act.last_seq = run.points.length - 1;
      if (run.review) {
        const last = run.points[run.points.length - 1];
        Object.assign(act, {
          status: 'review',
          review_reason: run.review.reason,
          flags: run.review.flags,
          ended_at: iso(last.t),
          finished_at: iso(last.t + 5000),
          meters: Math.round(run.points.length * 3.2),
          moving_seconds: run.points.length,
          avg_pace: 312,
        });
      }
    }
  }

  activityRow(id: string, userId: string, startedAt: number, mission: string, extra: Row = {}): Row {
    return {
      id,
      user_id: userId,
      status: 'recording',
      mission,
      started_at: iso(startedAt),
      ended_at: null,
      finished_at: null,
      meters: 0,
      moving_seconds: 0,
      avg_pace: null,
      rp_total: 0,
      xp: 0,
      flags: [],
      result: null,
      scored: false,
      review_reason: null,
      invalid_segments: [],
      ghost_pace: null,
      last_seq: -1,
      device_id: null,
      beat_ghost: null,
      created_at: iso(startedAt),
      ...extra,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Consultas auxiliares
  // ---------------------------------------------------------------------------------------------
  profile(userId: string | null): Row | null {
    return userId ? (this.tables.profiles.find((p) => p.id === userId) ?? null) : null;
  }

  isStaff(userId: string | null) {
    const r = this.profile(userId)?.role;
    return r === 'moderator' || r === 'admin';
  }

  isAdmin(userId: string | null) {
    return this.profile(userId)?.role === 'admin';
  }

  crewOf(userId: string): string | null {
    const m = this.tables.crew_members.find((r) => r.user_id === userId);
    return m ? String(m.crew_id) : null;
  }

  activityOwner(activityId: unknown): string | null {
    const a = this.tables.activities.find((r) => r.id === activityId);
    return a ? String(a.user_id) : null;
  }

  pointsOf(activityId: string): Row[] {
    return this.tables.activity_points.filter((p) => p.activity_id === activityId).sort((a, b) => Number(a.seq) - Number(b.seq));
  }

  /** Estatística de um corredor no período (o próprio corredor de demonstração soma as corridas pontuadas). */
  stats(userId: string, period: 'week' | 'season'): { rp: number; meters: number; runs: number } {
    const seeded = this.runners.get(userId);
    const base = seeded ? { ...seeded[period] } : { rp: 0, meters: 0, runs: 0 };
    const since = period === 'week' ? this.weekStart() : this.seasonStart();
    for (const a of this.tables.activities) {
      if (a.user_id !== userId || a.scored !== true) continue;
      const started = msOf(a.started_at) ?? 0;
      if (started < since) continue;
      base.rp += Number(a.rp_total) || 0;
      base.meters += Number(a.meters) || 0;
      base.runs += 1;
    }
    return base;
  }

  /** Segunda-feira 00:00 de Brasília (UTC-3), como `public.week_start()`. */
  weekStart(): number {
    const br = new Date(this.now() - 3 * 3600_000);
    const day = (br.getUTCDay() + 6) % 7;
    return Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - day) + 3 * 3600_000;
  }

  /** Dia 1 do mês (temporada), em Brasília. */
  seasonStart(): number {
    const br = new Date(this.now() - 3 * 3600_000);
    return Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + 3 * 3600_000;
  }

  /** Dia de hoje em Brasília (AAAA-MM-DD), como `public.br_today()`. */
  brToday(): string {
    return new Date(this.now() - 3 * 3600_000).toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------------------------
  private individualRows(filter: (p: Row) => boolean = () => true, period: 'week' | 'season' = 'season'): Row[] {
    const tagByCrew = new Map(this.tables.crews.map((c) => [c.id, c.tag]));
    const rows = this.tables.profiles
      .filter((p) => p.status !== 'inactive' && p.faction && filter(p))
      .map((p) => {
        const s = this.stats(String(p.id), period);
        const crewId = this.crewOf(String(p.id));
        return { user_id: p.id, username: p.username, faction: p.faction, city: p.city, crew_tag: crewId ? (tagByCrew.get(crewId) ?? null) : null, rp: s.rp, meters: s.meters, runs: s.runs };
      })
      .filter((r) => r.runs > 0 || r.rp > 0)
      .sort((a, b) => b.rp - a.rp || String(a.username).localeCompare(String(b.username)));
    return rows.map((r, i) => ({ position: i + 1, ...r }));
  }

  rankingRunners(period: 'week' | 'season', scope: string, value: string | null, limit: number): Row[] {
    const filter = (p: Row) => {
      if (scope === 'faction') return p.faction === value;
      if (scope === 'city') return p.city === value;
      if (scope === 'district') return this.districtOfUser(String(p.id)) === value;
      return true;
    };
    return this.individualRows(filter, period).slice(0, limit);
  }

  rankingCrews(period: 'week' | 'season', scope: string, value: string | null, limit: number): Row[] {
    const people = new Map(this.individualRows(() => true, period).map((r) => [String(r.user_id), r]));
    const rows = this.tables.crews
      .filter((c) => scope !== 'faction' || c.faction === value)
      .map((c) => {
        const members = this.tables.crew_members.filter((m) => m.crew_id === c.id);
        const inScope = members.filter((m) => {
          const p = this.profile(String(m.user_id));
          if (!p) return false;
          if (scope === 'city') return p.city === value;
          if (scope === 'district') return this.districtOfUser(String(p.id)) === value;
          return true;
        });
        const rp = inScope.reduce((s, m) => s + Number(people.get(String(m.user_id))?.rp ?? 0), 0);
        return { crew_id: c.id, name: c.name, tag: c.tag, faction: c.faction, rp, members: members.length };
      })
      .filter((r) => r.rp > 0 || scope === 'general')
      .sort((a, b) => b.rp - a.rp || String(a.tag).localeCompare(String(b.tag)));
    return rows.slice(0, limit).map((r, i) => ({ position: i + 1, ...r }));
  }

  rankingFactions(period: 'week' | 'season', scope: string, value: string | null): Row[] {
    const people = this.rankingRunners(period, scope === 'faction' ? 'general' : scope, value, 10_000);
    const zones = [...this.zones.values()];
    const rows = FACTION_IDS.map((f) => {
      const mine = people.filter((p) => p.faction === f);
      return {
        faction: f,
        rp: mine.reduce((s, p) => s + Number(p.rp), 0),
        runners: mine.length,
        zones: zones.filter((z) => z.owner === f && (scope !== 'district' || districtOf(z.id) === value)).length,
      };
    }).sort((a, b) => b.rp - a.rp || a.faction.localeCompare(b.faction));
    return rows.map((r, i) => ({ position: i + 1, ...r }));
  }

  /** Distrito da zona da corrida mais recente (o do corredor de demonstração vem das próprias corridas). */
  districtOfUser(userId: string): string | null {
    const last = this.tables.activity_zones.filter((z) => z.user_id === userId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (last) return districtOf(String(last.zone_id));
    return this.runners.get(userId)?.district ?? (userId === this.world.me.id ? this.world.me.district : null);
  }

  private view(table: DemoTable, userId: string | null): Row[] {
    switch (table) {
      case 'public_profiles':
        return this.tables.profiles
          .filter((p) => p.status !== 'inactive')
          .map((p) => ({ id: p.id, username: p.username, faction: p.faction, avatar_url: p.avatar_url, city: p.city, crew_id: this.crewOf(String(p.id)) }));
      case 'staff_profiles':
        return this.isStaff(userId)
          ? this.tables.profiles.map((p) => ({ id: p.id, username: p.username, role: p.role, status: p.status, trust: p.trust, faction: p.faction, city: p.city, created_at: p.created_at }))
          : [];
      case 'leaderboard_individual':
        return this.individualRows();
      case 'leaderboard_crews':
        return this.rankingCrews('season', 'general', null, 10_000);
      case 'leaderboard_factions':
        return this.rankingFactions('season', 'general', null);
      case 'leaderboard_cities':
        return this.world.cities
          .map((c) => ({ city: c.city, rp: c.rp, active_runners: c.activeRunners, eligible: c.eligible, score: c.score }))
          .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
          .map((c, i) => ({ position: i + 1, ...c }));
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Leitura e escrita com as regras da RLS
  // ---------------------------------------------------------------------------------------------
  private visible(table: BaseTable, row: Row, userId: string | null): boolean {
    if (!userId) return false;
    switch (table) {
      case 'profiles':
        return row.id === userId;
      case 'activities':
        return row.user_id === userId || this.isStaff(userId);
      case 'activity_points':
      case 'moderation_reviews':
        return this.activityOwner(row.activity_id) === userId || this.isStaff(userId);
      case 'crews':
        // QA-01: só o líder e os membros leem a linha (com o código de convite).
        return row.leader_id === userId || this.tables.crew_members.some((m) => m.crew_id === row.id && m.user_id === userId);
      case 'crew_members':
        return true;
      default:
        return row.user_id === userId;
    }
  }

  read(table: DemoTable, userId: string | null): Row[] {
    if (VIEWS.has(table)) return userId ? this.view(table, userId) : [];
    const base = table as BaseTable;
    return this.tables[base].filter((r) => this.visible(base, r, userId));
  }

  insert(table: DemoTable, values: Row[], userId: string | null): Row[] {
    if (!userId) throw new DemoPgError('42501', 'new row violates row-level security policy');
    const out: Row[] = [];
    for (const v of values) {
      switch (table) {
        case 'privacy_zones': {
          if (this.tables.privacy_zones.filter((r) => r.user_id === userId).length >= 3) throw raise('PRIVACY_ZONES_LIMIT: no máximo 3 zonas de privacidade');
          const row = { id: this.nextId('privacidade'), user_id: userId, label: v.label ?? null, lat: v.lat, lng: v.lng, radius_m: v.radius_m ?? 200, created_at: iso(this.now()) };
          this.tables.privacy_zones.push(row);
          out.push(row);
          break;
        }
        case 'safety_contacts': {
          if (this.tables.safety_contacts.filter((r) => r.user_id === userId).length >= 5) throw raise('CONTACTS_LIMIT: no máximo 5 contatos de segurança');
          const row = { id: this.nextId('contato'), user_id: userId, name: v.name, phone: v.phone, created_at: iso(this.now()) };
          this.tables.safety_contacts.push(row);
          out.push(row);
          break;
        }
        case 'crews': {
          const me = this.profile(userId);
          if (!me?.faction) throw raise('FACTION_REQUIRED: escolha uma facção antes de criar uma crew');
          if (this.crewOf(userId)) throw raise('ALREADY_IN_CREW: saia da crew atual antes de criar outra');
          const tag = String(v.tag ?? '').toUpperCase();
          if (this.tables.crews.some((c) => c.tag === tag || c.name === v.name)) throw new DemoPgError('23505', 'duplicate key value violates unique constraint "crews_tag_key"');
          const id = this.nextId('crew');
          const row = { id, name: v.name, tag, faction: me.faction, invite_code: `DEMO${tag}${this.seq}`.slice(0, 12), leader_id: userId, created_at: iso(this.now()) };
          this.tables.crews.push(row);
          this.tables.crew_members.push({ crew_id: id, user_id: userId, role: 'leader', joined_at: iso(this.now()) });
          out.push(row);
          break;
        }
        default:
          throw new DemoPgError('42501', `permission denied for table ${table}`);
      }
    }
    return out;
  }

  update(table: DemoTable, patch: Row, match: (r: Row) => boolean, userId: string | null): Row[] {
    const allowed: Partial<Record<DemoTable, readonly string[]>> = {
      profiles: ['username', 'city', 'units', 'notification_prefs', 'avatar_url'],
      safety_contacts: ['name', 'phone'],
      privacy_zones: ['label', 'lat', 'lng', 'radius_m'],
    };
    const cols = allowed[table];
    if (!cols || VIEWS.has(table)) throw new DemoPgError('42501', `permission denied for table ${table}`);
    for (const k of Object.keys(patch)) if (!cols.includes(k)) throw new DemoPgError('42501', `permission denied for column ${k} of relation ${table}`);
    if (table === 'profiles' && typeof patch.username === 'string') {
      const name = patch.username.trim().toLowerCase();
      if (this.tables.profiles.some((p) => p.id !== userId && String(p.username).toLowerCase() === name)) throw raise('USERNAME_TAKEN: nome de usuário já está em uso');
    }
    const rows = this.read(table, userId).filter(match);
    for (const r of rows) Object.assign(r, patch);
    return rows;
  }

  remove(table: DemoTable, match: (r: Row) => boolean, userId: string | null): Row[] {
    const base = table as BaseTable;
    if (VIEWS.has(table) || !['privacy_zones', 'safety_contacts', 'crew_members'].includes(base)) throw new DemoPgError('42501', `permission denied for table ${table}`);
    const victims = this.read(table, userId)
      .filter(match)
      .filter((r) => {
        if (base !== 'crew_members') return true;
        // policy crew_members_delete: o próprio membro sai; o líder remove os outros.
        const crew = this.tables.crews.find((c) => c.id === r.crew_id);
        return r.user_id === userId || crew?.leader_id === userId;
      });
    this.tables[base] = this.tables[base].filter((r) => !victims.includes(r));
    return victims;
  }

  // ---------------------------------------------------------------------------------------------
  // Usado pelas functions e RPCs
  // ---------------------------------------------------------------------------------------------
  insertNotification(userId: string, n: { type: string; title: string; body: string; data: Row }) {
    const prefs = (this.profile(userId)?.notification_prefs ?? {}) as Row;
    const prefKey = n.type === 'conquest' ? 'conquest' : n.type === 'invasion' ? 'invasion' : null;
    if (prefKey && prefs[prefKey] === false) return null;
    const row: Row = { id: this.nextId('notificacao'), user_id: userId, type: n.type, title: n.title, body: n.body, data: { ...n.data, demonstracao: true }, read_at: null, created_at: iso(this.now()) };
    this.tables.notifications.push(row);
    this.emit('notifications', 'INSERT', row);
    return row;
  }

  zoneRowsAsDomain(ids?: Iterable<string>): Record<string, Zone> {
    const out: Record<string, Zone> = {};
    const list = ids ? [...ids].map((id) => this.zones.get(id)).filter((z): z is ZoneRow => !!z) : [...this.zones.values()];
    for (const z of list) out[z.id] = zoneFromRow(z);
    return out;
  }

  writeZone(z: Zone, name: string | null) {
    const before = this.zones.get(z.id);
    const row: ZoneRow = {
      id: z.id,
      name: before?.name ?? name,
      city: before?.city ?? DEMO_CITY_LABEL,
      owner: z.owner,
      influence: { ...z.influence },
      shield: z.shield,
      attacker: z.attacker,
      attack_started_at: iso(z.attackStartedAt),
      blocked: z.blocked,
      updated_at: iso(this.now())!,
      version: (before?.version ?? 0) + 1,
    };
    this.zones.set(z.id, row);
    this.emit('zones', before ? 'UPDATE' : 'INSERT', row as unknown as Row);
    return row;
  }
}
