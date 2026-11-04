/**
 * @jest-environment node
 *
 * F8 C3 (D-99) — pronto para publicar:
 *  - OTA de verdade: expo-updates instalado, runtimeVersion "appVersion", updates.url = https://u.expo.dev/<projectId>
 *    derivada de extra.eas.projectId; com o marcador, OTA desligado e projectId fora da configuração resolvida;
 *  - identificadores das lojas (br.com.nomaderun.app);
 *  - a trava `scripts/check-publicacao.js` recusa publicar/gerar APK com o marcador (o "teste que falha se o
 *    marcador for publicado" roda de verdade no `npm run publicar` e no `npm run apk`);
 *  - publicar.sh com --environment;
 *  - Política de Privacidade com Controlador e Encarregado (DPO): lembrete enquanto houver marcador; com
 *    NOMADE_RELEASE=1 este teste falha até os autores preencherem e subirem a PRIVACY_VERSION.
 */
import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LEGAL_CONTACTS, isLegalPlaceholder, pendingLegalFields } from '@/features/auth/legal-contacts';
import { PRIVACY_VERSION } from '@/services/api/auth-repo';

const APP = join(__dirname, '..', '..');
const ROOT = join(APP, '..', '..');
const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: Record<string, any> };
const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require(join(APP, 'app.config.js')) as ((ctx: { config: Record<string, any> }) => Record<string, any>) & {
  EAS_PROJECT_PLACEHOLDER: string;
};
const CHECK = join(APP, 'scripts', 'check-publicacao.js');
const UUID = '0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b';

function runCheck(projectId: unknown, env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'nomade-publicacao-'));
  const file = join(dir, 'app.json');
  writeFileSync(file, JSON.stringify({ expo: { ...appJson.expo, extra: { ...appJson.expo.extra, eas: { projectId } } } }));
  return spawnSync(process.execPath, [CHECK, file], { encoding: 'utf8', env: { ...process.env, ...env } });
}

describe('OTA (EAS Update)', () => {
  it('expo-updates está instalado na versão do SDK 57', () => {
    expect(pkg.dependencies['expo-updates']).toMatch(/^~57\./);
  });

  it('runtimeVersion pela versão do app e o campo do projectId presente', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(appJson.expo.extra.eas).toHaveProperty('projectId');
  });

  it('com o marcador: OTA desligado e nenhum projectId falso na configuração resolvida (Expo Go segue funcionando)', () => {
    const resolved = appConfig({ config: appJson.expo });
    expect(appJson.expo.extra.eas.projectId).toBe(appConfig.EAS_PROJECT_PLACEHOLDER);
    expect(resolved.updates.enabled).toBe(false);
    expect(resolved.updates.url).toBeUndefined();
    expect(resolved.extra.eas.projectId).toBeUndefined();
    expect(resolved.runtimeVersion).toEqual({ policy: 'appVersion' });
  });

  it('com o projectId do eas init: updates.url = https://u.expo.dev/<projectId> e OTA ligado', () => {
    const resolved = appConfig({ config: { ...appJson.expo, extra: { ...appJson.expo.extra, eas: { projectId: UUID } } } });
    expect(resolved.updates).toMatchObject({ enabled: true, url: `https://u.expo.dev/${UUID}` });
    expect(resolved.extra.eas.projectId).toBe(UUID);
  });

  it('a trava recusa publicar com o marcador ou com um valor que não é UUID', () => {
    const placeholder = runCheck(appConfig.EAS_PROJECT_PLACEHOLDER);
    expect(placeholder.status).toBe(1);
    expect(placeholder.stderr).toMatch(/eas-cli@latest init/);
    expect(runCheck('meu-projeto').status).toBe(1);
    expect(runCheck(undefined).status).toBe(1);
  });

  it('a trava libera com o projectId real (e só avisa da política enquanto não for NOMADE_RELEASE=1)', () => {
    const ok = runCheck(UUID, { NOMADE_RELEASE: '' });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(`https://u.expo.dev/${UUID}`);
    if (pendingLegalFields().length) {
      expect(ok.stderr).toMatch(/Política de Privacidade sem preencher/);
      expect(runCheck(UUID, { NOMADE_RELEASE: '1' }).status).toBe(1);
    }
  });

  it('publicar.sh e apk.sh passam pela trava antes do EAS; publicar.sh usa --environment', () => {
    const publicar = readFileSync(join(ROOT, 'scripts', 'publicar.sh'), 'utf8');
    const apk = readFileSync(join(ROOT, 'scripts', 'apk.sh'), 'utf8');
    for (const script of [publicar, apk]) {
      const guard = script.indexOf('scripts/check-publicacao.js');
      expect(guard).toBeGreaterThan(0);
      expect(guard).toBeLessThan(script.indexOf('npx eas-cli@latest'));
    }
    expect(publicar).toMatch(/eas-cli@latest update [^\n]*--environment "\$EAS_ENV"/);
  });
});

describe('lojas', () => {
  it('android.package e ios.bundleIdentifier = br.com.nomaderun.app (D-99, o dono confirma)', () => {
    expect(appJson.expo.android.package).toBe('br.com.nomaderun.app');
    expect(appJson.expo.ios.bundleIdentifier).toBe('br.com.nomaderun.app');
  });
});

describe('Política de Privacidade: controlador e encarregado', () => {
  it('os campos existem e cada um está preenchido ou com marcador claro', () => {
    for (const key of ['controllerName', 'controllerEmail', 'dpoName', 'dpoEmail', 'serverRegion'] as const) {
      const v = LEGAL_CONTACTS[key];
      expect(v.trim().length).toBeGreaterThan(0);
      if (!isLegalPlaceholder(v) && key.endsWith('Email')) expect(v).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it('lembra de preencher (e falha com NOMADE_RELEASE=1); ao preencher, a PRIVACY_VERSION sobe', () => {
    const pending = pendingLegalFields();
    if (process.env.NOMADE_RELEASE === '1') {
      expect(pending).toEqual([]);
    } else if (pending.length) {
      console.warn(`LEMBRETE (D-99): preencha ${pending.join(', ')} em src/features/auth/legal-contacts.ts antes de abrir para pessoas reais.`);
    }
    if (pending.length === 0) expect(PRIVACY_VERSION).not.toBe('2026-10');
  });

  it('pendingLegalFields reconhece marcador, vazio e valor preenchido', () => {
    expect(pendingLegalFields({ a: '[NOME]', b: '', c: 'Fulana de Tal', d: 'dpo@exemplo.com.br' })).toEqual(['a', 'b']);
  });
});
