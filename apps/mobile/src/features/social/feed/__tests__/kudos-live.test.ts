/**
 * @jest-environment node
 *
 * T7.3.7 — aplausos ao vivo (puro): o que o Realtime muda na tela e a conferência com o servidor.
 */
import { describe, expect, it } from '@jest/globals';

import { toKudosChange, type KudosChange } from '@/services/api/feed-repo';

import { applyKudosChange, mergeKudos } from '../feed-model';

const item = (id: string, bora = 0) => ({ id, kudos: { bora, fogo: 0, raio: 0 }, myReaction: null as 'bora' | 'fogo' | 'raio' | null });
const ins = (itemId: string | null, userId: string, reaction: 'bora' | 'fogo' | 'raio' = 'bora'): KudosChange => ({ event: 'INSERT', itemId, userId, reaction });

describe('applyKudosChange', () => {
  it('INSERT de outra pessoa soma 1 na hora e pede conferência', () => {
    const items = [item('a', 2), item('b')];
    const r = applyKudosChange(items, ins('a', 'colega'), 'eu');
    expect(r.items[0].kudos.bora).toBe(3);
    expect(r.items[1]).toBe(items[1]);
    expect(r.sync).toBe(true);
  });

  it('a minha própria reação não soma de novo (já entrou pelo otimista)', () => {
    const items = [item('a', 2)];
    const r = applyKudosChange(items, ins('a', 'eu'), 'eu');
    expect(r.items).toBe(items);
    expect(r.sync).toBe(true);
  });

  it('UPDATE/DELETE só pedem conferência; item fora da lista é ignorado', () => {
    const items = [item('a', 2)];
    expect(applyKudosChange(items, { event: 'DELETE', itemId: null, userId: null, reaction: null }, 'eu')).toEqual({ items, sync: true });
    expect(applyKudosChange(items, { event: 'UPDATE', itemId: 'a', userId: 'x', reaction: 'fogo' }, 'eu')).toEqual({ items, sync: true });
    expect(applyKudosChange(items, ins('zzz', 'colega'), 'eu')).toEqual({ items, sync: false });
  });

  it('propriedade (300 sequências): contadores nunca negativos e só sobem 1 por INSERT de outra pessoa', () => {
    let s = 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
    for (let k = 0; k < 300; k++) {
      let items = [item('a'), item('b'), item('c')];
      let inserts = 0;
      for (let n = 0; n < 20; n++) {
        const ev = (['INSERT', 'UPDATE', 'DELETE'] as const)[Math.floor(rnd() * 3)];
        const who = rnd() < 0.3 ? 'eu' : 'colega';
        const id = ['a', 'b', 'c', 'x', null][Math.floor(rnd() * 5)];
        const ch: KudosChange = { event: ev, itemId: id, userId: who, reaction: ev === 'DELETE' ? null : 'bora' };
        if (ev === 'INSERT' && who !== 'eu' && id && id !== 'x') inserts++;
        items = [...applyKudosChange(items, ch, 'eu').items];
      }
      const total = items.reduce((t, i) => t + i.kudos.bora + i.kudos.fogo + i.kudos.raio, 0);
      expect(total).toBe(inserts);
      for (const i of items) expect(Math.min(i.kudos.bora, i.kudos.fogo, i.kudos.raio)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('mergeKudos', () => {
  it('contadores e minha reação passam a ser os do servidor, menos nos itens com reação a caminho', () => {
    const items = [item('a', 9), item('b', 9), item('c', 1)];
    const fresh = [
      { id: 'a', kudos: { bora: 3, fogo: 1, raio: 0 }, myReaction: 'fogo' as const },
      { id: 'b', kudos: { bora: 4, fogo: 0, raio: 0 }, myReaction: null },
    ];
    const out = mergeKudos(items, fresh, new Set(['b']));
    expect(out[0]).toMatchObject({ kudos: { bora: 3, fogo: 1, raio: 0 }, myReaction: 'fogo' });
    expect(out[1]).toBe(items[1]);
    expect(out[2]).toBe(items[2]);
  });
});

describe('toKudosChange (payload do Realtime)', () => {
  it('INSERT com a linha nova; DELETE só com a chave; lixo vira null', () => {
    expect(toKudosChange({ eventType: 'INSERT', new: { feed_item_id: 'i', user_id: 'u', reaction: 'raio' }, old: {} })).toEqual({ event: 'INSERT', itemId: 'i', userId: 'u', reaction: 'raio' });
    expect(toKudosChange({ eventType: 'DELETE', new: {}, old: { id: 'k' } })).toEqual({ event: 'DELETE', itemId: null, userId: null, reaction: null });
    expect(toKudosChange({ eventType: 'INSERT', new: { feed_item_id: 'i', reaction: 'aplauso' } })).toMatchObject({ reaction: null });
    expect(toKudosChange({ eventType: 'TRUNCATE' })).toBeNull();
    expect(toKudosChange(null)).toBeNull();
  });
});
