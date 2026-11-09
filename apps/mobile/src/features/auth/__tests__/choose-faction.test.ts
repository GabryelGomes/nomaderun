/**
 * F8-D · M1 — `choose_faction` gravou, mas a releitura do perfil falhou (rede, 5xx, 429):
 *  (a) com a cópia do cadastro salva (ainda sem time), o perfil local fica com o time na hora — a pessoa não fica
 *      presa no passo do GPS;
 *  (b) sem cópia salva, a escolha também vale (nada de "escolha de novo", que viraria troca no servidor);
 *  e, na reserva, `chooseFactionOnce` relê o perfil antes e não chama a RPC se o servidor já tem time.
 * F8-D · B3 — sair da conta apaga o time pendente.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AppError } from '@/services/api/errors';
import { useSession } from '@/store/session-store';

type AnyFn = (...args: any[]) => any;
jest.mock('@/services/api/auth-repo', () => ({ signOut: jest.fn(async () => ({ ok: true, data: undefined })) }));
jest.mock('@/services/api/profile-cache', () => ({ readCachedProfile: jest.fn(), writeCachedProfile: jest.fn() }));
jest.mock('@/services/api/profile-repo', () => ({ chooseFaction: jest.fn(), getMyProfile: jest.fn() }));
jest.mock('@/store/game-store', () => {
  const applyProfile = jest.fn();
  const resetForSignOut = jest.fn();
  return { useGame: { getState: () => ({ resetForSignOut, applyProfile }) } };
});
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(), addEventListener: jest.fn() }));
const mockLocal = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (name: string) => mockLocal.get(name) ?? null,
  writeLocal: async (name: string, value: unknown) => {
    if (value === null || value === undefined) mockLocal.delete(name);
    else mockLocal.set(name, value);
  },
}));

const { chooseFaction, chooseFactionOnce, signOut } = jest.requireActual<typeof import('../session-controller')>('../session-controller');
const { usePendingTeam, savePendingTeam } = jest.requireActual<typeof import('../pending-team')>('../pending-team');
const repo = jest.requireMock<Record<'chooseFaction' | 'getMyProfile', jest.Mock<AnyFn>>>('@/services/api/profile-repo');
const cache = jest.requireMock<Record<'readCachedProfile' | 'writeCachedProfile', jest.Mock<AnyFn>>>('@/services/api/profile-cache');
const game = jest.requireMock<{ useGame: { getState: () => { applyProfile: jest.Mock } } }>('@/store/game-store').useGame.getState();

const ANA = { userId: 'ana', email: 'ana@ex.com' };
const PROFILE = { id: 'ana', username: 'ana_corre', faction: null, xp: 0, trust: 100 };
const offline = () => ({ ok: false, error: new AppError('NETWORK', 'Sem conexão.') });

beforeEach(() => {
  jest.clearAllMocks();
  mockLocal.clear();
  usePendingTeam.setState({ team: null, record: null, hydrated: false });
  useSession.getState().reset();
  useSession.getState().setSession(ANA as never);
  useSession.getState().setProfile(PROFILE as never);
  repo.chooseFaction.mockResolvedValue({ ok: true, data: undefined });
});

describe('chooseFaction: gravou e a releitura falhou (F8-D · M1)', () => {
  it('(a) com a cópia do cadastro (sem time): o perfil local fica com o time, e o guarda sai do onboarding', async () => {
    await savePendingTeam('volt');
    repo.getMyProfile.mockResolvedValue(offline());
    cache.readCachedProfile.mockResolvedValue({ ...PROFILE, savedAt: 123 });
    const res = await chooseFaction('volt');
    expect(res).toMatchObject({ ok: true, data: { faction: 'volt' } });
    expect(useSession.getState().profile?.faction).toBe('volt');
    // o aviso de "sem conexão" continua (o resto do perfil é da cópia)
    expect(useSession.getState().profileError?.code).toBe('NETWORK');
    expect(useSession.getState().profileSavedAt).toBe(123);
    expect(game.applyProfile).toHaveBeenLastCalledWith(expect.objectContaining({ faction: 'volt' }));
    expect(usePendingTeam.getState().team).toBeNull();
    expect(cache.writeCachedProfile).toHaveBeenLastCalledWith(expect.objectContaining({ faction: 'volt' }));
    expect(repo.chooseFaction).toHaveBeenCalledTimes(1);
  });

  it('(b) sem cópia salva: devolve ok com o time (não manda escolher de novo)', async () => {
    repo.getMyProfile.mockResolvedValue(offline());
    cache.readCachedProfile.mockResolvedValue(null);
    const res = await chooseFaction('owls');
    expect(res).toMatchObject({ ok: true, data: { faction: 'owls' } });
    expect(useSession.getState().profile?.faction).toBe('owls');
  });

  it('releitura ok: usa o perfil novo do servidor', async () => {
    repo.getMyProfile.mockResolvedValue({ ok: true, data: { ...PROFILE, faction: 'coyotes', xp: 50 } });
    const res = await chooseFaction('coyotes');
    expect(res).toMatchObject({ ok: true, data: { faction: 'coyotes', xp: 50 } });
    expect(useSession.getState().profileError).toBeNull();
  });

  it('a RPC falhou: nada muda no perfil local', async () => {
    repo.chooseFaction.mockResolvedValue(offline());
    const res = await chooseFaction('volt');
    expect(res.ok).toBe(false);
    expect(repo.getMyProfile).not.toHaveBeenCalled();
    expect(useSession.getState().profile?.faction).toBeNull();
  });
});

describe('chooseFactionOnce: a reserva relê antes de gravar (F8-D · M1b)', () => {
  it('o servidor já tem time (a 1ª gravação deu certo): segue com ele, sem chamar a RPC (seria troca)', async () => {
    repo.getMyProfile.mockResolvedValue({ ok: true, data: { ...PROFILE, faction: 'volt' } });
    const res = await chooseFactionOnce('owls');
    expect(res).toMatchObject({ ok: true, data: { faction: 'volt' } });
    expect(repo.chooseFaction).not.toHaveBeenCalled();
  });

  it('o servidor ainda não tem time: grava o escolhido', async () => {
    repo.getMyProfile.mockResolvedValueOnce({ ok: true, data: PROFILE }).mockResolvedValueOnce({ ok: true, data: { ...PROFILE, faction: 'owls' } });
    const res = await chooseFactionOnce('owls');
    expect(repo.chooseFaction).toHaveBeenCalledWith('owls');
    expect(res).toMatchObject({ ok: true, data: { faction: 'owls' } });
  });

  it('a cópia salva diz que tem time mas o servidor não respondeu: não confia nela e tenta gravar', async () => {
    repo.getMyProfile.mockResolvedValue(offline());
    cache.readCachedProfile.mockResolvedValue({ ...PROFILE, faction: 'volt' });
    repo.chooseFaction.mockResolvedValue(offline());
    const res = await chooseFactionOnce('volt');
    expect(repo.chooseFaction).toHaveBeenCalledWith('volt');
    expect(res.ok).toBe(false);
  });
});

describe('sair da conta (F8-D · B3)', () => {
  it('apaga o time pendente da memória e do aparelho', async () => {
    await savePendingTeam('striders');
    await signOut();
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockLocal.has('pending-team')).toBe(false);
  });
});
