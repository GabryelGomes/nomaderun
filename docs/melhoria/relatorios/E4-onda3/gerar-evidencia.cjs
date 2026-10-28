// Evidência da E4 (onda 3): renderiza em PNG as famílias novas de `apps/mobile/src/components/art/` com os
// MESMOS módulos de geometria e a mesma expansão em camadas dos componentes (`neon/core.ts`). Reaproveita o
// carregador de .ts e os auxiliares `piece`/`stack` do gerador da onda 2.
//
// Uso (na raiz do repositório):
//   NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda3/gerar-evidencia.cjs [familia...]
// Saída: docs/melhoria/relatorios/E4-onda3/<familia>.png (o script chama o pngquant --quality=85-98 se existir).
// OUT_DIR=<pasta> troca a saída (rascunhos de revisão).
const path = require('path');
const { execFileSync } = require('child_process');
const { art, piece, stack, ART, TEAMS } = require('../E4-onda2/gerar-evidencia.cjs');

const OUT = process.env.OUT_DIR || __dirname;
const FAMILIES = {};
function family(name, title, cols, build, cell = 214) {
  FAMILIES[name] = { title, cols, build, cell };
}

// ---------------------------------------------------------------- sequência: chama e gelo
family(
  'sequencia',
  'Sequência · chama acesa (semana garantida), fraca (falta 1 atividade) e gelo (congelamento usado) · 200, 96, 56 e 32 pt',
  6,
  () => {
    const s = art('streak/streak-art.ts');
    const out = [];
    for (const st of s.STREAK_STATES) {
      out.push(piece(s.streakNodes(st), s.STREAK_BOX, 200, { label: `${s.STREAK_LABELS[st]} · 200 pt` }));
      for (const w of [96, 56, 32]) {
        const p = piece(s.streakNodes(st), s.STREAK_BOX, w, {});
        out.push({ ...p, label: `${w} pt · ${p.q}` });
      }
      out.push(piece(s.streakNodes(st), s.STREAK_BOX, 96, { label: `sobre o card`, bg: '#0F1013' }));
      out.push(piece(s.streakNodes(st), s.STREAK_BOX, 96, { label: 'plano · 96 pt', quality: 'plano' }));
    }
    return out;
  },
  176,
);

family(
  'sequencia-camadas',
  'Sequência · camadas para a E5 (layer="chama" e layer="gelo") e o StreakFlame da E5 montado (chama por baixo, gelo por cima)',
  5,
  () => {
    const s = art('streak/streak-art.ts');
    const out = [];
    out.push(piece(s.streakLayerNodes('gelo', 'chama'), s.STREAK_BOX, 170, { label: 'gelo · layer="chama"' }));
    out.push(piece(s.streakLayerNodes('gelo', 'gelo'), s.STREAK_BOX, 170, { label: 'gelo · layer="gelo"' }));
    out.push(stack([{ nodes: s.streakNodes('acesa') }, { nodes: s.streakLayerNodes('gelo', 'gelo') }], s.STREAK_BOX, 170, 'acesa + gelo por cima'));
    out.push(stack([{ nodes: s.streakLayerNodes('gelo', 'chama') }, { nodes: s.streakLayerNodes('gelo', 'gelo') }], s.STREAK_BOX, 170, 'chama congelada + gelo = state="gelo"'));
    out.push(piece(s.streakNodes('gelo'), s.STREAK_BOX, 170, { label: 'state="gelo" (inteiro)' }));
    for (const st of ['acesa', 'fraca']) {
      for (const f of [0, 1]) {
        const parts = s.streakParts(st);
        const nodes = [...parts.fundo, ...(f ? [art('neon/core.ts').pivot(parts.chama, { ...s.STREAK_PIVOTS.chama, scale: 1.06 })] : parts.chama), ...parts.gelo, ...parts.brilho];
        out.push(piece(nodes, s.STREAK_BOX, 120, { label: `${s.STREAK_LABELS[st]} · quadro ${f ? 'alto' : 'baixo'} do "parado"` }));
      }
    }
    return out;
  },
  204,
);

