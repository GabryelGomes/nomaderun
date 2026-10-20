import type { FactionId } from '@/domain/types';

import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';
import { toProfile, toProfileRow, type Profile, type ProfilePatch } from './types';

/** Perfil do usuário logado (tabela `profiles`, RLS: só o próprio). */
export async function getMyProfile(userId: string): Promise<Result<Profile>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return toProfile(data as Record<string, unknown>);
  });
}

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<Result<Profile>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('profiles').update(toProfileRow(patch)).eq('id', userId).select('*').single();
    if (error) throw error;
    return toProfile(data as Record<string, unknown>);
  });
}

/** RPC `choose_faction(p_faction)` (RF-003; troca 1×/temporada validada no servidor). */
export async function chooseFaction(faction: FactionId): Promise<Result<void>> {
  return attempt(async () => {
    const { error } = await requireSupabase().rpc('choose_faction', { p_faction: faction });
    if (error) throw error;
  });
}

/**
 * RPC `username_available(p_username)` (liberado para anon). Usado antes do `signUp`, porque o
 * Auth só devolve "Database error saving new user" quando o trigger recusa o cadastro.
 */
export async function isUsernameAvailable(username: string): Promise<Result<boolean>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('username_available', { p_username: username.trim() });
    if (error) throw error;
    return data === true;
  });
}
