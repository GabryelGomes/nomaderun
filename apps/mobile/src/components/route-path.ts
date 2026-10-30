import type { LatLng } from '@/domain/types';

/**
 * Desenho da rota no mini-mapa (`FeedRunCard`): projeção plana local (equiretangular com o cosseno da latitude),
 * mantendo a proporção da rota e centralizada na caixa. Sem mapa-base e sem grade (o mapa nunca mostra hexágonos).
 * Privacidade: quem chama passa a rota já cortada pelo domain quando ela é de outra pessoa (D-78, D-79).
 */
export function routeSvgPath(points: readonly LatLng[], width: number, height: number, pad = 8): string {
  if (points.length < 2) return '';
  const lat0 = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const k = Math.cos(lat0);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  if (span === 0) return '';
  const inner = Math.min(width, height) - pad * 2;
  const scale = inner / span;
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const r = (n: number) => Math.round(n * 10) / 10;
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${r(offX + (x - minX) * scale)} ${r(offY + (ys[i] - minY) * scale)}`).join(' ');
}

/** No máximo `max` pontos, sempre com o primeiro e o último (a lista do feed não precisa de 1 ponto por segundo). */
export function thinRoute<T>(points: readonly T[], max = 120): T[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}
