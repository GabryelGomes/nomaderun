import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { fetchDailyChests, parseDailyChests } from '../chests-repo';

type AnyFn = (...args: any[]) => any;
const mockRpc = jest.fn<AnyFn>();
jest.mock('../supabase', () => ({ requireSupabase: () => ({ rpc: mockRpc }), getSupabase: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('baús do servidor (RF-023, RN-017)', () => {
  it('converte para o tipo do domain e separa os já abertos', () => {
    const r = parseDailyChests({
      day: '2026-10-20',
      chests: [
        { id: 'a', lat: -16.7, lng: -49.2, rarity: 'raro', xp: 60, openedAt: null },
        { id: 'b', lat: -16.71, lng: -49.21, rarity: 'lendario', xp: 150, openedAt: 1760000000000 },
        { id: 'c', lat: 'x', lng: -49.2, rarity: 'comum' },
        { id: 'd', lat: -16.7, lng: -49.2, rarity: 'épico' },
      ],
    });
    expect(r.day).toBe('2026-10-20');
    expect(r.chests).toEqual([
      { id: 'a', position: { lat: -16.7, lng: -49.2 }, rarity: 'raro' },
      { id: 'b', position: { lat: -16.71, lng: -49.21 }, rarity: 'lendario' },
    ]);
    expect(r.openedIds).toEqual(['b']);
    expect(parseDailyChests(null)).toEqual({ day: '', chests: [], openedIds: [] });
  });

  it('chama daily_chests com a posição atual', async () => {
    mockRpc.mockResolvedValueOnce({ data: { day: '2026-10-20', chests: [] }, error: null });
    const r = await fetchDailyChests({ lat: -16.7, lng: -49.2 });
    expect(mockRpc).toHaveBeenCalledWith('daily_chests', { p_lat: -16.7, p_lng: -49.2 });
    expect(r.ok && r.data.chests).toEqual([]);
  });

  it('erro de rede vira Result com falha (o app cai nos baús locais)', async () => {
    mockRpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    const r = await fetchDailyChests();
    expect(mockRpc).toHaveBeenCalledWith('daily_chests', {});
    expect(r.ok).toBe(false);
  });
});
