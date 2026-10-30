/**
 * D-95 (UX-05, UX-38) — estados de dado honestos:
 *  - erro 5xx (ou sem internet) com o perfil salvo: o app abre com a cópia e o aviso; sem cópia, tela de erro;
 *    erro da conta (sessão recusada) nunca usa a cópia;
 *  - offline/erro/carregando nunca mostram "0" como se fosse dado: "—" ou esqueleto, e o `OfflineNotice` com a hora.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v, Easing: { ...require('@/components/motion/__tests__/render-mocks').reanimated.Easing, inOut: (f: unknown) => f, sin: (t: number) => t } }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn(), navigate: jest.fn() }, useFocusEffect: () => undefined }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/features/engagement', () => ({ useEngagementData: () => ({ track: { status: 'unavailable', data: null } }) }));
const mockList = jest.fn<() => Promise<unknown>>();
jest.mock('@/services/api/activities-repo', () => ({ listMyActivities: () => mockList() }));
const mockGetProfile = jest.fn<() => Promise<unknown>>();
jest.mock('@/services/api/profile-repo', () => ({ getMyProfile: () => mockGetProfile() }));
const mockReadCache = jest.fn<() => Promise<unknown>>();
jest.mock('@/services/api/profile-cache', () => ({ readCachedProfile: () => mockReadCache(), writeCachedProfile: jest.fn(async () => undefined) }));

/* eslint-disable import/first */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { offlineNoticeText } from '@/components/offline-notice';
import { loadProfile } from '@/features/auth/session-controller';
import { AppError } from '@/services/api/errors';
import type { Profile } from '@/services/api/types';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';

import { ProfileScreen } from '../profile-screen';
/* eslint-enable import/first */

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 23, 12);
const ANA: Profile = {
  id: 'ana',
  username: 'ana_corre',
  birthdate: null,
  faction: 'volt',
  city: 'Goiânia',
  unit: 'km',
  notificationPrefs: { invasions: true, conquests: true, missions: true, moderation: true },
  xp: 900,
  trust: 100,
  role: 'runner',
  status: 'active',
  avatarUrl: null,
  factionChangedSeason: null,
};

const fail = (code: 'NETWORK' | 'SERVER' | 'UNAUTHORIZED') => ({ ok: false, error: new AppError(code, code === 'SERVER' ? 'O servidor está fora do ar.' : 'Sem conexão.') });

beforeEach(() => {
  jest.clearAllMocks();
  useSession.getState().reset();
  useGame.getState().resetForSignOut();
  useSession.getState().setSession({ userId: 'ana', email: 'ana@ex.com' } as never);
});

describe('perfil com o servidor fora do ar (UX-05)', () => {
  it('503 com cópia salva: o app abre com o perfil e guarda o erro e a hora da cópia para o aviso', async () => {
    mockGetProfile.mockResolvedValue(fail('SERVER'));
    mockReadCache.mockResolvedValue({ ...ANA, savedAt: NOW - 2 * H });
    const res = await loadProfile();
    expect(res.ok).toBe(true);
    const s = useSession.getState();
    expect(s.profile).toEqual(ANA);
    expect(s.profileStatus).toBe('ready');
    expect(s.profileError?.code).toBe('SERVER');
    expect(s.profileSavedAt).toBe(NOW - 2 * H);
  });

  it('503 sem cópia: tela de erro (o guarda mostra "Tentar de novo")', async () => {
    mockGetProfile.mockResolvedValue(fail('SERVER'));
    mockReadCache.mockResolvedValue(null);
    const res = await loadProfile();
    expect(res.ok).toBe(false);
    expect(useSession.getState().profileStatus).toBe('error');
    expect(useSession.getState().profile).toBeNull();
  });

  it('sessão recusada nunca abre com a cópia (não é falha de rede)', async () => {
    mockGetProfile.mockResolvedValue(fail('UNAUTHORIZED'));
    mockReadCache.mockResolvedValue({ ...ANA, savedAt: NOW - H });
    await loadProfile();
    expect(useSession.getState().profile).toBeNull();
    expect(mockReadCache).not.toHaveBeenCalled();
  });

  it('servidor de volta: o perfil fresco limpa o aviso e a hora da cópia', async () => {
    mockGetProfile.mockResolvedValueOnce(fail('NETWORK'));
    mockReadCache.mockResolvedValue({ ...ANA, savedAt: NOW - H });
    await loadProfile();
    mockGetProfile.mockResolvedValueOnce({ ok: true, data: { ...ANA, xp: 1000 } });
    await loadProfile();
    const s = useSession.getState();
    expect(s.profileError).toBeNull();
    expect(s.profileSavedAt).toBeUndefined();
    expect(s.profile?.xp).toBe(1000);
  });
});

