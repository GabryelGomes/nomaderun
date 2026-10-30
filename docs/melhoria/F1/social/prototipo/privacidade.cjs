/**
 * Implementação de referência (F1) do corte da rota pelas zonas de privacidade (RN-010) para o card e o feed.
 * Na F3 isto vira `apps/mobile/src/domain/share-privacy.ts` (puro, usado pelo app e pelas Edge Functions).
 *
 * Coordenadas aqui são metros num plano local (x para leste, y para baixo, como no `mapa.json`).
 * No domain, a mesma lógica roda sobre lat/lng usando `distanceMeters` de `domain/geo.ts`.
 *
 * Regras (ver 08-social.md, seção 4):
 *  1. Densifica a rota (um ponto a cada 8 m) para que nenhum segmento longo "atravesse" uma zona sem ser cortado.
 *  2. Esconde todo ponto a até (raio + folga) de cada zona; a folga é sorteada por zona a cada geração (25–85 m),
 *     então a borda do corte não desenha um círculo perfeito que entregue o centro (ataque de Hassan et al., 2018).
 *  3. Esconde também o começo e o fim da corrida (150–250 m sorteados), mesmo fora de zona (padrão ligado).
 *  4. Apara mais 0–60 m sorteados em cada ponta que encosta num trecho escondido (com o começo e o fim
 *     escondidos, isso vale para todas as pontas).
 *  5. Descarta pedaços visíveis com menos de 150 m (pedaços curtos perto de casa vazam mais do que enfeitam).
 *  6. O enquadramento do card usa só os pedaços visíveis (o recorte não "aponta" para o trecho escondido).
 */

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function densify(pts, step = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

function length(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Remove `meters` do começo (`fromStart`) ou do fim de um pedaço. */
function trim(piece, meters, fromStart) {
  const p = fromStart ? piece : [...piece].reverse();
  let acc = 0;
  let i = 1;
  while (i < p.length && acc < meters) {
    acc += dist(p[i - 1], p[i]);
    i++;
  }
  const rest = p.slice(i - 1);
  return fromStart ? rest : rest.reverse();
}

/** Gerador pseudoaleatório só para o protótipo ser reproduzível. No app: `crypto.getRandomValues`. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * @param {number[][]} route pontos [x, y] em metros
 * @param {{c:number[], r:number}[]} zones zonas de privacidade
 * @param {{random?:() => number, hideEnds?: boolean}} opts
 * @returns {{pieces:number[][][], hiddenMeters:number, mode:'route'|'noRoute'}}
 */
function clipForSharing(route, zones, opts = {}) {
  const random = opts.random ?? Math.random;
  const hideEnds = opts.hideEnds ?? true;
  const margins = zones.map(() => 25 + random() * 60);
  const dense = densify(route);
  const total = length(dense);

  // 3. começo e fim: marca por distância percorrida.
  const startCut = hideEnds ? 150 + random() * 100 : 0;
  const endCut = hideEnds ? 150 + random() * 100 : 0;
  let walked = 0;
  const hidden = dense.map((p, i) => {
    if (i > 0) walked += dist(dense[i - 1], p);
    if (walked < startCut || total - walked < endCut) return true;
    return zones.some((z, k) => dist(p, z.c) <= z.r + margins[k]);
  });

  // split em pedaços visíveis, lembrando quais pontas encostam num trecho escondido
  let pieces = [];
  let cur = null;
  for (let i = 0; i < dense.length; i++) {
    if (hidden[i]) {
      if (cur) pieces.push({ ...cur, hiddenAfter: true });
      cur = null;
    } else if (cur) cur.pts.push(dense[i]);
    else cur = { pts: [dense[i]], hiddenBefore: i > 0 };
  }
  if (cur) pieces.push({ ...cur, hiddenAfter: false });

  // 4. apara 0–60 m sorteados em cada ponta que encosta num trecho escondido
  pieces = pieces.map(({ pts, hiddenBefore, hiddenAfter }) => {
    let q = pts;
    if (hiddenBefore) q = trim(q, random() * 60, true);
    if (hiddenAfter) q = trim(q, random() * 60, false);
    return q;
  });
  // 5. descarta pedaços curtos
  pieces = pieces.filter((p) => p.length > 1 && length(p) >= (opts.minPiece ?? 150));

  const shown = pieces.reduce((s, p) => s + length(p), 0);
  return { pieces, hiddenMeters: Math.round(total - shown), mode: pieces.length ? 'route' : 'noRoute' };
}

/** Propriedade que o teste de propriedade da F3 vai verificar: nenhum ponto visível dentro de zona. */
function noPointInsideZones(pieces, zones) {
  return pieces.every((p) => p.every((pt) => zones.every((z) => dist(pt, z.c) > z.r)));
}

module.exports = { clipForSharing, noPointInsideZones, densify, length, rng, dist };
