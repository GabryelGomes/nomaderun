/**
 * F8 C3 (D-99) — página pública `/excluir-conta` (Google Play) e o link na Política de Privacidade.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/* eslint-disable import/first -- os jest.mock acima precisam vir antes dos imports do app */
import { render } from '@/components/__tests__/render-helpers';

import { DELETE_ACCOUNT_STEPS, DeleteAccountInfoScreen } from '../delete-account-info-screen';
import { DELETE_ACCOUNT_PATH, LEGAL_CONTACTS } from '../legal-contacts';
import { LegalScreen } from '../legal-screen';

const SRC = join(__dirname, '..', '..', '..');

describe('/excluir-conta', () => {
  it('explica a exclusão pelo app (Você → Ajustes → Conta → Excluir conta) e por e-mail ao encarregado', () => {
    const r = render(<DeleteAccountInfoScreen />);
    const text = r.text();
    expect(text).toContain('Excluir sua conta');
    expect(text).toContain('Você → Ajustes → Conta');
    expect(text).toContain('Excluir conta');
    expect(text).toContain(LEGAL_CONTACTS.dpoEmail);
    expect(text).toContain('Nunca pedimos sua senha por e-mail.');
    expect(DELETE_ACCOUNT_STEPS).toHaveLength(3);
  });

  it('fechar sem histórico (aberta direto pelo link) volta ao início', () => {
    const r = render(<DeleteAccountInfoScreen />);
    r.press('excluir-conta-fechar');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('é estática: não lê sessão, perfil, nem fala com o servidor (sem dado pessoal)', () => {
    const src = readFileSync(join(SRC, 'features', 'auth', 'delete-account-info-screen.tsx'), 'utf8');
    expect(src).not.toMatch(/@\/store|@\/services|supabase|useSession|fetch\(/);
  });

  it('fica fora dos guards de sessão no layout raiz e existe como rota', () => {
    const layout = readFileSync(join(SRC, 'app', '_layout.tsx'), 'utf8');
    const route = readFileSync(join(SRC, 'app', 'excluir-conta.tsx'), 'utf8');
    expect(route).toContain('DeleteAccountInfoScreen');
    const screen = layout.indexOf('name="excluir-conta"');
    expect(screen).toBeGreaterThan(layout.lastIndexOf('</Stack.Protected>'));
  });

  it('a Política de Privacidade tem Controlador, Encarregado (DPO), art. 18 e o link para a página', () => {
    const r = render(<LegalScreen kind="privacidade" />);
    const text = r.text();
    expect(text).toContain(`Controlador: ${LEGAL_CONTACTS.controllerName}`);
    expect(text).toContain(`Encarregado (DPO): ${LEGAL_CONTACTS.dpoName}`);
    expect(text).toContain('art. 18 da LGPD');
    expect(text).toContain('Estatísticas de uso (opcional');
    r.press('legal-excluir-conta');
    expect(mockRouter.push).toHaveBeenCalledWith(DELETE_ACCOUNT_PATH);
  });

  it('os Termos não mostram o botão de exclusão', () => {
    const r = render(<LegalScreen kind="termos" />);
    expect(r.has('legal-excluir-conta')).toBe(false);
  });
});
