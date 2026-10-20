import { describe, expect, it } from '@jest/globals';

import { AppError, attempt, fromHttp, MESSAGES, onAccountInactive, splitServerMessage, toAppError } from '../errors';

const authErr = (props: Record<string, unknown>) => ({ __isAuthError: true, name: 'AuthApiError', message: '', ...props });

describe('toAppError — Supabase Auth', () => {
  it('credenciais inválidas', () => {
    const e = toAppError(authErr({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }));
    expect(e.code).toBe('UNAUTHORIZED');
    expect(e.message).toBe(MESSAGES.invalidCredentials);
  });

  it('credenciais inválidas sem código (versões antigas do GoTrue)', () => {
    expect(toAppError(authErr({ status: 400, message: 'Invalid login credentials' })).message).toBe(MESSAGES.invalidCredentials);
  });

  it('muitas tentativas (RNF-007, 10 a cada 15 min)', () => {
    expect(toAppError(authErr({ code: 'over_request_rate_limit', status: 429 })).code).toBe('RATE_LIMITED');
    expect(toAppError(authErr({ status: 429, message: 'Too many requests' })).code).toBe('RATE_LIMITED');
    expect(toAppError(authErr({ code: 'over_email_send_rate_limit', status: 429 })).message).toBe(MESSAGES.rateLimited);
  });

  it('sem internet', () => {
    const e = toAppError({ __isAuthError: true, name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 });
    expect(e.code).toBe('NETWORK');
    expect(e.message).toBe(MESSAGES.network);
  });

  it('e-mail já cadastrado, senha fraca, e-mail não confirmado, link expirado', () => {
    expect(toAppError(authErr({ code: 'user_already_exists', status: 422 })).code).toBe('CONFLICT');
    expect(toAppError(authErr({ code: 'weak_password', status: 422 })).code).toBe('VALIDATION');
    expect(toAppError(authErr({ code: 'email_not_confirmed', status: 400 })).message).toBe(MESSAGES.emailNotConfirmed);
    expect(toAppError(authErr({ code: 'otp_expired', status: 403 })).message).toBe(MESSAGES.linkExpired);
    expect(toAppError(authErr({ code: 'session_not_found', status: 403 })).message).toBe(MESSAGES.sessionExpired);
  });

  it('erro do trigger no cadastro vira conflito com mensagem de nome de usuário', () => {
    const e = toAppError(authErr({ status: 500, code: 'unexpected_failure', message: 'Database error saving new user' }));
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe(MESSAGES.signupDb);
  });

  it('sessão ausente', () => {
    expect(toAppError({ __isAuthError: true, name: 'AuthSessionMissingError', message: 'Auth session missing!' }).code).toBe('UNAUTHORIZED');
  });
});

