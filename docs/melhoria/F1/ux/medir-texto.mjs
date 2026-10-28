#!/usr/bin/env node
/**
 * NOMADE RUN — régua de texto por tela (Reformulação v2, E6 UX).
 *
 * Análise estática dos .tsx de `apps/mobile/src/app` e `apps/mobile/src/features`:
 * conta as palavras que aparecem na tela (textos de <Text>, atributos visíveis como
 * `label`, `title`, `body`, `help`, `placeholder`, e as listas de dados da tela, como
 * os cards da Arena), os blocos de texto longos (> 90 caracteres ou mais de 1 frase)
 * e os elementos visuais (mapa, ilustração, número grande, gráfico, emblema, ícone).
 *
 * Sem dependência nova: usa o `typescript` que o app já tem em `apps/mobile/node_modules`.
 *
 * Uso (na raiz do repositório):
 *   node docs/melhoria/F1/ux/medir-texto.mjs                 # tabela em Markdown
 *   node docs/melhoria/F1/ux/medir-texto.mjs --json          # JSON
 *   node docs/melhoria/F1/ux/medir-texto.mjs --salvar antes  # grava medicao-antes.json/.md
 *   node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes # antes × agora, com a meta
 *
 * Como ler o número:
 *   - "palavras" soma TODOS os estados que o código pode mostrar (carregando, vazio, erro,
 *     ternários pelo ramo mais longo). É um teto, e por isso é estável para comparar
 *     antes/depois. O estado principal visto na captura costuma ter de 40% a 70% disso
 *     (ver a tabela "na captura" do relatório 06-ux.md).
 *   - Valores dinâmicos (nome, número, zona) não contam como palavra.
 *   - Só contam palavras com letras ("2.312" não conta; "km" conta).
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const MOBILE = join(ROOT, 'apps', 'mobile');
const SRC = join(MOBILE, 'src');
const require = createRequire(join(MOBILE, 'package.json'));
const ts = require('typescript');

/** Atributos JSX cujo valor aparece na tela. */
const VISIBLE_ATTR = new Set(['title', 'body', 'label', 'placeholder', 'help', 'subtitle', 'text', 'message', 'format', 'unit', 'options', 'hint']);
/** Componentes que valem como "elemento visual" (o que NÃO é texto). */
const VISUAL = {
  mapa: ['TerritoryMap'],
  // E6a (onda 2): + as peças da E4 (`components/art`) e a arte feita com as primitivas dela (`StaticArt`).
  ilustracao: ['CaptureCelebration', 'NeonBackdrop', 'HeroWordmark', 'NeonBadges', 'Svg', 'Image', 'Mascot', 'Boss', 'Chest', 'Medal', 'TutorialArt', 'EmptyArt', 'TeamEmblem', 'StaticArt'],
  numeroGrande: ['CountUp', 'TickerText', 'StatCount', 'Metric', 'Countdown'],
  grafico: ['GrowBar', 'ProgressBar', 'InfluenceBar', 'GrowPillar', 'Podium', 'LineChart', 'StepProgress', 'StrengthMeter'],
  emblema: ['TeamBadge'],
  icone: ['Icon', 'IconButton'],
};
const LIMITE_BLOCO = 90;
/** Meta padrão por tipo (seções 4 e 20 do prompt); telas com textos de segurança ou formulário têm `meta` própria. */
const META = { jogo: 45, conta: 80, informativa: Infinity };

/**
 * Cada tela = rota → arquivos (e, opcionalmente, só algumas funções ou um bloco condicional).
 * `tipo` define a meta: jogo (abas e fluxo de corrida), conta (formulários) ou informativa (termos).
 */
