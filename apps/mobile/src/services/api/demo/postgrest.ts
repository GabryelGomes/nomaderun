/**
 * Construtor de consultas no formato do `@supabase/postgrest-js`, sobre o banco de demonstração:
 * `select` (com `count`/`head`), `insert`/`update`/`delete` (com `.select()` de retorno), os filtros
 * `eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`in`/`is`/`like`/`ilike`/`filter`/`match`, `order`, `limit`, `range`,
 * `single` e `maybeSingle`. O resultado é `{ data, error, count, status, statusText }`, como no supabase-js.
 */
import { DEMO_TABLE_COLUMNS, DemoPgError, type DemoDb, type DemoTable, type Row } from './db';

export type PgResponse = { data: unknown; error: { code: string; message: string; details: string | null; hint: string | null } | null; count: number | null; status: number; statusText: string };

/** Antes de cada pedido: latência e falhas do roteiro (`erro`, `offline`, `lento`). */
export type Gate = () => Promise<{ status: number; error: PgResponse['error'] } | null>;

type Filter = (r: Row) => boolean;
type Order = { column: string; ascending: boolean; nullsFirst: boolean };

const cmp = (a: unknown, b: unknown): number => {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
};

/** `%` e `*` = qualquer sequência; `_` = um caractere (como o LIKE do Postgres e o atalho do PostgREST). */
function likeRegex(pattern: string, flags: string) {
  let src = '';
  for (const ch of pattern) {
    if (ch === '%' || ch === '*') src += '.*';
    else if (ch === '_') src += '.';
    else src += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${src}$`, flags);
}

function parseColumns(cols: string): string[] | '*' {
  const list = cols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (list.length === 0 || list.includes('*')) return '*';
  return list;
}

export class DemoQuery implements PromiseLike<PgResponse> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns: string[] | '*' = '*';
  private returning = false;
  private countMode: 'exact' | null = null;
  private head = false;
  private filters: Filter[] = [];
  private filterColumns: string[] = [];
  private orders: Order[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode: 'single' | 'maybe' | null = null;
  private payload: Row[] = [];
  private patch: Row = {};
  /** Filtro que a demonstração não imita: vira erro claro em vez de resultado errado. */
  private unsupported: string | null = null;

  constructor(
    private readonly db: DemoDb,
    private readonly table: string,
    private readonly userId: () => string | null,
    private readonly gate: Gate,
  ) {}

  select(columns = '*', opts: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}) {
    if (this.op !== 'select') this.returning = true;
    this.columns = parseColumns(columns);
    if (opts.count) this.countMode = 'exact';
    if (opts.head) this.head = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(patch: Row) {
    this.op = 'update';
    this.patch = patch;
    return this;
  }

  delete(opts: { count?: 'exact' | 'planned' | 'estimated' } = {}) {
    this.op = 'delete';
    if (opts.count) this.countMode = 'exact';
    return this;
  }

  private where(column: string, f: Filter) {
    this.filterColumns.push(column);
    this.filters.push(f);
    return this;
  }

  eq(column: string, value: unknown) {
    return this.where(column, (r) => r[column] === value || (r[column] !== null && value !== null && String(r[column]) === String(value)));
  }
  neq(column: string, value: unknown) {
    return this.where(column, (r) => r[column] !== value);
  }
  gt(column: string, value: unknown) {
    return this.where(column, (r) => r[column] !== null && r[column] !== undefined && cmp(r[column], value) > 0);
  }
  gte(column: string, value: unknown) {
    return this.where(column, (r) => r[column] !== null && r[column] !== undefined && cmp(r[column], value) >= 0);
  }
  lt(column: string, value: unknown) {
    return this.where(column, (r) => r[column] !== null && r[column] !== undefined && cmp(r[column], value) < 0);
  }
  lte(column: string, value: unknown) {
    return this.where(column, (r) => r[column] !== null && r[column] !== undefined && cmp(r[column], value) <= 0);
  }
  in(column: string, values: readonly unknown[]) {
    const set = new Set(values.map(String));
    return this.where(column, (r) => r[column] !== null && r[column] !== undefined && set.has(String(r[column])));
  }
  is(column: string, value: null | boolean) {
    return this.where(column, (r) => (r[column] ?? null) === value);
  }
  like(column: string, pattern: string) {
    const re = likeRegex(pattern, '');
    return this.where(column, (r) => typeof r[column] === 'string' && re.test(r[column] as string));
  }
  ilike(column: string, pattern: string) {
    const re = likeRegex(pattern, 'i');
    return this.where(column, (r) => typeof r[column] === 'string' && re.test(r[column] as string));
  }
  match(query: Row) {
    for (const [k, v] of Object.entries(query)) this.eq(k, v);
    return this;
  }
  filter(column: string, operator: string, value: unknown) {
    switch (operator) {
      case 'eq':
      case 'neq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        return this[operator](column, value);
      case 'like':
      case 'ilike':
        return this[operator](column, String(value));
      case 'is':
        return this.is(column, value === 'null' || value === null ? null : value === 'true' || value === true);
      case 'in': {
        const list = String(value).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        return this.in(column, list);
      }
      default:
        this.unsupported = `operador "${operator}"`;
        return this;
    }
  }

  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const ascending = opts.ascending ?? true;
    // Postgres: ASC NULLS LAST, DESC NULLS FIRST.
    this.orders.push({ column, ascending, nullsFirst: opts.nullsFirst ?? !ascending });
    this.filterColumns.push(column);
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  single() {
    this.singleMode = 'single';
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }
  /** O app não usa; existe para o tipo do supabase-js não exigir `as never` em chamadas encadeadas. */
  abortSignal() {
    return this;
  }

  then<A = PgResponse, B = never>(onfulfilled?: ((value: PgResponse) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private fail(e: DemoPgError, status = 400): PgResponse {
    return { data: null, error: e.toJSON(), count: null, status, statusText: 'Bad Request' };
  }

  private checkColumns(): DemoPgError | null {
    const known = (DEMO_TABLE_COLUMNS as Record<string, readonly string[]>)[this.table];
    if (!known) return new DemoPgError('PGRST205', `Could not find the table 'public.${this.table}' in the schema cache`);
    const cols = [...(this.columns === '*' ? [] : this.columns), ...this.filterColumns, ...Object.keys(this.patch), ...this.payload.flatMap((p) => Object.keys(p))];
    const bad = cols.find((c) => !known.includes(c));
    if (bad) return new DemoPgError('42703', `column ${this.table}.${bad} does not exist`);
    if (this.unsupported) return new DemoPgError('PGRST100', `Demonstração: ${this.unsupported} não é suportado`);
    return null;
  }

  private project(rows: Row[]): Row[] {
    if (this.columns === '*') return rows.map((r) => ({ ...r }));
    const cols = this.columns;
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }

  private async execute(): Promise<PgResponse> {
    const gated = await this.gate();
    if (gated) return { data: null, error: gated.error, count: null, status: gated.status, statusText: 'Error' };
    const bad = this.checkColumns();
    if (bad) return this.fail(bad, bad.code === 'PGRST205' ? 404 : 400);
    const table = this.table as DemoTable;
    const userId = this.userId();
    const match = (r: Row) => this.filters.every((f) => f(r));
    try {
      if (this.op === 'insert') {
        const rows = this.db.insert(table, this.payload, userId);
        return this.finish(this.returning ? this.project(rows) : null, rows.length, 201);
      }
      if (this.op === 'update') {
        const rows = this.db.update(table, this.patch, match, userId);
        return this.finish(this.returning ? this.project(rows) : null, rows.length, 200);
      }
      if (this.op === 'delete') {
        const rows = this.db.remove(table, match, userId);
        return this.finish(this.returning ? this.project(rows) : null, rows.length, 200);
      }
      let rows = this.db.read(table, userId).filter(match);
      const total = rows.length;
      if (this.orders.length) {
        rows = [...rows].sort((a, b) => {
          for (const o of this.orders) {
            const av = a[o.column] ?? null;
            const bv = b[o.column] ?? null;
            if (av === null && bv === null) continue;
            if (av === null) return o.nullsFirst ? -1 : 1;
            if (bv === null) return o.nullsFirst ? 1 : -1;
            const c = cmp(av, bv);
            if (c !== 0) return o.ascending ? c : -c;
          }
          return 0;
        });
      }
      if (this.rangeFrom !== null && this.rangeTo !== null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      return this.finish(this.head ? null : this.project(rows), total, 200);
    } catch (e) {
      if (e instanceof DemoPgError) return this.fail(e, e.code === '42501' ? 403 : 400);
      throw e;
    }
  }

  private finish(data: Row[] | null, count: number, status: number): PgResponse {
    const counted = this.countMode ? count : null;
    if (this.singleMode && data) {
      if (data.length === 1) return { data: data[0], error: null, count: counted, status, statusText: 'OK' };
      if (data.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count: counted, status, statusText: 'OK' };
      return this.fail(new DemoPgError('PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${data.length} rows`), 406);
    }
    return { data, error: null, count: counted, status, statusText: 'OK' };
  }
}
