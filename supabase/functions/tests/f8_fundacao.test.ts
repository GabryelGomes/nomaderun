// F8 · A2 (E9 + E3): D-92 paridade da curva de nível com o SQL, marcos da pintura no resultado da corrida
// (`extras.milestones`) e a regra pura do selo "Precisa de reforço" (D-96) pela ponte do domain.
import assert from 'node:assert/strict';
import {
  factionNeedingBoost,
  isEchoHour,
  levelProgress,
  type PaintMilestones,
  paintMilestones,
} from '../_shared/domain.ts';
import { DbError } from '../_shared/supabase.ts';
import { buildExtras, type V2Raw } from '../_shared/v2.ts';
import { withMilestones } from '../_shared/v2-run.ts';

const SQL = new URL('../../tests/database/31_f8_fundacao.test.sql', import.meta.url);

/** A tabela do pgTAP 31 entre os marcadores: os 50 XP e o esperado [xp, nível, XP no nível, XP do nível]. */
async function parityTable(): Promise<{ xs: number[]; expected: number[][] }> {
  const text = await Deno.readTextFile(SQL);
  const block = text.slice(text.indexOf('-- LEVEL_PARITY_BEGIN'), text.indexOf('-- LEVEL_PARITY_END'));
  const xs = /unnest\(array\[([\d,\s]+)\]::bigint\[\]\)/.exec(block)?.[1].split(',').map((v) => Number(v.trim())) ?? [];
  const expected = JSON.parse(/'(\[\[.*\]\])'::jsonb/s.exec(block)?.[1] ?? '[]') as number[][];
  return { xs, expected };
}

Deno.test('D-92: a tabela do pgTAP 31 (o que o SQL calcula) = levelProgress do domain, nos 50 valores de 0 a 50.000', async () => {
  const { xs, expected } = await parityTable();
  assert.equal(xs.length, 50);
  assert.equal(new Set(xs).size, 50);
  assert.ok(xs.every((x) => Number.isInteger(x) && x >= 0 && x <= 50_000));
  assert.deepEqual(expected.map((e) => e[0]), xs, 'mesma ordem de XP nas duas listas');
  for (const [x, level, intoLevel, needed] of expected) {
    const p = levelProgress(x);
    assert.deepEqual([p.level, p.intoLevel, p.needed], [level, intoLevel, needed], `XP ${x}`);
  }
});

/* ---------- marcos da pintura ---------- */

const RAW: V2Raw = { version: 1, scored: true, paint: { rule: 'v2', cells: 12, new: 12, reinforced: 0, flipped: 0, weakened: 0, track: [], zones: [] } };
const MS: PaintMilestones = { firstPaint: true, cells: 12, cellsRecord: null };
const OPTS = { activityId: 'e9e9e9e9-0000-4000-8000-000000000001', userId: 'e9e9e9e9-0000-4000-8000-0000000000aa' };

Deno.test('marcos: com a pintura v2, pede ao banco (svc_paint_milestones) e devolve em extras.milestones', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const raw = await withMilestones(RAW, OPTS, {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(MS as never);
    },
  });
  assert.deepEqual(calls, [{ name: 'svc_paint_milestones', args: { p_user: OPTS.userId, p_activity: OPTS.activityId } }]);
  assert.deepEqual(buildExtras(raw, 0).milestones, MS);
});

Deno.test('marcos: sem pintura (regra v1), já gravado ou corrida não pontuada → nenhuma chamada a mais', async () => {
  let calls = 0;
  const deps = { rpc: () => { calls++; return Promise.resolve(MS as never); } };
  const noPaint: V2Raw = { version: 1, scored: true };
  assert.equal(await withMilestones(noPaint, OPTS, deps), noPaint);
  const done: V2Raw = { ...RAW, milestones: MS };
  assert.equal(await withMilestones(done, OPTS, deps), done);
  const unscored: V2Raw = { ...RAW, scored: false };
  assert.equal(await withMilestones(unscored, OPTS, deps), unscored);
  assert.equal(calls, 0);
  assert.equal('milestones' in buildExtras(noPaint, 0), false, 'sem marco, o campo não aparece (contrato opcional)');
});

Deno.test('marcos: banco antigo (sem a RPC) ou erro não derruba o finish — só sai sem o marco', async () => {
  const errors: unknown[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  try {
    const raw = await withMilestones(RAW, OPTS, { rpc: () => Promise.reject(new DbError('PGRST202', 'function not found', 404)) });
    assert.equal(raw.milestones, undefined);
    assert.equal('milestones' in buildExtras(raw, 0), false);
  } finally {
    console.error = orig;
  }
  assert.equal(errors.length, 1);
});

Deno.test('marcos: a regra do domain (demonstração) bate com os casos do pgTAP 31', () => {
  const H = 3_600_000;
  const now = 1_800_000_000_000;
  const others = [
    { id: '21', cells: 0, endedAt: now - 96 * H, firstPaint: false },
    { id: '22', cells: 12, endedAt: now - 72 * H, firstPaint: false },
    { id: '23', cells: 30, endedAt: now - 48 * H, firstPaint: false },
    { id: '24', cells: 20, endedAt: now - H, firstPaint: false },
  ];
  const run = (id: string) => others.find((o) => o.id === id)!;
  assert.deepEqual(paintMilestones({ ...run('22'), others }), { firstPaint: true, cells: 12, cellsRecord: null });
  others[1].firstPaint = true;
  assert.deepEqual(paintMilestones({ ...run('23'), others }), { firstPaint: false, cells: 30, cellsRecord: { value: 30, previous: 20 } });
  assert.deepEqual(paintMilestones({ ...run('24'), others }), { firstPaint: false, cells: 20, cellsRecord: null });
  assert.deepEqual(paintMilestones({ ...run('21'), others }), { firstPaint: false, cells: 0, cellsRecord: null });
  // fora de ordem: a mais nova avaliada antes → o marco fica com a que terminou antes
  const pair = [{ id: '31', cells: 5, endedAt: now - 2 * H, firstPaint: false }, { id: '32', cells: 8, endedAt: now - H, firstPaint: false }];
  assert.equal(paintMilestones({ ...pair[1], others: pair }).firstPaint, false);
  assert.equal(paintMilestones({ ...pair[0], others: pair }).firstPaint, true);
});

Deno.test('D-96 e eco pela ponte: selo só com um time claramente atrás; eco só entre 07h e 22h (Brasília)', () => {
  assert.equal(factionNeedingBoost({ striders: 5, coyotes: 4, owls: 1, volt: 3 }), 'owls');
  assert.equal(factionNeedingBoost({ striders: 5, coyotes: 1, owls: 1, volt: 3 }), null);
  assert.equal(factionNeedingBoost({ striders: 1, coyotes: 1, owls: 0, volt: 1 }), null);
  const brt = (h: number) => Date.UTC(2026, 10, 4, h + 3, 0);
  assert.deepEqual([6, 7, 21, 22].map((h) => isEchoHour(brt(h))), [false, true, true, false]);
});
