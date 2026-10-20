/**
 * Erros esperados viram `AppError` com mensagem em português; exceções ficam só para bugs
 * (ARQUITETURA §2, "Result tipado"). Este módulo não importa o supabase-js: reconhece os
 * erros pelo formato (nome, `code`, `status`), o que facilita os testes.
 */
export type AppErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Código original (Auth, Postgres, contrato da API) para logs e decisões finas na tela. */
  readonly detail?: string;
  readonly status?: number;

  constructor(code: AppErrorCode, message: string, opts: { detail?: string; status?: number } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = opts.detail;
    this.status = opts.status;
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never>(error: AppError): Result<T> => ({ ok: false, error });

export const MESSAGES = {
  network: 'Sem conexão com a internet. Verifique sua rede e tente de novo.',
  invalidCredentials: 'E-mail ou senha incorretos.',
  emailNotConfirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  rateLimited: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  emailTaken: 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.',
  usernameTaken: 'Este nome de usuário já está em uso. Escolha outro.',
  signupDb:
    'Não foi possível criar a conta. O nome de usuário pode já estar em uso ou algum dado não foi aceito. Revise e tente de novo.',
  weakPassword: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  samePassword: 'A nova senha precisa ser diferente da atual.',
  linkExpired: 'O link expirou ou já foi usado. Peça um novo.',
  linkOtherDevice:
    'Abra o link no mesmo celular em que você fez o pedido. Se era a confirmação do cadastro, seu e-mail já foi confirmado: entre com sua senha.',
  linkUnsafe: 'Por segurança, este link não é aceito. Peça um novo pelo app.',
  wrongPassword: 'Senha incorreta. Confira e tente de novo.',
  accountInactive: 'Conta inativada. Sua sessão foi encerrada. Fale com o suporte do NOMADE RUN.',
  reauthNeeded: 'Por segurança, entre de novo antes de trocar a senha.',
  passwordRequired: 'Digite sua senha atual para confirmar.',
  sessionExpired: 'Sua sessão expirou. Entre de novo.',
  invalidEmail: 'Confira o e-mail digitado.',
  banned: 'Esta conta está inativa. Fale com o suporte do NOMADE RUN.',
  forbidden: 'Você não tem permissão para fazer isso.',
  notFound: 'Não encontramos o que você procurou.',
  conflict: 'Esse registro já existe.',
  validation: 'Algum dado não foi aceito. Revise e tente de novo.',
  server: 'O servidor não respondeu como esperado. Tente de novo em instantes.',
  unavailable: 'Este recurso ainda não está disponível no servidor.',
  unknown: 'Algo deu errado. Tente de novo.',
} as const;

/**
 * Conta inativada pelo admin (D-50, QA-07): PostgREST e functions respondem 401 `ACCOUNT_INACTIVE`.
 * Quem montar a sessão (session-controller) escuta aqui para encerrar a sessão e avisar a pessoa.
 */
export const ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE';
const inactiveListeners = new Set<() => void>();

export function onAccountInactive(listener: () => void): () => void {
  inactiveListeners.add(listener);
  return () => {
    inactiveListeners.delete(listener);
  };
}

/** Avisa os ouvintes (usado também pelo transporte do sync, que não passa por `fromHttp`). */
export function reportAccountInactive() {
  for (const l of inactiveListeners) {
    try {
      l();
    } catch {
      /* um ouvinte com erro não impede os outros */
    }
  }
}

function accountInactive(status = 401): AppError {
  reportAccountInactive();
  return new AppError('UNAUTHORIZED', MESSAGES.accountInactive, { detail: ACCOUNT_INACTIVE, status });
}

type Loose = { name?: unknown; message?: unknown; code?: unknown; status?: unknown; details?: unknown; hint?: unknown; __isAuthError?: unknown };

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

function isNetworkMessage(msg: string | undefined) {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes('network request failed') || m.includes('failed to fetch') || m.includes('fetch failed') || m.includes('networkerror') || m.includes('network error') || m.includes('load failed');
}

/** Mapeia um status HTTP (e o corpo `{ error: { code, message } }` do contrato) para AppError. */
export function fromHttp(status: number, body?: unknown): AppError {
  const e = (body && typeof body === 'object' ? (body as { error?: { code?: unknown; message?: unknown } }).error : undefined) ?? undefined;
  const serverCode = str(e?.code);
  const serverMsg = str(e?.message);
  const opts = { detail: serverCode, status };
  if (serverCode === ACCOUNT_INACTIVE) return accountInactive(status);
  if (status === 0) return new AppError('NETWORK', MESSAGES.network, opts);
  if (status === 400 || status === 422) return new AppError('VALIDATION', serverMsg ?? MESSAGES.validation, opts);
  if (status === 401) return new AppError('UNAUTHORIZED', serverMsg ?? MESSAGES.sessionExpired, opts);
  if (status === 403) return new AppError('UNAUTHORIZED', serverMsg ?? MESSAGES.forbidden, opts);
  if (status === 404) return new AppError('NOT_FOUND', serverMsg ?? MESSAGES.unavailable, opts);
  if (status === 409) return new AppError('CONFLICT', serverMsg ?? MESSAGES.conflict, opts);
  if (status === 429) return new AppError('RATE_LIMITED', serverMsg ?? MESSAGES.rateLimited, opts);
  if (status >= 500) return new AppError('SERVER', serverMsg ?? MESSAGES.server, opts);
  return new AppError('UNKNOWN', serverMsg ?? MESSAGES.unknown, opts);
}

function fromAuth(e: Loose): AppError {
  const code = str(e.code);
  const status = num(e.status);
  const name = str(e.name);
  const msg = str(e.message) ?? '';
  const opts = { detail: code ?? name, status };

  if (name === 'AuthRetryableFetchError' || status === 0 || isNetworkMessage(msg)) return new AppError('NETWORK', MESSAGES.network, opts);
  switch (code) {
    case 'invalid_credentials':
      return new AppError('UNAUTHORIZED', MESSAGES.invalidCredentials, opts);
    case 'email_not_confirmed':
      return new AppError('UNAUTHORIZED', MESSAGES.emailNotConfirmed, opts);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return new AppError('RATE_LIMITED', MESSAGES.rateLimited, opts);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('CONFLICT', MESSAGES.emailTaken, opts);
    case 'weak_password':
      return new AppError('VALIDATION', MESSAGES.weakPassword, opts);
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return new AppError('UNAUTHORIZED', MESSAGES.reauthNeeded, opts);
    case 'same_password':
      return new AppError('VALIDATION', MESSAGES.samePassword, opts);
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return new AppError('UNAUTHORIZED', MESSAGES.linkExpired, opts);
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
    case 'bad_jwt':
    case 'no_authorization':
      return new AppError('UNAUTHORIZED', MESSAGES.sessionExpired, opts);
    case 'email_address_invalid':
    case 'validation_failed':
      return new AppError('VALIDATION', MESSAGES.invalidEmail, opts);
    case 'user_banned':
      return new AppError('UNAUTHORIZED', MESSAGES.banned, opts);
  }
  if (/invalid login credentials/i.test(msg)) return new AppError('UNAUTHORIZED', MESSAGES.invalidCredentials, opts);
  if (/database error saving new user/i.test(msg)) return new AppError('CONFLICT', MESSAGES.signupDb, opts);
  if (/rate limit/i.test(msg) || status === 429) return new AppError('RATE_LIMITED', MESSAGES.rateLimited, opts);
  if (name === 'AuthPKCECodeVerifierMissingError') return new AppError('UNAUTHORIZED', MESSAGES.linkOtherDevice, opts);
  if (name === 'AuthSessionMissingError') return new AppError('UNAUTHORIZED', MESSAGES.sessionExpired, opts);
  if (status) return fromHttp(status);
  return new AppError('UNKNOWN', MESSAGES.unknown, opts);
}

/**
 * O backend escreve as exceções como "CODIGO: mensagem em pt-BR" (ex.: "FACTION_CHANGE_LIMIT: a facção
 * só pode ser trocada uma vez por temporada"). Separa o código e devolve a frase com inicial maiúscula.
 */
export function splitServerMessage(message: string | undefined): { code: string; message: string } | null {
  const m = message ? /^([A-Z][A-Z0-9_]{2,}):\s*(.+)$/s.exec(message.trim()) : null;
  if (!m) return null;
  const text = m[2].trim();
  return { code: m[1], message: text.charAt(0).toUpperCase() + text.slice(1).replace(/([^.!?])$/, '$1.') };
}

const SERVER_CODE_TO_APP: Record<string, AppErrorCode> = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'UNAUTHORIZED',
  NOT_OWNER: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  USERNAME_TAKEN: 'CONFLICT',
  ALREADY_IN_CREW: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
};

