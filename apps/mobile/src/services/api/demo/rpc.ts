/**
 * As 11 RPCs que o app chama (`supabase.rpc(...)`), com as regras das funções SQL do backend
 * (`supabase/migrations/*`), sobre o banco de demonstração. Erros como `RAISE EXCEPTION 'CODIGO: ...'`.
 */
import { CHEST_XP } from '@/domain/games';
import { districtOf } from '@/domain/grid';
import { FACTION_IDS } from '@/domain/types';
import { seedChests } from '@/demo/demo-data';

import { DemoPgError, iso, msOf, raise, type ChestRow, type DemoDb, type Row } from './db';
import { DEMO_SOCIAL_RPC_HANDLERS } from './social';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

function requireUser(db: DemoDb, userId: string | null): Row {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return p;
}

/** Temporada atual ('AAAA-MM', horário de Brasília), como `public.current_season_id()`. */
const seasonId = (db: DemoDb) => new Date(db.now() - 3 * 3600_000).toISOString().slice(0, 7);

const period = (v: unknown) => (v === 'week' ? 'week' : 'season') as 'week' | 'season';
const scopeOf = (v: unknown) => (v === 'faction' || v === 'city' || v === 'district' ? v : 'general');
const valueOf = (v: unknown) => (typeof v === 'string' && v ? v : null);
const limitOf = (v: unknown) => Math.max(1, Math.min(100, typeof v === 'number' ? v : 50));