const SCREENS = [
  { rota: '(auth)/entrar', tipo: 'conta', partes: [['features/auth/sign-in-screen.tsx'], ['features/auth/neon-badges.tsx']] },
  { rota: '(auth)/cadastro', tipo: 'conta', partes: [['features/auth/sign-up-screen.tsx']] },
  { rota: '(auth)/recuperar-senha', tipo: 'conta', partes: [['features/auth/forgot-password-screen.tsx']] },
  { rota: 'nova-senha', tipo: 'conta', partes: [['features/auth/new-password-screen.tsx']] },
  // E6a (onda 2, D-72): as boas-vindas viraram a 1ª tela do grupo (auth) e o onboarding foi para
  // `features/screens/onboarding/`. Os rótulos antigos continuam (para o --comparar antes); o passo de
  // notificações saiu da primeira abertura (vem depois da 1ª conquista).
  { rota: 'onboarding · 1 boas-vindas', tipo: 'jogo', partes: [['features/auth/welcome-screen.tsx'], ['features/auth/neon-badges.tsx']] },
  { rota: 'onboarding · 1b cidade dividida', tipo: 'jogo', partes: [['features/screens/onboarding/city-divided-step.tsx']], extra: 4 },
  { rota: 'onboarding · 2 time', tipo: 'jogo', partes: [['features/screens/onboarding/onboarding-screen.tsx', "cond:step === 'times'"]], extra: 3 + 12 },
  { rota: 'onboarding · 2b quiz', tipo: 'jogo', partes: [['features/screens/onboarding/team-quiz.tsx'], ['features/screens/onboarding/quiz.ts']] },
  { rota: 'onboarding · 2c confirmação', tipo: 'jogo', partes: [['components/celebration/team-confirm.tsx']], extra: 4 },
  { rota: 'onboarding · 3 localização', tipo: 'jogo', partes: [['features/screens/onboarding/onboarding-screen.tsx', 'LocationStep']] },
  { rota: 'onboarding · nome (só login social sem nome)', tipo: 'jogo', partes: [['features/screens/onboarding/onboarding-screen.tsx', "cond:step === 'nome'"]] },
  { rota: 'mapa · missão de boas-vindas', tipo: 'jogo', meta: 25, partes: [['features/screens/onboarding/welcome-mission-card.tsx'], ['features/screens/onboarding/welcome-mission.ts']] },
  { rota: '(tabs)/correr', tipo: 'jogo', partes: [['components/app-tabs-correr.tsx']] },
  { rota: 'atividades → perfil/atividades (redireciona)', tipo: 'informativa', partes: [['components/app-tabs-redirect.tsx']] },
  { rota: '(tabs)/index · Mapa', tipo: 'jogo', partes: [['features/screens/map-screen.tsx', 'MapScreen'], ['features/screens/map-layer-chips.tsx']] },
  { rota: 'corrida · preparação', tipo: 'jogo', partes: [['features/screens/run-screen.tsx', 'RunScreen']] },
  { rota: 'corrida · GPS', tipo: 'jogo', partes: [['features/screens/run-screen.tsx', 'GpsPreflight']] },
  { rota: 'corrida · contagem', tipo: 'jogo', partes: [['features/screens/run-screen.tsx', 'Countdown']] },
  { rota: 'corrida · ativa', tipo: 'jogo', meta: 90, partes: [['features/screens/run-screen.tsx', 'ActiveRun', 'Metric']] },
  { rota: 'resumo', tipo: 'jogo', meta: 60, partes: [['features/screens/summary-screen.tsx']] }, // capture-celebration.tsx saiu (T7.3.2): estava sem uso
  { rota: 'zona/[id]', tipo: 'jogo', meta: 50, partes: [['features/screens/zone-sheet.tsx']] },
  { rota: '(tabs)/arena', tipo: 'jogo', partes: [['features/screens/arena-screen.tsx']] },
  { rota: '(tabs)/atividades', tipo: 'jogo', partes: [['features/screens/activities-screen.tsx'], ['features/run/history-model.ts']] },
  { rota: '(tabs)/clube', tipo: 'jogo', partes: [['features/screens/club-screen.tsx']], extra: 12 },
  { rota: '(tabs)/clube/crew', tipo: 'jogo', meta: 70, partes: [['features/screens/crew-screen.tsx']] },
  { rota: '(tabs)/perfil', tipo: 'jogo', partes: [['features/screens/profile-screen.tsx']] },
  { rota: '(tabs)/perfil/time', tipo: 'jogo', meta: 60, partes: [['features/screens/faction-screen.tsx']] },
  { rota: '(tabs)/perfil/editar', tipo: 'conta', partes: [['features/screens/edit-profile-screen.tsx']] },
  { rota: '(tabs)/perfil/conta', tipo: 'conta', partes: [['features/screens/account-screen.tsx']] },
  { rota: 'notificacoes', tipo: 'jogo', partes: [['features/notifications/notifications-screen.tsx']] },
  { rota: 'contatos-seguranca', tipo: 'conta', partes: [['features/safety/contacts-screen.tsx']] },
  { rota: 'zonas-privacidade', tipo: 'conta', partes: [['features/screens/privacy-zones-screen.tsx']] },
  { rota: 'indisponivel', tipo: 'conta', partes: [['features/auth/unavailable-screen.tsx']] },
  { rota: 'termos / privacidade', tipo: 'informativa', partes: [['features/auth/legal-screen.tsx']] },
  { rota: 'moderacao (lista)', tipo: 'conta', partes: [['features/moderation/moderation-list-screen.tsx']] },
  { rota: 'moderacao/[id]', tipo: 'conta', partes: [['features/moderation/moderation-detail-screen.tsx']] },
  { rota: 'moderacao/contas', tipo: 'conta', partes: [['features/moderation/admin-users-screen.tsx']] },
];

