// Núcleo do traço "neon line-art geométrico" do NOMADE RUN (protótipo F1, E4).
// Mesma lógica que os componentes react-native-svg da F3 vão usar: o brilho é feito com
// camadas de stroke da mesma cor (sem filtro de desfoque), então roda igual no Android.

const C = {
  bg: '#070708',
  panel: '#0A0B0E',
  orange: '#FF6A13',
  ink: '#F3F1ED',
  ink2: '#A8A6A1',
  villain: '#B15CFF', // proposta: cor reservada aos chefões (decisão pendente do coordenador)
  team: { striders: '#2FA8FF', volt: '#19E6A8', owls: '#FF2D55', coyotes: '#FFD60A' },
  rarity: { comum: '#F3F1ED', raro: '#FF6A13' },
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function attrs(o) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}

// Forma: string = path "d"; objeto = {tag, ...atributos}.
function tag(s, extra = {}) {
  if (typeof s === 'string') return `<path ${attrs({ d: s, ...extra })}/>`;
  const { tag: t = 'path', ...rest } = s;
  return `<${t} ${attrs({ ...rest, ...extra })}/>`;
}

/**
 * Traço neon: (preenchimento opcional que tapa o que está atrás) + 2 halos + núcleo + filete quente.
 * opt.fill: true → fundo escuro opaco + tinta da cor; string → cor do preenchimento.
 * opt.glow: multiplicador do halo (0 desliga). opt.hot: opacidade do filete claro.
 */
function neon(shapes, color, w, opt = {}) {
  shapes = [].concat(shapes);
  const { fill, tint = 0.1, glow = 1, hot = 0.5, dash, opacity = 1 } = opt;
  const join = (extra) => shapes.map((s) => tag(s, extra)).join('');
  let out = `<g opacity="${opacity}">`;
  if (fill) {
    out += `<g fill="${fill === true ? C.panel : fill}" stroke="none">${join()}</g>`;
    if (fill === true && tint) out += `<g fill="${color}" fill-opacity="${tint}" stroke="none">${join()}</g>`;
  }
  const layer = (sw, op, col = color) =>
    `<g fill="none" stroke="${col}" stroke-width="${+sw.toFixed(2)}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}>${join()}</g>`;
  if (glow) out += layer(w * 4.6, +(0.07 * glow).toFixed(3)) + layer(w * 2.4, +(0.2 * glow).toFixed(3));
  out += layer(w, 1);
  if (hot) out += layer(Math.max(0.7, w * 0.36), hot, color.startsWith('url') ? '#ffffff' : mix(color, '#ffffff', 0.72));
  return out + '</g>';
}

/** Forma cheia que brilha (pupila, nariz, gema). */
function glowFill(shapes, color, opt = {}) {
  shapes = [].concat(shapes);
  const { glow = 1, w = 2, opacity = 1 } = opt;
  const join = (extra) => shapes.map((s) => tag(s, extra)).join('');
  let out = `<g opacity="${opacity}">`;
  if (glow)
    out += `<g fill="none" stroke="${color}" stroke-linejoin="round" stroke-width="${w * 4}" stroke-opacity="${0.08 * glow}">${join()}</g>` +
      `<g fill="none" stroke="${color}" stroke-linejoin="round" stroke-width="${w * 2}" stroke-opacity="${0.22 * glow}">${join()}</g>`;
  out += `<g fill="${color}" stroke="${color}" stroke-width="${w * 0.5}" stroke-linejoin="round">${join()}</g>`;
  return out + '</g>';
}

/** Forma do time: círculo, triângulo, losango ou quadrado, centrada em (cx, cy) com "raio" r. */
function glyph(kind, cx, cy, r) {
  switch (kind) {
    case 'circulo':
      return { tag: 'circle', cx, cy, r };
    case 'triangulo':
      return `M${cx} ${cy - r * 1.1} L${cx + r * 1.05} ${cy + r * 0.75} L${cx - r * 1.05} ${cy + r * 0.75} Z`;
    case 'losango':
      return `M${cx} ${cy - r * 1.2} L${cx + r} ${cy} L${cx} ${cy + r * 1.2} L${cx - r} ${cy} Z`;
    case 'quadrado':
      return { tag: 'rect', x: cx - r * 0.85, y: cy - r * 0.85, width: r * 1.7, height: r * 1.7, rx: r * 0.22 };
  }
}

/** Espelha um path simples (só comandos absolutos M L C Q Z com pares x,y) no eixo x = cx. */
function mirror(d, cx = 100) {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(2 * cx - x).toFixed(2)} ${y}`);
}

function svg(w, h, body, { bg = false, title } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    (title ? `<title>${title}</title>` : '') +
    (bg ? `<rect width="${w}" height="${h}" fill="${C.bg}"/>` : '') + body + '</svg>';
}

/** Grupo com transformação em torno de um ponto (o "pivô" que a E5 anima). */
function pivot(body, { x = 0, y = 0, rotate = 0, scale = 1, tx = 0, ty = 0, id } = {}) {
  const t = `translate(${tx} ${ty}) translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-x} ${-y})`;
  return `<g${id ? ` id="${id}"` : ''} transform="${t}">${body}</g>`;
}

/** Linhas de velocidade (identidade "corrida"). */
function speedLines(color, lines, w = 2.2, op = 0.6) {
  return neon(lines.map(([x1, y, x2]) => `M${x1} ${y} L${x2} ${y}`), color, w, { hot: 0, opacity: op });
}

/** Faíscas em cruz. */
function spark(cx, cy, r, color, w = 2) {
  return neon([`M${cx} ${cy - r} L${cx} ${cy + r}`, `M${cx - r} ${cy} L${cx + r} ${cy}`], color, w, { hot: 0.6 });
}

module.exports = { C, mix, neon, glowFill, glyph, mirror, svg, pivot, speedLines, spark, tag };
