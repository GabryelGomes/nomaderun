/**
 * @jest-environment node
 */
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import * as accountRepo from '../account-repo';
import * as authRepo from '../auth-repo';
import * as profileRepo from '../profile-repo';

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
    },
  });
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
  let userId = '';
  let deleted = false;

  afterAll(async () => {
    if (!deleted && userId) await accountRepo.deleteMyAccount();
  });

  it('nome livre antes do cadastro', async () => {
    await expect(profileRepo.isUsernameAvailable(username)).resolves.toEqual({ ok: true, data: true });
  });

  it('cadastro com 16+ e aceites cria sessão e perfil sem facção', async () => {
    const r = await authRepo.signUp({ email, password, username, birthdate: '2000-05-10', acceptedTerms: true, acceptedPrivacy: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.needsConfirmation).toBe(false);
    userId = r.data.session?.userId ?? '';
    const p = await profileRepo.getMyProfile(userId);
    expect(p).toMatchObject({ ok: true, data: { username, faction: null, unit: 'km', role: 'runner' } });
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

  it('exclui a conta e não consegue mais entrar', async () => {
    const r = await accountRepo.deleteMyAccount();
    expect(r.ok).toBe(true);
    deleted = r.ok;
    await authRepo.signOut();
    const again = await authRepo.signIn(email, password);
    expect(again.ok).toBe(false);
  });
});
