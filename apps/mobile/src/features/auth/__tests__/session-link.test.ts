import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AppError, MESSAGES } from '@/services/api/errors';
import { useSession } from '@/store/session-store';

/**
 * QA-03: links de autenticação com alguém já conectado só trocam a conta depois de confirmados;
 * tokens soltos na URL nunca viram sessão (a recusa em si é testada em auth-repo.test.ts).
 */
type AnyFn = (...args: any[]) => any;
jest.mock('@/services/api/auth-repo', () => ({
  getCurrentSession: jest.fn(),
  sessionFromCallback: jest.fn(),
  onAuthChange: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@/services/api/profile-cache', () => ({ readCachedProfile: jest.fn(), writeCachedProfile: jest.fn() }));
jest.mock('@/services/api/profile-repo', () => ({}));
jest.mock('@/store/game-store', () => {
  const resetForSignOut = jest.fn();
  return { useGame: { getState: () => ({ resetForSignOut, applyProfile: jest.fn() }) } };
});
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(), addEventListener: jest.fn() }));

const { confirmPendingLink, dismissPendingLink, endSessionForInactiveAccount, handleAuthUrl } = jest.requireActual<typeof import('../session-controller')>('../session-controller');
const mockRepo = jest.requireMock<Record<'getCurrentSession' | 'sessionFromCallback' | 'signOut', jest.Mock<AnyFn>>>('@/services/api/auth-repo');
const mockReset = jest.requireMock<{ useGame: { getState: () => { resetForSignOut: jest.Mock } } }>('@/store/game-store').useGame.getState().resetForSignOut;

const ANA = { userId: 'ana', email: 'ana@ex.com' };
const BIA = { userId: 'bia', email: 'bia@ex.com' };
const RECOVERY = 'nomaderun://nova-senha?code=abc';

beforeEach(() => {
  jest.clearAllMocks();
  useSession.getState().reset();
});

describe('handleAuthUrl (QA-03)', () => {
  it('sem ninguém conectado: troca o code pela sessão e marca recuperação', async () => {
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: null });
    mockRepo.sessionFromCallback.mockResolvedValue({ ok: true, data: ANA });
    await expect(handleAuthUrl(RECOVERY)).resolves.toBeNull();
    expect(mockRepo.sessionFromCallback).toHaveBeenCalledWith({ kind: 'code', code: 'abc', type: null });
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', session: ANA, recovering: true, pendingLink: null });
  });

  it('link de tokens sem sessão: erro amigável na tela de nova senha', async () => {
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: null });
    const unsafe = new AppError('UNAUTHORIZED', MESSAGES.linkUnsafe, { detail: 'IMPLICIT_TOKENS' });
    mockRepo.sessionFromCallback.mockResolvedValue({ ok: false, error: unsafe });
    await expect(handleAuthUrl('nomaderun://nova-senha#access_token=a&refresh_token=r&type=recovery')).resolves.toBe(unsafe);
    expect(useSession.getState().linkError).toBe(unsafe);
    expect(useSession.getState().session).toBeNull();
  });

  it('com alguém conectado: o link fica pendente e nada muda até confirmar', async () => {
    useSession.getState().setSession(ANA);
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: ANA });
    await handleAuthUrl(RECOVERY);
    expect(mockRepo.sessionFromCallback).not.toHaveBeenCalled();
    expect(useSession.getState()).toMatchObject({ session: ANA, recovering: false, pendingLink: { url: RECOVERY, currentEmail: 'ana@ex.com' } });

    dismissPendingLink();
    expect(useSession.getState().pendingLink).toBeNull();
    expect(useSession.getState().session).toEqual(ANA);
  });

  it('confirmando a troca para outra conta: usa o link e limpa o progresso local da anterior', async () => {
    useSession.getState().setSession(ANA);
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: ANA });
    await handleAuthUrl(RECOVERY);
    mockRepo.sessionFromCallback.mockResolvedValue({ ok: true, data: BIA });
    await expect(confirmPendingLink()).resolves.toBeNull();
    expect(mockRepo.sessionFromCallback).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({ session: BIA, recovering: true, pendingLink: null });
  });

  it('confirmado mas o link falha: continua na conta de antes, sem modo recuperação', async () => {
    useSession.getState().setSession(ANA);
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: ANA });
    await handleAuthUrl(RECOVERY);
    const expired = new AppError('UNAUTHORIZED', MESSAGES.linkOtherDevice);
    mockRepo.sessionFromCallback.mockResolvedValue({ ok: false, error: expired });
    await expect(confirmPendingLink()).resolves.toBe(expired);
    expect(useSession.getState()).toMatchObject({ session: ANA, recovering: false });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('com alguém conectado, links de erro ou com tokens são ignorados (sem pedir confirmação)', async () => {
    useSession.getState().setSession(ANA);
    mockRepo.getCurrentSession.mockResolvedValue({ ok: true, data: ANA });
    await handleAuthUrl('nomaderun://nova-senha#access_token=a&refresh_token=r&type=recovery');
    await handleAuthUrl('nomaderun://nova-senha#error=access_denied&error_description=expired');
    expect(mockRepo.sessionFromCallback).not.toHaveBeenCalled();
    expect(useSession.getState()).toMatchObject({ session: ANA, pendingLink: null, linkError: null });
  });

  it('links que não são de autenticação não fazem nada', async () => {
    await expect(handleAuthUrl('nomaderun://zona/89a8')).resolves.toBeNull();
    expect(mockRepo.getCurrentSession).not.toHaveBeenCalled();
  });
});

describe('conta inativada (P-39)', () => {
  it('encerra a sessão e deixa o aviso para a tela Entrar', async () => {
    useSession.getState().setSession(ANA);
    mockRepo.signOut.mockResolvedValue({ ok: true, data: undefined });
    await endSessionForInactiveAccount();
    expect(mockRepo.signOut).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', session: null, signedOutNotice: MESSAGES.accountInactive });
    // sem sessão, não faz nada
    await endSessionForInactiveAccount();
    expect(mockRepo.signOut).toHaveBeenCalledTimes(1);
  });
});
