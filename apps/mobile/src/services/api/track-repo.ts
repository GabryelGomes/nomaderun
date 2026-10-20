import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

/**
 * Trechos inválidos do percurso (UC-01 E1, P-20): busca no servidor só os pontos de cada
 * `invalidSegments[i]` (fromSeq..toSeq) do resultado oficial, pelo `seq`, para o mapa do resumo
 * desenhar esses trechos em cinza. O dono lê todos os próprios pontos (RLS), então o `seq` é exato
 * mesmo quando o percurso local foi simplificado para o mapa.
 */
export type SeqRange = { fromSeq: number; toSeq: number };
export type LatLngPoint = { lat: number; lng: number };

/** Até quantos trechos e pontos por trecho o mapa pede (o resumo é uma prévia, não um replay). */
export const MAX_STRETCHES = 20;
export const MAX_POINTS_PER_STRETCH = 1000;

type Row = { seq?: unknown; lat?: unknown; lng?: unknown };
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));

/** Junta trechos que se tocam ou se sobrepõem e descarta os inválidos (ordem por `fromSeq`). */
export function mergeRanges(ranges: SeqRange[]): SeqRange[] {
  const sorted = ranges
    .filter((r) => Number.isInteger(r.fromSeq) && Number.isInteger(r.toSeq) && r.toSeq >= r.fromSeq && r.fromSeq >= 0)
    .map((r) => ({ fromSeq: r.fromSeq, toSeq: r.toSeq }))
    .sort((a, b) => a.fromSeq - b.fromSeq);
  const out: SeqRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.fromSeq <= last.toSeq + 1) last.toSeq = Math.max(last.toSeq, r.toSeq);
    else out.push(r);
  }
  return out;
}

export async function getInvalidStretches(activityId: string, segments: SeqRange[]): Promise<Result<LatLngPoint[][]>> {
  const ranges = mergeRanges(segments).slice(0, MAX_STRETCHES);
  return attempt(async () => {
    const supabase = requireSupabase();
    const parts = await Promise.all(
      ranges.map(async (r) => {
        // Inclui o ponto anterior para o trecho cinza encostar no percurso válido.
        const { data, error } = await supabase
          .from('activity_points')
          .select('seq,lat,lng')
          .eq('activity_id', activityId)
          .gte('seq', Math.max(0, r.fromSeq - 1))
          .lte('seq', r.toSeq)
          .order('seq')
          .limit(MAX_POINTS_PER_STRETCH);
        if (error) throw error;
        return ((data ?? []) as Row[]).map((p) => ({ lat: num(p.lat), lng: num(p.lng) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      }),
    );
    return parts.filter((p) => p.length > 1);
  });
}
