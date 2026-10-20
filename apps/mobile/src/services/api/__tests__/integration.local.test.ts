/**
 * @jest-environment node
 */
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import * as accountRepo from '../account-repo';
import * as authRepo from '../auth-repo';
import { MESSAGES } from '../errors';
import * as profileRepo from '../profile-repo';
import { isRecoveryLink, parseAuthCallback } from '../../auth/deep-link';

/**
 * Integração real contra o Supabase local (cadastro → perfil → facção → exportar → excluir).
 * Só roda com a stack de pé e NOMADE_IT=1:
 *   NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon key> npx jest integration.local
 * Atenção ao rate limit do Auth local (sign_in_sign_ups = 3 a cada 5 min por IP): este teste usa 2.
 */
const RUN = process.env.NOMADE_IT === '1';
const URL = process.env.NOMADE_IT_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NOMADE_IT_ANON ?? '';

// O preset jest-expo troca o fetch global pelo do Expo (que precisa do app nativo).
// Aqui usamos o node-fetch (dependência transitiva já presente) só neste teste.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = (RUN ? require('node-fetch') : undefined) as typeof fetch | undefined;
const memory = new Map<string, string>();
let mockRealClient: SupabaseClient | null = null;
if (RUN) {
  mockRealClient = createClient(URL, ANON, {
    global: { fetch: nodeFetch },
    auth: {
      storage: {
        getItem: async (k: string) => memory.get(k) ?? null,
        setItem: async (k: string, v: string) => void memory.set(k, v),
        removeItem: async (k: string) => void memory.delete(k),
      },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce', // igual ao app (QA-03)
    },
  });
}
const MAIL = process.env.NOMADE_IT_MAIL ?? 'http://127.0.0.1:54324';

/** Último link do e-mail de recuperação enviado para `to` na caixa local (`npm run mail`). */
async function recoveryLinkFor(to: string, after: number): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const res = await nodeFetch!(`${MAIL}/api/messages`).catch(() => null);
    const body = res ? ((await res.json()) as { messages: { to: string; date: string; links: string[] }[] }) : { messages: [] };
    const msg = body.messages.find((m) => m.to.includes(to) && Date.parse(m.date) >= after - 2000);
    const link = msg?.links.find((l) => l.includes('/auth/v1/verify'));
    if (link) return link;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

jest.mock('../supabase', () => ({
  requireSupabase: () => mockRealClient,
  getSupabase: () => mockRealClient,
}));

const suite = RUN ? describe : describe.skip;

