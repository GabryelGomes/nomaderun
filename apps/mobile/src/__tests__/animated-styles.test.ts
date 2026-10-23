/**
 * @jest-environment node
 *
 * T7.2.10 (E10) — "só transform e opacidade" por análise estática (AST do TypeScript), regra da D-54 e do
 * guia de performance do React Native: animar `width`, `height`, `top`, `left` ou `margin*` refaz o layout a
 * cada quadro (cai de 60 fps no Android médio); `transform` e `opacity` rodam só na composição.
 *
 * Onde olha, em todo `src/` (menos `__tests__`):
 *  1. o objeto devolvido pelo `useAnimatedStyle(() => ...)` (corpo de expressão ou `return` do worklet);
 *  2. os quadros-chave das animações CSS do Reanimated 4 (`animationName`): objeto literal, constante do
 *     mesmo arquivo, chamada a `kf(...)`/função local que devolve os quadros;
 *  3. as transições CSS (`transitionProperty`): nome proibido, `'all'`, ou `transitionDuration` sem
 *     `transitionProperty` no mesmo objeto (o padrão do Reanimated é `'all'`, que anima também o layout).
 *
 * Exceção só com motivo, na lista abaixo (`arquivo:propriedade`, uma por ocorrência). Corrigir = apagar daqui.
 * `NOMADE_ANIM_REPORT=1 npx jest animated-styles` imprime o que foi encontrado.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const SRC = join(__dirname, '..');

/** Propriedades de layout que não podem ser animadas. */
const FORBIDDEN = new Set(['width', 'height', 'top', 'left']);
const isForbidden = (key: string) => FORBIDDEN.has(key) || /^margin/.test(key);

/**
 * Exceções justificadas (`arquivo:propriedade`, caminho relativo a `src/`), uma por ocorrência, com o motivo
 * e o dono ao lado. Corrigir = apagar daqui. Não acrescente entradas: anime `transform` (`scaleX` com
 * `transformOrigin`, `translateY`) ou `opacity`.
 * Na criação do teste (T7.2.10) o código antigo das telas tinha estas ocorrências; todas saem na onda 2.
 */
const BASELINE_LAYOUT_ANIMATIONS: string[] = [
  // GrowBar e InfluenceBar (barras que crescem): a E6b troca por `ProgressBar` (scaleX) na T7.2.7.
  'features/screens/game-motion.tsx:width',
  'features/screens/game-motion.tsx:width',
  // GrowPillar (pedestal do pódio): a E6b troca por `ProgressBar`/scaleY na T7.2.7.
  'features/screens/game-motion.tsx:height',
  // Contagem regressiva do Correr (barra de 40×4 px, quadros `from`/`to`): a E6b troca por scaleX na T7.2.7.
  'features/screens/run-screen.tsx:width',
  'features/screens/run-screen.tsx:width',
];

