/**
 * @jest-environment node
 *
 * PostgREST de demonstração (T7.1.18): os erros e a semântica que os repositórios esperam do supabase-js
 * (tabela/coluna inexistente, `single`, ordenação com nulos, `range`, contagem e roteiros de falha).
 */
import { describe, expect, it } from '@jest/globals';

import { toAppError } from '../../errors';
import { createDemoClient } from '../client';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const demo = createDemoClient({ clock: () => NOW });

describe('PostgREST de demonstração', () => {
  it('tabela ou coluna que não existem falham como no servidor', async () => {
    const t = await demo.from('missoes').select('*');
    expect(t.error?.code).toBe('PGRST205');
    expect(toAppError(t.error).code).toBe('SERVER');
    const c = await demo.from('profiles').select('id,nao_existe');
    expect(c.error?.code).toBe('42703');
    const f = await demo.from('activities').select('id').eq('coluna_errada', 1);
    expect(f.error?.code).toBe('42703');
  });

  it('single sem linha devolve PGRST116 (NOT_FOUND no app); maybeSingle devolve null', async () => {
    const s = await demo.from('activities').select('id').eq('id', 'nao-existe').single();
    expect(s.error?.code).toBe('PGRST116');
    expect(toAppError(s.error).code).toBe('NOT_FOUND');
    expect((await demo.from('activities').select('id').eq('id', 'nao-existe').maybeSingle()).data).toBeNull();
  });

  it('ordem, range, contagem e head', async () => {
    const all = await demo.from('activities').select('id,started_at', { count: 'exact' }).order('started_at', { ascending: true });
    const rows = all.data as { started_at: string }[];
    expect(all.count).toBe(6);
    expect(rows.map((r) => r.started_at)).toEqual([...rows.map((r) => r.started_at)].sort());
    const page = await demo.from('activities').select('id').order('started_at').range(2, 3);
    expect(page.data).toHaveLength(2);
    const head = await demo.from('activities').select('id', { count: 'exact', head: true });
    expect([head.data, head.count]).toEqual([null, 6]);
  });

  it('RLS: o corredor não lê o perfil dos outros nem escreve onde não pode', async () => {
    expect(((await demo.from('profiles').select('id')).data as unknown[]).length).toBe(1);
    const w = await demo.from('notifications').insert({ title: 'x' });
    expect(w.error?.code).toBe('42501');
    const u = await demo.from('profiles').update({ xp: 999999 }).eq('id', 'demo-corredor');
    expect(u.error?.code).toBe('42501');
  });

  it('roteiros: erro vira SERVER, offline vira NETWORK (inclusive nas functions e no Realtime)', async () => {
    const erro = createDemoClient({ clock: () => NOW, scenario: 'erro' });
    expect(toAppError((await erro.from('profiles').select('*')).error).code).toBe('SERVER');
    const off = createDemoClient({ clock: () => NOW, scenario: 'offline' });
    expect(toAppError((await off.from('profiles').select('*')).error).code).toBe('NETWORK');
    expect(toAppError((await off.rpc('daily_chests')).error).code).toBe('NETWORK');
    expect(toAppError((await off.functions.invoke('zones?bbox=0,0,1,1', { method: 'GET' })).error).code).toBe('NETWORK');
    const statuses: string[] = [];
    off.channel('zones-x').on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => undefined).subscribe((s) => statuses.push(s));
    await Promise.resolve();
    expect(statuses).toEqual(['CHANNEL_ERROR']);
    // A sessão é local: continua aberta mesmo sem rede.
    expect((await off.auth.getSession()).data.session?.user.id).toBe('demo-corredor');
  });

  it('RPC desconhecida falha com PGRST202', async () => {
    const r = await demo.rpc('claim_mission', {});
    expect(r.error && (r.error as { code: string }).code).toBe('PGRST202');
  });
});
