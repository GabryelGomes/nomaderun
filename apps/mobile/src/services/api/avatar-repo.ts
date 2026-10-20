import { AppError, attempt, type Result } from './errors';
import { requireSupabase } from './supabase';
import { toProfile, type Profile } from './types';

/**
 * Foto de perfil (RF-002, P-03): bucket público `avatars`, pasta do próprio usuário
 * (`avatars/<userId>/<arquivo>`, policy do A2), até 2 MB, JPEG/PNG/WebP. Depois grava a URL pública
 * em `profiles.avatar_url`.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type AvatarFile = { body: ArrayBuffer | Blob; mimeType: string; size?: number };

export function validateAvatar(file: { mimeType?: string | null; size?: number | null }): string | null {
  if (!file.mimeType || !MIME_EXT[file.mimeType]) return 'Use uma imagem JPEG, PNG ou WebP.';
  if (file.size && file.size > AVATAR_MAX_BYTES) return 'A foto pode ter no máximo 2 MB.';
  return null;
}

export function avatarPath(userId: string, mimeType: string, now = Date.now()): string {
  return `${userId}/avatar-${now}.${MIME_EXT[mimeType] ?? 'jpg'}`;
}

export async function uploadAvatar(userId: string, file: AvatarFile): Promise<Result<Profile>> {
  return attempt(async () => {
    const invalid = validateAvatar(file);
    if (invalid) throw new AppError('VALIDATION', invalid);
    const supabase = requireSupabase();
    const path = avatarPath(userId, file.mimeType);
    const up = await supabase.storage.from('avatars').upload(path, file.body, { contentType: file.mimeType, upsert: true, cacheControl: '3600' });
    if (up.error) throw up.error;
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const { data, error } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', userId).select('*').single();
    if (error) throw error;
    // Apaga as fotos antigas da pasta (só conveniência; falha aqui não desfaz o envio).
    const list = await supabase.storage.from('avatars').list(userId);
    const old = (list.data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path);
    if (old.length) await supabase.storage.from('avatars').remove(old);
    return toProfile(data as Record<string, unknown>);
  });
}
