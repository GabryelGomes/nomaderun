/**
 * F8-B3 (E6 + E8) — telas que fecham: o seletor "Corridas · Ranking" do Clube com a prévia de 3 corridas (UX-21),
 * os Ajustes em 4 telas com rota própria (UX-16), os avisos que gravam na hora em Lembretes e a Conta sem número
 * cru (UX-24). A folha da Liga e o "Correr contra o chefão" estão em `e6c-arena-clube.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v, useAnimatedScrollHandler: () => () => undefined, Easing: { ...require('@/components/motion/__tests__/render-mocks').reanimated.Easing, inOut: (f: unknown) => f, sin: (t: number) => t } }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: (...a: unknown[]) => mockPush(...a), navigate: jest.fn(), canGoBack: () => false }, useFocusEffect: () => undefined }));
jest.mock('@/services/api/env', () => ({ isDemoMode: () => false }));

// Clube: crew, semana e ranking de mentira; o feed e o convite viram marcadores com as props que receberam.
const mockGetMyCrew = jest.fn<() => Promise<unknown>>();
jest.mock('@/services/api/crews-repo', () => ({ getMyCrew: () => mockGetMyCrew(), getCrewWeekGoal: async () => ({ ok: true, data: null }) }));
jest.mock('@/services/api/leaderboard-repo', () => ({
  rankRunners: async () => ({ ok: true, data: [] }),
  rankCrews: async () => ({ ok: true, data: [] }),
  rankFactions: async () => ({ ok: true, data: [] }),
  getCityRanking: async () => ({ ok: true, data: [] }),
  getMyRecentZoneId: async () => ({ ok: true, data: null }),
  getDistrictLabel: async () => ({ ok: true, data: 'Bairro' }),
}));
const mockMarkRanking = jest.fn();
jest.mock('@/features/engagement', () => ({
  markRankingOpened: () => mockMarkRanking(),
  HealthPauseSheet: () => null,
  TelemetrySettingsSection: () => null,
}));
jest.mock('@/features/social/feed', () => ({
  CrewFeed: (p: { limit?: number }) => {
    const { Text } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    return <Text testID="feed-mock">{`feed limite ${p.limit ?? 'todos'}`}</Text>;
  },
  FeedSettings: () => null,
}));
jest.mock('@/features/social/invite/invite-card', () => ({
  InviteCard: (p: { kind: string; testID: string }) => {
    const { Text } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    return <Text testID={p.testID}>{`convite ${p.kind}`}</Text>;
  },
}));
jest.mock('@/features/notifications/reminder-settings', () => ({ ReminderSettingsSection: () => null }));
const mockSaveProfile = jest.fn<(patch: unknown) => Promise<unknown>>();
jest.mock('@/features/auth/session-controller', () => ({ saveProfile: (p: unknown) => mockSaveProfile(p), signOutAfterDeletion: jest.fn() }));

/* eslint-disable import/first */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import VoceLembretes from '@/app/(tabs)/perfil/lembretes';
import VocePrivacidade from '@/app/(tabs)/perfil/privacidade';
import VoceSeguranca from '@/app/(tabs)/perfil/seguranca';
import { DEFAULT_NOTIFICATION_PREFS, type Profile } from '@/services/api/types';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';

import { AccountScreen } from '../account-screen';
import { ClubScreen, FEED_PREVIEW } from '../club-screen';
import { SETTINGS_ROUTES, SettingsScreen } from '../profile-screen.settings';
/* eslint-enable import/first */

const mounted: ReactTestRenderer[] = [];
async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(el);
  });
  mounted.push(r);
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const has = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id).length > 0;
const press = (r: ReactTestRenderer, id: string, arg?: unknown) =>
  act(async () => {
    const fn = r.root.findAll((n) => n.props.testID === id && (typeof n.props.onPress === 'function' || typeof n.props.onValueChange === 'function'))[0];
    if (fn.props.onPress) fn.props.onPress({});
    else fn.props.onValueChange(arg);
    await new Promise((res) => setTimeout(res, 0));
  });
const text = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.type === 'string' && (typeof n.props.children === 'string' || Array.isArray(n.props.children)))
    .map((n) => [n.props.children].flat().filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
    .join('|');

const crew = { crew: { id: 'c1', name: 'Flamboyant Runners', tag: 'FLR', faction: 'striders', inviteCode: 'DEMOFLR1' }, members: [{ userId: 'u1' }, { userId: 'u2' }] };
const profile = { id: 'u1', username: 'eu', faction: 'striders', city: 'Goiânia', notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS } } as unknown as Profile;

afterEach(() => {
  for (const r of mounted.splice(0)) act(() => r.unmount());
});
beforeEach(() => {
  mockPush.mockReset();
  mockMarkRanking.mockReset();
  mockSaveProfile.mockReset();
  useSession.setState({ session: { userId: 'u1', email: 'eu@exemplo.com' } as never, profile });
});

