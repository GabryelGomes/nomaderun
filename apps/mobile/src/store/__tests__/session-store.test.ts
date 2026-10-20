import { beforeEach, describe, expect, it } from '@jest/globals';

import { AppError } from '@/services/api/errors';
import { toProfile } from '@/services/api/types';

import { useGame } from '../game-store';
import { useSession } from '../session-store';

const profile = toProfile({ id: 'u1', username: 'ana', faction: 'owls', xp: 50, trust: 80 });

beforeEach(() => {
  useSession.setState({ status: 'loading', session: null, profile: null, profileStatus: 'idle', profileError: null, recovering: false, linkError: null });
  useGame.getState().resetForSignOut();
});

describe('session-store', () => {
  it('login, perfil e logout', () => {
    const s = useSession.getState();
    s.setSession({ userId: 'u1', email: 'a@b.com' });
    expect(useSession.getState().status).toBe('signedIn');
    s.setProfileLoading();
    expect(useSession.getState().profileStatus).toBe('loading');
    s.setProfile(profile);
    expect(useSession.getState()).toMatchObject({ profileStatus: 'ready', profile: { username: 'ana' } });
    s.setSession(null);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', profile: null, recovering: false });
  });

  it('refresh do mesmo usuário mantém o perfil; outro usuário descarta', () => {
    const s = useSession.getState();
    s.setSession({ userId: 'u1', email: null });
    s.setProfile(profile);
    s.setSession({ userId: 'u1', email: null });
    expect(useSession.getState().profile).not.toBeNull();
    s.setSession({ userId: 'u2', email: null });
    expect(useSession.getState().profile).toBeNull();
  });

  it('erro de perfil só bloqueia se não houver perfil carregado', () => {
    const s = useSession.getState();
    s.setSession({ userId: 'u1', email: null });
    s.setProfileError(new AppError('NETWORK', 'sem rede'));
    expect(useSession.getState().profileStatus).toBe('error');
    s.setProfile(profile);
    s.setProfileError(new AppError('NETWORK', 'sem rede'));
    expect(useSession.getState().profileStatus).toBe('ready');
  });

  it('backend não configurado', () => {
    useSession.getState().setUnconfigured();
    expect(useSession.getState().status).toBe('unconfigured');
  });
});

describe('game-store recebe nome e facção do servidor', () => {
  it('applyProfile e resetForSignOut', () => {
    useGame.getState().applyProfile({ username: 'ana', faction: 'owls', xp: 50, trust: 80 });
    expect(useGame.getState()).toMatchObject({ name: 'ana', faction: 'owls', onboarded: true, xp: 50, trust: 80 });
    useGame.getState().applyProfile({ username: 'ana2', faction: null });
    expect(useGame.getState()).toMatchObject({ name: 'ana2', faction: null, onboarded: false, xp: 50 });
    useGame.getState().resetForSignOut();
    expect(useGame.getState()).toMatchObject({ name: 'Corredor', faction: null, xp: 0, history: [] });
  });

  it('API usada pela corrida continua igual', () => {
    const g = useGame.getState();
    for (const fn of ['setMission', 'setGhostPace', 'openChest', 'commitRun', 'toggleEscort', 'toggleStopAlert', 'completeOnboarding'] as const) {
      expect(typeof g[fn]).toBe('function');
    }
    g.openChest('c1', 10);
    expect(useGame.getState().openedChests).toEqual(['c1']);
  });
});