// ---------------------------------------------------------------- texto

const WORD = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
const countWords = (s) => (s.match(WORD) ?? []).filter((w) => /\p{L}/u.test(w)).length;
/** Uma string de dados parece texto de interface? (descarta chaves como 'meu-time', rotas e ícones). */
const looksLikeUi = (s) => /\p{L}/u.test(s) && !/^[/@#.]/.test(s) && !/^[a-z0-9_-]+$/.test(s.trim()) && !/^[A-Z_]+$/.test(s.trim()) && !/^(pt-BR|https?:)/.test(s);
const DYN = '•';
const sentences = (s) => s.split(/[.!?](?:\s+|$)(?=\p{Lu}|$)/u).filter((x) => countWords(x) > 0).length;

function tagName(node) {
  const n = ts.isJsxElement(node) ? node.openingElement.tagName : ts.isJsxSelfClosingElement(node) ? node.tagName : null;
  return n ? n.getText() : null;
}
const isTextTag = (name) => !!name && /(^|\.)(\w*Text)$/.test(name);

/** Texto representativo de uma expressão (ramo mais longo dos ternários); valores dinâmicos viram "•". */
function textOf(e) {
  if (!e) return '';
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => textOf(s.expression) + s.literal.text).join('');
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return textOf(e.expression);
  if (ts.isConditionalExpression(e)) {
    const a = textOf(e.whenTrue);
    const b = textOf(e.whenFalse);
    return countWords(a) >= countWords(b) ? a : b;
  }
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.PlusToken) return textOf(e.left) + textOf(e.right);
    if (k === ts.SyntaxKind.AmpersandAmpersandToken) return textOf(e.right);
    if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
      const a = textOf(e.left);
      const b = textOf(e.right);
      return countWords(a) >= countWords(b) ? a : b;
    }
    return DYN;
  }
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return ts.isBlock(e.body) ? '' : textOf(e.body);
  if (ts.isArrayLiteralExpression(e)) return e.elements.map((x) => uiStrings(x).join(' ')).join(' ');
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return '';
  return DYN;
}

/** Todas as strings "de interface" dentro de um nó (para listas de dados e `options`). */
function uiStrings(node) {
  const out = [];
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (looksLikeUi(n.text)) out.push(n.text);
    } else if (ts.isTemplateExpression(n)) {
      const t = textOf(n);
      if (looksLikeUi(t)) out.push(t);
      return;
    } else if (ts.isPropertyAssignment(n) && ['id', 'icon', 'kind', 'key', 'testID', 'accessibilityLabel'].includes(n.name.getText())) {
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** Junta o texto de um <Text> inteiro (com <Text> aninhados) numa "fatia". */
function gatherText(node, consumed) {
  let s = '';
  const visit = (n) => {
    consumed.add(n);
    if (ts.isJsxText(n)) s += n.text.replace(/\s+/g, ' ');
    else if (ts.isJsxExpression(n)) s += textOf(n.expression);
    else ts.forEachChild(n, visit);
  };
  if (ts.isJsxElement(node)) node.children.forEach(visit);
  return s.trim();
}

function analyzeNodes(roots, sf, refConsts) {
  const slots = [];
  const visual = Object.fromEntries(Object.keys(VISUAL).map((k) => [k, 0]));
  const consumed = new Set();
  const add = (text, where) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (countWords(t) === 0) return;
    slots.push({ text: t, words: countWords(t), line: sf.getLineAndCharacterOfPosition(where.getStart(sf)).line + 1 });
  };
  const visit = (n) => {
    if (consumed.has(n)) return;
    const name = tagName(n);
    if (name) {
      for (const [k, list] of Object.entries(VISUAL)) if (list.includes(name.split('.').pop())) visual[k]++;
      const attrs = (ts.isJsxElement(n) ? n.openingElement : n).attributes.properties;
      const hasChildren = ts.isJsxElement(n) && n.children.some((c) => (ts.isJsxText(c) && c.text.trim()) || ts.isJsxElement(c));
      for (const a of attrs) {
        if (!ts.isJsxAttribute(a) || !VISIBLE_ATTR.has(a.name.getText())) continue;
        if (a.name.getText() === 'label' && hasChildren) continue;
        const init = a.initializer;
        if (!init) continue;
        add(ts.isStringLiteral(init) ? init.text : ts.isJsxExpression(init) ? textOf(init.expression) : '', a);
      }
      if (isTextTag(name) && ts.isJsxElement(n)) {
        add(gatherText(n, consumed), n);
        return;
      }
    }
    if (ts.isJsxText(n) && n.text.trim()) add(n.text, n);
    if (ts.isJsxExpression(n) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)) && n.expression) {
      const t = textOf(n.expression);
      if (t && t !== DYN) add(t, n);
    }
    ts.forEachChild(n, visit);
  };
  roots.forEach(visit);
  for (const c of refConsts) for (const s of uiStrings(c)) add(s, c);
  return { slots, visual };
}

