// GET /zones?bbox=minLng,minLat,maxLng,maxLat — zonas visíveis (RF-007, RNF-009). Máx. 2.000.
import { handler, json } from '../_shared/http.ts';
import { zoneLabel } from '../_shared/scoring.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';
import { parseBbox } from '../_shared/validate.ts';
import { enforceRateLimit } from '../_shared/rate-limit.ts';

type Row = {
  id: string;
  name: string | null;
  city: string | null;
  owner: string | null;
  influence: Record<string, number>;
  shield: number;
  attacker: string | null;
  attack_started_at: string | null;
  blocked: boolean;
  /** C2 (20261104120000): "perto do Estádio"; ausente no banco antigo. */
  near_ref?: string | null;
};

Deno.serve(handler(['GET'], async (req) => {
  const user = await requireUser(req);
  await enforceRateLimit(user.id, 'geral');
  const bbox = parseBbox(new URL(req.url).searchParams.get('bbox'));
  // QA-04: um único JSON com até 2.000 zonas (a RPC em linhas sofreria o max_rows do PostgREST)
  const rows = await rpc<Row[]>('zones_in_bbox_json', {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
  });
  return json({
    zones: rows.map((z) => ({
      id: z.id,
      name: zoneLabel(z.id, z.name),
      city: z.city,
      owner: z.owner,
      influence: z.influence,
      shield: z.shield,
      attacker: z.attacker,
      attackStartedAt: z.attack_started_at ? Date.parse(z.attack_started_at) : null,
      blocked: z.blocked,
      // C2: campo novo e opcional (o app antigo ignora); só sai quando há referência
      ...(typeof z.near_ref === 'string' && z.near_ref ? { nearRef: z.near_ref } : {}),
    })),
  });
}));
