/**
 * Teste de propriedade (rascunho F1) do corte por privacidade: 3.000 rotas e zonas aleatórias.
 * Propriedades: (1) nenhum ponto visível dentro de zona; (2) folga mínima > 25 m até a borda.
 * Na F3 vira teste com fast-check em `src/domain/__tests__/share-privacy.property.test.ts`.
 * Uso: node docs/melhoria/F1/social/prototipo/teste-propriedade.cjs
 */
const { clipForSharing, noPointInsideZones, rng, dist } = require('./privacidade.cjs');
const r = rng(42);
let fails = 0;
let noRoute = 0;
let minEdge = Infinity;
for (let k = 0; k < 3000; k++) {
  const n = 5 + Math.floor(r() * 80);
  let p = [r() * 2000 - 1000, r() * 2000 - 1000];
  const route = [p];
  for (let i = 0; i < n; i++) route.push((p = [p[0] + (r() - 0.5) * 400, p[1] + (r() - 0.5) * 400]));
  const zones = Array.from({ length: Math.floor(r() * 4) }, () => ({ c: [r() * 2000 - 1000, r() * 2000 - 1000], r: 50 + r() * 950 }));
  if (r() < 0.5) zones.push({ c: route[0], r: 50 + r() * 300 }); // casa no início, o caso mais comum
  const out = clipForSharing(route, zones, { random: r });
  if (!noPointInsideZones(out.pieces, zones)) fails++;
  if (out.mode === 'noRoute') noRoute++;
  for (const pc of out.pieces) for (const pt of pc) for (const z of zones) minEdge = Math.min(minEdge, dist(pt, z.c) - z.r);
}
console.log(`casos: 3000 | pontos dentro de zona: ${fails} | viraram "sem rota": ${noRoute} | menor folga até a borda: ${minEdge.toFixed(1)} m`);
process.exit(fails || minEdge <= 25 ? 1 : 0);
