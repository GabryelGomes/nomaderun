/**
 * F8 · B2 (E7) — as peças de tela do engajamento: "Quando você corre de novo?" (D-94), momentos do resumo (só com
 * dado real), missões com "Ir"/"Fácil"/% inteiro e barra honesta, medalha tocável, "Como jogar" em 6 cartões,
 * sequência consertável com o recorde, selo "Precisa de reforço" (D-96) e o eco da crew.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn(), navigate: jest.fn() }, useFocusEffect: () => undefined }));

const mockMemory = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (k: string) => (mockMemory.has(k) ? JSON.parse(JSON.stringify(mockMemory.get(k))) : null),
  writeLocal: async (k: string, v: unknown) => {
    if (v === null || v === undefined) mockMemory.delete(k);
    else mockMemory.set(k, v);
  },
}));
jest.mock('@/features/notifications/reminders', () => ({ replanReminders: jest.fn(async () => ({ plan: [], scheduled: 0, cancelled: 0, skipped: 'unsupported' })) }));
jest.mock('@/features/run/notification-permission', () => ({ notificationPermissionStatus: jest.fn(async () => 'granted'), requestNotificationPermission: jest.fn(async () => true) }));
const mockList = jest.fn(async () => ({ ok: true, data: [] as unknown[] }));
jest.mock('@/services/api/activities-repo', () => ({
  ...(jest.requireActual('@/services/api/activities-repo') as object),
  listMyActivities: () => mockList(),
}));
const mockEcho = jest.fn(async (): Promise<unknown> => ({ ok: true, data: null }));
jest.mock('@/services/api/crews-repo', () => ({ getCrewEcho: () => mockEcho() }));
jest.mock('@/features/engagement/controller', () => ({
  refreshEngagement: jest.fn(async () => undefined),
  rerollDailyMission: jest.fn(async () => ({ ok: false, error: { message: 'x' } })),
  markRankingOpened: jest.fn(async () => ({ ok: true, data: { completed: [] } })),
  openStoredChests: jest.fn(),
  claimSeasonStep: jest.fn(),
  startPause: jest.fn(),
  endPause: jest.fn(),
}));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render as renderOnce, type Rendered } from '@/components/__tests__/render-helpers';
import { brtCalendar } from '@/domain/progression';
import { hasGuiltWords } from '@/domain/reminders';
import type { RunSummary } from '@/features/run/summary-model';
import { parseMissions } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { useGame } from '@/store/game-store';
import { router } from 'expo-router';

import { CosmeticThumb, trailColors } from '../cosmetic-thumb';
import { COSMETICS } from '../cosmetics';
import { CrewEchoCard } from '../crew-echo-card';
import { resetCrewEchoCache } from '../crew-echo';
import { howToPlayCards } from '../how-to-play';
import { MedalSheet, medalInfo } from '../medal-sheet';
import { MissionsScreen } from '../missions-screen';
import { ftueBarValue, missionGo, pctInt, streakLine, TIER_LABEL } from '../model';
import { NextRunPlanCard } from '../next-run-plan-card';
import { PLAN_KEY } from '../next-run-plan';
import { SummaryMoments } from '../summary-moments';
import { boostLabel, TeamBoostBadge } from '../team-boost';
/* eslint-enable import/first */

const NOW = brtCalendar.at('2026-10-21', 10);
const DAY = 86_400_000;

