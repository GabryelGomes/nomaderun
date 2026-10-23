import type { Profile } from './types';
import { isDemoMode } from './env';

/**
 * Web: mesma ideia do nativo, sobre `localStorage` (ausente na renderização estática).
 * Chave separada no modo demonstração (D-77): os dados de demonstração nunca aparecem na conta real.
 */
export const cacheKey = (demo = isDemoMode()) => (demo ? 'nomade.demo.profile.v1' : 'nomade.profile.v1');
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export async function readCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = ls()?.getItem(cacheKey());
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p.id === userId ? p : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) ls()?.setItem(cacheKey(), JSON.stringify(profile));
    else ls()?.removeItem(cacheKey());
  } catch {
    // Cache é só conveniência.
  }
}
