import { describe, expect, it } from '@jest/globals';

import { CHUNK_BYTES, createChunkedStorage, createWebStorage, safeKey, splitByBytes, type AsyncKeyValue } from '../secure-storage';

function memoryStore(limit = 2048) {
  const data = new Map<string, string>();
  const store: AsyncKeyValue & { data: Map<string, string> } = {
    data,
    async getItemAsync(k) {
      return data.has(k) ? (data.get(k) as string) : null;
    },
    async setItemAsync(k, v) {
      if (!/^[\w.-]+$/.test(k)) throw new Error(`chave inválida: ${k}`);
      if (Buffer.byteLength(v, 'utf8') > limit) throw new Error('valor maior que 2 KB');
      data.set(k, v);
    },
    async deleteItemAsync(k) {
      data.delete(k);
    },
  };
  return store;
}

describe('splitByBytes', () => {
  it('não passa do limite em bytes nem quebra caracteres multibyte', () => {
    const value = 'ação🏃'.repeat(500);
    const parts = splitByBytes(value, 100);
    expect(parts.join('')).toBe(value);
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(100);
  });

  it('texto vazio vira uma parte vazia', () => {
    expect(splitByBytes('')).toEqual(['']);
  });
});

describe('createChunkedStorage', () => {
  const key = 'sb-127-auth-token';

  it('valor pequeno fica numa chave só', async () => {
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    await s.setItem(key, 'abc');
    expect(mem.data.get(key)).toBe('abc');
    await expect(s.getItem(key)).resolves.toBe('abc');
  });

  it('valor maior que 2 KB é dividido e remontado (sessão do Supabase)', async () => {
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    const session = JSON.stringify({ access_token: 'x'.repeat(3000), refresh_token: 'r'.repeat(40), user: { name: 'João' } });
    await s.setItem(key, session);
    expect(mem.data.has(key)).toBe(false);
    expect(Number(mem.data.get(`${key}__chunks`))).toBe(Math.ceil(Buffer.byteLength(session) / CHUNK_BYTES));
    await expect(s.getItem(key)).resolves.toBe(session);
  });

  it('regravar menor apaga as partes antigas', async () => {
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    await s.setItem(key, 'y'.repeat(5000));
    await s.setItem(key, 'z'.repeat(2500));
    expect(mem.data.get(`${key}__chunks`)).toBe('2');
    expect(mem.data.has(`${key}__2`)).toBe(false);
    await s.setItem(key, 'pequeno');
    expect([...mem.data.keys()]).toEqual([key]);
    await expect(s.getItem(key)).resolves.toBe('pequeno');
  });

  it('removeItem limpa tudo', async () => {
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    await s.setItem(key, 'w'.repeat(4000));
    await s.removeItem(key);
    expect(mem.data.size).toBe(0);
    await expect(s.getItem(key)).resolves.toBeNull();
  });

  it('parte faltando devolve null (sessão corrompida pede login)', async () => {
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    await s.setItem(key, 'q'.repeat(4000));
    mem.data.delete(`${key}__1`);
    await expect(s.getItem(key)).resolves.toBeNull();
  });

  it('chaves com caracteres inválidos são normalizadas', async () => {
    expect(safeKey('sb:auth/token')).toBe('sb_auth_token');
    const mem = memoryStore();
    const s = createChunkedStorage(mem);
    await s.setItem('sb:auth/token', 'v');
    await expect(s.getItem('sb:auth/token')).resolves.toBe('v');
  });
});

describe('createWebStorage', () => {
  it('não quebra sem window (renderização estática)', async () => {
    const s = createWebStorage();
    await expect(s.getItem('k')).resolves.toBeNull();
    await expect(s.setItem('k', 'v')).resolves.toBeUndefined();
    await expect(s.removeItem('k')).resolves.toBeUndefined();
  });
});
