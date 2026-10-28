/**
 * Pares de demonstração da telemetria opt-in (E7, T7.3.6; D-82), com as regras da migration da E9
 * (`supabase/migrations/20261024120200_telemetry.sql`):
 * - `my_telemetry_consent` → `{ optedIn, policyVersion, enabled }` (aqui a flag está ligada);
 * - `set_telemetry_consent(p_opt_in, p_policy_version)` → `{ optedIn, policyVersion, deletedEvents }`; retirar
 *   apaga os eventos da pessoa na hora;
 * - `track_events(p_events)` → `{ accepted, dropped }`: `TELEMETRY_CONSENT` sem consentimento; 1 a 50 eventos;
 *   lista fechada de 5 nomes; `day` de hoje a 2 dias atrás; `props` só com as chaves permitidas (texto curto sem
 *   ponto, booleano ou inteiro até 100.000); o lote inteiro é recusado se um evento for inválido; 200 por dia e
 *   1 `app_open` por dia (o excedente conta em `dropped`).
 * Tudo em memória, por banco de demonstração (nada sai do aparelho).
 */
import { raise, type DemoDb, type Row } from './db';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

export const DEMO_TELEMETRY_EVENTS = ['app_open', 'run_finish', 'zone_conquer', 'share', 'mission_complete'] as const;
const PROP_KEYS = ['model', 'format', 'withRoute', 'kind', 'source', 'missionId', 'count'];
const EVENT_KEYS = ['event', 'day', 'props', 'appVersion', 'platform'];
const MAX_PER_DAY = 200;

type Consent = { optedIn: boolean; policyVersion: number; updatedAt: number };
type StoredEvent = { userId: string; event: string; day: string; props: Row; platform: string | null };
type TelemetryState = { consents: Map<string, Consent>; events: StoredEvent[] };

const STATES = new WeakMap<DemoDb, TelemetryState>();

function stateOf(db: DemoDb): TelemetryState {
  let st = STATES.get(db);
  if (!st) {
    st = { consents: new Map(), events: [] };
    STATES.set(db, st);
  }
  return st;
}

function requireUser(db: DemoDb, userId: string | null): string {
  const p = db.profile(userId);
  if (!userId || !p) throw raise('UNAUTHORIZED: faça login novamente');
  if (p.status === 'inactive') throw raise('ACCOUNT_INACTIVE: conta inativa');
  return userId;
}

const brDay = (at: number) => new Date(at - 3 * 3_600_000).toISOString().slice(0, 10);

function propsOk(p: unknown): boolean {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const entries = Object.entries(p as Row);
  if (entries.length > 6 || JSON.stringify(p).length > 256) return false;
  return entries.every(([k, v]) => {
    if (!PROP_KEYS.includes(k)) return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') return /^[a-z0-9_-]{1,32}$/.test(v);
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000;
  });
}

export const DEMO_TELEMETRY_RPC_HANDLERS: Record<string, RpcHandler> = {
  my_telemetry_consent: (db, userId) => {
    const uid = requireUser(db, userId);
    const c = stateOf(db).consents.get(uid);
    return { optedIn: c?.optedIn === true, policyVersion: c?.policyVersion ?? 1, enabled: true };
  },

  set_telemetry_consent: (db, userId, args) => {
    const uid = requireUser(db, userId);
    if (typeof args.p_opt_in !== 'boolean') throw raise('VALIDATION: informe true ou false');
    const version = args.p_policy_version === undefined ? 1 : args.p_policy_version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 100) throw raise('VALIDATION: versão da política inválida');
    const st = stateOf(db);
    st.consents.set(uid, { optedIn: args.p_opt_in, policyVersion: version, updatedAt: db.now() });
    let deleted = 0;
    if (!args.p_opt_in) {
      const before = st.events.length;
      st.events = st.events.filter((e) => e.userId !== uid);
      deleted = before - st.events.length;
    }
    return { optedIn: args.p_opt_in, policyVersion: version, deletedEvents: deleted };
  },

  track_events: (db, userId, args) => {
    const uid = requireUser(db, userId);
    const st = stateOf(db);
    if (st.consents.get(uid)?.optedIn !== true) throw raise('TELEMETRY_CONSENT: sem consentimento, nenhum evento é gravado');
    const list = args.p_events;
    if (!Array.isArray(list) || list.length < 1 || list.length > 50) throw raise('VALIDATION: envie de 1 a 50 eventos');
    const now = db.now();
    const today = brDay(now);
    const oldest = brDay(now - 2 * 86_400_000);
    // 1ª passada: valida tudo antes de gravar (o lote inteiro é recusado).
    for (const raw of list as unknown[]) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some((k) => !EVENT_KEYS.includes(k))) throw raise('VALIDATION: evento com formato inválido');
      const e = raw as Row;
      if (typeof e.event !== 'string' || !(DEMO_TELEMETRY_EVENTS as readonly string[]).includes(e.event)) throw raise('VALIDATION: evento fora da lista');
      if (e.day !== undefined && (typeof e.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.day) || e.day < oldest || e.day > today)) throw raise('VALIDATION: dia inválido (hoje ou até 2 dias atrás)');
      if (e.props !== undefined && !propsOk(e.props)) throw raise('VALIDATION: props fora da lista (sem localização, texto curto)');
      if (e.platform !== undefined && e.platform !== 'ios' && e.platform !== 'android' && e.platform !== 'web') throw raise('VALIDATION: plataforma inválida');
    }
    let accepted = 0;
    let dropped = 0;
    for (const e of list as Row[]) {
      const day = typeof e.day === 'string' ? e.day : today;
      const mine = st.events.filter((x) => x.userId === uid && x.day === day);
      if (mine.length >= MAX_PER_DAY || (e.event === 'app_open' && mine.some((x) => x.event === 'app_open'))) {
        dropped += 1;
        continue;
      }
      st.events.push({ userId: uid, event: String(e.event), day, props: (e.props as Row) ?? {}, platform: typeof e.platform === 'string' ? e.platform : null });
      accepted += 1;
    }
    return { accepted, dropped };
  },
};

/** Só para testes: o que o servidor de demonstração guardou. */
export function demoTelemetryState(db: DemoDb) {
  return STATES.get(db) ?? null;
}
