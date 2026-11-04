// F8 · D (E9): B1 — a regra do selo "Precisa de reforço" no SQL (`private.faction_needing_boost`, migration
// 20261104120300) é a mesma de `factionNeedingBoost` do domain. Lê a tabela do pgTAP 34 entre os marcadores.
import assert from 'node:assert/strict';
import { asBoostFaction, factionNeedingBoost } from '../_shared/domain.ts';

const SQL = new URL('../../tests/database/34_f8_revisao.test.sql', import.meta.url);

async function boostTable(): Promise<{ cases: Record<string, unknown>[]; expected: (string | null)[] }> {
  const text = await Deno.readTextFile(SQL);
  const block = text.slice(text.indexOf('-- BOOST_PARITY_BEGIN'), text.indexOf('-- BOOST_PARITY_END'));
  const lits = [...block.matchAll(/'(\[.*?\])'::jsonb/gs)].map((m) => JSON.parse(m[1]));
  return { cases: lits[0] ?? [], expected: lits[1] ?? [] };
}

Deno.test('B1: needsBoost do SQL (tabela do pgTAP 34) = factionNeedingBoost do domain', async () => {
  const { cases, expected } = await boostTable();
  assert.ok(cases.length >= 10, 'a tabela tem casos');
  assert.equal(cases.length, expected.length);
  cases.forEach((c, i) => assert.equal(factionNeedingBoost(c as never), expected[i], `caso ${i}: ${JSON.stringify(c)}`));
});

Deno.test('B1: asBoostFaction só aceita um dos 4 times', () => {
  assert.equal(asBoostFaction('owls'), 'owls');
  for (const v of [null, undefined, '', 'OWLS', 'lobos', 3, {}, ['owls']]) assert.equal(asBoostFaction(v), null);
});