const fileCache = new Map();
function parse(rel) {
  if (!fileCache.has(rel)) {
    const abs = join(SRC, rel);
    fileCache.set(rel, ts.createSourceFile(abs, readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  }
  return fileCache.get(rel);
}

/** Raízes a analisar numa parte: arquivo todo, funções nomeadas ou um bloco `cond && (...)`. */
function rootsFor(sf, selectors) {
  if (selectors.length === 0) {
    const consts = sf.statements.filter((s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.initializer && (ts.isArrayLiteralExpression(d.initializer) || ts.isObjectLiteralExpression(d.initializer))));
    const rest = sf.statements.filter((s) => !consts.includes(s));
    // Arquivo .ts de apoio (ex.: rótulos de período): todas as strings de interface contam.
    if (!sf.fileName.endsWith('.tsx')) return { roots: [], consts: sf.statements };
    return { roots: rest, consts };
  }
  const roots = [];
  for (const sel of selectors) {
    if (sel.startsWith('cond:')) {
      const want = sel.slice(5);
      const visit = (n) => {
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && n.left.getText(sf) === want) roots.push(n.right);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    } else {
      const fn = sf.statements.find((s) => (ts.isFunctionDeclaration(s) && s.name?.text === sel) || (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(sf) === sel)));
      if (!fn) throw new Error(`Função ${sel} não encontrada em ${sf.fileName}`);
      roots.push(fn);
    }
  }
  // Constantes de dados do arquivo citadas pelas raízes (ex.: MODES, MISSIONS, LAYERS).
  const used = new Set();
  const collect = (n) => {
    if (ts.isIdentifier(n)) used.add(n.text);
    ts.forEachChild(n, collect);
  };
  roots.forEach(collect);
  const consts = sf.statements.filter(
    (s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => used.has(d.name.getText(sf)) && d.initializer && (ts.isArrayLiteralExpression(d.initializer) || ts.isObjectLiteralExpression(d.initializer))),
  );
  return { roots, consts };
}

function measure(screen) {
  const slots = [];
  const visual = Object.fromEntries(Object.keys(VISUAL).map((k) => [k, 0]));
  for (const [rel, ...selectors] of screen.partes) {
    const sf = parse(rel);
    const { roots, consts } = rootsFor(sf, selectors);
    const r = analyzeNodes(roots, sf, consts);
    r.slots.forEach((s) => slots.push({ ...s, file: rel }));
    for (const k of Object.keys(visual)) visual[k] += r.visual[k];
  }
  const words = slots.reduce((n, s) => n + s.words, 0) + (screen.extra ?? 0);
  const longos = slots.filter((s) => s.text.length > LIMITE_BLOCO || sentences(s.text) > 1);
  // "Imagem" = mapa ou ilustração de verdade (o que o dono sente falta). Número e barra contam à parte.
  const heroi = visual.mapa + visual.ilustracao > 0;
  return { rota: screen.rota, tipo: screen.tipo, palavras: words, blocos: slots.length, longos: longos.length, exemplosLongos: longos.slice(0, 3).map((s) => `${s.file}:${s.line}`), visual, heroi, meta: screen.meta ?? META[screen.tipo] };
}

// ---------------------------------------------------------------- cobertura das rotas

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
function routeCoverage() {
  const routes = walk(join(SRC, 'app')).filter((p) => p.endsWith('.tsx') && !p.endsWith('_layout.tsx'));
  const mapped = new Set(SCREENS.flatMap((s) => s.partes.map((p) => p[0])));
  const missing = [];
  for (const r of routes) {
    const src = readFileSync(r, 'utf8');
    const imp = src.match(/from '@\/([^']+)'/);
    const target = imp ? `${imp[1]}.tsx` : null;
    if (!target || !mapped.has(target)) missing.push(relative(SRC, r));
  }
  return { total: routes.length, missing };
}

