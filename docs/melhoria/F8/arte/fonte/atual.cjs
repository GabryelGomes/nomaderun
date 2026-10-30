// F8 · auditoria de arte: renderiza TODA a arte atual de `apps/mobile/src/components/art/` em folhas de contato,
// com os mesmos módulos de geometria dos componentes (`neon/core.ts`), mais o selo antigo (`team-badge.tsx` e
// `card-parts.tsx`) reproduzido com os mesmos números, em contexto (mapa, zona, feed, pódio, card).
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F8/arte/fonte/atual.cjs [familia...]
// Saída: docs/melhoria/F8/arte/atual/<familia>.png
const path = require('path');
const { execFileSync } = require('child_process');
const { art, piece, ART, TEAMS } = require('../../../relatorios/E4-onda2/gerar-evidencia.cjs');

const OUT = process.env.OUT_DIR || path.resolve(__dirname, '../atual');
const FAMILIES = {};
function family(name, title, cols, build, cell = 200) {
  FAMILIES[name] = { title, cols, build, cell };
}
const NAMES = { striders: 'Neon Striders', volt: 'Volt Runners', owls: 'Night Owls', coyotes: 'Urban Coyotes' };
// Cores sólidas do token `factions` (tokens.ts) — o selo antigo usa estas, não as neon.
const SOLID = { striders: '#0072B2', volt: '#009E73', owls: '#D7263D', coyotes: '#D9B200' };
const SHAPE = { striders: 'circulo', volt: 'triangulo', owls: 'losango', coyotes: 'quadrado' };

// ---------------------------------------------------------------- mascotes
family(
  'mascotes',
  'Mascotes (busto) · 4 times × 4 poses em 150 pt · e o "parado" em 64, 40 e 24 pt (qualidade automática)',
  7,
  () => {
    const t = art('team/mascot-art.ts');
    const out = [];
    for (const team of TEAMS) {
      for (const pose of t.MASCOT_POSES) out.push(piece(t.mascotNodes(team, pose, ART.team[team]), t.MASCOT_BOX, 150, { label: `${t.MASCOT_NAMES[team]} · ${pose}` }));
      for (const w of [64, 40, 24]) out.push(piece(t.mascotNodes(team, 'parado', ART.team[team]), t.MASCOT_BOX, w, { label: `${w} pt` }));
    }
    return out;
  },
  176,
);

family('corredores', 'Mascotes em corrida (card da escolha de time) · 320 pt · e em 72 pt', 4, () => {
  const r = art('team/runner-art.ts');
  const t = art('team/mascot-art.ts');
  const out = [];
  for (const team of TEAMS) out.push(piece(r.runnerNodes(team, ART.team[team]), r.RUNNER_BOX, 320, { label: `${t.MASCOT_NAMES[team]} · corrida · 320 pt` }));
  for (const team of TEAMS) out.push(piece(r.runnerNodes(team, ART.team[team]), r.RUNNER_BOX, 72, { label: `72 pt` }));
  return out;
}, 350);

family(
  'emblemas',
  'Emblemas atuais (TeamEmblem) · completo 120 pt (nome por Text) · compacto 64, 40, 28 e 20 pt',
  5,
  () => {
    const t = art('team/mascot-art.ts');
    const out = [];
    for (const team of TEAMS) {
      const k = 120 / 200;
      const band = t.EMBLEM_BAND;
      const label = NAMES[team].toUpperCase();
      const overlay = `<div style="position:absolute;left:${band.x * k}px;top:${band.y * k}px;width:${band.width * k}px;height:${band.height * k}px;display:flex;align-items:center;justify-content:center;font:800 ${(label.length > 12 ? 11.5 : 13) * k}px Arial;letter-spacing:${1.2 * k}px;color:${ART.ink}">${label}</div>`;
      out.push(piece(t.emblemNodes(team, ART.team[team], false), t.EMBLEM_BOX, 120, { label: `${NAMES[team]} · completo 120`, overlay }));
      for (const w of [64, 40, 28, 20]) out.push(piece(t.emblemNodes(team, ART.team[team], true), t.EMBLEM_BOX, w, { label: `compacto ${w} pt` }));
    }
    return out;
  },
  150,
);

