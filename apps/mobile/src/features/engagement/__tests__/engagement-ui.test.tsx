/**
 * T7.2.4 (E7): telas e folhas do engajamento renderizam com os dados do store — missões com anéis e troca,
 * recompensas com as chances visíveis, trilha e cosméticos, bloco do resumo, pausa de saúde e "bem-vindo de
 * volta" — e cada estado (carregando, indisponível) tem a sua cara.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/features/engagement/local-store', () => ({ readLocal: async () => null, writeLocal: async () => undefined }));
jest.mock('@/features/engagement/controller', () => ({
  refreshEngagement: jest.fn(async () => undefined),
  recordRunResult: jest.fn(() => null),
  rerollDailyMission: jest.fn(async () => ({ ok: false, error: { message: 'Você já trocou uma missão hoje.' } })),
  openStoredChests: jest.fn(async () => ({ ok: false, error: { message: 'x', detail: 'DAILY_CHEST_LOCKED' } })),
  claimSeasonStep: jest.fn(async () => ({ ok: true, data: { step: 3, alreadyClaimed: false, items: [{ kind: 'cosmetic', cosmeticId: 'moldura-temporada', amount: null, rarity: null, medalTier: null }] } })),
  startPause: jest.fn(async () => ({ ok: true, data: { from: '2026-10-19', until: '2026-11-01', seasonId: '2026-10' } })),
  endPause: jest.fn(async () => ({ ok: true, data: null })),
}));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render as renderOnce, type Rendered } from '@/components/__tests__/render-helpers';
import { parseDailyChest, parseMissions, parseTrack, type EngagementStatus, type RunEngagement } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';

import * as controller from '../controller';
import { HealthPauseSheet } from '../health-pause-sheet';
import { MissionsScreen } from '../missions-screen';
import { RewardsScreen } from '../rewards-screen';
import { RunRewardsBlock } from '../run-rewards-block';
import { WelcomeBackSheet } from '../welcome-back-sheet';
/* eslint-enable import/first */

const NOW = Date.now();
const DAY = 86_400_000;

const m = (id: string, defId: string, kind: string, slot: number, extra: object = {}) => ({
  id,
  defId,
  kind,
  tier: ['leve', 'padrao', 'desafio'][slot] ?? 'leve',
  slot,
  title: `Missão ${id}`,
  metric: 'meters',
  progress: 1000,
  target: 3000,
  xp: 30,
  periodKey: 'p',
  availableFrom: NOW - DAY,
  availableUntil: NOW + DAY,
  completedAt: null,
  claimedAt: null,
  rerolled: false,
  ...extra,
});

const STATUS: EngagementStatus = {
  source: 'server',
  xp: 1850,
  level: 6,
  intoLevel: 520,
  needed: 560,
  isMax: false,
  title: { id: 'pe-na-rua', name: 'Pé na Rua' },
  band: { id: 'prata', name: 'Prata', metersToNext: 20_000, nextName: 'Ouro' },
  lifetimeMeters: 130_000,
  streak: { weeks: 2, best: 3, activitiesThisWeek: 1, freezesLeft: 1, pause: null, pauseAvailable: true },
  season: null,
  createdAt: NOW - 60 * DAY,
  lastActivityAt: NOW - DAY,
  recentStartTimes: [],
  week: { activities: 1, meters: 3000, zones: 1 },
  previousWeek: null,
  cosmetics: [{ id: 'rastro-faisca', variant: '' }],
};

function fill() {
  const s = useEngagement.getState();
  s.reset();
  s.setUser('demo');
  s.setLoadedAt(NOW);
  s.setReady('status', STATUS);
  s.setReady(
    'missions',
    parseMissions({
      periods: { daily: 'd', weekly: 'w' },
      daily: [m('a', 'd-mover-15', 'diaria', 0), m('b', 'd-km', 'diaria', 1, { completedAt: NOW }), m('c', 'd-conquistar', 'diaria', 2)],
      weekly: [m('x', 's-2-atividades', 'semanal', 0), m('y', 's-km', 'semanal', 1), m('z', 's-conquistar-3', 'semanal', 2)],
      ftue: [m('f1', 'f1-dominio', 'ftue', 1, { completedAt: NOW - DAY }), m('f2', 'f2-caca', 'ftue', 2)],
      ftueStartedAt: NOW - 3 * DAY,
      comeback: null,
      rerollsLeft: 1,
    }),
  );
  s.setReady('chest', parseDailyChest({ stored: 1, bonus: ['raro'], pityLeft: 14, openedToday: false }));
  s.setReady(
    'track',
    parseTrack({
      seasonId: '2026-10',
      xp: 300,
      step: 2,
      stepXp: 120,
      steps: 24,
      intoStep: 60,
      rewards: Array.from({ length: 24 }, (_, i) => ({ step: i + 1, unlocked: i < 2, claimed: i < 1, items: [{ kind: i === 7 ? 'medal' : 'xp', amount: 50, medalTier: 'bronze' }] })),
    }),
  );
}