// ---------------------------------------------------------------- saída

const visualCell = (v) =>
  [v.mapa && `mapa ${v.mapa}`, v.ilustracao && `ilustr. ${v.ilustracao}`, v.numeroGrande && `número ${v.numeroGrande}`, v.grafico && `gráfico ${v.grafico}`, v.emblema && `emblema ${v.emblema}`, v.icone && `ícone ${v.icone}`]
    .filter(Boolean)
    .join(', ') || '—';

function toMarkdown(rows, before) {
  const head = before
    ? '| Tela | Tipo | Palavras antes | Palavras agora | Δ | Meta | Blocos longos (antes → agora) | Imagem agora |\n|---|---|---:|---:|---:|---:|---|---|'
    : '| Tela | Tipo | Palavras (todos os estados) | Meta | Blocos longos | Imagem (mapa/ilustração)? | Elementos visuais | Exemplos de bloco longo |\n|---|---|---:|---:|---:|---|---|---|';
  const lines = rows.map((r) => {
    const meta = Number.isFinite(r.meta) ? r.meta : '—';
    if (before) {
      const b = before.find((x) => x.rota === r.rota);
      const delta = b ? r.palavras - b.palavras : 0;
      return `| ${r.rota} | ${r.tipo} | ${b?.palavras ?? '—'} | ${r.palavras} | ${delta > 0 ? '+' : ''}${delta} | ${meta} | ${b?.longos ?? '—'} → ${r.longos} | ${r.heroi ? 'sim' : 'não'} |`;
    }
    return `| ${r.rota} | ${r.tipo} | ${r.palavras} | ${meta} | ${r.longos} | ${r.heroi ? 'sim' : '**não**'} | ${visualCell(r.visual)} | ${r.exemplosLongos.join(', ') || '—'} |`;
  });
  const jogo = rows.filter((r) => r.tipo === 'jogo');
  const sum = (xs) => xs.reduce((n, r) => n + r.palavras, 0);
  const foot = `\n\nTelas de jogo: ${jogo.length} · palavras somadas ${sum(jogo)} · média ${Math.round(sum(jogo) / jogo.length)} · acima da meta ${jogo.filter((r) => r.palavras > r.meta).length} · sem imagem ${jogo.filter((r) => !r.heroi).length} · blocos longos ${jogo.reduce((n, r) => n + r.longos, 0)}`;
  return `${head}\n${lines.join('\n')}${foot}`;
}

const args = process.argv.slice(2);
const rows = SCREENS.map(measure);
const cov = routeCoverage();
const flag = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

if (args.includes('--json')) {
  console.log(JSON.stringify({ geradoEm: new Date().toISOString(), cobertura: cov, telas: rows }, null, 2));
} else if (flag('--salvar')) {
  const name = flag('--salvar');
  const json = join(HERE, `medicao-${name}.json`);
  writeFileSync(json, JSON.stringify({ geradoEm: new Date().toISOString(), cobertura: cov, telas: rows }, null, 2) + '\n');
  writeFileSync(join(HERE, `medicao-${name}.md`), `# Medição de texto — ${name}\n\nGerado por \`medir-texto.mjs\` em ${new Date().toISOString().slice(0, 10)}.\n\n${toMarkdown(rows)}\n`);
  console.log(`Gravado: ${relative(ROOT, json)} e .md`);
} else if (flag('--comparar')) {
  const file = join(HERE, `medicao-${flag('--comparar')}.json`);
  if (!existsSync(file)) throw new Error(`Não achei ${file}. Rode antes com --salvar ${flag('--comparar')}.`);
  console.log(toMarkdown(rows, JSON.parse(readFileSync(file, 'utf8')).telas));
} else {
  console.log(toMarkdown(rows));
}
if (cov.missing.length) console.error(`\nAtenção: rotas sem tela mapeada: ${cov.missing.join(', ')}`);
else if (!args.includes('--json')) console.log(`\nCobertura: ${cov.total}/${cov.total} arquivos de rota em src/app mapeados.`);