type Kind = 'useAnimatedStyle' | 'animationName' | 'transitionProperty';
type Hit = { file: string; line: number; kind: Kind; key: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const propName = (p: ts.ObjectLiteralElementLike, sf: ts.SourceFile): string | null => {
  if (ts.isShorthandPropertyAssignment(p)) return p.name.text;
  if (!ts.isPropertyAssignment(p) && !ts.isMethodDeclaration(p)) return null;
  const n = p.name;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  if (ts.isComputedPropertyName(n)) return null;
  return n.getText(sf);
};

const unwrap = (e: ts.Expression): ts.Expression => {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
  return x;
};

type Seen = { useAnimatedStyle: number; animationName: number; transitionProperty: number };

/** O detector: devolve as propriedades de layout animadas de um arquivo e conta os pontos de animação vistos. */
function scanSource(rel: string, text: string, seen: Seen): Hit[] {
  const hits: Hit[] = [];
  if (!/useAnimatedStyle|animationName|transition(Property|Duration)/.test(text)) return hits;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  /** Declarações de topo e locais (`const X = ...`, `function f() {}`) do arquivo, por nome. */
  const decls = new Map<string, ts.Node>();
  const collect = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) decls.set(n.name.text, n.initializer);
    if (ts.isFunctionDeclaration(n) && n.name && n.body) decls.set(n.name.text, n);
    ts.forEachChild(n, collect);
  };
  collect(sf);

  /** Cada propriedade conta uma vez, mesmo quando uma constante de quadros é usada em vários lugares. */
  const reported = new Set<ts.Node>();
  const report = (kind: Kind, key: string, at: ts.Node) => {
    if (reported.has(at)) return;
    reported.add(at);
    hits.push({ file: rel, line: lineOf(at), kind, key });
  };

  /** Chaves do objeto de estilo (sem descer em `transform: [...]`, que é permitido por definição). */
  const checkStyleObject = (obj: ts.ObjectLiteralExpression, kind: Kind) => {
    for (const p of obj.properties) {
      const k = propName(p, sf);
      if (k && isForbidden(k)) report(kind, k, p);
    }
  };

  /** Todos os objetos que uma expressão pode devolver (condicional, `&&`, `||`, `??`). */
  const objectsOf = (e: ts.Expression): ts.ObjectLiteralExpression[] => {
    const x = unwrap(e);
    if (ts.isObjectLiteralExpression(x)) return [x];
    if (ts.isConditionalExpression(x)) return [...objectsOf(x.whenTrue), ...objectsOf(x.whenFalse)];
    if (ts.isBinaryExpression(x)) return [...objectsOf(x.left), ...objectsOf(x.right)];
    return [];
  };

  /** `return` do próprio worklet (não desce em funções aninhadas). */
  const returnsOf = (body: ts.Node): ts.Expression[] => {
    const out: ts.Expression[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
      if (ts.isFunctionLike(n)) return;
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(body, visit);
    return out;
  };

  /** Quadros-chave: qualquer objeto dentro da expressão, seguindo constantes e funções locais. */
  const checkKeyframes = (e: ts.Node, depth = 0) => {
    if (depth > 4) return;
    const visit = (n: ts.Node) => {
      if (ts.isObjectLiteralExpression(n)) {
        for (const p of n.properties) {
          const k = propName(p, sf);
          if (k && isForbidden(k)) report('animationName', k, p);
        }
      }
      const p = n.parent;
      const isName = p && (ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p) || ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p)) && p.name === n;
      if (ts.isIdentifier(n) && decls.has(n.text) && !isName) {
        checkKeyframes(decls.get(n.text)!, depth + 1);
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(e);
  };

  const transitionNames = (e: ts.Expression): ts.StringLiteralLike[] => {
    const x = unwrap(e);
    if (ts.isStringLiteralLike(x)) return [x];
    if (ts.isArrayLiteralExpression(x)) return x.elements.flatMap((el) => transitionNames(el));
    if (ts.isConditionalExpression(x)) return [...transitionNames(x.whenTrue), ...transitionNames(x.whenFalse)];
    return [];
  };

  const visit = (n: ts.Node) => {
    // 1. useAnimatedStyle(() => ({ ... })) / useAnimatedStyle(() => { return { ... } })
    if (ts.isCallExpression(n) && unwrap(n.expression).getText(sf).split('.').pop() === 'useAnimatedStyle') {
      const fn = n.arguments[0];
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        seen.useAnimatedStyle += 1;
        const results = ts.isBlock(fn.body) ? returnsOf(fn.body) : [fn.body];
        for (const r of results) for (const obj of objectsOf(r)) checkStyleObject(obj, 'useAnimatedStyle');
      }
    }
    if (ts.isObjectLiteralExpression(n)) {
      const names = n.properties.map((p) => propName(p, sf));
      // 2. animationName: quadros-chave
      for (const p of n.properties) {
        if (ts.isPropertyAssignment(p) && propName(p, sf) === 'animationName') {
          seen.animationName += 1;
          checkKeyframes(p.initializer);
        }
        if (ts.isPropertyAssignment(p) && propName(p, sf) === 'transitionProperty') {
          seen.transitionProperty += 1;
          for (const s of transitionNames(p.initializer)) {
            if (s.text === 'all' || isForbidden(s.text)) report('transitionProperty', s.text, s);
          }
        }
      }
      // 3. transição sem `transitionProperty`: o padrão `'all'` anima também o layout.
      const spread = n.properties.some((p) => ts.isSpreadAssignment(p));
      if (names.includes('transitionDuration') && !names.includes('transitionProperty') && !spread) report('transitionProperty', 'all (padrão)', n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return hits;
}

const seen: Seen = { useAnimatedStyle: 0, animationName: 0, transitionProperty: 0 };
const hits: Hit[] = walk(SRC).flatMap((file) => scanSource(relative(SRC, file).split('\\').join('/'), readFileSync(file, 'utf8'), seen));

const id = (h: Hit) => `${h.file}:${h.key}`;

if (process.env.NOMADE_ANIM_REPORT === '1') {
  console.log(
    [
      `useAnimatedStyle: ${seen.useAnimatedStyle} · animationName: ${seen.animationName} · transitionProperty: ${seen.transitionProperty} · propriedades de layout animadas: ${hits.length}`,
      ...hits.map((h) => `  ${h.kind}: ${h.file}:${h.line} → ${h.key}`),
    ].join('\n'),
  );
}

describe('estilos animados: só transform e opacidade (nada de layout)', () => {
  it('encontrou os estilos animados do app (o teste está olhando para o lugar certo)', () => {
    expect(seen.useAnimatedStyle).toBeGreaterThan(10);
    expect(seen.animationName).toBeGreaterThan(10);
    expect(seen.transitionProperty).toBeGreaterThan(3);
  });

  it('nenhuma propriedade de layout animada fora das exceções justificadas', () => {
    const baseline = [...BASELINE_LAYOUT_ANIMATIONS];
    const unexpected: string[] = [];
    for (const h of hits) {
      const i = baseline.indexOf(id(h));
      if (i >= 0) baseline.splice(i, 1);
      else unexpected.push(`${h.file}:${h.line} anima "${h.key}" (${h.kind}): use transform (translate/scale) ou opacity`);
    }
    expect(unexpected).toEqual([]);
  });
});

describe('autoteste do detector', () => {
  const scan = (code: string) => scanSource('autoteste.tsx', code, { useAnimatedStyle: 0, animationName: 0, transitionProperty: 0 }).map((h) => `${h.kind}:${h.key}`);

  it('useAnimatedStyle: acusa width, height, top, left e margin*; aceita transform e opacity', () => {
    expect(scan('useAnimatedStyle(() => ({ width: w.value, marginTop: 4 }))')).toEqual(['useAnimatedStyle:width', 'useAnimatedStyle:marginTop']);
    expect(scan('useAnimatedStyle(() => { const f = () => ({ width: 1 }); return on ? { top: 1, left: 2 } : { height: 3 }; })')).toEqual([
      'useAnimatedStyle:top',
      'useAnimatedStyle:left',
      'useAnimatedStyle:height',
    ]);
    expect(scan('useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }, { scale: s.value }] }))')).toEqual([]);
  });

  it('animationName: segue o literal, a constante do arquivo e a função local que monta os quadros', () => {
    expect(scan('<V style={{ animationName: { from: { opacity: 0 }, to: { opacity: 1, transform: [{ translateY: 0 }] } } }} />')).toEqual([]);
    expect(scan('const GROW = { from: { width: 0 }, to: { width: 100 } }; <V style={{ animationName: GROW }} />')).toEqual(['animationName:width', 'animationName:width']);
    expect(scan("function drop(d) { return { '0%': { top: -d }, '100%': { top: 0 } }; } <V style={{ animationName: kf(drop(8)) }} />")).toEqual([
      'animationName:top',
      'animationName:top',
    ]);
  });

  it("transições: nome de layout, 'all' e duração sem transitionProperty (o padrão é 'all')", () => {
    expect(scan("<V style={{ transitionProperty: ['opacity', 'marginLeft'], transitionDuration: 200 }} />")).toEqual(['transitionProperty:marginLeft']);
    expect(scan("<V style={{ transitionProperty: on ? 'all' : 'opacity', transitionDuration: 200 }} />")).toEqual(['transitionProperty:all']);
    expect(scan('<V style={{ opacity: 1, transitionDuration: 200 }} />')).toEqual(['transitionProperty:all (padrão)']);
    expect(scan("<V style={{ transitionProperty: 'backgroundColor', transitionDuration: 200 }} />")).toEqual([]);
  });
});