function fromPostgrest(e: Loose): AppError {
  const code = str(e.code) ?? '';
  const text = `${str(e.message) ?? ''} ${str(e.details) ?? ''}`.toLowerCase();
  const opts = { detail: code };
  const server = splitServerMessage(str(e.message));
  if (server?.code === ACCOUNT_INACTIVE) return accountInactive();
  if (server) {
    const mapped = SERVER_CODE_TO_APP[server.code] ?? (code === '23505' ? 'CONFLICT' : code === '42501' ? 'UNAUTHORIZED' : 'VALIDATION');
    return new AppError(mapped, server.message, { detail: server.code });
  }
  if (code === '23505') return new AppError('CONFLICT', text.includes('username') ? MESSAGES.usernameTaken : MESSAGES.conflict, opts);
  if (code === '42501') return new AppError('UNAUTHORIZED', MESSAGES.forbidden, opts);
  if (code === 'PGRST116') return new AppError('NOT_FOUND', MESSAGES.notFound, opts);
  if (code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303') return new AppError('UNAUTHORIZED', MESSAGES.sessionExpired, opts);
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01') return new AppError('SERVER', MESSAGES.unavailable, opts);
  // RAISE EXCEPTION no Postgres (P0001) traz a mensagem do servidor, que o backend escreve em pt-BR.
  if (code === 'P0001') return new AppError('VALIDATION', str(e.message) ?? MESSAGES.validation, opts);
  if (code.startsWith('22') || code.startsWith('23')) return new AppError('VALIDATION', MESSAGES.validation, opts);
  if (code.startsWith('PGRST')) return new AppError('SERVER', MESSAGES.server, opts);
  return new AppError('SERVER', MESSAGES.server, opts);
}

const isPostgrestCode = (code: string) => /^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST');

/** Converte qualquer erro (Auth, PostgREST, Functions, rede, AppError) em AppError com mensagem pt-BR. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') {
    return new AppError('UNKNOWN', MESSAGES.unknown, { detail: typeof error === 'string' ? error : undefined });
  }
  const e = error as Loose;
  const name = str(e.name) ?? '';
  const msg = str(e.message);

  if (e.__isAuthError === true || name.startsWith('Auth')) return fromAuth(e);
  if (name === 'FunctionsFetchError') return new AppError('NETWORK', MESSAGES.network, { detail: name });
  if (name === 'FunctionsRelayError') return new AppError('SERVER', MESSAGES.server, { detail: name });
  if (name === 'FunctionsHttpError') {
    const status = num((e as { context?: { status?: unknown } }).context?.status);
    return status ? fromHttp(status) : new AppError('SERVER', MESSAGES.server, { detail: name });
  }
  if (isNetworkMessage(msg)) return new AppError('NETWORK', MESSAGES.network, { detail: name || undefined });
  const code = str(e.code);
  if (code && isPostgrestCode(code)) return fromPostgrest(e);
  const status = num(e.status);
  if (status) return fromHttp(status);
  return new AppError('UNKNOWN', MESSAGES.unknown, { detail: msg });
}

/** Atalho para repositórios: executa e devolve Result, nunca lança erro esperado. */
export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(toAppError(e));
  }
}