describe('toAppError — PostgREST', () => {
  it('nome de usuário duplicado (23505)', () => {
    const e = toAppError({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_key"', details: 'Key (username)=(ana) already exists.' });
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe(MESSAGES.usernameTaken);
  });

  it('outros 23505 são conflito genérico', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key', details: 'Key (id)=(1)' }).message).toBe(MESSAGES.conflict);
  });

  it('RLS, não encontrado, JWT expirado, função inexistente', () => {
    expect(toAppError({ code: '42501', message: 'permission denied' }).code).toBe('UNAUTHORIZED');
    expect(toAppError({ code: 'PGRST116', message: '0 rows' }).code).toBe('NOT_FOUND');
    expect(toAppError({ code: 'PGRST301', message: 'JWT expired' }).message).toBe(MESSAGES.sessionExpired);
    expect(toAppError({ code: 'PGRST202', message: 'Could not find the function' }).message).toBe(MESSAGES.unavailable);
  });

  it('RAISE EXCEPTION do servidor mantém a mensagem pt-BR', () => {
    const e = toAppError({ code: 'P0001', message: 'Você já trocou de facção nesta temporada.' });
    expect(e.code).toBe('VALIDATION');
    expect(e.message).toBe('Você já trocou de facção nesta temporada.');
  });

  it('mensagens "CODIGO: texto" do backend', () => {
    expect(splitServerMessage('FACTION_CHANGE_LIMIT: a facção só pode ser trocada uma vez por temporada')).toEqual({
      code: 'FACTION_CHANGE_LIMIT',
      message: 'A facção só pode ser trocada uma vez por temporada.',
    });
    expect(splitServerMessage('texto comum')).toBeNull();
    expect(toAppError({ code: 'P0001', message: 'FACTION_CHANGE_LIMIT: a facção só pode ser trocada uma vez por temporada' })).toMatchObject({
      code: 'VALIDATION',
      detail: 'FACTION_CHANGE_LIMIT',
    });
    expect(toAppError({ code: '23505', message: 'USERNAME_TAKEN: nome de usuário já está em uso' })).toMatchObject({ code: 'CONFLICT', message: 'Nome de usuário já está em uso.' });
    expect(toAppError({ code: 'P0001', message: 'UNAUTHORIZED: faça login novamente' }).code).toBe('UNAUTHORIZED');
  });

  it('violação de check vira validação', () => {
    expect(toAppError({ code: '23514', message: 'check' }).code).toBe('VALIDATION');
  });
});

describe('toAppError — Functions, rede e desconhecidos', () => {
  it('FunctionsFetchError é rede; FunctionsRelayError é servidor', () => {
    expect(toAppError({ name: 'FunctionsFetchError', message: 'x' }).code).toBe('NETWORK');
    expect(toAppError({ name: 'FunctionsRelayError', message: 'x' }).code).toBe('SERVER');
  });

  it('FunctionsHttpError usa o status da resposta', () => {
    expect(toAppError({ name: 'FunctionsHttpError', context: { status: 409 } }).code).toBe('CONFLICT');
    expect(toAppError({ name: 'FunctionsHttpError' }).code).toBe('SERVER');
  });

  it('TypeError de fetch é rede', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('NETWORK');
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('NETWORK');
  });

  it('AppError passa direto; valores estranhos viram UNKNOWN', () => {
    const original = new AppError('CONFLICT', 'x');
    expect(toAppError(original)).toBe(original);
    expect(toAppError(undefined).code).toBe('UNKNOWN');
    expect(toAppError('boom').code).toBe('UNKNOWN');
    expect(toAppError(new Error('qualquer')).code).toBe('UNKNOWN');
  });

  it('objeto com status HTTP', () => {
    expect(toAppError({ status: 503 }).code).toBe('SERVER');
  });
});

describe('fromHttp (corpo de erro do contrato)', () => {
  it('usa a mensagem do servidor quando existe', () => {
    const e = fromHttp(409, { error: { code: 'OUT_OF_ORDER', message: 'Lote fora de ordem.' } });
    expect(e).toMatchObject({ code: 'CONFLICT', detail: 'OUT_OF_ORDER', status: 409, message: 'Lote fora de ordem.' });
  });

  it.each([
    [0, 'NETWORK'],
    [400, 'VALIDATION'],
    [422, 'VALIDATION'],
    [401, 'UNAUTHORIZED'],
    [403, 'UNAUTHORIZED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [500, 'SERVER'],
    [418, 'UNKNOWN'],
  ])('status %i → %s', (status, code) => {
    expect(fromHttp(status).code).toBe(code);
  });
});

describe('attempt', () => {
  it('embrulha sucesso e falha em Result', async () => {
    await expect(attempt(async () => 1)).resolves.toEqual({ ok: true, data: 1 });
    const r = await attempt(async () => {
      throw { code: '23505', message: 'username' };
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICT');
  });
});

describe('conta inativada (D-50, P-39)', () => {
  it('PostgREST (PT401) e functions (401 ACCOUNT_INACTIVE) viram a mesma mensagem e avisam os ouvintes', () => {
    const calls: number[] = [];
    const off = onAccountInactive(() => calls.push(1));
    const pg = toAppError({ code: 'PT401', message: 'ACCOUNT_INACTIVE: conta inativa', details: null, hint: null });
    expect(pg).toMatchObject({ code: 'UNAUTHORIZED', detail: 'ACCOUNT_INACTIVE', message: MESSAGES.accountInactive });
    const fn = fromHttp(401, { error: { code: 'ACCOUNT_INACTIVE', message: 'Conta inativa.' } });
    expect(fn).toMatchObject({ code: 'UNAUTHORIZED', detail: 'ACCOUNT_INACTIVE', message: MESSAGES.accountInactive });
    expect(calls).toHaveLength(2);
    off();
    fromHttp(401, { error: { code: 'ACCOUNT_INACTIVE' } });
    expect(calls).toHaveLength(2);
    // 401 comum (token vencido) não é conta inativada
    expect(fromHttp(401, { error: { code: 'UNAUTHORIZED' } }).detail).toBe('UNAUTHORIZED');
  });

  it('troca de senha que pede login recente (secure_password_change) tem mensagem própria', () => {
    expect(toAppError({ __isAuthError: true, name: 'AuthApiError', status: 400, code: 'reauthentication_needed', message: 'x' })).toMatchObject({ message: MESSAGES.reauthNeeded });
  });
});
