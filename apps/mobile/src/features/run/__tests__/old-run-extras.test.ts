/**
 * Pendências da onda 3 (E6b): (1) o resumo de uma corrida antiga relê o `extras` de `activities.v2_extras`;
 * (2) o resumo mostra um número só de XP — o creditado pelo servidor (bloco da E7), não o `xp` da v1.
 */
import { describe, expect, it, jest } from '@jest/globals';

import type { RunEngagement } from '@/services/api/engagement-repo';

type Resp = { data: unknown; error: unknown };
const mockCalls: string[] = [];
let mockRespond: (columns: string) => Resp = () => ({ data: [], error: null });

jest.mock('@/services/api/supabase', () => {
  const builder = (columns: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['order', 'limit', 'gte', 'lt', 'eq']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(mockRespond(columns));
    b.then = (ok: (r: Resp) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(mockRespond(columns)).then(ok, ko);
    return b;
  };
  const client = {
    from: () => ({
      select: (columns: string) => {
        mockCalls.push(columns);
        return builder(columns);
      },
    }),
  };
  return { requireSupabase: () => client, getSupabase: () => client };
});

/* eslint-disable import/first */
import { getActivity, isMissingColumn, listMyActivities, toActivity } from '@/services/api/activities-repo';

import { summaryCelebrations } from '../summary-celebration';
import { officialFromActivity, summaryXpFrom } from '../summary-extras';
import type { RunSummary } from '../summary-model';
/* eslint-enable import/first */

const ROW = { id: 'a1', status: 'valid', mission: 'livre', started_at: 1, ended_at: 2, meters: 5000, moving_seconds: 1500, avg_pace: 300, rp_total: 50, xp: 98, flags: [], result: { activityId: 'a1', xp: 98 } };
const EXTRAS = { contract: 2, engagement: { xp: { total: 153, lines: [] }, level: { before: 4, after: 5 } } };

describe('(1) corrida antiga: activities.v2_extras', () => {
  it('toActivity lê v2_extras (objeto) e ignora o resto', () => {
    expect(toActivity({ ...ROW, v2_extras: EXTRAS }).extras).toEqual(EXTRAS);
    expect(toActivity({ ...ROW, v2_extras: null }).extras).toBeNull();
    expect(toActivity({ ...ROW, v2_extras: [1] }).extras).toBeNull();
  });

  it('pede a coluna nova; servidor antigo (42703/PGRST204) repete sem ela e o histórico não quebra', async () => {
    mockCalls.length = 0;
    mockRespond = (cols) => (cols.includes('v2_extras') ? { data: null, error: { code: '42703', message: 'column activities.v2_extras does not exist' } } : { data: [ROW], error: null });
    const res = await listMyActivities();
    expect(res.ok && res.data[0]).toMatchObject({ id: 'a1', extras: null });
    expect(mockCalls).toHaveLength(2);
    expect(mockCalls[0]).toContain('v2_extras');
    expect(mockCalls[1]).not.toContain('v2_extras');
    expect(isMissingColumn({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumn({ code: '42501' })).toBe(false);
  });

  it('servidor v2: 1 pedido, e a corrida volta com o extras para o cache oficial', async () => {
    mockCalls.length = 0;
    mockRespond = () => ({ data: { ...ROW, v2_extras: EXTRAS }, error: null });
    const res = await getActivity('a1');
    expect(mockCalls).toHaveLength(1);
    const a = res.ok ? res.data : null;
    expect(officialFromActivity(a)).toEqual({ activityId: 'a1', xp: 98, extras: EXTRAS });
    expect(officialFromActivity({ id: 'x', result: null, extras: null })).toBeNull();
  });

  it('outro erro não é engolido', async () => {
    mockRespond = () => ({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect((await getActivity('a1')).ok).toBe(false);
  });
});

describe('(2) um número só de XP no resumo', () => {
  const block = { xp: { total: 153, lines: [] }, level: { before: 4, after: 5, titleAfter: null } } as unknown as RunEngagement;
  const summary = { status: 'valid', xp: 98, zones: [] } as unknown as RunSummary;

  it('com o bloco da E7: o total creditado (153), não o xp da v1 (98), e o nível do servidor', () => {
    expect(summaryXpFrom(block, 0)).toMatchObject({ gained: 153, level: 5 });
    expect(summaryXpFrom(null, 0)).toBeNull();
  });

  it('a celebração de XP usa o mesmo número do bloco; sem ele, o xp da corrida', () => {
    const xpOf = (n?: number) => summaryCelebrations(summary, true, 'striders', n).find((e) => e.kind === 'xp');
    expect(xpOf(153)).toMatchObject({ payload: { gained: 153 } });
    expect(xpOf()).toMatchObject({ payload: { gained: 98 } });
  });
});