family('lideres', 'Líderes · parado e falando · 150 pt · e parado em 56 pt', 6, () => {
  const l = art('leader/leader-art.ts');
  const out = [];
  for (const team of TEAMS) {
    for (const pose of l.LEADER_POSES) out.push(piece(l.leaderNodes(team, pose, ART.team[team]), l.LEADER_BOX, 150, { label: `${l.LEADER_NAMES[team]} · ${pose}` }));
    out.push(piece(l.leaderNodes(team, 'parado', ART.team[team]), l.LEADER_BOX, 56, { label: '56 pt' }));
  }
  return out;
}, 176);

// ---------------------------------------------------------------- chefões
family('chefoes', 'Chefões · 5 × 4 estados (parado, golpe, furioso, derrotado) · 150 pt · e parado em 48 pt', 5, () => {
  const b = art('boss/boss-art.ts');
  const out = [];
  for (const id of b.BOSS_IDS) {
    for (const st of b.BOSS_STATES) out.push(piece(b.bossNodes(id, st, 0, ART.villain), b.BOSS_BOX, 150, { label: `${b.BOSS_NAMES[id]} · ${st}` }));
    out.push(piece(b.bossNodes(id, 'parado', 0, ART.villain), b.BOSS_BOX, 48, { label: '48 pt' }));
  }
  return out;
}, 176);

// ---------------------------------------------------------------- baús, medalhas, modos
family('baus', 'Baús · 3 raridades × 3 estados · 120 pt · e fechado em 40 pt', 4, () => {
  const c = art('chest/chest-art.ts');
  const out = [];
  for (const r of c.CHEST_RARITIES) {
    for (const st of c.CHEST_STATES) out.push(piece(c.chestNodes(r, st), c.CHEST_BOX, 120, { label: `${c.CHEST_LABELS[r]} · ${st}` }));
    out.push(piece(c.chestNodes(r, 'fechado'), c.CHEST_BOX, 40, { label: '40 pt' }));
  }
  return out;
}, 150);

family('medalhas', 'Medalhas · 12 (nível 3) em 96 pt · 3 níveis · bloqueadas · e 48 pt', 6, () => {
  const md = art('medal/medal-art.ts');
  const out = [];
  for (const k of md.MEDAL_KINDS) out.push(piece(md.medalNodes(k, 3, false), md.MEDAL_BOX, 96, { label: md.MEDAL_LABELS[k] }));
  for (const t of [1, 2, 3]) out.push(piece(md.medalNodes('explorador', t, false), md.MEDAL_BOX, 96, { label: `explorador · nível ${t}` }));
  for (const k of ['chefao', 'liga', 'crew']) out.push(piece(md.medalNodes(k, 1, true), md.MEDAL_BOX, 96, { label: `${md.MEDAL_LABELS[k]} · bloqueada` }));
  for (const k of md.MEDAL_KINDS.slice(0, 6)) out.push(piece(md.medalNodes(k, 3, false), md.MEDAL_BOX, 48, { label: '48 pt' }));
  return out;
}, 130);

family('modos', 'Ícones dos modos · 8 em 64, 44 e 24 pt', 8, () => {
  const mi = art('mode-icons/mode-icon-art.ts');
  const out = [];
  for (const w of [64, 44, 24]) for (const k of mi.MODE_ICON_KINDS) out.push(piece(mi.modeIconNodes(k), mi.MODE_ICON_BOX, w, { label: `${mi.MODE_ICON_LABELS[k]} · ${w}` }));
  return out;
}, 110);

family('vazios', 'Estados vazios · 13 · 200 pt (Striders onde há mascote)', 5, () => {
  const e = art('empty/empty-art.ts');
  return e.EMPTY_KINDS.map((k) => piece(e.emptyNodes(k, ART.orange, 'striders'), e.EMPTY_BOX, 200, { label: `${e.EMPTY_LABELS[k]} · ${k}` }));
}, 226);

