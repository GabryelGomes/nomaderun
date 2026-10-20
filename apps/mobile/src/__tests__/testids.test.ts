/**
 * @jest-environment node
 *
 * T4.3 (A5) — RNF-012/RNF-011 por análise estática (AST do TypeScript):
 *  1. todo elemento interativo (Pressable, Touchable*, TextInput, Switch, Button, IconButton, HoldButton) tem
 *     `testID` e descrição para leitor de tela; os que faltam hoje estão na lista BASELINE (docs/QA.md) e um novo
 *     elemento sem testID derruba o teste;
 *  2. todo `id` e texto usados nos fluxos Maestro (`.maestro/`) existem no código.
 * `NOMADE_TESTID_REPORT=1 npx jest testids` imprime o relatório completo.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const MAESTRO = join(ROOT, '.maestro');

const INTERACTIVE = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TextInput', 'Switch', 'Button', 'IconButton', 'HoldButton']);
/** Componentes cuja prop obrigatória `label` vira o accessibilityLabel. */
const LABEL_IS_A11Y = new Set(['Button', 'IconButton', 'HoldButton']);

/**
 * Elementos interativos sem testID no momento da revisão (arquivo:Tag, uma entrada por ocorrência).
 * Corrigir = apagar daqui. Não acrescente entradas: dê um testID ao elemento novo.
 */
const BASELINE_MISSING_TESTID: string[] = []; // QA-13 corrigido (A3): lista vazia
/** Sem accessibilityLabel explícito (o leitor de tela lê o texto filho, mas sem descrição fixa). */
const BASELINE_MISSING_A11Y: string[] = []; // filtros de camada ganharam accessibilityLabel (QA-13)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

