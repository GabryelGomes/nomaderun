import { describe, expect, it } from '@jest/globals';

import { isRecoveryLink, parseAuthCallback } from '../deep-link';

describe('parseAuthCallback', () => {
  it('fluxo implícito: tokens no fragmento', () => {
    const url = 'nomaderun://nova-senha#access_token=aaa&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery';
    const cb = parseAuthCallback(url);
    expect(cb).toEqual({ kind: 'tokens', accessToken: 'aaa', refreshToken: 'rrr', type: 'recovery' });
    expect(isRecoveryLink(url, cb)).toBe(true);
  });

  it('fluxo PKCE: code na query', () => {
    expect(parseAuthCallback('nomaderun://entrar?code=abc123')).toEqual({ kind: 'code', code: 'abc123', type: null });
  });

  it('erro no link (expirado)', () => {
    const cb = parseAuthCallback('nomaderun://nova-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(cb).toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' });
    expect(isRecoveryLink('nomaderun://nova-senha', cb)).toBe(false);
  });

  it('links comuns não são de autenticação', () => {
    expect(parseAuthCallback('nomaderun://zona/89a8')).toBeNull();
    expect(parseAuthCallback(null)).toBeNull();
    expect(parseAuthCallback('nomaderun://x?%E0%A4%A=1')).toBeNull();
  });

  it('confirmação de cadastro não é recuperação', () => {
    const url = 'nomaderun://entrar#access_token=a&refresh_token=r&type=signup';
    expect(isRecoveryLink(url, parseAuthCallback(url))).toBe(false);
  });
});
