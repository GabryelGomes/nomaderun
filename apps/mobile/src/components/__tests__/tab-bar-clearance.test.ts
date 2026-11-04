import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'Animated.View', ScrollView: 'Animated.ScrollView' } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/* eslint-disable import/first */
import { space } from '@/theme/tokens';
import { MAP_ALERT_SLOT, MAP_RUN_BUTTON_SLOT, tabBarBelowContent, welcomeMissionBottom } from '@/features/screens/onboarding/welcome-mission';

import { ACTIVITIES_ROUTE, ANDROID_TAB_BAR_HEIGHT, APP_TABS, RUN_ROUTE, WEB_TAB_BAR_HEIGHT } from '../app-tabs-config';
import { IOS_TAB_BAR_HEIGHT, tabBarClearance } from '../screen';
/* eslint-enable import/first */

describe('tabBarClearance — elementos flutuantes acima da barra de abas', () => {
  it('no iOS soma a barra flutuante à área segura (iPhone 15: 34 pt)', () => {
    expect(tabBarClearance(34, 'ios')).toBe(34 + IOS_TAB_BAR_HEIGHT + 8);
    expect(tabBarClearance(34, 'ios')).toBeGreaterThanOrEqual(95);
  });

  it('no Android e na web mantém os 16 pt de antes', () => {
    expect(tabBarClearance(24, 'android')).toBe(16);
    expect(tabBarClearance(0, 'web')).toBe(16);
  });
});

describe('abas (D-89): Mapa · Arena · Clube · Você', () => {
  it('4 abas nessa ordem, com testID próprio', () => {
    expect(APP_TABS.map((t) => t.label)).toEqual(['Mapa', 'Arena', 'Clube', 'Você']);
    expect(new Set(APP_TABS.map((t) => t.testID)).size).toBe(4);
  });

  it('não há aba Correr: nenhuma aba abre a Nova corrida (o CORRER do Mapa é o único genérico)', () => {
    expect(APP_TABS.some((t) => t.label === 'Correr' || t.testID === 'aba-correr' || t.href === '/correr')).toBe(false);
    expect(APP_TABS.some((t) => 'opens' in t)).toBe(false);
    expect(RUN_ROUTE).toBe('/corrida');
  });

  it('"Você" mantém a rota do perfil e agrupa as Atividades (links antigos continuam funcionando)', () => {
    const you = APP_TABS.find((t) => t.label === 'Você');
    expect(you?.name).toBe('perfil');
    expect(you?.href).toBe('/perfil');
    expect(ACTIVITIES_ROUTE).toBe('/perfil/atividades');
    expect(APP_TABS.some((t) => t.href === '/atividades')).toBe(false);
  });

  it('cada aba tem alvo de toque ≥ 44 pt na web (barra de 64 pt, 4 colunas em 360 pt)', () => {
    expect(WEB_TAB_BAR_HEIGHT - space[2]).toBeGreaterThanOrEqual(44);
    expect(360 / APP_TABS.length).toBeGreaterThanOrEqual(44);
  });
});

describe('missão de boas-vindas no Mapa: acima da barra de abas e do "Correr"', () => {
  it('no iOS a barra flutua sobre o conteúdo (não soma de novo)', () => {
    expect(tabBarBelowContent(34, 'ios')).toBe(0);
    expect(welcomeMissionBottom(34, 'ios')).toBe(tabBarClearance(34, 'ios') + MAP_RUN_BUTTON_SLOT + space[2] + MAP_ALERT_SLOT);
  });

  it('no Android e na web o conteúdo termina em cima da barra', () => {
    expect(welcomeMissionBottom(24, 'android')).toBe(ANDROID_TAB_BAR_HEIGHT + 24 + 16 + MAP_RUN_BUTTON_SLOT + space[2] + MAP_ALERT_SLOT);
    expect(welcomeMissionBottom(0, 'web')).toBe(WEB_TAB_BAR_HEIGHT + 16 + MAP_RUN_BUTTON_SLOT + space[2] + MAP_ALERT_SLOT);
  });

  it('o card nunca fica sobre o botão de 72 pt nem sobre o alerta de ataque (56 pt) do Mapa', () => {
    for (const os of ['ios', 'android', 'web']) {
      for (const inset of [0, 20, 34]) {
        const alertTop = tabBarBelowContent(inset, os) + tabBarClearance(inset, os) + 72 + space[2] + 56;
        expect(welcomeMissionBottom(inset, os)).toBeGreaterThan(alertTop);
      }
    }
  });
});
