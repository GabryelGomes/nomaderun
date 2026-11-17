/**
 * DF07 e DF08 dos testes externos: o histórico parava em 200 corridas e o percurso do servidor em 2.000 pontos.
 * Agora as duas leituras vão página a página (o Supabase devolve no máximo 1.000 linhas por pedido).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Call = { table: string; from: number; to: number };
const mockCalls: Call[] = [];
let mockRows: Record<string, unknown[]> = {};

jest.mock('../supabase', () => ({
  requireSupabase: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        gte: () => q,
        lt: () => q,
        range: (from: number, to: number) => {
          mockCalls.push({ table, from, to });
          return Promise.resolve({ data: (mockRows[table] ?? []).slice(from, to + 1), error: null });
        },
      };
      return q;
    },
  }),
}));

// eslint-disable-next-line import/first
import { getActivityPath, listMyActivities, PAGE_SIZE } from '../activities-repo';

beforeEach(() => {
  mockCalls.length = 0;
  mockRows = {};
});

describe('leitura em páginas', () => {
  it('o histórico traz todas as 2.350 corridas, em 3 páginas', async () => {
    mockRows.activities = Array.from({ length: 2350 }, (_, i) => ({ id: `a${i}`, status: 'valid', started_at: 1000 + i }));
    const res = await listMyActivities();
    expect(res.ok && res.data.length).toBe(2350);
    expect(mockCalls.map((c) => c.from)).toEqual([0, PAGE_SIZE, 2 * PAGE_SIZE]);
  });

  it('com limite, para no limite', async () => {
    mockRows.activities = Array.from({ length: 2350 }, (_, i) => ({ id: `a${i}`, status: 'valid' }));
    const res = await listMyActivities({ limit: 30 });
    expect(res.ok && res.data.length).toBe(30);
    expect(mockCalls).toEqual([{ table: 'activities', from: 0, to: 29 }]);
  });

  it('o percurso vem inteiro, até o último ponto (5.432 pontos)', async () => {
    mockRows.activity_points = Array.from({ length: 5432 }, (_, i) => ({ lat: i, lng: -i }));
    const res = await getActivityPath('x');
    expect(res.ok && res.data.length).toBe(5432);
    expect(res.ok && res.data[5431]).toEqual({ lat: 5431, lng: -5431 });
  });
});
