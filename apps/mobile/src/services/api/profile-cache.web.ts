import type { Profile } from './types';

/** Web: mesma ideia do nativo, sobre `localStorage` (ausente na renderização estática). */
const KEY = 'nomade.profile.v1';
const ls = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

export async function readCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = ls()?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p.id === userId ? p : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) ls()?.setItem(KEY, JSON.stringify(profile));
    else ls()?.removeItem(KEY);
  } catch {
    // Cache é só conveniência.
  }
}
