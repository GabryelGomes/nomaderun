import { uploadAvatar } from '@/services/api/avatar-repo';
import { AppError, fail, type Result } from '@/services/api/errors';
import { writeCachedProfile } from '@/services/api/profile-cache';
import type { Profile } from '@/services/api/types';
import { useSession } from '@/store/session-store';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 → bytes sem depender de `atob`/Buffer (iguais em iOS, Android e web). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, o);
}

/**
 * Escolhe uma foto da galeria (quadrada, comprimida) e envia para o bucket `avatars` (P-03).
 * Devolve `null` se o usuário cancelar.
 */
export async function pickAndUploadAvatar(): Promise<Result<Profile> | null> {
  const userId = useSession.getState().session?.userId;
  if (!userId) return fail(new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre de novo.'));
  const ImagePicker = await import('expo-image-picker');
  if (process.env.EXPO_OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return fail(new AppError('VALIDATION', 'Permita o acesso às fotos nas configurações do aparelho para escolher uma foto.'));
  }
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  if (!asset.base64) return fail(new AppError('VALIDATION', 'Não foi possível ler a imagem escolhida. Tente outra.'));
  const bytes = base64ToBytes(asset.base64);
  const mimeType = asset.mimeType ?? (asset.uri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
  const res = await uploadAvatar(userId, { body: bytes.buffer as ArrayBuffer, mimeType, size: bytes.byteLength });
  if (res.ok) {
    useSession.getState().setProfile(res.data);
    void writeCachedProfile(res.data);
  }
  return res;
}