suite('integração com o Supabase local', () => {
  const stamp = Date.now().toString(36);
  const email = `it_${stamp}@nomaderun.test`;
  const username = `it_${stamp}`.slice(0, 20);
  const password = 'Corrida2026!';
  const newPassword = 'Trilha2026#nova';
  let userId = '';
  let deleted = false;

  afterAll(async () => {
    if (!deleted && userId) {
      // a senha pode ter mudado no teste de recuperação
      if (!(await authRepo.signIn(email, newPassword)).ok) await authRepo.signIn(email, password);
      const r = await accountRepo.deleteMyAccount(newPassword);
      if (!r.ok) await accountRepo.deleteMyAccount(password);
    }
  });

  it('nome livre antes do cadastro', async () => {
    await expect(profileRepo.isUsernameAvailable(username)).resolves.toEqual({ ok: true, data: true });
  });

  it('cadastro com 16+ e aceites cria sessão e perfil sem facção', async () => {
    const r = await authRepo.signUp({ email, password, username, birthdate: '2000-05-10', city: ' Goiânia ', acceptedTerms: true, acceptedPrivacy: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.needsConfirmation).toBe(false);
    userId = r.data.session?.userId ?? '';
    const p = await profileRepo.getMyProfile(userId);
    // cidade natal do cadastro (options.data.city) gravada pelo trigger
    expect(p).toMatchObject({ ok: true, data: { username, faction: null, unit: 'km', role: 'runner', city: 'Goiânia' } });
    await expect(profileRepo.isUsernameAvailable(username.toUpperCase())).resolves.toEqual({ ok: true, data: false });
  });

  it('cadastro de menor de 16 é recusado pelo banco', async () => {
    // Sem sessão para não trocar o usuário logado do teste: usa um cliente separado.
    const other = createClient(URL, ANON, { global: { fetch: nodeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await other.auth.signUp({
      email: `menor_${stamp}@nomaderun.test`,
      password,
      options: { data: authRepo.buildSignUpMetadata({ email: '', password, username: `m_${stamp}`.slice(0, 20), birthdate: '2015-01-01', acceptedTerms: true, acceptedPrivacy: true }) },
    });
    expect(error).not.toBeNull();
  });

  it('edita perfil, recusa cidade de 1 letra no banco e escolhe facção pelo RPC', async () => {
    const up = await profileRepo.updateMyProfile(userId, {
      city: 'Goiânia',
      unit: 'mi',
      notificationPrefs: { invasions: false, conquests: true, missions: false, moderation: true },
    });
    expect(up).toMatchObject({ ok: true, data: { city: 'Goiânia', unit: 'mi', notificationPrefs: { invasions: false, missions: false } } });
    const bad = await profileRepo.updateMyProfile(userId, { city: 'G' });
    expect(bad.ok).toBe(false);
    await expect(profileRepo.chooseFaction('owls')).resolves.toEqual({ ok: true, data: undefined });
    await expect(profileRepo.getMyProfile(userId)).resolves.toMatchObject({ ok: true, data: { faction: 'owls' } });
  });

  it('login com senha errada devolve mensagem amigável', async () => {
    const r = await authRepo.signIn(email, 'senha-errada');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['UNAUTHORIZED', 'RATE_LIMITED']).toContain(r.error.code);
  });

  it('exporta os dados (LGPD)', async () => {
    const r = await accountRepo.exportMyData();
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.data)).toContain(username);
  });

  it('QA-03: recuperação de senha pelo fluxo PKCE (e-mail local → code → sessão → senha nova)', async () => {
    await authRepo.signOut();
    const t0 = Date.now();
    await expect(authRepo.sendPasswordReset(email, 'nomaderun://nova-senha')).resolves.toEqual({ ok: true, data: undefined });
    const verify = await recoveryLinkFor(email, t0);
    expect(verify).not.toBeNull();
    // o link do e-mail passa pelo Auth, que redireciona para o app só com `?code=` (nada de tokens)
    const hop = await nodeFetch!(verify!, { redirect: 'manual' });
    const appUrl = hop.headers.get('location') ?? '';
    expect(appUrl).toMatch(/^nomaderun:\/\/nova-senha\?code=/);
    expect(appUrl).not.toContain('access_token');
    const cb = parseAuthCallback(appUrl);
    expect(cb?.kind).toBe('code');
    expect(isRecoveryLink(appUrl, cb)).toBe(true);
    // o mesmo code em outro aparelho (sem o verificador) não serve
    const otherDevice = createClient(URL, ANON, { global: { fetch: nodeFetch }, auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' } });
    const stolen = await otherDevice.auth.exchangeCodeForSession((cb as { code: string }).code);
    expect(stolen.data.session).toBeNull();
    const s = await authRepo.sessionFromCallback(cb!);
    expect(s).toMatchObject({ ok: true, data: { userId } });
    await expect(authRepo.updatePassword(newPassword)).resolves.toEqual({ ok: true, data: undefined });
    await authRepo.signOut();
    await expect(authRepo.signIn(email, newPassword)).resolves.toMatchObject({ ok: true, data: { userId } });
  });

  it('QA-03: link com tokens na URL (fluxo implícito) é recusado e não troca a sessão', async () => {
    const before = await authRepo.getCurrentSession();
    const forged = parseAuthCallback('nomaderun://nova-senha#access_token=forjado&refresh_token=forjado&type=recovery');
    await expect(authRepo.sessionFromCallback(forged!)).resolves.toMatchObject({ ok: false, error: { detail: 'IMPLICIT_TOKENS' } });
    await expect(authRepo.getCurrentSession()).resolves.toEqual(before);
  });

  it('QA-06: excluir com a senha errada é recusado com mensagem amigável', async () => {
    const r = await accountRepo.deleteMyAccount('senha-errada-123');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(accountRepo.isWrongPasswordError(r.error)).toBe(true);
      expect(r.error.message).toBe(MESSAGES.wrongPassword);
    }
  });

  it('exclui a conta e não consegue mais entrar', async () => {
    const r = await accountRepo.deleteMyAccount(newPassword);
    expect(r.ok).toBe(true);
    deleted = r.ok;
    await authRepo.signOut();
    const again = await authRepo.signIn(email, newPassword);
    expect(again.ok).toBe(false);
  });
});