export const DEMO_RPC_HANDLERS: Record<string, RpcHandler> = {
  username_available: (db, _u, args) => {
    const name = String(args.p_username ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(name)) return false;
    return !db.tables.profiles.some((p) => String(p.username).toLowerCase() === name);
  },

  choose_faction: (db, userId, args) => {
    const me = requireUser(db, userId);
    const f = args.p_faction;
    if (typeof f !== 'string' || !(FACTION_IDS as readonly string[]).includes(f)) throw raise('INVALID_FACTION: facção inválida');
    const season = seasonId(db);
    if (!me.faction) me.faction = f;
    else if (me.faction === f) {
      // nada muda
    } else if (me.faction_changed_season === season) throw raise('FACTION_CHANGE_LIMIT: a facção só pode ser trocada uma vez por temporada');
    else {
      me.faction = f;
      me.faction_changed_season = season;
      db.tables.crew_members = db.tables.crew_members.filter((m) => m.user_id !== userId); // RN-011
    }
    return { faction: me.faction, factionChangedSeason: me.faction_changed_season, canChangeThisSeason: me.faction_changed_season !== season };
  },

  join_crew: (db, userId, args) => {
    const me = requireUser(db, userId);
    if (db.crewOf(userId!)) throw raise('ALREADY_IN_CREW: saia da crew atual antes de entrar em outra');
    const code = String(args.p_code ?? '').trim().toUpperCase();
    const crew = db.tables.crews.find((c) => c.invite_code === code);
    if (!crew) throw raise('CREW_NOT_FOUND: código de convite inválido');
    if (crew.faction !== me.faction) throw raise('CREW_FACTION_MISMATCH: a crew precisa ser da mesma facção do corredor');
    if (db.tables.crew_members.filter((m) => m.crew_id === crew.id).length >= 30) throw raise('CREW_FULL: a crew já tem 30 membros');
    db.tables.crew_members.push({ crew_id: crew.id, user_id: userId, role: 'member', joined_at: iso(db.now()) });
    return { crewId: crew.id, name: crew.name, tag: crew.tag, faction: crew.faction };
  },

  leave_crew: (db, userId) => {
    requireUser(db, userId);
    const before = db.tables.crew_members.length;
    db.tables.crew_members = db.tables.crew_members.filter((m) => m.user_id !== userId);
    return db.tables.crew_members.length < before;
  },

  mark_notifications_read: (db, userId, args) => {
    if (!userId) return 0;
    const ids = Array.isArray(args.ids) ? new Set(args.ids.map(String)) : null;
    let n = 0;
    for (const row of db.tables.notifications) {
      if (row.user_id !== userId || row.read_at !== null) continue;
      if (ids && !ids.has(String(row.id))) continue;
      row.read_at = iso(db.now());
      n++;
    }
    return n;
  },

  admin_set_user_status: (db, userId, args) => {
    if (!db.isAdmin(userId)) throw raise('FORBIDDEN: apenas administradores podem alterar o status de contas');
    const status = args.p_status;
    if (status !== 'active' && status !== 'inactive' && status !== 'suspended') throw raise('INVALID_STATUS: status inválido');
    if (args.p_user_id === userId) throw raise('FORBIDDEN: não é possível alterar o próprio status');
    const target = db.profile(String(args.p_user_id));
    if (!target) throw raise('NOT_FOUND: usuário não encontrado');
    target.status = status;
    target.suspended_until = status === 'suspended' ? iso(db.now() + 30 * 86_400_000) : null;
    return { userId: target.id, status };
  },

  daily_chests: (db, userId, args) => {
    requireUser(db, userId);
    const lat = args.p_lat;
    const lng = args.p_lng;
    if ((lat === undefined || lat === null) !== (lng === undefined || lng === null)) throw raise('VALIDATION: posição inválida');
    const day = db.brToday();
    let mine = db.chests.filter((c) => c.user_id === userId && c.day === day);
    if (mine.length === 0) {
      // Sorteio do dia perto do fim da última corrida; sem corrida, da posição enviada.
      const last = db.tables.activities.filter((a) => a.user_id === userId && a.status !== 'rejected').sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
      const pts = last ? db.pointsOf(String(last.id)) : [];
      const near = pts.length ? { lat: Number(pts[pts.length - 1].lat), lng: Number(pts[pts.length - 1].lng) } : typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
      if (near) {
        const rows: ChestRow[] = seedChests(near, db.now()).map((c) => ({ id: db.nextId('bau'), user_id: userId!, day, lat: c.position.lat, lng: c.position.lng, rarity: c.rarity, xp: CHEST_XP[c.rarity], opened_at: null, created_at: iso(db.now())! }));
        db.chests.push(...rows);
        mine = rows;
      }
    }
    return { day, chests: mine.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, rarity: c.rarity, xp: c.xp, openedAt: msOf(c.opened_at) })) };
  },

  district_label: (db, _u, args) => {
    const district = String(args.p_district ?? '');
    // Nome do bairro mais comum entre as zonas com nome dentro do distrito (H3 res. 7).
    const counts = new Map<string, number>();
    for (const z of db.zones.values()) {
      if (!z.name || districtOf(z.id) !== district) continue;
      const hood = z.name.replace(/\s+\d+$/, '');
      counts.set(hood, (counts.get(hood) ?? 0) + 1);
    }
    const best = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return best ? best[0] : `Distrito ${district.slice(-4).toUpperCase()}`;
  },

  ranking_runners: (db, userId, args) => {
    requireUser(db, userId);
    return db.rankingRunners(period(args.p_period), scopeOf(args.p_scope), valueOf(args.p_value), limitOf(args.p_limit));
  },

  ranking_crews: (db, userId, args) => {
    requireUser(db, userId);
    return db.rankingCrews(period(args.p_period), scopeOf(args.p_scope), valueOf(args.p_value), limitOf(args.p_limit));
  },

  ranking_factions: (db, userId, args) => {
    requireUser(db, userId);
    const scope = scopeOf(args.p_scope);
    if (scope === 'faction') throw new DemoPgError('P0001', 'VALIDATION: escopo inválido para facções');
    return db.rankingFactions(period(args.p_period), scope, valueOf(args.p_value));
  },

  // E8 (T7.2.5): feed da crew, reações e record_share.
  ...DEMO_SOCIAL_RPC_HANDLERS,
};

/** Nomes das RPCs que o servidor de demonstração atende (o teste de contrato confere contra os repositórios). */
export const DEMO_RPCS = Object.keys(DEMO_RPC_HANDLERS).sort();