family('logo-abas-extras', 'Logo (símbolo 160/48/24, horizontal 320), aba Correr, sequência (3 estados), tutorial (3 cards) e fundos das abas', 6, () => {
  const lg = art('logo/logo-art.ts');
  const t = art('tab-icon/run-tab-art.ts');
  const s = art('streak/streak-art.ts');
  const tu = art('tutorial/tutorial-art.ts');
  const bg = art('backgrounds/background-art.ts');
  const out = [];
  for (const w of [160, 48, 24]) out.push(piece(lg.logoNodes('simbolo'), lg.LOGO_BOX.simbolo, w, { label: `símbolo · ${w}` }));
  out.push(piece(lg.logoNodes('horizontal'), lg.LOGO_BOX.horizontal, 320, { label: 'horizontal · 320' }));
  for (const v of t.RUN_TAB_VARIANTS) out.push(piece(t.runTabNodes(v), t.RUN_TAB_BOX, 84, { label: `aba Correr · ${v} (3×)`, quality: 'plano' }));
  for (const st of s.STREAK_STATES) out.push(piece(s.streakNodes(st), s.STREAK_BOX, 120, { label: `sequência · ${st}` }));
  for (const step of tu.TUTORIAL_STEPS) out.push(piece(tu.tutorialNodes(step, ART.team.striders, ART.team.coyotes, 'circulo'), tu.TUTORIAL_BOX, 200, { label: `tutorial · ${step}` }));
  for (const k of bg.TAB_BACKGROUND_KINDS) out.push(piece(bg.backgroundNodes(k, 'owls'), bg.BACKGROUND_BOX, 110, { quality: 'plano', bg: ART.bg, label: `fundo ${k} · 100% (real: ${Math.round(bg.BACKGROUND_OPACITY[k] * 100)}%)` }));
  return out;
}, 226);

// ---------------------------------------------------------------- selo antigo (team-badge.tsx) reproduzido 1:1
function glyphSvg(shape, size, color) {
  const c = size / 2;
  const r = size * 0.2;
  switch (shape) {
    case 'circulo':
      return `<circle cx="${c}" cy="${c}" r="${r}" fill="${color}"/>`;
    case 'triangulo':
      return `<polygon points="${c},${c - r * 1.15} ${c + r * 1.1},${c + r * 0.8} ${c - r * 1.1},${c + r * 0.8}" fill="${color}"/>`;
    case 'losango':
      return `<polygon points="${c},${c - r * 1.25} ${c + r * 1.05},${c} ${c},${c + r * 1.25} ${c - r * 1.05},${c}" fill="${color}"/>`;
    case 'quadrado':
      return `<rect x="${c - r * 0.9}" y="${c - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="${r * 0.25}" fill="${color}"/>`;
  }
}
/** `TeamBadge` de `components/team-badge.tsx`, com os mesmos números. */
function oldBadge(team, size, attack) {
  const c = size / 2;
  const ring = attack ? Math.max(2, size * 0.06) : 0;
  const r = c - ring * 1.6;
  const f = team ? { color: SOLID[team], shape: SHAPE[team] } : null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="display:block">${
    attack ? `<circle cx="${c}" cy="${c}" r="${c - ring / 2}" fill="none" stroke="#FF4D45" stroke-width="${ring}" stroke-dasharray="${ring * 2} ${ring * 1.5}"/>` : ''
  }<circle cx="${c}" cy="${c}" r="${r}" fill="${f ? f.color : '#1A1B20'}" stroke="${f ? '#FFFFFF' : '#6E6C68'}" stroke-width="${f ? 1.5 : 1.2}"${f ? '' : ' stroke-dasharray="3 3"'}/>${f ? glyphSvg(f.shape, size, '#FFFFFF') : ''}</svg>`;
}
/** `TeamBadge` e `TeamPill` de `features/social/card/card-parts.tsx` (dentro do SVG do card 1080 × 1920). */
function cardGlyph(shape, cx, cy, r, fill) {
  switch (shape) {
    case 'circulo':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
    case 'triangulo':
      return `<polygon points="${cx},${cy - r * 1.15} ${cx + r * 1.1},${cy + r * 0.8} ${cx - r * 1.1},${cy + r * 0.8}" fill="${fill}"/>`;
    case 'losango':
      return `<polygon points="${cx},${cy - r * 1.25} ${cx + r * 1.05},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.05},${cy}" fill="${fill}"/>`;
    case 'quadrado':
      return `<rect x="${cx - r * 0.9}" y="${cy - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="${r * 0.25}" fill="${fill}"/>`;
  }
}
function cardBadge(team, cx, cy, r) {
  const color = ART.team[team];
  return `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${color}" opacity="0.12"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${ART.bg}" stroke="${color}" stroke-width="${Math.max(3, r * 0.12)}"/>${cardGlyph(SHAPE[team], cx, cy, r * 0.46, color)}`;
}
function cardPill(team, right, cy, scale = 1) {
  const color = ART.team[team];
  const size = 28 * scale;
  const ls = 3 * scale;
  const label = NAMES[team].toUpperCase();
  const h = 64 * scale;
  const w = label.length * size * 0.62 + ls * label.length + 96 * scale;
  const x = right - w;
  return `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${ART.bg}"/><rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-opacity="0.7" stroke-width="2"/>${cardGlyph(SHAPE[team], x + 34 * scale, cy, 11 * scale, color)}<text x="${x + 60 * scale}" y="${cy + size * 0.36}" font-family="Arial" font-weight="800" font-size="${size}" letter-spacing="${ls}" fill="${ART.ink}">${label}</text>`;
}
const html = (label, inner, w) => ({ label, html: `<div class="art" style="width:${w}px;line-height:normal">${inner}</div>` });

