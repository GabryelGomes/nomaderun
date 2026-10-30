/**
 * D-78 — exportar a corrida em GPX 1.1 (https://www.topografix.com/GPX/1/1/).
 *
 * Padrão: a rota sai já cortada pelas zonas de privacidade (`SharedRoute`), um `<trkseg>` por pedaço
 * visível e **sem nenhum horário** (nem no `<metadata>`): o ritmo do trecho escondido apontaria onde ele
 * estava. A rota completa, com horários, só sai com a confirmação explícita da pessoa
 * (`confirmedFullRoute: true`), pedida pela tela antes de chamar esta função.
 * Puro: sem relógio; o horário de cada ponto vem do próprio ponto.
 */
import { isSharedRoute, type SharedRoute } from './share-privacy';

export const GPX_MIME_TYPE = 'application/gpx+xml';
export const GPX_UTI = 'com.topografix.gpx';
export const GPX_CREATOR = 'NOMADE RUN';

/** Ponto da rota completa. `t` em milissegundos desde 1970 (como o `GeoPoint`); `ele` em metros. */
export type GpxPoint = { lat: number; lng: number; t?: number; ele?: number };

export type GpxSource =
  | { kind: 'shared'; route: SharedRoute }
  | { kind: 'full'; points: readonly GpxPoint[]; confirmedFullRoute: true };

export type GpxOptions = {
  /** Nome da atividade (ex.: "Corrida NOMADE — 23/10/2026"). Sem hora. */
  name: string;
  description?: string;
  /** Tipo livre do GPX (`<type>`); padrão "running". */
  activityType?: string;
};

/** Remove o que o XML 1.0 não aceita nem com escape (controles e metades soltas de pares substitutos). */
function stripInvalidXml(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if ((c < 0x20 && c !== 0x9 && c !== 0xa && c !== 0xd) || c === 0xfffe || c === 0xffff) continue;
    out += value[i];
  }
  return out;
}

/** Escapa texto e atributos para XML (e remove caracteres proibidos). */
export function escapeGpxText(value: string): string {
  return stripInvalidXml(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const validCoord = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng < 180;

const coord = (n: number) => n.toFixed(6);

function trkpt(p: GpxPoint, withTime: boolean): string {
  const children: string[] = [];
  if (typeof p.ele === 'number' && Number.isFinite(p.ele)) children.push(`<ele>${p.ele.toFixed(1)}</ele>`);
  if (withTime && typeof p.t === 'number' && Number.isFinite(p.t)) {
    const iso = new Date(p.t).toISOString();
    children.push(`<time>${iso.replace(/\.\d{3}Z$/, 'Z')}</time>`);
  }
  const open = `<trkpt lat="${coord(p.lat)}" lon="${coord(p.lng)}"`;
  return children.length ? `${open}>${children.join('')}</trkpt>` : `${open}/>`;
}

function segment(points: readonly GpxPoint[], withTime: boolean): string | null {
  const valid = points.filter(validCoord);
  if (valid.length === 0) return null;
  return `    <trkseg>\n${valid.map((p) => `      ${trkpt(p, withTime)}`).join('\n')}\n    </trkseg>`;
}

/**
 * Monta o GPX. Com `kind: 'shared'`, exige uma `SharedRoute` de verdade (lança erro se o objeto não saiu
 * de `clipRouteForSharing`); uma rota "sem rota" gera um `<trk>` sem segmentos (GPX válido).
 */
export function buildGpx(source: GpxSource, options: GpxOptions): string {
  let segments: string[];
  if (source.kind === 'shared') {
    if (!isSharedRoute(source.route)) throw new Error('buildGpx: a rota precisa passar por clipRouteForSharing');
    segments = source.route.pieces.map((piece) => segment(piece, false)).filter((s): s is string => s !== null);
  } else {
    if (source.confirmedFullRoute !== true) throw new Error('buildGpx: a rota completa exige confirmação');
    const s = segment(source.points, true);
    segments = s ? [s] : [];
  }
  const name = escapeGpxText(options.name);
  const desc = options.description ? `    <desc>${escapeGpxText(options.description)}</desc>\n` : '';
  const type = escapeGpxText(options.activityType ?? 'running');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${GPX_CREATOR}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    '  <metadata>',
    `    <name>${name}</name>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${name}</name>`,
    desc + `    <type>${type}</type>`,
    ...segments,
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/** Nome do arquivo no cache (só letras, números, `-` e `_`). */
export function gpxFileName(activityId: string): string {
  const safe = activityId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return `nomade-${safe || 'corrida'}.gpx`;
}
