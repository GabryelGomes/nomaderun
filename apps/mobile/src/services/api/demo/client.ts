/**
 * Cliente de demonstração (D-77, T7.1.18): implementa, em memória, a parte do `SupabaseClient` que o app usa
 * — `from()` (PostgREST), `rpc()`, `functions.invoke()`, `auth`, `channel()`/`removeChannel()` (Realtime) e
 * `storage.from('avatars')`. `getSupabase()` o devolve quando `EXPO_PUBLIC_DEMO=1`; repositórios e telas não
 * mudam. Nada aqui chama a rede (o teste `demo-no-network` garante).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { DemoAuth } from './auth';
import { DEMO_BUCKETS, DemoDb, DemoPgError, type Row } from './db';
import { functionsFetchError, functionsHttpError, runFunction } from './functions';
import { DemoQuery, type Gate } from './postgrest';
import { DemoChannel } from './realtime';
import { DEMO_RPC_HANDLERS } from './rpc';
import { DEFAULT_SCENARIO, INITIAL_SCENARIO, scenarioLatency, type DemoScenario } from './scenario';
import { settleSeededRuns } from './server';

export type DemoClientOptions = {
  scenario?: DemoScenario;
  /** Relógio do "servidor" (testes e capturas usam um relógio fixo). */
  clock?: () => number;
  /** Latência em ms; o padrão vem do roteiro (`lento` = 2,5 s). */
  latencyMs?: number;
};

export type DemoClient = {
  readonly isDemo: true;
  readonly scenario: DemoScenario;
  readonly db: DemoDb;
  readonly auth: DemoAuth;
  from(table: string): DemoQuery;
  rpc(fn: string, args?: Row): PromiseLike<{ data: unknown; error: unknown; count: null; status: number; statusText: string }>;
  functions: { invoke(path: string, opts?: { method?: string; body?: unknown }): Promise<{ data: unknown; error: unknown }> };
  channel(topic: string): DemoChannel;
  removeChannel(ch: DemoChannel): Promise<'ok'>;
  removeAllChannels(): Promise<'ok'[]>;
  storage: { from(bucket: string): DemoBucket };
};

type DemoBucket = {
  upload(path: string, body: unknown, opts?: { contentType?: string }): Promise<{ data: { path: string } | null; error: unknown }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  list(prefix?: string): Promise<{ data: { name: string }[]; error: null }>;
  remove(paths: string[]): Promise<{ data: { name: string }[]; error: null }>;
};

const NETWORK_MESSAGE = 'TypeError: Network request failed';

