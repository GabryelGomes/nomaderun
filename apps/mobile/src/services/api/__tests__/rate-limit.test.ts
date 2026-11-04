/**
 * F8 C3 (D-99): o limite por pessoa das Edge Functions responde 429 `RATE_LIMITED`; o app mostra
 * "Muitas tentativas. Tente de novo em instantes." e o sync trata como erro temporário (tenta de novo depois).
 */
import { describe, expect, it } from '@jest/globals';

import { fromHttp, MESSAGES, toAppError } from '../errors';
import { errorFromFunctions } from '../functions';
import { parseFunctionsError } from '@/services/sync/transport';
import { isRetryable } from '@/services/sync/types';

const body = { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente de novo em instantes.', details: { retryAfter: 17 } } };
const httpError = (status: number, json: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: { status, clone: () => ({ json: async () => json }) },
});

describe('limite de chamadas das Edge Functions (429 RATE_LIMITED)', () => {
  it('a mensagem pedida existe e é curta', () => {
    expect(MESSAGES.tooManyRequests).toBe('Muitas tentativas. Tente de novo em instantes.');
  });

  it('fromHttp com o corpo do contrato vira RATE_LIMITED com a frase do app', () => {
    const e = fromHttp(429, body);
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.detail).toBe('RATE_LIMITED');
    expect(e.status).toBe(429);
    expect(e.message).toBe(MESSAGES.tooManyRequests);
  });

  it('429 sem corpo também mostra "em instantes"', () => {
    expect(fromHttp(429).message).toBe(MESSAGES.tooManyRequests);
    expect(toAppError(httpError(429, null)).message).toBe(MESSAGES.tooManyRequests);
  });

  it('callFunction lê o corpo da FunctionsHttpError', async () => {
    const e = await errorFromFunctions(httpError(429, body));
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.message).toBe(MESSAGES.tooManyRequests);
  });

  it('o login continua com a frase do Auth (limite de minutos, não de instantes)', () => {
    const e = toAppError({ __isAuthError: true, name: 'AuthApiError', code: 'over_request_rate_limit', status: 429, message: '' });
    expect(e.message).toBe(MESSAGES.rateLimited);
  });

  it('no sync, o envio da corrida recusado por limite fica para depois (não se perde)', async () => {
    const failure = await parseFunctionsError(httpError(429, body));
    expect(failure.code).toBe('RATE_LIMITED');
    expect(failure.status).toBe(429);
    expect(isRetryable(failure)).toBe(true);
  });
});