const mounted: Rendered[] = [];
function render(el: ReactElement): Rendered {
  const r = renderOnce(el);
  mounted.push(r);
  return r;
}
/** Deixa as promessas (memória local, leitura do servidor) terminarem dentro do `act`. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  mockMemory.clear();
  jest.clearAllMocks();
  resetCrewEchoCache();
  act(() => useEngagement.getState().reset());
});
afterEach(() => {
  for (const r of mounted.splice(0)) act(() => r.renderer.unmount());
});

describe('D-94 — "Quando você corre de novo?"', () => {
  it('1º resumo: 3 horários e "Agora não"; escolher grava o plano e confirma', async () => {
    const r = render(<NextRunPlanCard now={NOW} />);
    await settle();
    expect(r.has('plano-proxima')).toBe(true);
    expect(r.text()).toContain('Quando você corre de novo?');
    expect(r.text()).toContain('Amanhã · 19h');
    expect(r.has('plano-proxima-opcao-3')).toBe(true);
    expect(r.has('plano-proxima-agora-nao')).toBe(true);
    r.press('plano-proxima-opcao-1');
    await settle();
    expect(mockMemory.get(PLAN_KEY)).toEqual({ at: brtCalendar.at('2026-10-22', 19), askedWeek: brtCalendar.clock(NOW).weekId });
    expect(r.has('plano-proxima-combinado')).toBe(true);
    expect(r.text()).toContain('Combinado: Amanhã · 19h');
  });

  it('"Agora não" é neutro, some e não volta na mesma semana', async () => {
    const r = render(<NextRunPlanCard now={NOW} />);
    await settle();
    r.press('plano-proxima-agora-nao');
    await settle();
    expect(r.has('plano-proxima')).toBe(false);
    const again = render(<NextRunPlanCard now={NOW + 3_600_000} />);
    await settle();
    expect(again.has('plano-proxima')).toBe(false);
    // Texto da recusa sem confirmshaming.
    expect(hasGuiltWords('Agora não')).toBe(false);
  });
});

describe('momentos do resumo (só com dado real)', () => {
  const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
    source: 'official',
    status: 'valid',
    meters: 4200,
    movingSeconds: 1500,
    avgPace: 357,
    rpTotal: 30,
    xp: 40,
    flags: [],
    invalidSegments: [],
    zones: [],
    newFogCells: 0,
    beatGhost: null,
    trust: 100,
    review: null,
    ...over,
  });

  it('1º trecho: o cartão e a fala do líder (1 por tela)', async () => {
    const official = { extras: { milestones: { firstPaint: true, cells: 3, cellsRecord: null } } };
    const r = render(<SummaryMoments runId="r1" team="volt" official={official} summary={summary()} confirmed />);
    await settle();
    expect(r.has('momento-primeiro-trecho')).toBe(true);
    expect(r.has('momento-recorde')).toBe(false);
    expect(r.all('lider-comenta').filter((n) => typeof n.type === 'string').length).toBe(1);
    expect(r.text()).toContain('Téo Faria');
  });

  it('recorde: "Recorde · 47 trechos" com o anterior (comparação só consigo)', async () => {
    const official = { extras: { milestones: { firstPaint: false, cells: 47, cellsRecord: { value: 47, previous: 31 } } } };
    const r = render(<SummaryMoments runId="r2" team="owls" official={official} summary={summary()} confirmed />);
    await settle();
    expect(r.has('momento-recorde')).toBe(true);
    expect(r.text()).toContain('47 trechos');
    expect(r.text()).toContain('Antes: 31');
    expect(r.has('momento-primeiro-trecho')).toBe(false);
  });

  it('provisório, rejeitado ou servidor antigo sem marcos e sem feito: nada', async () => {
    const official = { extras: { milestones: { firstPaint: true, cells: 3, cellsRecord: null } } };
    const a = render(<SummaryMoments runId="r3" team="volt" official={official} summary={summary()} confirmed={false} />);
    const b = render(<SummaryMoments runId="r3" team="volt" official={official} summary={summary({ status: 'rejected' })} confirmed />);
    const c = render(<SummaryMoments runId="r3" team="volt" official={{}} summary={summary({ meters: 400 })} confirmed />);
    await settle();
    for (const x of [a, b, c]) expect(x.has('resumo-momentos')).toBe(false);
  });
});

describe('missões (UX-27)', () => {
  const mission = (id: string, defId: string, cadence: string, slot: number, extra: object = {}) => ({
    id,
    defId,
    kind: cadence,
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

  function fill(ftue: object[] = []) {
    act(() => {
      const s = useEngagement.getState();
      s.setUser('u');
      s.setLoadedAt(Date.now());
      s.setReady(
        'missions',
        parseMissions({
          periods: { daily: 'd', weekly: 'w' },
          daily: [mission('a', 'd-mover-15', 'diaria', 0), mission('b', 'd-caca-2', 'diaria', 1, { metric: 'huntChests', progress: 0, target: 2 }), mission('c', 'd-km', 'diaria', 2, { completedAt: NOW })],
          weekly: [mission('x', 's-2-atividades', 'semanal', 0, { metric: 'activities', progress: 1, target: 3 })],
          ftue,
          ftueStartedAt: ftue.length ? Date.now() - DAY : null,
          comeback: null,
          rerollsLeft: 1,
        }),
      );
    });
  }

  it('"Ir" abre a Nova corrida no modo certo; concluída não tem "Ir"; "Fácil"; % inteiro', () => {
    fill();
    const r = render(<MissionsScreen />);
    expect(r.has('missao-ir-diaria-0')).toBe(true);
    expect(r.has('missao-ir-diaria-2')).toBe(false);
    r.press('missao-ir-diaria-1');
    expect(useGame.getState().mission).toBe('caca');
    expect(router.push).toHaveBeenCalledWith('/corrida');
    expect(r.text()).toContain('Fácil');
    expect(r.text()).not.toContain('Leve');
    expect(r.text()).toContain('33%');
    expect(r.text()).not.toMatch(/\d+,\d+%/);
  });

  it('regras: missionGo, pctInt e a barra da primeira semana sem progresso dado', () => {
    expect(missionGo({ metric: 'ghostWins', completedAt: null })).toEqual({ label: 'Ir', href: '/corrida', mode: 'fuga' });
    expect(missionGo({ metric: 'meters', completedAt: null })?.mode).toBe('livre');
    expect(missionGo({ metric: 'shares', completedAt: null })?.href).toBe('/perfil/atividades');
    expect(missionGo({ metric: 'meters', completedAt: NOW })).toBeNull();
    expect(pctInt(1 / 3)).toBe('33%');
    expect(pctInt(0.999)).toBe('99%');
    expect(pctInt(1)).toBe('100%');
    expect(pctInt(-1)).toBe('0%');
    expect(TIER_LABEL.leve).toBe('Fácil');
    expect(ftueBarValue([])).toBe(0);
    const row = (status: 'done' | 'open' | 'locked') => ({ id: 'f', step: 1, short: '', title: '', xp: 0, status, unlocksAt: null, mission: null });
    expect(ftueBarValue([row('open'), ...Array.from({ length: 6 }, () => row('locked'))])).toBe(0);
    expect(ftueBarValue([row('done'), row('open'), ...Array.from({ length: 5 }, () => row('locked'))])).toBeCloseTo(1 / 7);
  });
});

describe('medalha tocável (UX-34)', () => {
  it('nome, critério do próximo nível e progresso com o número real', () => {
    const info = medalInfo('primeiros-passos', 'runs', 7, [1, 10, 50]);
    expect(info).toMatchObject({ name: 'Primeiros passos', tier: 1, status: 'Nível 1 de 3', criterion: 'Complete 10 corridas', progress: { value: 7, target: 10, label: '7 de 10' } });
    expect(medalInfo('conquistador', 'zones', 0, [1, 10, 50])).toMatchObject({ status: 'Ainda não é sua', criterion: 'Conquiste 1 zona' });
    expect(medalInfo('sequencia', 'streakWeeks', 20, [2, 4, 12])).toMatchObject({ tier: 3, progress: null });
    const r = render(<MedalSheet info={info} onClose={() => {}} />);
    expect(r.text()).toContain('Complete 10 corridas');
    expect(r.text()).toContain('7 de 10');
    expect(r.has('medalha-folha-fechar')).toBe(true);
  });
});

describe('cosméticos com miniatura (UX-39)', () => {
  it('todo rastro tem cor de traço e toda miniatura desenha', () => {
    for (const c of COSMETICS.filter((x) => x.slot === 'trail')) expect(trailColors(c.id).length).toBeGreaterThan(0);
    for (const c of COSMETICS.filter((x) => x.slot !== 'title')) expect(render(<CosmeticThumb def={c} owned />).renderer.toJSON()).not.toBeNull();
  });
});

describe('"Como jogar" (UX-07, UX-19)', () => {
  it('6 cartões com arte, frases ≤ 90 e sem culpa', () => {
    const cards = howToPlayCards('striders');
    expect(cards.map((c) => c.title)).toEqual(['Corra', 'Pinte', 'Defenda', 'Chefão', 'Missões e baú', 'Liga']);
    for (const c of cards) {
      expect(c.art).toBeTruthy();
      expect(c.body.length).toBeLessThanOrEqual(90);
      expect(hasGuiltWords(c.body)).toBe(false);
    }
  });
});

describe('sequência quebrada, consertável e sem culpa', () => {
  it('o recorde fica ao lado; a quebra vira "Sequência nova"', () => {
    expect(streakLine({ weeks: 0, best: 6, activitiesThisWeek: 1 })).toEqual({ main: 'Sequência nova: 1 de 2 nesta semana', best: 'Sua melhor: 6 semanas' });
    expect(streakLine({ weeks: 3, best: 3, activitiesThisWeek: 2 })).toEqual({ main: '3 semanas seguidas · semana garantida', best: null });
    expect(streakLine({ weeks: 1, best: 4, activitiesThisWeek: 0 })).toEqual({ main: '1 semana seguida · 0 de 2 nesta', best: 'Sua melhor: 4 semanas' });
    expect(streakLine({ weeks: 0, best: 0, activitiesThisWeek: 0 }).best).toBeNull();
    for (const t of [streakLine({ weeks: 0, best: 6, activitiesThisWeek: 0 }).main]) expect(hasGuiltWords(t)).toBe(false);
  });
});

describe('selo "Precisa de reforço" (D-96)', () => {
  it('só no time que precisa, só cosmético e marcado na demonstração', () => {
    const boost = { needsBoost: 'owls' as const, isDemo: true };
    const owls = render(<TeamBoostBadge team="owls" boost={boost} />);
    expect(owls.has('selo-reforco-owls')).toBe(true);
    expect(owls.text()).toContain('demonstração');
    expect(owls.host('selo-reforco-owls').props.accessibilityLabel).toContain('sem vantagem');
    expect(render(<TeamBoostBadge team="volt" boost={boost} />).has('selo-reforco-volt')).toBe(false);
    expect(render(<TeamBoostBadge team="owls" boost={null} />).has('selo-reforco-owls')).toBe(false);
    expect(boostLabel(false).text).toBe('Precisa de reforço');
  });
});

describe('eco da crew na central', () => {
  it('mostra o texto real dentro da janela; sem eco, nada', async () => {
    const now = Date.now();
    const echo = { available: true, day: '2026-10-20', mateUsername: 'rafa', cells: 3, othersCount: 0, totalCells: 3, notifyFrom: now - 3_600_000, notifyUntil: now + 3_600_000, isDemo: true };
    mockEcho.mockResolvedValueOnce({ ok: true, data: echo });
    const hour = new Date(now - 3 * 3_600_000).getUTCHours();
    const r = render(<CrewEchoCard now={now} />);
    await settle();
    // Fora das 07h–22h (Brasília) o eco não aparece, mesmo com dado.
    if (hour >= 7 && hour < 22) {
      expect(r.text()).toContain('rafa reforçou 3 trechos que você pintou');
      expect(r.host('eco-da-crew').props.accessibilityLabel).toContain('Demonstração');
    } else {
      expect(r.has('eco-da-crew')).toBe(false);
    }
    resetCrewEchoCache();
    const none = render(<CrewEchoCard now={now} />);
    await settle();
    expect(none.has('eco-da-crew')).toBe(false);
  });
});
