/**
 * @jest-environment node
 *
 * T7.3.7 (revisão M4) — aplausos ao vivo (puro): contadores absolutos de `feed_kudos_counts` na tela.
 */
import { describe, expect, it } from '@jest/globals';

import { toKudosCounts, type KudosCounts } from '@/services/api/feed-repo';

import { applyKudosCounts } from '../feed-model';

const item = (id: string, bora = 0) => ({ id, kudos: { bora, fogo: 0, raio: 0 }, myReaction: null as 'bora' | 'fogo' | 'raio' | null });
const counts = (itemId: string, bora: number, fogo = 0, raio = 0): KudosCounts => ({ itemId, kudos: { bora, fogo, raio } });

describe('applyKudosCounts', () => {
  it('troca pelo valor do servidor (não soma) e só no item certo', () => {
    const items = [item('a', 2), item('b')];
    const out = applyKudosCounts(items, counts('a', 5, 1));
    expect(out[0].kudos).toEqual({ bora: 5, fogo: 1, raio: 0 });
    expect(out[1]).toBe(items[1]);
  });

  it('o mesmo evento 2 vezes dá o mesmo resultado (nada conta 2 vezes)', () => {
    const items = [item('a', 2)];
    const once = applyKudosCounts(items, counts('a', 3));
    expect(applyKudosCounts(once, counts('a', 3))).toBe(once);
    expect(once[0].kudos.bora).toBe(3);
  });

  it('item fora da lista e item com reação minha a caminho ficam como estão', () => {
    const items = [item('a', 2)];
    expect(applyKudosCounts(items, counts('zzz', 9))).toBe(items);
    expect(applyKudosCounts(items, counts('a', 9), new Set(['a']))).toBe(items);
  });

  it('propriedade (300 sequências): a tela termina igual ao último contador de cada item, em qualquer ordem de chegada', () => {
    let s = 7;
    const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32;
    for (let k = 0; k < 300; k++) {
      let items: readonly ReturnType<typeof item>[] = [item('a'), item('b'), item('c')];
      const last = new Map<string, KudosCounts>();
      for (let n = 0; n < 20; n++) {
        const id = ['a', 'b', 'c', 'x'][Math.floor(rnd() * 4)];
        const c = counts(id, Math.floor(rnd() * 9), Math.floor(rnd() * 3), Math.floor(rnd() * 3));
        last.set(id, c);
        items = applyKudosCounts(items, c);
      }
      for (const it of items) expect(it.kudos).toEqual(last.get(it.id)?.kudos ?? { bora: 0, fogo: 0, raio: 0 });
    }
  });
});

describe('toKudosCounts (payload do Realtime)', () => {
  it('INSERT/UPDATE com os contadores; DELETE zera; sem quem reagiu; lixo vira null', () => {
    expect(toKudosCounts({ eventType: 'UPDATE', new: { feed_item_id: 'i', bora: 3, fogo: 1, raio: 0, total: 4 }, old: {} })).toEqual(counts('i', 3, 1, 0));
    expect(toKudosCounts({ eventType: 'INSERT', new: { feed_item_id: 'i', bora: -2, fogo: 'x' } })).toEqual(counts('i', 0, 0, 0));
    expect(toKudosCounts({ eventType: 'DELETE', new: {}, old: { feed_item_id: 'i' } })).toEqual(counts('i', 0, 0, 0));
    expect(toKudosCounts({ eventType: 'DELETE', old: {} })).toBeNull();
    expect(toKudosCounts({ eventType: 'TRUNCATE' })).toBeNull();
    expect(toKudosCounts(null)).toBeNull();
    expect(Object.keys(toKudosCounts({ eventType: 'UPDATE', new: { feed_item_id: 'i', user_id: 'u' } })!)).toEqual(['itemId', 'kudos']);
  });
});
