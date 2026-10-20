/**
 * Storage da sessão do supabase-js sobre o expo-secure-store (D-06, RNF-007).
 * O Keychain/Keystore aceita valores de até ~2 KB por chave; a sessão do Supabase
 * (access + refresh token + usuário) passa disso, então o valor é dividido em partes
 * medidas em bytes UTF-8. Esta fábrica recebe o "backend" por injeção para ser testável.
 */
export type AsyncKeyValue = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** Interface que o supabase-js espera em `auth.storage`. */
export type SupportedStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Limite seguro por item (o SecureStore avisa acima de 2048 bytes). */
export const CHUNK_BYTES = 1800;

const COUNT_SUFFIX = '__chunks';
const chunkKey = (key: string, i: number) => `${key}__${i}`;

/** O SecureStore só aceita chaves com letras, números, ".", "-" e "_". */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

function utf8Bytes(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Divide o texto em partes de no máximo `maxBytes` bytes UTF-8, sem quebrar caracteres. */
export function splitByBytes(value: string, maxBytes = CHUNK_BYTES): string[] {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of value) {
    const b = utf8Bytes(ch.codePointAt(0) ?? 0);
    if (size + b > maxBytes && current) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += b;
  }
  if (current || parts.length === 0) parts.push(current);
  return parts;
}

export function createChunkedStorage(store: AsyncKeyValue, maxBytes = CHUNK_BYTES): SupportedStorage {
  const readCount = async (key: string) => {
    const raw = await store.getItemAsync(key + COUNT_SUFFIX);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const deleteChunks = async (key: string, from: number, to: number) => {
    for (let i = from; i < to; i++) await store.deleteItemAsync(chunkKey(key, i));
  };

  return {
    async getItem(rawKey) {
      const key = safeKey(rawKey);
      const count = await readCount(key);
      if (count === 0) return store.getItemAsync(key);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItemAsync(chunkKey(key, i));
        // Parte faltando = sessão corrompida: melhor pedir login de novo do que usar dado quebrado.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(rawKey, value) {
      const key = safeKey(rawKey);
      const previous = await readCount(key);
      const parts = splitByBytes(value, maxBytes);
      if (parts.length === 1) {
        await store.setItemAsync(key, value);
        if (previous > 0) {
          await store.deleteItemAsync(key + COUNT_SUFFIX);
          await deleteChunks(key, 0, previous);
        }
        return;
      }
      for (let i = 0; i < parts.length; i++) await store.setItemAsync(chunkKey(key, i), parts[i]);
      await store.setItemAsync(key + COUNT_SUFFIX, String(parts.length));
      if (previous > parts.length) await deleteChunks(key, parts.length, previous);
      await store.deleteItemAsync(key);
    },

    async removeItem(rawKey) {
      const key = safeKey(rawKey);
      const count = await readCount(key);
      await deleteChunks(key, 0, count);
      await store.deleteItemAsync(key + COUNT_SUFFIX);
      await store.deleteItemAsync(key);
    },
  };
}

/** Web (painel de moderação): `localStorage`, ausente durante a renderização estática no servidor. */
export function createWebStorage(): SupportedStorage {
  const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  return {
    async getItem(key) {
      return ls()?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      ls()?.setItem(key, value);
    },
    async removeItem(key) {
      ls()?.removeItem(key);
    },
  };
}
