import { isDemoMode } from '@/services/api/env';

/** Web: a mesma ideia do nativo, sobre o `localStorage` (ausente na renderização estática). */
const key = (name: string) => (isDemoMode() ? `nomade.demo.eng.${name}.v1` : `nomade.eng.${name}.v1`);
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export async function readLocal<T>(name: string): Promise<T | null> {
  try {
    const raw = ls()?.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeLocal(name: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) ls()?.removeItem(key(name));
    else ls()?.setItem(key(name), JSON.stringify(value));
  } catch {
    // Só conveniência.
  }
}