/** Avatar de demonstração (SVG embutido): a foto enviada nunca sai do aparelho. */
function avatarDataUrl(seed: string) {
  const hue = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="hsl(${hue},80%,45%)"/><text x="48" y="58" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#070708">DEMO</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createDemoClient(opts: DemoClientOptions = {}): DemoClient {
  const scenario = opts.scenario ?? DEFAULT_SCENARIO;
  const db = new DemoDb({
    clock: opts.clock,
    profile: scenario === 'vazio' ? 'vazio' : scenario === 'sem-time' || scenario === 'primeira-abertura' ? 'sem-time' : 'cheio',
    moderator: scenario === 'moderador',
  });
  settleSeededRuns(db);
  const auth = new DemoAuth(db, scenario !== 'primeira-abertura');
  const latency = opts.latencyMs ?? scenarioLatency(scenario);
  const failing = scenario === 'erro' || scenario === 'offline';
  const channels = new Set<DemoChannel>();
  const files = new Map<string, { contentType: string }>();

  const wait = () => (latency > 0 ? new Promise<void>((r) => setTimeout(r, latency)) : Promise.resolve());

  const gate: Gate = async () => {
    await wait();
    if (scenario === 'offline') return { status: 0, error: { code: '', message: NETWORK_MESSAGE, details: null, hint: null } };
    if (scenario === 'erro') return { status: 503, error: { code: 'PGRST000', message: 'O servidor de demonstração está fora do ar (roteiro "erro").', details: null, hint: null } };
    return null;
  };

  const client: DemoClient = {
    isDemo: true,
    scenario,
    db,
    auth,
    from: (table) => new DemoQuery(db, table, () => auth.currentUserId(), gate),
    rpc: (fn, args = {}) => {
      const run = async () => {
        const gated = await gate();
        if (gated) return { data: null, error: gated.error, count: null, status: gated.status, statusText: 'Error' };
        const handler = DEMO_RPC_HANDLERS[fn];
        if (!handler) {
          const e = new DemoPgError('PGRST202', `Could not find the function public.${fn} in the schema cache`);
          return { data: null, error: e.toJSON(), count: null, status: 404, statusText: 'Not Found' };
        }
        try {
          const data = handler(db, auth.currentUserId(), JSON.parse(JSON.stringify(args)) as Row);
          return { data: JSON.parse(JSON.stringify(data ?? null)), error: null, count: null, status: 200, statusText: 'OK' };
        } catch (e) {
          if (e instanceof DemoPgError) return { data: null, error: e.toJSON(), count: null, status: 400, statusText: 'Bad Request' };
          throw e;
        }
      };
      return { then: (ok, ko) => run().then(ok, ko) };
    },
    functions: {
      invoke: async (path, o = {}) => {
        await wait();
        if (scenario === 'offline') return { data: null, error: functionsFetchError() };
        if (scenario === 'erro') return { data: null, error: functionsHttpError(503, { error: { code: 'UNAVAILABLE', message: 'O servidor de demonstração está fora do ar (roteiro "erro").' } }) };
        return runFunction(db, auth.currentUserId(), path, o);
      },
    },
    channel: (topic) => {
      const ch = new DemoChannel(topic, db, {
        failing,
        onSubscribed: (c) => {
          // Roteiro "sob ataque": o alerta de invasão chega pelo Realtime alguns segundos depois de abrir.
          if (scenario !== 'sob-ataque' || !topic.startsWith('notifications-')) return;
          c.later(4000, () => {
            const me = auth.currentUserId();
            if (!me) return;
            const park = [...db.zones.values()].find((z) => z.attack_started_at !== null);
            db.insertNotification(me, {
              type: 'invasion',
              title: 'Alerta de Invasão!',
              body: `Seu território em ${park?.name ?? 'Parque Flamboyant'} está sendo conquistado pelos Urban Coyotes. Corra lá nas próximas 24h para defender.`,
              data: park ? { zoneId: park.id } : {},
            });
          });
        },
      });
      channels.add(ch);
      return ch;
    },
    removeChannel: (ch) => {
      channels.delete(ch);
      return ch.unsubscribe();
    },
    removeAllChannels: () => Promise.all([...channels].map((ch) => client.removeChannel(ch))),
    storage: {
      from: (bucket) => {
        const known = (DEMO_BUCKETS as readonly string[]).includes(bucket);
        return {
          upload: async (path, _body, o = {}) => {
            await wait();
            if (!known) return { data: null, error: { message: 'Bucket not found', statusCode: '404' } };
            if (failing) return { data: null, error: { message: NETWORK_MESSAGE } };
            files.set(path, { contentType: o.contentType ?? 'image/jpeg' });
            return { data: { path }, error: null };
          },
          getPublicUrl: (path) => ({ data: { publicUrl: avatarDataUrl(path) } }),
          list: async (prefix = '') => ({ data: [...files.keys()].filter((p) => p.startsWith(`${prefix}/`)).map((p) => ({ name: p.slice(prefix.length + 1) })), error: null }),
          remove: async (paths) => {
            for (const p of paths) files.delete(p);
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };
  return client;
}

let current: DemoClient | null = null;

/** Cliente de demonstração único do processo (roteiro lido da URL na web: `?cenario=`). */
export function getDemoClient(): DemoClient {
  if (!current) current = createDemoClient({ scenario: INITIAL_SCENARIO });
  return current;
}

/** Troca o cliente único (testes) ou descarta o mundo de demonstração (`null`). */
export function setDemoClient(next: DemoClient | null) {
  if (current && current !== next) void current.removeAllChannels();
  current = next;
}

export const isDemoClient = (c: unknown): c is DemoClient => typeof c === 'object' && c !== null && (c as { isDemo?: unknown }).isDemo === true;

/** O cliente de demonstração com o tipo do supabase-js (só a parte usada pelos repositórios existe). */
export const asSupabaseClient = (c: DemoClient) => c as unknown as SupabaseClient;
