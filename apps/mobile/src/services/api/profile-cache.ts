import Storage from 'expo-sqlite/kv-store';

import type { Profile } from './types';

/**
 * Última cópia do perfil, para o app abrir sem internet (UC-01 A1: correr offline).
 * Não guarda segredo: só dados que o próprio usuário vê no perfil. A sessão fica no SecureStore.
 */
const KEY = 'nomade.profile.v1';

export async function readCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = await Storage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p.id === userId ? p : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) await Storage.setItem(KEY, JSON.stringify(profile));
    else await Storage.removeItem(KEY);
  } catch {
    // Cache é só conveniência.
  }
}
