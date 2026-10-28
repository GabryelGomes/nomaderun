/**
 * Pares de demonstração da telemetria opt-in (E7, T7.3.6; D-82): `my_telemetry`, `set_telemetry_consent` e
 * `log_events`, com as mesmas regras do contrato para a E9 (`docs/melhoria/relatorios/E7-onda3.md` §4):
 * - desligada por padrão; o consentimento guarda quem, quando e qual versão do texto (e o histórico);
 * - `log_events` recusa com `TELEMETRY_OFF` sem consentimento; lista fechada de 5 nomes; até 50 por envio e
 *   200 por dia; `app_open` 1 por dia; instante fora de [agora − 7 dias, agora + 5 min] é descartado;
 *   propriedades fora da regra do evento são descartadas;
 * - desligar apaga os eventos da pessoa; a retenção é de 30 dias.
 * Tudo em memória, por banco de demonstração (nada sai do aparelho).
 */
import { iso, raise, type DemoDb, type Row } from './db';

type RpcHandler = (db: DemoDb, userId: string | null, args: Row) => unknown;

export const DEMO_TELEMETRY_EVENTS = ['app_open', 'run_finished', 'zone_conquered', 'share', 'mission_completed'] as const;
const RETENTION_DAYS = 30;
const MAX_PER_CALL = 50;
const MAX_PER_DAY = 200;
const DAY = 86_400_000;

type Consent = { optIn: boolean; version: string | null; decidedAt: number | null };
type StoredEvent = { userId: string; name: string; at: number; day: string; props: Row; receivedAt: number };
type TelemetryState = { consents: Map<string, Consent>; log: { userId: string; optIn: boolean; version: string; at: number }[]; events: StoredEvent[] };

const STATES = new WeakMap<DemoDb, TelemetryState>();

function stateOf(db: DemoDb): TelemetryState {
  let st = STATES.get(db);
  if (!st) {
    st = { consents: new Map(), log: [], events: [] };
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

const PROP_RULES: Record<string, Record<string, (v: unknown) => boolean>> = {
  zone_conquered: { count: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 50 },
  mission_completed: { cadence: (v) => v === 'diaria' || v === 'semanal' || v === 'ftue' || v === 'volta' },
};

function consentJson(c: Consent | undefined) {
  return {
    optIn: c?.optIn === true,
    version: c?.version ?? null,
    decidedAt: c?.decidedAt ?? null,
    retentionDays: RETENTION_DAYS,
    events: [...DEMO_TELEMETRY_EVENTS],
  };
}

/** Apaga os eventos com mais de 30 dias (o job diário do servidor). */
function purge(st: TelemetryState, now: number) {
  st.events = st.events.filter((e) => e.receivedAt >= now - RETENTION_DAYS * DAY);
}

export const DEMO_TELEMETRY_RPC_HANDLERS: Record<string, RpcHandler> = {
  my_telemetry: (db, userId) => {
    const uid = requireUser(db, userId);
    return consentJson(stateOf(db).consents.get(uid));
  },

  set_telemetry_consent: (db, userId, args) => {
    const uid = requireUser(db, userId);
    if (typeof args.p_opt_in !== 'boolean') throw raise('VALIDATION: informe ligar ou desligar');
    const version = typeof args.p_version === 'string' && args.p_version.length > 0 && args.p_version.length <= 40 ? args.p_version : null;
    if (!version) throw raise('VALIDATION: versão do texto do consentimento inválida');
    const st = stateOf(db);
    const now = db.now();
    const c: Consent = { optIn: args.p_opt_in, version, decidedAt: now };
    st.consents.set(uid, c);
    st.log.push({ userId: uid, optIn: c.optIn, version, at: now });
    if (!c.optIn) st.events = st.events.filter((e) => e.userId !== uid);
    return consentJson(c);
  },

  log_events: (db, userId, args) => {
    const uid = requireUser(db, userId);
    const st = stateOf(db);
    if (st.consents.get(uid)?.optIn !== true) throw raise('TELEMETRY_OFF: a telemetria está desligada');
    const list = Array.isArray(args.p_events) ? (args.p_events as unknown[]) : null;
    if (!list) throw raise('VALIDATION: lista de eventos inválida');
    if (list.length > MAX_PER_CALL) throw raise(`VALIDATION: no máximo ${MAX_PER_CALL} eventos por envio`);
    const now = db.now();
    purge(st, now);
    const today = brDay(now);
    let accepted = 0;
    let dropped = 0;
    for (const raw of list) {
      const e = (raw && typeof raw === 'object' ? raw : {}) as Row;
      const name = typeof e.name === 'string' ? e.name : '';
      const at = typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : NaN;
      const mine = st.events.filter((x) => x.userId === uid && x.day === today);
      const ok =
        (DEMO_TELEMETRY_EVENTS as readonly string[]).includes(name) &&
        at >= now - 7 * DAY &&
        at <= now + 5 * 60_000 &&
        mine.length < MAX_PER_DAY &&
        !(name === 'app_open' && st.events.some((x) => x.userId === uid && x.name === 'app_open' && x.day === brDay(at)));
      if (!ok) {
        dropped += 1;
        continue;
      }
      const rules = PROP_RULES[name] ?? {};
      const given = (e.props && typeof e.props === 'object' ? e.props : {}) as Row;
      const props: Row = {};
      for (const [k, rule] of Object.entries(rules)) if (rule(given[k])) props[k] = given[k];
      st.events.push({ userId: uid, name, at, day: brDay(at), props, receivedAt: now });
      accepted += 1;
    }
    return { accepted, dropped, receivedAt: iso(now) };
  },
};

/** Só para testes: o que o servidor de demonstração guardou. */
export function demoTelemetryState(db: DemoDb) {
  return STATES.get(db) ?? null;
}
