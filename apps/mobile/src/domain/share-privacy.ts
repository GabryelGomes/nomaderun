/**
 * D-78 / RN-010 — corte da rota para compartilhar (card, adesivo, GPX e feed).
 *
 * O dono lê todos os pontos da própria corrida; qualquer coisa que leve a rota para fora do aparelho passa
 * por aqui antes. Esconder só um círculo fixo em volta de casa não basta: com algumas corridas, a borda do
 * corte entrega o centro (Hassan, Hussain e Bates, USENIX Security 2018). Por isso:
 *  1. a rota é densificada (1 ponto a cada 8 m), para nenhum segmento atravessar uma zona sem ser cortado;
 *  2. some todo ponto a até `raio + folga` de cada zona; a folga é sorteada por zona a cada geração (25–85 m);
 *  3. o começo e o fim somem (círculo de 150–250 m sorteados em volta do ponto inicial e do final), mesmo fora
 *     de zona — ligado por padrão, como o "esconder início/fim" do Strava;
 *  4. cada ponta que encosta num trecho escondido perde mais 0–60 m sorteados;
 *  5. pedaços com menos de 150 m são descartados;
 *  6. se mais de 60% da rota sumir (ou nada sobrar), o resultado é "sem rota".
 *
 * A saída é o tipo de marca `SharedRoute`, que só esta função produz: o card e o GPX só aceitam esse tipo.
 * Puro: a aleatoriedade vem da semente (`seed`); o app sorteia a semente com `expo-crypto` a cada geração.
 * Os pontos de saída são objetos novos só com `lat`/`lng` (nunca horário, precisão ou passos).
 */
import { distanceMeters } from './geo';
import type { LatLng } from './types';

/** Distância máxima entre dois pontos da rota densificada. */
export const SHARE_DENSIFY_STEP_M = 8;
/** Folga sorteada em volta de cada zona de privacidade (por zona, por geração). */
export const SHARE_ZONE_MARGIN_MIN_M = 25;
export const SHARE_ZONE_MARGIN_MAX_M = 85;
/** Raio escondido em volta do começo e do fim (sorteado por geração). */
export const SHARE_END_CUT_MIN_M = 150;
export const SHARE_END_CUT_MAX_M = 250;
/** Aparo extra sorteado em cada ponta que encosta num trecho escondido. */
export const SHARE_EDGE_TRIM_MAX_M = 60;
/** Pedaços visíveis menores que isto são descartados. */
export const SHARE_MIN_PIECE_M = 150;
/** Acima desta fração escondida, o card vira "sem rota". */
export const SHARE_MAX_HIDDEN_RATIO = 0.6;

/** Zona de privacidade como o domain a vê (mesmo formato de `PrivacyZone` do app, sem id/rótulo). */
export type PrivacyCircle = { lat: number; lng: number; radiusM: number };

export type ShareClipOptions = {
  /** Semente do sorteio (inteiro de 32 bits). Mesma semente + mesma rota = mesmo corte. */
  seed: number;
  /** Esconder o começo e o fim (padrão: ligado). */
  hideEnds?: boolean;
};

/** Por que não sobrou rota: nada para mostrar, ou a maior parte ficou escondida. */
export type NoRouteReason = 'empty' | 'mostlyHidden';

declare const SHARED_ROUTE_BRAND: unique symbol;

/**
 * Rota pronta para sair do aparelho. Só `clipRouteForSharing` cria valores deste tipo (marca nominal +
 * registro em tempo de execução, conferido por `isSharedRoute`).
 */
export type SharedRoute = {
  readonly mode: 'route' | 'noRoute';
  /** Pedaços visíveis, cada um com ≥ 150 m. Vazio quando `mode === 'noRoute'`. */
  readonly pieces: readonly (readonly LatLng[])[];
  /** Comprimento da rota original (m). */
  readonly totalMeters: number;
  /** Comprimento dos pedaços visíveis (m). */
  readonly shownMeters: number;
  /** `totalMeters - shownMeters`, arredondado (m). */
  readonly hiddenMeters: number;
  /** Fração escondida, de 0 a 1 (1 quando não há rota). */
  readonly hiddenRatio: number;
  /** O começo e o fim foram escondidos. */
  readonly endsHidden: boolean;
  /** Preenchido quando `mode === 'noRoute'`. */
  readonly noRouteReason: NoRouteReason | null;
  readonly [SHARED_ROUTE_BRAND]: true;
};

const issued = new WeakSet<object>();

/** Confere, em tempo de execução, que o valor saiu de `clipRouteForSharing` (e não foi montado à mão). */
export function isSharedRoute(value: unknown): value is SharedRoute {
  return typeof value === 'object' && value !== null && issued.has(value);
}

/** mulberry32: sorteio determinístico pela semente (o mesmo dos testes de propriedade do domain). */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isFiniteLatLng = (p: LatLng) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function densify(points: readonly LatLng[], step: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(distanceMeters(a, b) / step));
    for (let k = 0; k < n; k++) {
      out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lng: a.lng + ((b.lng - a.lng) * k) / n });
    }
  }
  const last = points[points.length - 1];
  out.push({ lat: last.lat, lng: last.lng });
  return out;
}

