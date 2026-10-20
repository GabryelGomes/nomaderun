// D-02 — as functions usam o domain do app por caminho relativo. Este teste falha quando um arquivo novo do
// domain não foi registrado na ponte (_shared/domain.ts) ou nos import maps, ou quando o h3-js vendorizado
// diverge do instalado no app.
import assert from 'node:assert/strict';

const ROOT = new URL('../../../', import.meta.url);
const DOMAIN = new URL('apps/mobile/src/domain/', ROOT);

const domainFiles = [...Deno.readDirSync(DOMAIN)]
  .filter((e) => e.isFile && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
  .map((e) => e.name.replace(/\.ts$/, ''))
  .sort();

Deno.test('a ponte _shared/domain.ts importa todos os arquivos do domain com extensão .ts', () => {
  const bridge = Deno.readTextFileSync(new URL('supabase/functions/_shared/domain.ts', ROOT));
  for (const f of domainFiles) {
    assert.ok(bridge.includes(`apps/mobile/src/domain/${f}.ts'`), `faltou ${f}.ts em _shared/domain.ts`);
  }
});

for (const config of ['supabase/functions/deno.json', 'supabase/scripts/deno.json']) {
  Deno.test(`${config} remapeia cada import sem extensão do domain`, () => {
    const imports = JSON.parse(Deno.readTextFileSync(new URL(config, ROOT))).imports as Record<string, string>;
    for (const f of domainFiles) {
      assert.equal(imports[`../../apps/mobile/src/domain/${f}`], `../../apps/mobile/src/domain/${f}.ts`, `${config}: faltou ${f}`);
    }
    assert.ok(imports['h3-js'], 'h3-js mapeado');
  });
}

Deno.test('imports do domain: só arquivos do próprio domain e h3-js (ARQUITETURA.md §2)', () => {
  for (const f of domainFiles) {
    const src = Deno.readTextFileSync(new URL(`${f}.ts`, DOMAIN));
    for (const m of src.matchAll(/(?:from|import)\s+'([^']+)'/g)) {
      const spec = m[1];
      if (spec === 'h3-js') continue;
      assert.ok(spec.startsWith('./'), `${f}.ts importa ${spec}`);
      assert.ok(domainFiles.includes(spec.slice(2).replace(/\.ts$/, '')), `${f}.ts importa ${spec}, que não existe no domain`);
    }
  }
});

Deno.test('h3-js vendorizado é idêntico ao instalado no app', { ignore: !exists('apps/mobile/node_modules/h3-js/dist/h3-js.es.js') }, () => {
  const strip = (s: string) => s.split('\n').filter((l) => !l.startsWith('//# sourceMappingURL') && !l.startsWith('// @ts-self-types')).join('\n').trim();
  const app = Deno.readTextFileSync(new URL('apps/mobile/node_modules/h3-js/dist/h3-js.es.js', ROOT));
  const vendored = Deno.readTextFileSync(new URL('supabase/functions/_shared/vendor/h3-js/h3-js.es.js', ROOT));
  assert.equal(strip(vendored), strip(app), 'rode: npm run domain:vendor-h3 (copia o h3-js do app para o vendor)');
});

function exists(path: string) {
  try {
    Deno.statSync(new URL(path, ROOT));
    return true;
  } catch {
    return false;
  }
}