type Found = { file: string; line: number; tag: string; hasTestId: boolean; hasA11y: boolean };
const literals = new Set<string>();
const templates: RegExp[] = [];
const samples: string[] = [];
const texts: string[] = [];
const elements: Found[] = [];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function collectIds(expr: ts.Node | undefined) {
  if (!expr) return;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) literals.add(expr.text);
  else if (ts.isJsxExpression(expr)) collectIds(expr.expression);
  else if (ts.isParenthesizedExpression(expr)) collectIds(expr.expression);
  else if (ts.isConditionalExpression(expr)) {
    collectIds(expr.whenTrue);
    collectIds(expr.whenFalse);
  } else if (ts.isBinaryExpression(expr)) {
    collectIds(expr.left);
    collectIds(expr.right);
  } else if (ts.isTemplateExpression(expr)) {
    const parts = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)];
    templates.push(new RegExp(`^${parts.map(esc).join('.+')}$`));
    samples.push(parts.join('X'));
  }
}

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/');
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'testID') collectIds(node.initializer);
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'testID') collectIds(node.initializer);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
    if (ts.isTemplateExpression(node)) texts.push([node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('X'));
    if (ts.isJsxText(node) && node.text.trim()) texts.push(node.text.trim());
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf).split('.').pop()!;
      if (INTERACTIVE.has(tag)) {
        const attrs = node.attributes.properties;
        const has = (n: string) => attrs.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === n);
        const spread = attrs.some((a) => ts.isJsxSpreadAttribute(a));
        elements.push({
          file: rel,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          tag,
          hasTestId: has('testID') || spread,
          hasA11y: has('accessibilityLabel') || has('aria-label') || spread || (LABEL_IS_A11Y.has(tag) && has('label')),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const missingTestId = elements.filter((e) => !e.hasTestId);
const missingA11y = elements.filter((e) => !e.hasA11y);

if (process.env.NOMADE_TESTID_REPORT === '1') {
  console.log(
    [
      `Elementos interativos: ${elements.length} · sem testID: ${missingTestId.length} · sem descrição para leitor de tela: ${missingA11y.length}`,
      ...missingTestId.map((e) => `  sem testID: ${e.file}:${e.line} <${e.tag}>`),
      ...missingA11y.map((e) => `  sem accessibilityLabel: ${e.file}:${e.line} <${e.tag}>`),
    ].join('\n'),
  );
}

describe('RNF-012 — testID em todo elemento interativo', () => {
  it('encontrou os elementos interativos das telas', () => {
    expect(elements.length).toBeGreaterThan(100);
    expect(literals.size).toBeGreaterThan(150);
  });

  it('nenhum elemento interativo novo sem testID (os antigos estão na BASELINE, ver docs/QA.md)', () => {
    const baseline = [...BASELINE_MISSING_TESTID];
    const unexpected: string[] = [];
    for (const e of missingTestId) {
      const i = baseline.indexOf(`${e.file}:${e.tag}`);
      if (i >= 0) baseline.splice(i, 1);
      else unexpected.push(`${e.file}:${e.line} <${e.tag}>`);
    }
    expect(unexpected).toEqual([]);
  });

  it('RNF-011: todo elemento interativo novo tem descrição para leitor de tela', () => {
    const baseline = [...BASELINE_MISSING_A11Y];
    const unexpected: string[] = [];
    for (const e of missingA11y) {
      const i = baseline.indexOf(`${e.file}:${e.tag}`);
      if (i >= 0) baseline.splice(i, 1);
      else unexpected.push(`${e.file}:${e.line} <${e.tag}>`);
    }
    expect(unexpected).toEqual([]);
  });
});

/* ---------- fluxos Maestro ---------- */
type Selector = { file: string; kind: 'id' | 'text'; value: string; optional: boolean };

function maestroSelectors(): Selector[] {
  const out: Selector[] = [];
  const files: string[] = [];
  const walkYaml = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walkYaml(p);
      else if (n.endsWith('.yaml') && n !== 'config.yaml') files.push(p);
    }
  };
  walkYaml(MAESTRO);
  for (const file of files) {
    const body = readFileSync(file, 'utf8').split('---').slice(1).join('---');
    // um comando = linha "- " na coluna 0 e as linhas indentadas que seguem
    const commands = body.split(/\n(?=- )/);
    for (const cmd of commands) {
      const optional = /optional:\s*true/.test(cmd);
      for (const m of cmd.matchAll(/\bid:\s*"([^"]+)"/g)) out.push({ file: relative(ROOT, file), kind: 'id', value: m[1], optional });
      for (const m of cmd.matchAll(/\btext:\s*"([^"]+)"/g)) out.push({ file: relative(ROOT, file), kind: 'text', value: m[1], optional });
      const short = /^- (?:tapOn|longPressOn|assertVisible|assertNotVisible):\s*"([^"]+)"\s*$/m.exec(cmd);
      if (short) out.push({ file: relative(ROOT, file), kind: 'text', value: short[1], optional });
    }
  }
  return out;
}

function idExists(pattern: string): boolean {
  // Maestro trata o id como regex (com alternativas "a|b")
  return pattern.split('|').every((alt) => {
    const re = new RegExp(`^${alt}$`);
    return [...literals].some((l) => re.test(l)) || samples.some((s) => re.test(s)) || templates.some((t) => t.test(alt));
  });
}

function textExists(pattern: string): boolean {
  const re = new RegExp(`^${pattern}$`);
  return texts.some((t) => re.test(t) || t === pattern);
}

describe('RNF-012 — fluxos Maestro usam testIDs e textos que existem no app', () => {
  const selectors = maestroSelectors();

  it('há fluxos para cadastro/login e UC-01, UC-02, UC-03', () => {
    const files = new Set(selectors.map((s) => s.file));
    for (const f of ['01-cadastro-onboarding', '02-login', '03-uc03', '04-uc02', '05-uc01']) {
      expect([...files].some((x) => x.includes(f))).toBe(true);
    }
  });

  it('todo id referenciado existe no código', () => {
    const missing = selectors.filter((s) => s.kind === 'id' && !idExists(s.value)).map((s) => `${s.file}: ${s.value}`);
    expect(missing).toEqual([]);
  });

  it('todo texto obrigatório referenciado existe no código (diálogos do sistema são opcionais)', () => {
    const missing = selectors.filter((s) => s.kind === 'text' && !s.optional && !textExists(s.value)).map((s) => `${s.file}: ${s.value}`);
    expect(missing).toEqual([]);
  });
});
