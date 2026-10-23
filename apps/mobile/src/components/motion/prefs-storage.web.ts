/**
 * Web: as preferências de motion ficam no `localStorage` (ausente na renderização estática). Mesma ideia do
 * `profile-cache.web.ts`.
 */
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export async function readMotionPrefsRaw(key: string): Promise<string | null> {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function writeMotionPrefsRaw(key: string, value: string): Promise<void> {
  try {
    ls()?.setItem(key, value);
  } catch {
    // preferência continua valendo em memória
  }
}