family('selo-antigo', 'Selo antigo (team-badge.tsx) · 4 times + neutro + sob ataque · 16, 20, 22, 28, 34, 44, 56 pt · e o selo/pílula do card (card-parts.tsx)', 7, () => {
  const out = [];
  for (const team of [...TEAMS, null]) for (const w of [16, 20, 22, 28, 34, 44, 56]) out.push(html(`${team ?? 'neutro'} · ${w}`, oldBadge(team, w, false), w));
  for (const w of [16, 20, 22, 28, 34, 44, 56]) out.push(html(`striders sob ataque · ${w}`, oldBadge('striders', w, true), w));
  for (const team of TEAMS) out.push(html(`card · TeamBadge r=60`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="110"><rect width="200" height="200" fill="${ART.bg}"/>${cardBadge(team, 100, 100, 60)}</svg>`, 110));
  for (const team of TEAMS) out.push(html(`card · TeamPill`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 100" width="200"><rect width="440" height="100" fill="${ART.bg}"/>${cardPill(team, 430, 50, 1)}</svg>`, 200));
  return out;
}, 110);

// ---------------------------------------------------------------- selo antigo em contexto (mocks com as medidas das telas)
function ctx(label, body, w = 300) {
  return { label, html: `<div class="art" style="width:${w}px;line-height:normal;font-family:Inter,Arial;color:${ART.ink}">${body}</div>` };
}
const row = (left, text, sub, right = '') =>
  `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#0F1013;border-radius:14px;margin-bottom:8px">${left}<div style="flex:1"><div style="font:700 15px Arial">${text}</div>${sub ? `<div style="font:12px Arial;color:${ART.ink2}">${sub}</div>` : ''}</div>${right}</div>`;