const mounted: Rendered[] = [];
/** Renderiza e desmonta no fim do teste (os relógios e animações não vazam para o próximo). */
function render(el: ReactElement): Rendered {
  const r = renderOnce(el);
  mounted.push(r);
  return r;
}

beforeEach(() => {
  act(() => fill());
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.renderer.unmount()));
});

describe('/missoes', () => {
  it('primeira semana, 3 de hoje e 3 da semana com anéis; troca só nas abertas de hoje', async () => {
    const r = render(<MissionsScreen />);
    expect(r.has('tela-missoes')).toBe(true);
    expect(r.has('missoes-primeira-semana')).toBe(true);
    expect(r.has('primeira-semana-passo-1')).toBe(true);
    expect(r.has('primeira-semana-passo-7')).toBe(true);
    for (const id of ['missao-anel-diaria-0', 'missao-anel-diaria-1', 'missao-anel-diaria-2', 'missao-anel-semanal-0', 'missao-anel-semanal-1', 'missao-anel-semanal-2']) expect(r.has(id)).toBe(true);
    expect(r.has('missao-trocar-0')).toBe(true);
    expect(r.has('missao-trocar-1')).toBe(false); // concluída
    const text = r.text();
    expect(text).toContain('Não curtiu uma? Troque 1 por dia.');
    expect(text).toContain('caminhar também conta');
    r.press('missao-trocar-0');
    await act(async () => undefined);
    expect(controller.rerollDailyMission).toHaveBeenCalledWith('a');
    expect(r.host('missoes-aviso').props.children).toBe('Você já trocou uma missão hoje.');
  });

  it('indisponível: estado "em breve", sem erro', () => {
    act(() => useEngagement.getState().setUnavailable('missions', 'old_server'));
    const r = render(<MissionsScreen />);
    expect(r.has('missoes-indisponivel')).toBe(true);
    expect(r.text()).toContain('Missões em breve');
  });

  it('carregando: esqueleto', () => {
    act(() => useEngagement.getState().reset());
    const r = render(<MissionsScreen />);
    expect(r.has('missoes-carregando')).toBe(true);
  });
});

describe('/recompensas', () => {
  it('nível, baú com chances visíveis, trilha e cosméticos; nada é vendido', async () => {
    const r = render(<RewardsScreen />);
    expect(r.has('tela-recompensas')).toBe(true);
    expect(r.text()).toContain('Pé na Rua');
    expect(r.has('recompensas-chances')).toBe(true);
    expect(r.host('recompensas-chances').props.accessibilityLabel).toBe('Chances do baú: Comum 70%, 15 XP; Raro 25%, 40 XP, 5% de item; Lendário 5%, 100 XP, 30% de item');
    expect(r.text()).toContain('2 baús guardados');
    expect(r.text()).toContain('Lendário garantido em até 14 baús.');
    expect(r.text()).toContain('Nada aqui é vendido.');
    expect(r.has('trilha-resgatar-2')).toBe(true);
    expect(r.has('trilha-degrau-1')).toBe(true);
    expect(r.has('trilha-resgatar-3')).toBe(false);
    expect(r.host('cosmetico-rastro-faisca').props.accessibilityLabel).toContain('É seu');
    expect(r.host('cosmetico-rastro-neon').props.accessibilityLabel).toContain('Como ganhar: Baú do dia');

    r.press('recompensas-bau-abrir');
    await act(async () => undefined);
    expect(r.host('recompensas-bau-mensagem').props.children).toBe('Corra ou caminhe 1 km hoje para abrir.');

    r.press('trilha-resgatar-2');
    await act(async () => undefined);
    expect(controller.claimSeasonStep).toHaveBeenCalledWith(2);
    expect(r.host('recompensas-trilha-mensagem').props.children).toBe('Resgatado: Moldura do mês');
  });

  it('tudo indisponível: um só estado "em breve"', () => {
    act(() => {
      const s = useEngagement.getState();
      s.reset();
      s.setUnavailable('chest', 'disabled');
      s.setUnavailable('track', 'disabled');
      s.setUnavailable('missions', 'disabled');
    });
    const r = render(<RewardsScreen />);
    expect(r.has('recompensas-indisponivel')).toBe(true);
  });
});

