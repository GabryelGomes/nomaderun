import { AppError, attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

/**
 * Zonas de privacidade (RN-010, P-27): tabela `privacy_zones` (RLS: só as próprias; no máximo 3,
 * garantido pelo banco com `PRIVACY_ZONES_LIMIT`). Os pontos dentro do raio pontuam normalmente,
 * mas não aparecem para terceiros (ex.: painel de moderação).
 */
export const MAX_PRIVACY_ZONES = 3;
export const DEFAULT_PRIVACY_RADIUS = 200;
export const MIN_PRIVACY_RADIUS = 50;
export const MAX_PRIVACY_RADIUS = 1000;

export type PrivacyZone = { id: string; label: string | null; lat: number; lng: number; radiusM: number; createdAt: number };
export type NewPrivacyZone = { label?: string | null; lat: number; lng: number; radiusM?: number };

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));

export function toPrivacyZone(r: Row): PrivacyZone {
  const created = typeof r.created_at === 'string' ? Date.parse(r.created_at) : NaN;
  return {
    id: String(r.id ?? ''),
    label: typeof r.label === 'string' && r.label.trim() ? r.label : null,
    lat: num(r.lat),
    lng: num(r.lng),
    radiusM: Number.isFinite(num(r.radius_m)) ? num(r.radius_m) : DEFAULT_PRIVACY_RADIUS,
    createdAt: Number.isFinite(created) ? created : 0,
  };
}

/** Mesmas regras do banco, com mensagem em pt-BR antes de ir ao servidor. */
export function validatePrivacyZone(z: NewPrivacyZone): string | null {
  const label = z.label?.trim() ?? '';
  if (label.length > 40) return 'Use até 40 caracteres no nome do endereço.';
  if (!Number.isFinite(z.lat) || !Number.isFinite(z.lng) || z.lat < -90 || z.lat > 90 || z.lng < -180 || z.lng > 180) return 'Escolha um ponto no mapa ou use sua posição atual.';
  const radius = z.radiusM ?? DEFAULT_PRIVACY_RADIUS;
  if (!Number.isInteger(radius) || radius < MIN_PRIVACY_RADIUS || radius > MAX_PRIVACY_RADIUS) return `O raio vai de ${MIN_PRIVACY_RADIUS} a ${MAX_PRIVACY_RADIUS} metros.`;
  return null;
}

const COLUMNS = 'id,label,lat,lng,radius_m,created_at';

export async function listPrivacyZones(): Promise<Result<PrivacyZone[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('privacy_zones').select(COLUMNS).order('created_at');
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toPrivacyZone);
  });
}

export async function addPrivacyZone(z: NewPrivacyZone): Promise<Result<PrivacyZone>> {
  const invalid = validatePrivacyZone(z);
  if (invalid) return { ok: false, error: new AppError('VALIDATION', invalid) };
  const label = z.label?.trim() || null;
  return attempt(async () => {
    const { data, error } = await requireSupabase()
      .from('privacy_zones')
      .insert({ label, lat: z.lat, lng: z.lng, radius_m: z.radiusM ?? DEFAULT_PRIVACY_RADIUS })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return toPrivacyZone(data as Row);
  });
}

export async function removePrivacyZone(id: string): Promise<Result<void>> {
  return attempt(async () => {
    const { error } = await requireSupabase().from('privacy_zones').delete().eq('id', id);
    if (error) throw error;
  });
}

/** Limite do banco (`PRIVACY_ZONES_LIMIT: ...`); a mensagem já vem em pt-BR pelo mapeador de erros. */
export const isPrivacyLimitError = (e: AppError) => e.detail === 'PRIVACY_ZONES_LIMIT';