family('selo-antigo-contexto', 'Selo antigo em contexto · cabeçalho do Mapa (34), barra da zona (16), feed (20/24), pódio do Clube (40/32), lista da crew (22), resumo (30), trocar de time (44)', 3, () => {
  const out = [];
  out.push(ctx('Mapa · chip do time (34) e marcador', `${row(oldBadge('striders', 34), 'Neon Striders', '47 zonas em Goiânia · demonstração')}<div style="position:relative;height:120px;background:#121a22;border-radius:14px;overflow:hidden"><div style="position:absolute;left:40px;top:30px">${oldBadge('coyotes', 34, true)}</div><div style="position:absolute;left:160px;top:60px">${oldBadge('volt', 34)}</div><div style="position:absolute;left:230px;top:20px">${oldBadge(null, 34)}</div></div>`));
  out.push(ctx('Zona · barra de disputa (16) e dono sob ataque (16)', `<div style="display:flex;justify-content:space-between;font:700 15px Arial;margin-bottom:6px"><span style="display:flex;gap:6px;align-items:center">${oldBadge('striders', 16)} Striders 13</span><span style="display:flex;gap:6px;align-items:center">12 Coyotes ${oldBadge('coyotes', 16)}</span></div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden"><div style="flex:13;background:#0072B2"></div><div style="flex:12;background:#D9B200"></div></div><div style="margin-top:14px;display:flex;align-items:center;gap:6px;font:13px Arial;color:${ART.ink2}">${oldBadge('striders', 16, true)} Dos Neon Striders · sob ataque</div>${row(oldBadge('owls', 20), 'ana.demo', '3 corridas aqui')}`));
  out.push(ctx('Feed (20) · crew (22/24)', `${row(oldBadge('striders', 20), 'ana.demo · Hoje', '')}${row(oldBadge('volt', 24), 'teo.demo', 'Corrida de 5,2 km')}${row(oldBadge('coyotes', 22), 'bento.demo', 'membro')}`));
  out.push(ctx('Clube · ranking de times (22) e pódio (40 / 32)', `<div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;height:150px;padding:10px;background:#0F1013;border-radius:14px"><div style="text-align:center"><div style="display:flex;justify-content:center">${oldBadge('coyotes', 32)}</div><div style="width:60px;height:50px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${oldBadge('striders', 40)}</div><div style="width:60px;height:80px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div><div style="text-align:center"><div style="display:flex;justify-content:center">${oldBadge('volt', 32)}</div><div style="width:60px;height:36px;background:#1A1B20;margin-top:6px;border-radius:8px 8px 0 0"></div></div></div>${row(oldBadge('owls', 22), '4º Night Owls', '312 zonas')}`));
  out.push(ctx('Resumo · zonas conquistadas (30) · time (32)', `${row(oldBadge('striders', 32), 'Você correu pelos Neon Striders', '+176 pontos')}${row(oldBadge('striders', 30), 'Shopping Flamboyant', 'era dos Urban Coyotes', oldBadge('coyotes', 20))}${row(oldBadge(null, 30), 'Setor Bueno', 'neutra')}`));
  out.push(ctx('Perfil · trocar de time (44) e cabeçalho (64)', `${row(oldBadge('coyotes', 44), 'Urban Coyotes', 'Correm em matilha')}${row(oldBadge('owls', 44), 'Night Owls', 'Donos das luzes da cidade')}${row(oldBadge('volt', 64), 'maria.demo', 'Volt Runners')}`));
  return out;
}, 330);

function page(name) {
  const f = FAMILIES[name];
  const cells = f
    .build()
    .map((p) => `<figure>${p.html}<figcaption>${p.label}</figcaption></figure>`)
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${ART.bg};color:${ART.ink};font-family:Inter,Arial,sans-serif;padding:28px 32px;width:${f.cols * f.cell}px}
  h1{font:800 13px Arial;letter-spacing:2.4px;color:${ART.orange};margin:0 0 14px;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(${f.cols},1fr);gap:12px}
  figure{margin:0;background:#0B0C0F;border:1px solid #1B1C21;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
  .art{position:relative;line-height:0} .art svg{display:block}
  figcaption{font-size:11px;color:${ART.ink2};text-align:center;margin-top:6px}
  </style><h1>NOMADE RUN · F8 · ATUAL · ${f.title}</h1><div class="grid">${cells}</div>`;
}

module.exports = { FAMILIES, page, oldBadge };

if (require.main === module) {
  (async () => {
    const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const ctxb = await browser.newContext({ deviceScaleFactor: 1 });
    const tab = await ctxb.newPage();
    for (const name of names) {
      await tab.setContent(page(name));
      const file = path.join(OUT, `${name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      try {
        execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
      } catch {
        // sem pngquant ou sem ganho
      }
      console.log('ok', name);
    }
    await browser.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
