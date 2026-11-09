/**
 * Tela `/compartilhar/[id]` e `<ShareButton>`: carrossel (o mais raro primeiro), formatos, chaves, aviso de
 * privacidade, "Copiar legenda", cópia de exportação em 1080 px e estados vazios.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { PixelRatio } from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

type AnyFn = (...args: any[]) => any;
jest.setTimeout(30_000);
const mockPush = jest.fn<AnyFn>();
const mockParams: { id: string; momentos?: string } = { id: 'corrida-1' };
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
const mockClipboard = jest.fn<AnyFn>(() => Promise.resolve(true));
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockClipboard(t) }));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '/cache' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => Promise.resolve(true), shareAsync: () => Promise.resolve() }));

const mockZones = jest.fn<AnyFn>();
jest.mock('@/services/api/privacy-zones-repo', () => ({ listPrivacyZones: () => mockZones() }));
jest.mock('@/services/api/share-repo', () => ({ recordShare: jest.fn(() => Promise.resolve({ ok: true, data: { recorded: true, completedMissions: 0 } })) }));

const mockRecord = { current: {} as Record<string, unknown> };
jest.mock('@/features/run/use-run-record', () => ({ useRunRecord: () => mockRecord.current }));

/* eslint-disable import/first */
import { DEMO_ROUTE } from '../../card/__tests__/fixtures';
import { ShareButton } from '../share-button';
import { getShareExtras, setShareExtras } from '../share-extras';
import { ShareScreen } from '../share-screen';
import { PRIVACY_NOTICE_NO_ZONES } from '../share-input';
import { useGame } from '@/store/game-store';
/* eslint-enable import/first */

const summary = {
  source: 'official',
  status: 'valid',
  meters: 2020,
  movingSeconds: 629,
  avgPace: 311,
  rpTotal: 183,
  xp: 60,
  flags: [],
  invalidSegments: [],
  zones: [{ zoneId: 'z1', name: 'Jardim Goiás', meters: 900, rp: 46, outcome: 'conquered', ownerBefore: 'coyotes', ownerAfter: 'striders' }],
  newFogCells: 0,
  beatGhost: null,
  trust: 96,
  review: null,
};

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((m) => m.unmount()));
});

async function mount(el: React.ReactElement): Promise<ReactTestRenderer> {
  let r: ReactTestRenderer | undefined;
  await act(async () => {
    r = create(el);
  });
  mounted.push(r!);
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r!;
}

const byId = (r: ReactTestRenderer, id: string) => r.root.findAll((n: ReactTestInstance) => n.props.testID === id && typeof n.type !== 'string');
const first = (r: ReactTestRenderer, id: string) => {
  const all = byId(r, id);
  if (!all.length) throw new Error(`sem ${id}`);
  return all[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.id = 'corrida-1';
  mockRecord.current = { state: 'official', summary, path: DEMO_ROUTE, endedAt: new Date(2026, 9, 23, 7, 0).getTime(), simulated: false, mission: 'livre', error: null };
  mockZones.mockImplementation(() => Promise.resolve({ ok: true, data: [] }));
  useGame.setState({ faction: 'striders', xp: 1850, serverRuns: [] });
});

describe('tela de compartilhar', () => {
  it('carrossel do mais raro para o mais comum, com os extras do resumo', async () => {
    setShareExtras('corrida-1', {
      level: { reached: 8, xpToNext: 1900, progressToNext: 0.1, totals: { meters: 86000, zones: 14, runs: 23 } },
      boss: { name: 'Mormaço de Outubro', defeated: true, myDamageMeters: 2020, cityName: 'Goiânia', cityMeters: 3_600_000, days: 5 },
    });
    const r = await mount(<ShareScreen />);
    const labels = [0, 1, 2, 3].map((i) => first(r, `compartilhar-modelo-${i}`).props.accessibilityLabel);
    // F8-B3 (UX-33): o momento mais forte primeiro (zona antes do nível).
    expect(labels).toEqual(['Modelo Chefão derrotado, 1 de 4', 'Modelo Conquista de zona, 2 de 4', 'Modelo Nível novo, 3 de 4', 'Modelo Corrida, 4 de 4']);
    for (const id of ['compartilhar-rota', 'compartilhar-usuario', 'compartilhar-cidade', 'compartilhar-enviar', 'compartilhar-legenda', 'compartilhar-fechar', 'compartilhar-formato-stories', 'compartilhar-formato-feed', 'compartilhar-formato-adesivo'])
      expect(byId(r, id).length).toBeGreaterThan(0);
    // A cópia de exportação é o card no tamanho de pixel exato.
    const exp = first(r, 'compartilhar-exportar');
    expect(exp.props.width).toBeCloseTo(1080 / PixelRatio.get(), 5);
    setShareExtras('corrida-1', {});
  });

  it('sem conferir as zonas de privacidade: aviso e "Mostrar rota" travado', async () => {
    mockZones.mockImplementation(() => Promise.resolve({ ok: false, error: new Error('offline') }));
    const r = await mount(<ShareScreen />);
    const rota = first(r, 'compartilhar-rota');
    expect(rota.props.disabled).toBe(true);
    expect(rota.props.value).toBe(false);
    const notice = first(r, 'compartilhar-aviso');
    expect(notice.findAll((n) => n.props.children === PRIVACY_NOTICE_NO_ZONES).length).toBeGreaterThan(0);
  });

  it('Adesivo: uma página só; "Copiar legenda" copia o texto pronto', async () => {
    const r = await mount(<ShareScreen />);
    await act(async () => {
      first(r, 'compartilhar-formato-adesivo').props.onPress();
    });
    expect(byId(r, 'compartilhar-modelo-0')).toHaveLength(0);
    expect(byId(r, 'compartilhar-previa-0').length).toBeGreaterThan(0);
    await act(async () => {
      first(r, 'compartilhar-legenda').props.onPress();
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(mockClipboard).toHaveBeenCalledWith('Corri 2,02 km e conquistei Jardim Goiás no NOMADE RUN.');
    expect(first(r, 'compartilhar-legenda').props.label).toBe('Legenda copiada');
  });

  it('corrida rejeitada não tem card', async () => {
    mockRecord.current = { ...mockRecord.current, summary: { ...summary, status: 'rejected' } };
    const r = await mount(<ShareScreen />);
    expect(byId(r, 'compartilhar-vazio').length).toBeGreaterThan(0);
    expect(byId(r, 'compartilhar-enviar')).toHaveLength(0);
  });
});

describe('<ShareButton>', () => {
  it('abre /compartilhar/[id] levando nível e chefão; some na corrida rejeitada', async () => {
    const level = { reached: 3, xpToNext: 10, progressToNext: 0.5, totals: { meters: 1, zones: 1, runs: 1 } };
    const r = await mount(<ShareButton activityId="abc 1" level={level} />);
    await act(async () => {
      first(r, 'resumo-compartilhar').props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/compartilhar/abc%201');
    expect(getShareExtras('abc 1')).toEqual({ level, boss: null });
    const hidden = await mount(<ShareButton activityId="x" status="rejected" />);
    expect(hidden.toJSON()).toBeNull();
  });
});
