// GET /zones?bbox=minLng,minLat,maxLng,maxLat — zonas visíveis (RF-007, RNF-009). Máx. 2.000.
import { handler, json } from '../_shared/http.ts';
import { zoneLabel } from '../_shared/scoring.ts';
import { requireUser, rpc } from '../_shared/supabase.ts';
import { parseBbox } from '../_shared/validate.ts';

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
};

Deno.serve(handler(['GET'], async (req) => {
  await requireUser(req);
  const bbox = parseBbox(new URL(req.url).searchParams.get('bbox'));
  const rows = await rpc<Row[]>('zones_in_bbox', {
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
    })),
  });
}));