function pathLength(points: readonly LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distanceMeters(points[i - 1], points[i]);
  return sum;
}

/** Tira `meters` do começo (`fromStart`) ou do fim de um pedaço, sem inventar ponto novo. */
function trimPiece(piece: LatLng[], meters: number, fromStart: boolean): LatLng[] {
  const p = fromStart ? piece : [...piece].reverse();
  let walked = 0;
  let i = 0;
  while (i < p.length - 1 && walked < meters) {
    walked += distanceMeters(p[i], p[i + 1]);
    i++;
  }
  const rest = p.slice(i);
  return fromStart ? rest : rest.reverse();
}

function seal(route: Omit<SharedRoute, typeof SHARED_ROUTE_BRAND>): SharedRoute {
  const frozen = Object.freeze({
    ...route,
    pieces: Object.freeze(route.pieces.map((piece) => Object.freeze(piece.map((p) => Object.freeze({ lat: p.lat, lng: p.lng }))))),
  }) as SharedRoute;
  issued.add(frozen);
  return frozen;
}

/**
 * Corta a rota para compartilhar. `route` aceita `GeoPoint[]` (só `lat`/`lng` são lidos).
 * Pontos inválidos (não finitos ou fora do globo) são ignorados.
 */
export function clipRouteForSharing(
  route: readonly LatLng[],
  zones: readonly PrivacyCircle[],
  options: ShareClipOptions,
): SharedRoute {
  const random = seededRandom(options.seed);
  const hideEnds = options.hideEnds ?? true;
  const clean = route.filter(isFiniteLatLng);
  const validZones = zones.filter((z) => isFiniteLatLng(z) && Number.isFinite(z.radiusM) && z.radiusM >= 0);

  if (clean.length < 2) {
    return seal({ mode: 'noRoute', pieces: [], totalMeters: 0, shownMeters: 0, hiddenMeters: 0, hiddenRatio: 1, endsHidden: hideEnds, noRouteReason: 'empty' });
  }

  // A ordem dos sorteios é fixa (folgas, pontas, aparos) para a semente reproduzir o corte.
  const margins = validZones.map(() => SHARE_ZONE_MARGIN_MIN_M + random() * (SHARE_ZONE_MARGIN_MAX_M - SHARE_ZONE_MARGIN_MIN_M));
  const startCut = SHARE_END_CUT_MIN_M + random() * (SHARE_END_CUT_MAX_M - SHARE_END_CUT_MIN_M);
  const endCut = SHARE_END_CUT_MIN_M + random() * (SHARE_END_CUT_MAX_M - SHARE_END_CUT_MIN_M);

  const dense = densify(clean, SHARE_DENSIFY_STEP_M);
  const totalMeters = pathLength(dense);
  const start = dense[0];
  const end = dense[dense.length - 1];

  const hidden = dense.map((p) => {
    if (hideEnds && (distanceMeters(p, start) <= startCut || distanceMeters(p, end) <= endCut)) return true;
    return validZones.some((z, k) => distanceMeters(p, z) <= z.radiusM + margins[k]);
  });

  type Run = { pts: LatLng[]; hiddenBefore: boolean; hiddenAfter: boolean };
  const runs: Run[] = [];
  let current: Run | null = null;
  for (let i = 0; i < dense.length; i++) {
    if (hidden[i]) {
      if (current) {
        current.hiddenAfter = true;
        runs.push(current);
      }
      current = null;
    } else if (current) {
      current.pts.push(dense[i]);
    } else {
      current = { pts: [dense[i]], hiddenBefore: i > 0, hiddenAfter: false };
    }
  }
  if (current) runs.push(current);

  const pieces = runs
    .map(({ pts, hiddenBefore, hiddenAfter }) => {
      let piece = pts;
      if (hiddenBefore) piece = trimPiece(piece, random() * SHARE_EDGE_TRIM_MAX_M, true);
      if (hiddenAfter) piece = trimPiece(piece, random() * SHARE_EDGE_TRIM_MAX_M, false);
      return piece;
    })
    .filter((piece) => piece.length > 1 && pathLength(piece) >= SHARE_MIN_PIECE_M);

  const shownMeters = pieces.reduce((sum, piece) => sum + pathLength(piece), 0);
  const hiddenRatio = totalMeters > 0 ? Math.min(1, Math.max(0, 1 - shownMeters / totalMeters)) : 1;
  const base = { totalMeters, endsHidden: hideEnds };

  if (pieces.length === 0 || hiddenRatio > SHARE_MAX_HIDDEN_RATIO) {
    return seal({
      ...base,
      mode: 'noRoute',
      pieces: [],
      shownMeters: 0,
      hiddenMeters: Math.round(totalMeters),
      hiddenRatio: 1,
      noRouteReason: totalMeters < SHARE_MIN_PIECE_M ? 'empty' : 'mostlyHidden',
    });
  }
  return seal({
    ...base,
    mode: 'route',
    pieces,
    shownMeters,
    hiddenMeters: Math.round(totalMeters - shownMeters),
    hiddenRatio,
    noRouteReason: null,
  });
}
