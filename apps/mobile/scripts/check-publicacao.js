#!/usr/bin/env node
// Trava de publicação (D-99), chamada pelo `npm run publicar` e pelo `npm run apk` antes de falar com o EAS:
//
// 1. projectId do EAS (bloqueia): enquanto o app.json tiver o marcador no lugar de expo.extra.eas.projectId, o
//    build não procura OTA e o update iria para lugar nenhum. O projectId nasce com `npx eas-cli@latest init`,
//    logado na conta dos autores (supabase/DEPLOY.md §12).
// 2. Controladores e encarregado da Política de Privacidade (src/features/auth/legal-contacts.ts): bloqueia por padrão
//    se houver marcador entre colchetes (F8-D, M3). Só para um teste interno, NOMADE_DEMO_OK=1 aceita com aviso.
//
// Uso: node scripts/check-publicacao.js [caminho/do/app.json]   (padrão: apps/mobile/app.json)
// Saída 0 se pode publicar; 1 se não.
const fs = require('fs');
const path = require('path');

const { EAS_PROJECT_PLACEHOLDER, isEasProjectId } = require('../app.config.js');

const LEGAL_FILE = process.env.NOMADE_LEGAL_FILE || path.join(__dirname, '..', 'src', 'features', 'auth', 'legal-contacts.ts');

function checkEasProject(appJsonPath) {
  let projectId;
  try {
    projectId = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))?.expo?.extra?.eas?.projectId;
  } catch (e) {
    return { ok: false, message: `Não consegui ler ${appJsonPath}: ${e.message}` };
  }
  if (projectId === EAS_PROJECT_PLACEHOLDER) {
    return {
      ok: false,
      message:
        'O app.json ainda tem o marcador no lugar do projectId do EAS. Rode `npx eas-cli@latest init` logado na conta dos autores e cole o ID em expo.extra.eas.projectId (supabase/DEPLOY.md §12).',
    };
  }
  if (!isEasProjectId(projectId)) {
    return { ok: false, message: `expo.extra.eas.projectId precisa ser o UUID do projeto no EAS. Valor atual: '${projectId ?? 'ausente'}'.` };
  }
  return { ok: true, projectId };
}

/** Campos de LEGAL_CONTACTS ainda com marcador (`campo: '[...]'`). Lê o fonte TS sem compilar. */
function pendingLegal(file = LEGAL_FILE) {
  const src = fs.readFileSync(file, 'utf8');
  const block = /export const LEGAL_CONTACTS = \{([\s\S]*?)\} as const;/.exec(src);
  if (!block) return ['LEGAL_CONTACTS (bloco não encontrado)'];
  return [...block[1].matchAll(/^\s*(\w+):\s*'(\[[^\]]+\])'/gm)].map((m) => m[1]);
}

module.exports = { checkEasProject, pendingLegal };

if (require.main === module) {
  const file = path.resolve(process.argv[2] ?? path.join(__dirname, '..', 'app.json'));
  let ok = true;
  const res = checkEasProject(file);
  if (res.ok) {
    process.stdout.write(`EAS projectId ${res.projectId}: OTA em https://u.expo.dev/${res.projectId}\n`);
  } else {
    process.stderr.write(`${res.message}\n`);
    ok = false;
  }
  // A Política é conferida mesmo sem o projectId, para a pessoa ver as duas pendências de uma vez.
  const legal = pendingLegal();
  if (legal.length) {
    const msg = `Política de Privacidade sem preencher (${legal.join(', ')}) em src/features/auth/legal-contacts.ts.`;
    if (process.env.NOMADE_DEMO_OK === '1') {
      process.stderr.write(`Aviso: ${msg} Aceito só porque NOMADE_DEMO_OK=1 (teste interno, nunca para pessoas reais).\n`);
    } else {
      process.stderr.write(`${msg} Publicação recusada: preencha os campos (ou NOMADE_DEMO_OK=1 para um teste interno).\n`);
      ok = false;
    }
  } else {
    process.stdout.write('Política de Privacidade: controladores, encarregado e região preenchidos.\n');
  }
  if (!ok) process.exit(1);
}
