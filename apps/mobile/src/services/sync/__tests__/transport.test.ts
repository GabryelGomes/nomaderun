import { describe, expect, it } from '@jest/globals';

import { createSupabaseTransport, parseFunctionsError } from '../transport';

const httpError = (status: number, body: unknown) => ({
  name: 'FunctionsHttpError',
  context: { status, clone: () => ({ json: async () => body }) },
});

describe('transporte do sync', () => {
  it('preserva código e details.lastSeq do contrato', async () => {
    const e = await parseFunctionsError(httpError(409, { error: { code: 'OUT_OF_ORDER', message: 'fora de ordem', details: { lastSeq: 41 } } }));
    expect(e).toEqual({ code: 'OUT_OF_ORDER', status: 409, message: 'fora de ordem', details: { lastSeq: 41 } });
  });

  it('corpo inválido vira HTTP_<status>; falha de rede vira NETWORK', async () => {
    expect((await parseFunctionsError(httpError(502, 'oops'))).code).toBe('HTTP_502');
    expect((await parseFunctionsError({ name: 'FunctionsFetchError' })).code).toBe('NETWORK');
    expect((await parseFunctionsError(new TypeError('Network request failed'))).status).toBe(0);
  });

  it('sem backend configurado não lança erro', async () => {
    const t = createSupabaseTransport(() => null);
    const r = await t.ingest({ activityId: 'a', deviceId: 'd', fromSeq: 0, toSeq: 0, points: [], signature: '' });
    expect(r.ok).toBe(false);
    expect(await t.refreshSession()).toBe(false);
  });

  it('chama a function certa com POST e devolve o erro do contrato', async () => {
    const calls: { name: string; body: unknown }[] = [];
    const client = {
      functions: {
        invoke: async (name: string, opts: { body: unknown }) => {
          calls.push({ name, body: opts.body });
          return name === 'finish-activity'
            ? { data: null, error: httpError(409, { error: { code: 'MISSING_POINTS', message: 'faltam', details: { lastSeq: 9 } } }) }
            : { data: { accepted: 1, duplicates: 0, lastSeq: 0 }, error: null };
        },
      },
      auth: { refreshSession: async () => ({ data: { session: {} }, error: null }) },
    };
    const t = createSupabaseTransport(() => client as never);
    expect(await t.ingest({ activityId: 'a', deviceId: 'd', fromSeq: 0, toSeq: 0, points: [], signature: 's' })).toEqual({ ok: true, data: { accepted: 1, duplicates: 0, lastSeq: 0 } });
    const f = await t.finish({ activityId: 'a', lastSeq: 20 });
    expect(f.ok ? null : f.error.details).toEqual({ lastSeq: 9 });
    expect(calls.map((c) => c.name)).toEqual(['ingest-points', 'finish-activity']);
    expect(await t.refreshSession()).toBe(true);
  });
});
