/**
 * @jest-environment node
 *
 * T7.1.19 — teste de contrato do modo demonstração (D-77). Lê o código do app (AST do TypeScript, como o
 * `testids.test.ts`) e extrai cada nome que ele pede ao servidor:
 *   - `from('tabela')` (PostgREST) e `storage.from('bucket')`;
 *   - `rpc('funcao')`;
 *   - Edge Functions: `functions.invoke(...)`, `callFunction(...)` e o tipo `FunctionName`.
 * Falha, com o nome, se algum não tiver par no servidor de demonstração (`src/services/api/demo`).
 * Nome calculado em tempo de execução também falha: o contrato precisa ser legível.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

import { DEMO_BUCKETS, DEMO_FUNCTIONS, DEMO_RPCS, DEMO_TABLES } from '@/services/api/demo';

const SRC = join(__dirname, '..');
/** O próprio servidor de demonstração e o mundo dele não são clientes do contrato. */
const SKIP_DIRS = [join(SRC, 'services', 'api', 'demo'), join(SRC, 'demo')];

type Kind = 'table' | 'bucket' | 'rpc' | 'function';
type Use = { kind: Kind; name: string; where: string };
type Problem = { where: string; what: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules' && !SKIP_DIRS.includes(p)) walk(p, out);
    } else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const isFunctionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** Literais de string de um tipo (`'a' | 'b'`, ou um alias no mesmo arquivo). */
function typeLiterals(type: ts.TypeNode | undefined, sf: ts.SourceFile): string[] | null {
  if (!type) return null;
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) return [type.literal.text];
  if (ts.isUnionTypeNode(type)) {
    const parts = type.types.map((t) => typeLiterals(t, sf));
    return parts.every((p): p is string[] => p !== null) ? parts.flat() : null;
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const alias = sf.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === (type.typeName as ts.Identifier).text);
    return alias ? typeLiterals(alias.type, sf) : null;
  }
  return null;
}

/** Primeiros argumentos literais das chamadas a `fnName` no arquivo (ex.: `invoke('register-device', ...)`). */
function literalCallArgs(fnName: string, index: number, sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === fnName) {
      const a = n.arguments[index];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) out.push(a.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Nomes possíveis de uma expressão usada como nome de tabela/RPC/function, ou null se for dinâmica. */
function namesOf(expr: ts.Expression | undefined, sf: ts.SourceFile): string[] | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) return namesOf(expr.expression, sf);
  if (ts.isConditionalExpression(expr)) {
    const a = namesOf(expr.whenTrue, sf);
    const b = namesOf(expr.whenFalse, sf);
    return a && b ? [...a, ...b] : null;
  }
  // `buildFunctionPath(name, query)`: o nome é o primeiro argumento.
  if (ts.isCallExpression(expr)) return namesOf(expr.arguments[0], sf);
  if (ts.isIdentifier(expr)) {
    for (let n: ts.Node | undefined = expr.parent; n; n = n.parent) {
      if (!isFunctionLike(n)) continue;
      const idx = n.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === expr.text);
      if (idx < 0) continue;
      const fromType = typeLiterals(n.parameters[idx].type, sf);
      if (fromType) return fromType;
      const fnName = n.name && ts.isIdentifier(n.name) ? n.name.text : ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? n.parent.name.text : null;
      const lits = fnName ? literalCallArgs(fnName, idx, sf) : [];
      return lits.length ? lits : null;
    }
  }
  return null;
}

const isStorageReceiver = (e: ts.Expression) => ts.isPropertyAccessExpression(e) && e.name.text === 'storage';
const looksLikeSupabase = (e: ts.Expression, sf: ts.SourceFile) => /supabase|requireSupabase|getSupabase|client|\bc\b/i.test(e.getText(sf));

/** Extrai os usos de um arquivo (também usado no autoteste abaixo). */
function scanSource(file: string, text: string): { uses: Use[]; problems: Problem[] } {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const uses: Use[] = [];
  const problems: Problem[] = [];
  const add = (kind: Kind, names: string[] | null, node: ts.Node, label: string) => {
    const where = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    if (!names) problems.push({ where, what: `${label} com nome dinâmico: ${node.getText(sf).slice(0, 80)}` });
    else for (const name of names) uses.push({ kind, name, where });
  };
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const arg = n.arguments[0];
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        const literal = arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));
        if (method === 'from' && isStorageReceiver(callee.expression)) add('bucket', namesOf(arg, sf), n, 'storage.from');
        else if (method === 'from' && (literal || looksLikeSupabase(callee.expression, sf))) add('table', namesOf(arg, sf), n, 'from');
        else if (method === 'rpc') add('rpc', namesOf(arg, sf), n, 'rpc');
        else if (method === 'invoke' && ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'functions') add('function', namesOf(arg, sf), n, 'functions.invoke');
      } else if (ts.isIdentifier(callee) && callee.text === 'callFunction') {
        add('function', namesOf(arg, sf), n, 'callFunction');
      }
    }
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'FunctionName') add('function', typeLiterals(n.type, sf), n, 'FunctionName');
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { uses, problems };
}

