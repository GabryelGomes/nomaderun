// Conferência de cor (E4, onda 3): distância perceptual ΔE2000 entre as cores de destaque da arte (baú raro,
// chama, gelo) e as cores dos 4 times e do violeta dos vilões, em visão normal e simulada (protanopia,
// deuteranopia e tritanopia, matrizes de Machado et al. 2009, severidade 1). Também o contraste com o fundo.
//
// Uso: node docs/melhoria/relatorios/E4-onda3/conferir-cores.cjs [#cor ...]
// Regra usada: ΔE2000 ≥ 20 = nitidamente outra cor; 10–20 = parecida, precisa de forma diferente; < 10 = colide.
const REF = {
  'Striders #2FA8FF': '#2FA8FF',
  'Volt #19E6A8': '#19E6A8',
  'Owls #FF2D55': '#FF2D55',
  'Coyotes #FFD60A': '#FFD60A',
  'Vilões #B15CFF': '#B15CFF',
};
const BG = '#070708';
const DEFAULT = {
  'baú raro (laranja) #FF6A13': '#FF6A13',
  'baú comum (branco quente) #F3F1ED': '#F3F1ED',
  'gelo #BFEFFF': '#BFEFFF',
  'chama fraca #C98A66': '#C98A66',
};

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (x) => Math.min(1, Math.max(0, x));

const CVD = {
  normal: null,
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
function simulate(rgb, m) {
  if (!m) return rgb;
  const l = rgb.map(lin);
  return m.map((row) => delin(clamp(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
}
function lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a, b) => {
    const t = Math.atan2(b, a) / rad;
    return t < 0 ? t + 360 : t;
  };
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lm = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p;
  if (C1p * C2p !== 0) hm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cmp;
  const SH = 1 + 0.015 * Cmp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
function contrast(a, b) {
  const Y = (h) => {
    const [r, g, bb] = hex(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const [x, y] = [Y(a), Y(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const args = process.argv.slice(2);
const targets = args.length ? Object.fromEntries(args.map((c) => [c, c])) : DEFAULT;
const rows = [];
for (const [name, c] of Object.entries(targets)) {
  for (const [refName, r] of Object.entries(REF)) {
    const row = { cor: name, contra: refName };
    for (const [mode, m] of Object.entries(CVD)) row[mode] = Math.round(de2000(lab(simulate(hex(c), m)), lab(simulate(hex(r), m))) * 10) / 10;
    rows.push(row);
  }
  rows.push({ cor: name, contra: `contraste com ${BG}`, normal: Math.round(contrast(c, BG) * 10) / 10 });
}
console.table(rows);
module.exports = { de2000, lab, hex, simulate, CVD, contrast };
