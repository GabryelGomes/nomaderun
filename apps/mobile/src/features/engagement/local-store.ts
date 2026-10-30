import Storage from 'expo-sqlite/kv-store';

import { isDemoMode } from '@/services/api/env';

/**
 * Memória local do engajamento (lembretes já entregues, "bem-vindo de volta" já visto). Não guarda segredo.
 * Chaves separadas no modo demonstração (D-77): nada da demonstração vaza para a conta real.
 */
const key = (name: string) => (isDemoMode() ? `nomade.demo.eng.${name}.v1` : `nomade.eng.${name}.v1`);

export async function readLocal<T>(name: string): Promise<T | null> {
  try {
    const raw = await Storage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeLocal(name: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) await Storage.removeItem(key(name));
    else await Storage.setItem(key(name), JSON.stringify(value));
  } catch {
    // Só conveniência: sem armazenamento, o app continua (no pior caso, um aviso repete).
  }
}