describe('bloco Recompensas do resumo', () => {
  const block: RunEngagement = {
    xp: { total: 150, lines: [{ source: 'run_distance', amount: 50, label: 'Distância' }, { source: 'run_complete', amount: 30, label: 'Atividade concluída' }, { source: 'daily_chest', amount: 40, label: 'Baú do dia' }, { source: 'mission', amount: 30, label: 'Missão' }] },
    level: { before: 6, after: 6, titleAfter: null },
    band: null,
    dailyChests: { opened: [{ n: 1, rarity: 'raro', xp: 40, cosmeticId: 'rastro-gelo', duplicate: false, guaranteed: false, bonus: false }], pityLeft: 13, reason: null, stored: 0 },
    missions: [{ id: 'd-km', userMissionId: 'u1', cadence: 'diaria', text: 'Corra 3 km hoje', xp: 30 }],
    streak: { activitiesThisWeek: 2, weekKept: true, weeks: 2, best: 3, freezesLeft: 1, paused: false },
    season: null,
    ftue: null,
    comeback: null,
  };

  it('XP linha a linha, nível, missões, baú (pico) e a semana no fim', () => {
    const r = render(<RunRewardsBlock block={block} demo />);
    const ids = ['resumo-recompensas-xp', 'resumo-recompensas-nivel', 'resumo-recompensas-missoes', 'resumo-recompensas-baus', 'resumo-recompensas-semana'];
    const order = r.renderer.root.findAll((n) => typeof n.type === 'string' && ids.includes(n.props.testID)).map((n) => n.props.testID);
    expect(order).toEqual(ids);
    expect(r.text()).toContain('Atividade concluída');
    expect(r.text()).toContain('Item novo: Gelo');
    expect(r.text()).toContain('Semana garantida');
    expect(r.has('resumo-recompensas-demonstracao')).toBe(true);
    expect(r.host('resumo-recompensas').props.accessibilityLabel).toBe('Você ganhou 150 XP, abriu 1 baú, concluiu 1 missão.');
  });

  it('servidor v1 (sem bloco): não desenha nada', () => {
    const r = render(<RunRewardsBlock block={null} />);
    expect(r.renderer.toJSON()).toBeNull();
  });
});

describe('pausa de saúde e bem-vindo de volta', () => {
  it('pausa: escolhe semanas e começa; ativa mostra até quando e encerrar', async () => {
    const r = render(<HealthPauseSheet visible onClose={() => undefined} />);
    r.press('pausa-saude-semanas-2');
    r.press('pausa-saude-comecar');
    await act(async () => undefined);
    expect(controller.startPause).toHaveBeenCalledWith(2);
    expect(r.host('pausa-saude-mensagem').props.children).toBe('Pausa até 01/11. Descanse bem.');

    const today = new Date(NOW - 3 * 3600_000).toISOString().slice(0, 10);
    act(() => useEngagement.getState().setReady('status', { ...STATUS, streak: { ...STATUS.streak, pause: { from: today, until: '2099-01-04' } } }));
    const active = render(<HealthPauseSheet visible onClose={() => undefined} />);
    expect(active.has('pausa-saude-ativa')).toBe(true);
    active.press('pausa-saude-encerrar');
    await act(async () => undefined);
    expect(controller.endPause).toHaveBeenCalled();
  });

  it('pausa já usada na temporada: explica, sem botão', () => {
    act(() => useEngagement.getState().setReady('status', { ...STATUS, streak: { ...STATUS.streak, pauseAvailable: false } }));
    const r = render(<HealthPauseSheet visible onClose={() => undefined} />);
    expect(r.has('pausa-saude-usada')).toBe(true);
    expect(r.has('pausa-saude-comecar')).toBe(false);
  });

  it('bem-vindo de volta: 3 cartões e um passo leve', () => {
    let started = 0;
    let closed = 0;
    const r = render(
      <WelcomeBackSheet
        visible
        daysAway={20}
        cards={[
          { key: 'volta', icon: 'play', title: 'Sua missão de volta', body: 'Caminhe 1 km no seu ritmo. +60 XP, sem prazo.' },
          { key: 'baus', icon: 'chest', title: '3 baús guardados', body: 'Uma atividade de 1 km abre todos.' },
          { key: 'nivel', icon: 'trophy', title: 'Nível 6 · Pé na Rua', body: 'Todo o seu XP continua aqui.' },
        ]}
        onStart={() => (started += 1)}
        onClose={() => (closed += 1)}
      />,
    );
    expect(r.text()).toContain('Que bom te ver!');
    expect(r.text()).toContain('Faz 20 dias. Comece leve, no seu ritmo.');
    expect(r.has('bem-vindo-cartao-volta')).toBe(true);
    expect(r.has('bem-vindo-pausa')).toBe(false);
    r.press('bem-vindo-comecar');
    r.press('bem-vindo-fechar');
    expect([started, closed]).toEqual([1, 1]);
  });
});