describe('OfflineNotice: o mesmo texto em todas as telas', () => {
  it('diz o que houve e o que a tela mostra, com a hora do dado salvo', () => {
    expect(offlineNoticeText({ code: 'NETWORK', hasData: true, savedAt: NOW - 2 * H }, NOW)).toEqual({ title: 'Sem internet', body: 'Mostrando o último salvo, há 2 h.' });
    expect(offlineNoticeText({ code: 'SERVER', hasData: true, savedAt: null }, NOW)).toEqual({ title: 'Servidor fora do ar', body: 'Mostrando o último salvo.' });
    expect(offlineNoticeText({ code: 'SERVER', hasData: false }, NOW).body).toBe('Os números aparecem quando a conexão voltar.');
    expect(offlineNoticeText({ hasData: false }, NOW).title).toBe('Sem conexão');
  });
});

describe('Você sem conexão e carregando: nunca zero falso (UX-38)', () => {
  const mounted: ReactTestRenderer[] = [];
  afterEach(() => {
    act(() => mounted.splice(0).forEach((r) => r.unmount()));
  });
  async function mount(): Promise<ReactTestRenderer> {
    useSession.getState().setProfile(ANA);
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(<ProfileScreen />);
    });
    mounted.push(r);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    return r;
  }
  const text = (r: ReactTestRenderer) =>
    r.root
      .findAll((n) => typeof n.props.children === 'string' || typeof n.props.children === 'number')
      .map((n) => String(n.props.children))
      .join(' | ');
  const has = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id).length > 0;
  const label = (r: ReactTestRenderer, id: string) => String(r.root.findAll((n) => n.props.testID === id && typeof n.props.accessibilityLabel === 'string')[0]?.props.accessibilityLabel ?? '');

  it('offline sem histórico: "—" nos números e nas medalhas, aviso "Sem internet" com tentar de novo', async () => {
    mockList.mockResolvedValue(fail('NETWORK'));
    useGame.getState().markSyncFailed('fog');
    const r = await mount();
    expect(has(r, 'perfil-sem-conexao')).toBe(true);
    expect(has(r, 'perfil-sem-conexao-tentar')).toBe(true);
    expect(text(r)).toContain('Sem internet');
    expect(label(r, 'perfil-km')).toBe('Distância: —');
    expect(label(r, 'perfil-zonas')).toBe('Zonas: —');
    expect(label(r, 'perfil-atlas')).toBe('Atlas: —');
    expect(text(r)).toContain('—');
    expect(text(r)).not.toMatch(/\b0 de \d/);
    expect(label(r, 'perfil-km')).not.toMatch(/0,0/);
    expect(has(r, 'perfil-medalhas')).toBe(false);
  });

  it('carregando: esqueleto no lugar dos números (nunca "0,0 km")', async () => {
    mockList.mockReturnValue(new Promise(() => undefined));
    const r = await mount();
    expect(has(r, 'perfil-km-carregando')).toBe(true);
    expect(has(r, 'perfil-medalhas-carregando')).toBe(true);
    expect(has(r, 'perfil-km')).toBe(false);
    expect(has(r, 'perfil-sem-conexao')).toBe(false);
  });

  it('perfil aberto da cópia (503): aviso "Servidor fora do ar" com a hora da cópia', async () => {
    mockList.mockResolvedValue({ ok: true, data: [] });
    useSession.getState().setProfile(ANA, NOW - 2 * H);
    useSession.getState().setProfileError(new AppError('SERVER', 'Fora do ar'));
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(<ProfileScreen />);
    });
    mounted.push(r);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(text(r)).toContain('Servidor fora do ar');
    expect(text(r)).toMatch(/Mostrando o último salvo, (há \d+ (h|min|dias)|ontem|agora)\./);
    // com o histórico em mãos, os números são de verdade (zero real aparece como zero)
    expect(label(r, 'perfil-km')).toBe('Distância: 0,0 km');
  });
});
