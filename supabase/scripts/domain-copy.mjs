#!/usr/bin/env node
/**
 * Plano B da D-02 (P-08): copia apps/mobile/src/domain para supabase/functions/_shared/domain_copy e aponta a ponte
 * (_shared/domain.ts) para a cópia. Use só se o deploy no Supabase Cloud recusar arquivos fora de supabase/
 * (ver supabase/DEPLOY.md). A cópia é gerada: não edite; mudou o domain → rode de novo.
 *
 *   node supabase/scripts/domain-copy.mjs            gera a cópia e troca a ponte
 *   node supabase/scripts/domain-copy.mjs --check    falha se a cópia existente divergir do domain (CI/pré-deploy)
 *   node supabase/scripts/domain-copy.mjs --restore  apaga a cópia e volta a ponte para o domain do app
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOMAIN = join(ROOT, 'apps/mobile/src/domain');
const COPY = join(ROOT, 'supabase/functions/_shared/domain_copy');
const BRIDGE = join(ROOT, 'supabase/functions/_shared/domain.ts');
const APP_PREFIX = '../../../apps/mobile/src/domain/';
const COPY_PREFIX = './domain_copy/';
const HEADER = '// GERADO por supabase/scripts/domain-copy.mjs a partir de apps/mobile/src/domain (plano B da D-02). Não edite.\n';

const files = readdirSync(DOMAIN).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
/** Acrescenta `.ts` aos imports relativos do domain (o Deno não aceita import sem extensão). */
const generate = (f) => HEADER + readFileSync(join(DOMAIN, f), 'utf8').replace(/((?:from|import)\s+')(\.\/[^'.]+)(')/g, '$1$2.ts$3');

const mode = process.argv[2] ?? '';
if (mode === '--restore') {
  rmSync(COPY, { recursive: true, force: true });
  writeFileSync(BRIDGE, readFileSync(BRIDGE, 'utf8').replaceAll(`'${COPY_PREFIX}`, `'${APP_PREFIX}`));
  console.log('ponte restaurada para apps/mobile/src/domain; cópia apagada');
} else if (mode === '--check') {
  if (!existsSync(COPY)) {
    console.log('sem cópia (plano A em uso)');
    process.exit(0);
  }
  const copied = readdirSync(COPY).filter((f) => f.endsWith('.ts')).sort();
  const bad = files.filter((f) => !existsSync(join(COPY, f)) || readFileSync(join(COPY, f), 'utf8') !== generate(f));
  const extra = copied.filter((f) => !files.includes(f));
  if (bad.length || extra.length) {
    console.error(`cópia do domain desatualizada: ${[...bad, ...extra].join(', ')} — rode: npm run domain:copy`);
    process.exit(1);
  }
  console.log(`cópia do domain em dia (${files.length} arquivos)`);
} else if (mode === '') {
  rmSync(COPY, { recursive: true, force: true });
  mkdirSync(COPY, { recursive: true });
  for (const f of files) writeFileSync(join(COPY, f), generate(f));
  writeFileSync(BRIDGE, readFileSync(BRIDGE, 'utf8').replaceAll(`'${APP_PREFIX}`, `'${COPY_PREFIX}`));
  console.log(`domain copiado para supabase/functions/_shared/domain_copy (${files.length} arquivos) e ponte apontando para a cópia`);
} else {
  console.error('uso: domain-copy.mjs [--check|--restore]');
  process.exit(2);
}