describe('Clube: seletor "Corridas · Ranking" (UX-21)', () => {
  it('com crew: o seletor no topo, a prévia de 3 corridas e o ranking só ao escolher', async () => {
    mockGetMyCrew.mockResolvedValue({ ok: true, data: crew });
    const r = await mount(<ClubScreen />);
    expect(has(r, 'clube-secao-corridas')).toBe(true);
    expect(has(r, 'clube-secao-ranking')).toBe(true);
    expect(text(r)).toContain(`feed limite ${FEED_PREVIEW}`);
    expect(FEED_PREVIEW).toBe(3);
    expect(has(r, 'ranking-quadro')).toBe(false);
    expect(mockMarkRanking).not.toHaveBeenCalled();
    await press(r, 'clube-secao-ranking');
    expect(has(r, 'feed-mock')).toBe(false);
    expect(has(r, 'ranking-quadro-individual')).toBe(true);
    expect(has(r, 'ranking-filtros')).toBe(true);
    expect(mockMarkRanking).toHaveBeenCalledTimes(1);
  });

  it('sem crew: sem seletor, o ranking direto e o convite do app (o único "Convidar" fora da crew)', async () => {
    mockGetMyCrew.mockResolvedValue({ ok: true, data: null });
    const r = await mount(<ClubScreen />);
    expect(has(r, 'clube-secao-corridas')).toBe(false);
    expect(has(r, 'ranking-quadro')).toBe(true);
    expect(text(r)).toContain('convite app');
  });
});

describe('Ajustes em 4 telas (UX-16)', () => {
  it('a engrenagem lista Conta · Segurança na corrida · Privacidade · Lembretes, cada uma com a sua rota', async () => {
    const r = await mount(<SettingsScreen />);
    const t = text(r);
    for (const title of ['Conta', 'Segurança na corrida', 'Privacidade', 'Lembretes']) expect(t).toContain(title);
    await press(r, 'ajustes-conta');
    expect(mockPush).toHaveBeenLastCalledWith(SETTINGS_ROUTES.conta);
    await press(r, 'ajustes-seguranca');
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/seguranca');
    await press(r, 'ajustes-privacidade');
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/privacidade');
    await press(r, 'ajustes-lembretes');
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/lembretes');
    // Sem duplicados: nada de convite, "Sair" ou notificações aqui.
    expect(has(r, 'convite-app')).toBe(false);
    expect(t).not.toMatch(/Sair|Convidar|Notificações/);
  });

  it('cada rota abre a sua tela', async () => {
    const seg = await mount(<VoceSeguranca />);
    expect(has(seg, 'tela-ajustes-seguranca')).toBe(true);
    expect(has(seg, 'perfil-escolta')).toBe(true);
    expect(has(seg, 'perfil-contatos-seguranca')).toBe(true);
    const priv = await mount(<VocePrivacidade />);
    expect(has(priv, 'tela-ajustes-privacidade')).toBe(true);
    expect(has(priv, 'perfil-zonas-privacidade')).toBe(true);
    const lem = await mount(<VoceLembretes />);
    expect(has(lem, 'tela-ajustes-lembretes')).toBe(true);
    expect(text(lem)).toContain('Pausa de saúde');
  });

  it('Lembretes: o aviso grava na hora, sem apagar as outras preferências', async () => {
    mockSaveProfile.mockImplementation(async (patch) => {
      const p = patch as { notificationPrefs: Profile['notificationPrefs'] };
      useSession.setState({ profile: { ...profile, notificationPrefs: p.notificationPrefs } });
      return { ok: true, data: null };
    });
    const r = await mount(<VoceLembretes />);
    await press(r, 'perfil-notificacao-invasions', false);
    expect(mockSaveProfile).toHaveBeenCalledWith({ notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, invasions: false } });
    expect(r.root.findAll((n) => n.props.testID === 'perfil-notificacao-invasions' && typeof n.props.onValueChange === 'function')[0].props.value).toBe(false);
  });

  it('Lembretes: falhou ao gravar, o interruptor volta e a frase do erro aparece', async () => {
    mockSaveProfile.mockResolvedValue({ ok: false, error: { code: 'NETWORK', message: 'Sem internet' } });
    const r = await mount(<VoceLembretes />);
    await press(r, 'perfil-notificacao-conquests', false);
    expect(has(r, 'ajustes-avisos-erro')).toBe(true);
    expect(r.root.findAll((n) => n.props.testID === 'perfil-notificacao-conquests' && typeof n.props.onValueChange === 'function')[0].props.value).toBe(true);
  });
});

describe('Conta (UX-24)', () => {
  it('"Corridas sem suspeita ✓" e o número só em "Ver mais"; sem "JSON"', async () => {
    useGame.setState({ trust: 100 });
    const r = await mount(<AccountScreen />);
    expect(text(r)).toContain('Corridas sem suspeita ✓');
    expect(text(r)).not.toMatch(/Índice de confiança|JSON/);
    expect(has(r, 'perfil-editar')).toBe(true);
    expect(has(r, 'conta-sair')).toBe(true);
    await press(r, 'conta-confianca-mais');
    expect(text(r)).toContain('Índice de confiança: 100 de 100.');
  });
});
