import Storage from 'expo-sqlite/kv-store';

import type { Profile } from './types';
import { isDemoMode } from './env';

/**
 * Última cópia do perfil, para o app abrir sem internet (UC-01 A1: correr offline).
 * Não guarda segredo: só dados que o próprio usuário vê no perfil. A sessão fica no SecureStore.
 * Chave separada no modo demonstração (D-77): os dados de demonstração nunca aparecem na conta real.
 */
export const cacheKey = (demo = isDemoMode()) => (demo ? 'nomade.demo.profile.v1' : 'nomade.profile.v1');

/** Perfil salvo + quando foi salvo (D-95: "último salvo há 2 h"). Cópias antigas não têm `savedAt`. */
export type CachedProfile = Profile & { savedAt?: number };

export async function readCachedProfile(userId: string): Promise<CachedProfile | null> {
  try {
    const raw = await Storage.getItem(cacheKey());
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedProfile;
    return p.id === userId ? p : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) await Storage.setItem(cacheKey(), JSON.stringify({ ...profile, savedAt: Date.now() }));
    else await Storage.removeItem(cacheKey());
  } catch {
    // Cache é só conveniência.
  }
}
