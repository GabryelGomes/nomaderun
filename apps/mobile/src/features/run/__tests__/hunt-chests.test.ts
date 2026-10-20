import { describe, expect, it, jest } from '@jest/globals';

import { fail, ok } from '@/services/api/errors';

import { loadHuntChests } from '../hunt-chests';

jest.mock('@/services/api/supabase', () => ({ requireSupabase: () => ({}), getSupabase: () => null }));

const near = { lat: -16.7097, lng: -49.2388 };
const serverChest = { id: '8f0c2b1e-0000-4000-8000-000000000001', position: { lat: -16.71, lng: -49.24 }, rarity: 'raro' as const };

describe('baús da Caça: servidor com fallback local (RF-023)', () => {
  it('usa os baús do servidor e marca os já abertos', async () => {
    const h = await loadHuntChests(near, async () => ok({ day: '2026-10-20', chests: [serverChest], openedIds: [serverChest.id] }));
    expect(h).toEqual({ chests: [serverChest], openedIds: [serverChest.id], source: 'server' });
  });

  it('sem internet cai nos baús locais perto da posição', async () => {
    const h = await loadHuntChests(near, async () => fail({ kind: 'network', message: 'sem rede' } as never));
    expect(h.source).toBe('local');
    expect(h.chests.length).toBeGreaterThan(0);
    expect(h.openedIds).toEqual([]);
  });

  it('servidor sem baús ou exceção também caem no local', async () => {
    expect((await loadHuntChests(near, async () => ok({ day: '', chests: [], openedIds: [] }))).source).toBe('local');
    expect((await loadHuntChests(near, async () => { throw new Error('x'); })).source).toBe('local');
  });
});