// ---------------------------------------------------------------- estados vazios novos
family(
  'vazios',
  'Estados vazios novos · sem medalhas (revisto), sem liga, sem chefão na semana, feed vazio, volte amanhã e sem endereço (zonas de privacidade) · 300 pt',
  3,
  () => {
    const e = art('empty/empty-art.ts');
    const out = [];
    for (const k of ['sem-medalhas', 'sem-liga', 'sem-chefao', 'feed-vazio', 'volte-amanha', 'sem-endereco']) out.push(piece(e.emptyNodes(k, ART.orange, 'owls'), e.EMPTY_BOX, 300, { label: `${e.EMPTY_LABELS[k]} · ${k}` }));
    out.push(piece(e.emptyNodes('volte-amanha', ART.orange, 'coyotes'), e.EMPTY_BOX, 300, { label: 'volte amanhã · com o Faro (Coyotes)' }));
    return out;
  },
  324,
);

family(
  'vazios-tamanhos',
  'Estados vazios novos · tamanho real (160 e 120 pt) e os 4 times onde o mascote aparece',
  5,
  () => {
    const e = art('empty/empty-art.ts');
    const out = [];
    for (const k of ['sem-medalhas', 'sem-liga', 'sem-chefao', 'feed-vazio', 'volte-amanha', 'sem-endereco']) out.push(piece(e.emptyNodes(k, ART.orange, 'striders'), e.EMPTY_BOX, 160, { label: `${e.EMPTY_LABELS[k]} · 160 pt` }));
    for (const k of ['sem-medalhas', 'sem-liga', 'sem-chefao', 'feed-vazio', 'volte-amanha', 'sem-endereco']) out.push(piece(e.emptyNodes(k, ART.orange, 'volt'), e.EMPTY_BOX, 120, { label: `120 pt` }));
    for (const t of TEAMS) out.push(piece(e.emptyNodes('volte-amanha', ART.orange, t), e.EMPTY_BOX, 160, { label: `volte amanhã · ${t}` }));
    out.push(piece(e.emptyNodes('feed-vazio', ART.orange, 'coyotes'), e.EMPTY_BOX, 160, { label: 'feed vazio · coyotes' }));
    return out;
  },
  184,
);

// ---------------------------------------------------------------- ícone da aba Correr
family(
  'aba-correr',
  'Ícone da aba Correr · padrão (contorno) e selecionado (cheio), sempre laranja · ampliado e em 1×, 2× e 3× (28, 56 e 84 px)',
  4,
  () => {
    const t = art('tab-icon/run-tab-art.ts');
    const out = [];
    for (const v of t.RUN_TAB_VARIANTS) {
      out.push(piece(t.runTabNodes(v), t.RUN_TAB_BOX, 168, { label: `${v} · ampliado`, quality: 'plano' }));
      for (const w of [28, 56, 84]) out.push(piece(t.runTabNodes(v), t.RUN_TAB_BOX, w, { label: `${v} · ${w} px`, quality: 'plano' }));
    }
    return out;
  },
  200,
);

// ---------------------------------------------------------------- baú raro: conferência de cor
family(
  'bau-raro-cor',
  'Baú raro · conferência de cor contra os 4 times e o violeta dos vilões (números ΔE2000 no relatório)',
  4,
  () => {
    const c = art('chest/chest-art.ts');
    const out = [];
    for (const r of c.CHEST_RARITIES) out.push(piece(c.chestNodes(r, 'fechado'), c.CHEST_BOX, 160, { label: `${c.CHEST_LABELS[r]} · fechado` }));
    out.push(piece(c.chestNodes('raro', 'aberto'), c.CHEST_BOX, 160, { label: 'raro · aberto' }));
    return out;
  },
  190,
);

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
  </style><h1>NOMADE RUN · E4 · ${f.title}</h1><div class="grid">${cells}</div>`;
}

module.exports = { FAMILIES, page };

if (require.main === module) {
  (async () => {
    const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    for (const name of names) {
      await tab.setContent(page(name));
      const file = path.join(OUT, `${name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      try {
        execFileSync('pngquant', ['--quality=85-98', '--force', '--ext', '.png', '--skip-if-larger', file]);
      } catch {
        // sem pngquant ou sem ganho: fica o original
      }
      console.log('ok', name);
    }
    await browser.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