const DEMO: Record<Kind, readonly string[]> = { table: DEMO_TABLES, bucket: DEMO_BUCKETS, rpc: DEMO_RPCS, function: DEMO_FUNCTIONS };

function missingPairs(uses: Use[]): string[] {
  return uses.filter((u) => !DEMO[u.kind].includes(u.name)).map((u) => `${u.kind} "${u.name}" (${u.where}) não tem par no servidor de demonstração`);
}

const scanned = walk(SRC).map((f) => scanSource(relative(join(SRC, '..'), f).split(sep).join('/'), readFileSync(f, 'utf8')));
const allUses = scanned.flatMap((s) => s.uses);
const allProblems = scanned.flatMap((s) => s.problems);
const names = (kind: Kind) => [...new Set(allUses.filter((u) => u.kind === kind).map((u) => u.name))].sort();

describe('contrato do modo demonstração (D-77)', () => {
  it('nenhum nome de tabela, RPC ou function é calculado em tempo de execução', () => {
    expect(allProblems.map((p) => `${p.where}: ${p.what}`)).toEqual([]);
  });

  it('toda tabela, bucket, RPC e Edge Function usada pelo app tem par na demonstração', () => {
    expect(missingPairs(allUses)).toEqual([]);
  });

  it('o levantamento acha a superfície da F1: 18 tabelas/views + o bucket avatars, 11 RPCs e 8 functions', () => {
    // Se cair, o leitor de AST parou de enxergar algum padrão (e o teste acima passaria sem conferir nada).
    expect(names('table').length).toBeGreaterThanOrEqual(18);
    expect(names('bucket')).toEqual(['avatars']);
    expect(names('rpc').length).toBeGreaterThanOrEqual(11);
    expect(names('function').length).toBeGreaterThanOrEqual(8);
    expect(names('rpc')).toEqual(expect.arrayContaining(['ranking_runners', 'ranking_crews', 'ranking_factions', 'choose_faction', 'daily_chests']));
    expect(names('function')).toEqual(expect.arrayContaining(['register-device', 'ingest-points', 'finish-activity', 'zones', 'zone', 'moderate-activity', 'account-export', 'account-delete']));
  });

  it('o servidor de demonstração não guarda pares de nomes que o app não usa mais', () => {
    // Pares órfãos não quebram nada, mas escondem que o contrato mudou: apague o par junto com o uso.
    expect(DEMO_RPCS.filter((n) => !names('rpc').includes(n))).toEqual([]);
    expect(DEMO_FUNCTIONS.filter((n) => !names('function').includes(n))).toEqual([]);
    expect(DEMO_TABLES.filter((n) => !names('table').includes(n))).toEqual([]);
  });

  it('autoteste: uma RPC, tabela ou function nova sem par falha com o nome dela', () => {
    const fake = scanSource(
      'src/services/api/missoes-repo.ts',
      [
        "import { requireSupabase } from './supabase';",
        "import { callFunction } from './functions';",
        "export const a = () => requireSupabase().rpc('exemplo_sem_par', { p_id: 1 });",
        "export const b = () => requireSupabase().from('missions').select('*');",
        "export const c = () => callFunction('share-card', { method: 'POST' });",
        'export const d = (name: string) => requireSupabase().rpc(`raid_${name}`);',
      ].join('\n'),
    );
    expect(missingPairs(fake.uses)).toEqual([
      'rpc "exemplo_sem_par" (src/services/api/missoes-repo.ts:3) não tem par no servidor de demonstração',
      'table "missions" (src/services/api/missoes-repo.ts:4) não tem par no servidor de demonstração',
      'function "share-card" (src/services/api/missoes-repo.ts:5) não tem par no servidor de demonstração',
    ]);
    expect(fake.problems.map((p) => p.where)).toEqual(['src/services/api/missoes-repo.ts:6']);
  });
});
