/**
 * T7.2.5 — feed da crew (D-79), parte pura: textos do item, data sem hora, reações otimistas e o
 * enquadramento do mini-mapa a partir da rota cortada no servidor (`ServerClippedRoute`).
 */
import { formatDuration, formatKm, formatPace, paceSecPerKm } from '@/domain/geo';
import type { LatLng } from '@/domain/types';
import type { FeedHighlight, FeedItem, FeedReaction, KudosCounts, ServerClippedRoute } from '@/services/api/feed-repo';

export const REACTION_LABEL: Record<FeedReaction, string> = { bora: 'Bora!', fogo: 'Fogo', raio: 'Raio' };
export const REACTION_HINT: Record<FeedReaction, string> = { bora: 'aplauso', fogo: 'ritmo forte', raio: 'conquista' };

/** Trava de toque nas reações (antispam, F1 §6). */
export const REACTION_LOCK_MS = 300;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Ontem" ou "20 out" (nunca a hora). `today` no formato `AAAA-MM-DD`. */
export function feedDateLabel(localDate: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return '';
  if (localDate === today) return 'Hoje';
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (t) {
    const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const n = Date.UTC(+t[1], +t[2] - 1, +t[3]);
    if (n - d === 86_400_000) return 'Ontem';
  }
  const label = `${+m[3]} ${MONTHS[+m[2] - 1]}`;
  return t && t[1] !== m[1] ? `${label} ${m[1]}` : label;
}

/** Data local de hoje (`AAAA-MM-DD`, fuso do aparelho). */
export function localToday(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function feedStats(item: Pick<FeedItem, 'meters' | 'movingSeconds'>): { km: string; time: string; pace: string } {
  const pace = item.meters > 0 && item.movingSeconds > 0 ? formatPace(paceSecPerKm(item.meters, item.movingSeconds)) : '--:--';
  return { km: `${formatKm(item.meters)} km`, time: formatDuration(item.movingSeconds), pace: `${pace} /km` };
}

export function highlightLabel(h: FeedHighlight): string {
  if (h.kind === 'zone_conquered') return `Conquistou ${h.name}`;
  if (h.kind === 'raid_damage') return `−${String(h.km).replace('.', ',')} km no chefão`;
  return `Recorde: ${h.distance}`;
}

/** Uma frase para o leitor de tela com o que o item mostra. */
export function feedItemLabel(item: FeedItem, today: string): string {
  const s = feedStats(item);
  const who = item.you ? 'Você' : item.author.username;
  const parts = [who, feedDateLabel(item.day, today), s.km, s.time, `ritmo ${s.pace}`, ...item.highlights.map(highlightLabel)];
  if (item.routeHidden) parts.push('rota escondida');
  if (item.isDemo) parts.push('demonstração');
  return parts.filter(Boolean).join(', ');
}

/** Reação otimista: põe, troca ou tira (tocar de novo na mesma tira). */
export function toggleReaction(item: Pick<FeedItem, 'kudos' | 'myReaction'>, reaction: FeedReaction): { kudos: FeedItem['kudos']; myReaction: FeedReaction | null } {
  const kudos = { ...item.kudos };
  if (item.myReaction) kudos[item.myReaction] = Math.max(0, kudos[item.myReaction] - 1);
  if (item.myReaction === reaction) return { kudos, myReaction: null };
  kudos[reaction] += 1;
  return { kudos, myReaction: reaction };
}

export const totalReactions = (r: FeedItem['kudos']) => r.bora + r.fogo + r.raio;

/**
 * T7.3.7 (revisão M4) — contadores ao vivo (`feed_kudos_counts`) → itens na tela. Troca pelos valores
 * absolutos (nunca soma). Item com reação minha a caminho (`pending`) fica como está: a resposta da RPC traz
 * os contadores e a minha reação juntos. Item que não está carregado é ignorado.
 */
export function applyKudosCounts<T extends Pick<FeedItem, 'id' | 'kudos'>>(items: readonly T[], counts: KudosCounts, pending: ReadonlySet<string> = new Set()): readonly T[] {
  if (pending.has(counts.itemId)) return items;
  const i = items.findIndex((it) => it.id === counts.itemId);
  if (i < 0) return items;
  const cur = items[i].kudos;
  const next = counts.kudos;
  if (cur.bora === next.bora && cur.fogo === next.fogo && cur.raio === next.raio) return items;
  const out = [...items];
  out[i] = { ...items[i], kudos: { ...next } };
  return out;
}

/**
 * Pedaços da rota → caminhos SVG numa caixa `width × height` com margem, mantendo a proporção (projeção
 * equirretangular com correção da latitude). Sem coordenada no resultado: só o desenho.
 */
export function miniMapPaths(route: ServerClippedRoute | null, width: number, height: number, pad = 12): string[] {
  if (!route) return [];
  const pts = route.pieces.flat();
  if (pts.length < 2) return [];
  const lat0 = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * (Math.PI / 180);
  const kx = Math.cos(lat0);
  const xy = (p: LatLng) => [p.lng * kx, -p.lat] as const;
  const xs = pts.map((p) => xy(p)[0]);
  const ys = pts.map((p) => xy(p)[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return route.pieces
    .filter((piece) => piece.length >= 2)
    .map((piece) =>
      piece
        .map((p, i) => {
          const [x, y] = xy(p);
          return `${i ? 'L' : 'M'}${(offX + (x - minX) * scale).toFixed(1)} ${(offY + (y - minY) * scale).toFixed(1)}`;
        })
        .join(' '),
    );
}
