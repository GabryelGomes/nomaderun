import type { Profile } from './types';
import { isDemoMode } from './env';

/**
 * Web: mesma ideia do nativo, sobre `localStorage` (ausente na renderização estática).
 * Chave separada no modo demonstração (D-77): os dados de demonstração nunca aparecem na conta real.
 */
export const cacheKey = (demo = isDemoMode()) => (demo ? 'nomade.demo.profile.v1' : 'nomade.profile.v1');
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

/** Perfil salvo + quando foi salvo (D-95: "último salvo há 2 h"). Cópias antigas não têm `savedAt`. */
export type CachedProfile = Profile & { savedAt?: number };

export async function readCachedProfile(userId: string): Promise<CachedProfile | null> {
  try {
    const raw = ls()?.getItem(cacheKey());
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedProfile;
    return p.id === userId ? p : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) ls()?.setItem(cacheKey(), JSON.stringify({ ...profile, savedAt: Date.now() }));
    else ls()?.removeItem(cacheKey());
  } catch {
    // Cache é só conveniência.
  }
}
