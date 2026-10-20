import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import * as authRepo from '../auth-repo';
import { MESSAGES } from '../errors';
import * as profileRepo from '../profile-repo';
import * as accountRepo from '../account-repo';

type AnyFn = (...args: any[]) => any;
const fn = () => jest.fn<AnyFn>();

const auth = {
  signInWithPassword: fn(),
  signUp: fn(),
  signOut: fn(),
  resetPasswordForEmail: fn(),
  updateUser: fn(),
  setSession: fn(),
  exchangeCodeForSession: fn(),
  getSession: fn(),
};
const single = fn();
const query = { select: fn(), eq: fn(), update: fn(), single };
query.select.mockReturnValue(query);
query.eq.mockReturnValue(query);
query.update.mockReturnValue(query);
const mockClient = { auth, from: jest.fn<AnyFn>(() => query), rpc: fn(), functions: { invoke: fn() } };

jest.mock('../supabase', () => ({ requireSupabase: () => mockClient, getSupabase: () => mockClient }));

const session = { user: { id: 'u1', email: 'ana@ex.com' } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth-repo', () => {
  it('signIn devolve a sessão', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    await expect(authRepo.signIn(' ana@ex.com ', 'segredo123')).resolves.toEqual({ ok: true, data: { userId: 'u1', email: 'ana@ex.com' } });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@ex.com', password: 'segredo123' });
  });

  it('signIn com credenciais erradas devolve mensagem pt-BR', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { __isAuthError: true, name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
    const r = await authRepo.signIn('a@b.com', 'x');
    expect(r).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED', message: MESSAGES.invalidCredentials } });
  });

  it('signUp envia username, nascimento e os dois aceites em options.data', async () => {
    auth.signUp.mockResolvedValue({ data: { session, user: { identities: [{}] } }, error: null });
    const r = await authRepo.signUp({
      email: 'ana@ex.com',
      password: 'segredo123',
      username: ' ana_corre ',
      birthdate: '2000-05-10',
      acceptedTerms: true,
      acceptedPrivacy: true,
      emailRedirectTo: 'nomaderun://entrar',
    });
    expect(r).toEqual({ ok: true, data: { session: { userId: 'u1', email: 'ana@ex.com' }, needsConfirmation: false } });
    const arg = auth.signUp.mock.calls[0][0];
    expect(arg.options.emailRedirectTo).toBe('nomaderun://entrar');
    expect(arg.options.data).toMatchObject({
      username: 'ana_corre',
      birthdate: '2000-05-10',
      accepted_terms: true,
      accepted_privacy: true,
      terms_version: authRepo.TERMS_VERSION,
      privacy_version: authRepo.PRIVACY_VERSION,
    });
    expect(typeof arg.options.data.terms_accepted_at).toBe('string');
  });

  it('signUp sem sessão = precisa confirmar e-mail; sem identidades = e-mail já usado', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { identities: [{}] } }, error: null });
    const input = { email: 'a@b.com', password: '12345678', username: 'ana', birthdate: '2000-01-01', acceptedTerms: true, acceptedPrivacy: true };
    await expect(authRepo.signUp(input)).resolves.toEqual({ ok: true, data: { session: null, needsConfirmation: true } });
    auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { identities: [] } }, error: null });
    await expect(authRepo.signUp(input)).resolves.toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('signOut cai para logout local se o global falhar', async () => {
    auth.signOut.mockResolvedValueOnce({ error: { name: 'AuthRetryableFetchError' } }).mockResolvedValueOnce({ error: null });
    await expect(authRepo.signOut()).resolves.toEqual({ ok: true, data: undefined });
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });

  it('sessionFromCallback usa setSession (tokens) ou exchangeCodeForSession (code)', async () => {
    auth.setSession.mockResolvedValue({ data: { session }, error: null });
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    await authRepo.sessionFromCallback({ kind: 'tokens', accessToken: 'a', refreshToken: 'r', type: 'recovery' });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    await authRepo.sessionFromCallback({ kind: 'code', code: 'c1', type: null });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('c1');
    const r = await authRepo.sessionFromCallback({ kind: 'error', code: 'otp_expired', description: 'expired' });
    expect(r).toMatchObject({ ok: false, error: { message: MESSAGES.linkExpired } });
  });

  it('sendPasswordReset repassa o redirect do deep link', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await authRepo.sendPasswordReset(' a@b.com ', 'nomaderun://nova-senha');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'nomaderun://nova-senha' });
  });
});

describe('profile-repo e account-repo', () => {
  it('getMyProfile filtra pelo próprio id', async () => {
    single.mockResolvedValue({ data: { id: 'u1', username: 'ana', faction: null }, error: null });
    const r = await profileRepo.getMyProfile('u1');
    expect(mockClient.from).toHaveBeenCalledWith('profiles');
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
    expect(r).toMatchObject({ ok: true, data: { username: 'ana', faction: null } });
  });

  it('updateMyProfile com nome repetido devolve CONFLICT', async () => {
    single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key', details: 'Key (username)=(ana)' } });
    const r = await profileRepo.updateMyProfile('u1', { username: 'ana' });
    expect(query.update).toHaveBeenCalledWith({ username: 'ana' });
    expect(r).toMatchObject({ ok: false, error: { code: 'CONFLICT', message: MESSAGES.usernameTaken } });
  });

  it('chooseFaction chama o RPC do contrato', async () => {
    mockClient.rpc.mockResolvedValue({ error: null });
    await expect(profileRepo.chooseFaction('volt')).resolves.toEqual({ ok: true, data: undefined });
    expect(mockClient.rpc).toHaveBeenCalledWith('choose_faction', { p_faction: 'volt' });
  });

  it('username_available antes do cadastro', async () => {
    mockClient.rpc.mockResolvedValue({ data: false, error: null });
    await expect(profileRepo.isUsernameAvailable(' ana ')).resolves.toEqual({ ok: true, data: false });
    expect(mockClient.rpc).toHaveBeenCalledWith('username_available', { p_username: 'ana' });
  });

  it('exportar (GET) e excluir (POST com EXCLUIR) chamam as Edge Functions', async () => {
    mockClient.functions.invoke.mockResolvedValue({ data: { profile: {} }, error: null });
    await expect(accountRepo.exportMyData()).resolves.toEqual({ ok: true, data: { profile: {} } });
    expect(mockClient.functions.invoke).toHaveBeenCalledWith('account-export', { method: 'GET', body: undefined });
    await accountRepo.deleteMyAccount();
    expect(mockClient.functions.invoke).toHaveBeenLastCalledWith('account-delete', { method: 'POST', body: { confirm: 'EXCLUIR' } });
  });

  it('erro de rede nas functions vira NETWORK', async () => {
    mockClient.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send' } });
    await expect(accountRepo.exportMyData()).resolves.toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });
});
