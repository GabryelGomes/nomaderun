// F8 · C2 (E9 + E8): os avisos de zona do servidor (trigger `notifications_zone_text`, migration 20261104120000) e
// o texto do domain (`zoneNoticeText`, usado pela demonstração) são o MESMO formato. Lê os `format(...)` do SQL e
// compara com o domain para os 3 tipos; e o nome da zona (`zone_display` × `zonePlaceName`).
import assert from 'node:assert/strict';
import { zoneNoticeText, zonePlaceName } from '../_shared/domain.ts';

const MIGRATION = new URL('../../migrations/20261104120000_f8_social.sql', import.meta.url);

/** `format('…%s…', …)` do SQL com os %s trocados, na ordem, pelos valores. */
function fill(template: string, values: string[]): string {
  let i = 0;
  return template.replace(/%s/g, () => values[i++] ?? '');
}

async function sqlTemplates() {
  const sql = await Deno.readTextFile(MIGRATION);
  const body = sql.slice(sql.indexOf('create or replace function private.zone_notice_text()'));
  const formats = [...body.matchAll(/new\.body := format\('([^']+)'/g)].map((m) => m[1]);
  const titles = [...body.matchAll(/new\.title := '([^']+)'/g)].map((m) => m[1]);
  return { formats, titles };
}

Deno.test('C2: o texto dos avisos de zona do servidor = o do domain (invasão, território perdido, conquista)', async () => {
  const { formats, titles } = await sqlTemplates();
  assert.equal(formats.length, 3);
  assert.deepEqual(titles, ['Alerta de invasão', 'Território perdido', 'Zona conquistada']);
  const place = 'Jardim Goiás · perto do Estádio';
  // 05h30 UTC = 02h30 em Brasília
  const until = Date.UTC(2026, 10, 5, 5, 30);
  const inv = zoneNoticeText('invasion', { place, team: 'Urban Coyotes', until });
  assert.equal(inv.title, titles[0]);
  assert.equal(inv.body, fill(formats[0], ['Urban Coyotes', place, '02h30']));
  assert.equal(inv.body, 'Os Urban Coyotes estão pintando suas ruas em Jardim Goiás · perto do Estádio. Defenda até 02h30.');
  const lost = zoneNoticeText('territory_lost', { place, team: 'Urban Coyotes' });
  assert.equal(lost.title, titles[1]);
  assert.equal(lost.body, fill(formats[1], [place, 'Urban Coyotes']));
  const won = zoneNoticeText('conquest', { place, team: 'Neon Striders' });
  assert.equal(won.title, titles[2]);
  assert.equal(won.body, fill(formats[2], [place, 'Neon Striders']));
});

Deno.test('C2: nome da zona sem número e com a referência (zone_display × zonePlaceName)', () => {
  assert.equal(zonePlaceName('Jardim Goiás 59', 'perto do Estádio'), 'Jardim Goiás · perto do Estádio');
  assert.equal(zonePlaceName('Setor Pedro Ludovico 35/36'), 'Setor Pedro Ludovico');
  assert.equal(zonePlaceName(null), 'Zona');
  // nome que já tem referência (demonstração) não ganha outra
  assert.equal(zonePlaceName('Jardim Goiás · perto do Estádio', 'perto do Lago'), 'Jardim Goiás · perto do Estádio');
});
