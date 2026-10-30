/**
 * T7.3.3 (E6c) — Arena e Clube: o chefão aparece só com dado real (D-76), o selo de demonstração vem do dado,
 * a grade de modos leva à corrida com o modo certo, e as regras de apresentação (fase → arte, prazo, semana da
 * crew, quadro "Cidades") ficam fixas.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => ({ ...require('@/components/motion/__tests__/render-mocks').reanimated, withRepeat: (v: unknown) => v, useAnimatedScrollHandler: () => () => undefined, Easing: { ...require('@/components/motion/__tests__/render-mocks').reanimated.Easing, inOut: (f: unknown) => f, sin: (t: number) => t } }));
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: (...a: unknown[]) => mockPush(...a), navigate: (...a: unknown[]) => mockNavigate(...a) }, useFocusEffect: () => undefined }));
jest.mock('@/services/api/env', () => ({ isDemoMode: () => false }));
const mockRaid = jest.fn<() => Promise<unknown>>();
const mockLeague = jest.fn<() => Promise<unknown>>();
jest.mock('@/services/api/raid-repo', () => ({ fetchRaidCurrent: () => mockRaid() }));
jest.mock('@/services/api/league-repo', () => ({ fetchLeagueCurrent: () => mockLeague() }));
jest.mock('@/features/engagement', () => ({ useEngagementData: () => ({ missions: { status: 'unavailable', data: null } }) }));

/* eslint-disable import/first */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useGame } from '@/store/game-store';

import { ArenaScreen } from '../arena-screen';
import { atlasPercent, bossLook, hpRatio, percentLabel, timeLeft } from '../arena-screen.model';
import { crewWeek, crewWeekFromGoal, emptyRankingText, hasPeriod, scopesFor } from '../club-ranking';
/* eslint-enable import/first */

const H = 3_600_000;
const NOW = Date.now();

const raid = (over: object = {}) => ({
  ok: true,
  data: {
    available: true,
    raid: { id: 'r1', bossId: 'mormaco', name: 'Mormaço de Outubro', hp: 3600, hpMax: 10_000, phase: 2, status: 'active', endsAt: NOW + 19 * H + 60_000, isDemo: false, ...over },
    me: { damage: 120 },
    share: 0.042,
  },
});
const league = { ok: true, data: { available: true, divisionName: 'Calçada', groupSize: 30, promoteSlots: 5, me: { position: 6 } } };

const mounted: ReactTestRenderer[] = [];
async function mount(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<ArenaScreen />);
  });
  mounted.push(r);
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const has = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id).length > 0;
const text = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.type === 'string' && (typeof n.props.children === 'string' || Array.isArray(n.props.children)))
    .map((n) => [n.props.children].flat().filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
    .join('|');

afterEach(() => {
  // Desmonta (relógio do prazo e animações) antes de o Jest desmontar o ambiente.
  for (const r of mounted.splice(0)) act(() => r.unmount());
});

beforeEach(() => {
  mockPush.mockReset();
  mockNavigate.mockReset();
  mockRaid.mockReset();
  mockLeague.mockReset();
});

describe('Arena', () => {
  it('chefão real: arte, vida, fase, prazo, "Sua parte" e a liga; sem selo numa conta real', async () => {
    mockRaid.mockResolvedValue(raid());
    mockLeague.mockResolvedValue(league);
    const r = await mount();
    expect(has(r, 'arena-raid')).toBe(true);
    expect(has(r, 'arena-raid-chefao')).toBe(true);
    expect(has(r, 'arena-raid-demonstracao')).toBe(false);
    const t = text(r);
    expect(t).toContain('Mormaço de Outubro');
    expect(t).toContain('36% de vida · Fase 2');
    expect(t).toContain('Foge em 19 h');
    expect(t).toContain('4%');
    expect(t).toContain('Liga Calçada');
    expect(t).toContain('6º de 30 · top 5 sobe');
  });

  it('dado de demonstração vem com o selo', async () => {
    mockRaid.mockResolvedValue(raid({ isDemo: true }));
    mockLeague.mockResolvedValue(league);
    const r = await mount();
    expect(has(r, 'arena-raid-demonstracao')).toBe(true);
  });

  it('D-76: servidor sem Raid/Liga mostra estado ilustrado, sem nenhum número', async () => {
    mockRaid.mockResolvedValue({ ok: true, data: { available: false, reason: 'servidor-antigo' } });
    mockLeague.mockResolvedValue({ ok: true, data: { available: false, reason: 'desligada' } });
    const r = await mount();
    expect(has(r, 'arena-raid-vazio')).toBe(true);
    expect(has(r, 'arena-raid')).toBe(false);
    expect(has(r, 'arena-liga-vazio')).toBe(true);
    const t = text(r);
    expect(t).toContain('O chefão ainda não chegou');
    expect(t).not.toMatch(/de vida|Sua parte|Foge em/);
  });

  it('erro: "Sem conexão" e tentar de novo, sem número', async () => {
    mockRaid.mockResolvedValue({ ok: false, error: { code: 'NETWORK', message: 'Sem internet' } });
    mockLeague.mockResolvedValue(league);
    const r = await mount();
    expect(text(r)).toContain('Sem conexão');
    expect(has(r, 'arena-raid-tentar')).toBe(true);
  });

  it('grade 2×2: Fuga e Caça escolhem o modo e abrem a corrida; Domínio e Atlas abrem o mapa', async () => {
    mockRaid.mockResolvedValue(raid());
    mockLeague.mockResolvedValue(league);
    const r = await mount();
    const press = (id: string) =>
      act(() => {
        r.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress({});
      });
    await press('arena-modo-caca');
    expect(useGame.getState().mission).toBe('caca');
    expect(mockPush).toHaveBeenLastCalledWith('/corrida');
    await press('arena-modo-fuga');
    expect(useGame.getState().mission).toBe('fuga');
    await press('arena-modo-atlas');
    expect(mockNavigate).toHaveBeenLastCalledWith('/');
  });
});

describe('regras de apresentação', () => {
  it('fase → estado e rachaduras do chefão', () => {
    expect(bossLook({ status: 'active', phase: 1 })).toEqual({ state: 'parado', dano: 0 });
    expect(bossLook({ status: 'active', phase: 2 })).toEqual({ state: 'parado', dano: 1 });
    expect(bossLook({ status: 'active', phase: 3 })).toEqual({ state: 'furioso', dano: 2 });
    expect(bossLook({ status: 'defeated', phase: 3 })).toEqual({ state: 'derrotado', dano: 2 });
    expect(bossLook({ status: 'escaped', phase: 2 })).toEqual({ state: 'parado', dano: 1 });
  });

  it('porcentagem nunca some quem ajudou; prazo em d, h ou min', () => {
    expect(percentLabel(0)).toBe('0%');
    expect(percentLabel(0.004)).toBe('<1%');
    expect(percentLabel(0.36)).toBe('36%');
    expect(hpRatio({ hp: 5, hpMax: 0 })).toBe(0);
    expect(timeLeft(3 * 24 * H)).toBe('3 d');
    expect(timeLeft(19 * H + 1)).toBe('19 h');
    expect(timeLeft(45 * 60_000)).toBe('45 min');
    expect(timeLeft(-5)).toBe('0 min');
    expect(atlasPercent([])).toBe(0);
  });

  it('semana da crew: só quem tem a sigla e correu; meta = todos correrem', () => {
    const rows = [
      { crewTag: 'FLR', meters: 5000, runs: 1 },
      { crewTag: 'FLR', meters: 3200, runs: 2 },
      { crewTag: 'OUT', meters: 9000, runs: 3 },
      { crewTag: 'FLR', meters: 0, runs: 0 },
    ];
    expect(crewWeek(rows, 'FLR', 4)).toEqual({ meters: 8200, ran: 2, ratio: 0.5 });
    expect(crewWeek([], 'FLR', 0)).toEqual({ meters: 0, ran: 0, ratio: 0 });
    // D-88: com a meta oficial, a barra é km feitos ÷ meta (não mais quem correu ÷ membros)
    expect(crewWeekFromGoal({ meters: 8200, ran: 2, goalMeters: 40000 })).toEqual({ meters: 8200, ran: 2, ratio: 0.205, goalMeters: 40000 });
    expect(crewWeekFromGoal({ meters: 90000, ran: 4, goalMeters: 40000 }).ratio).toBe(1);
  });

  it('quadro "Cidades": sem escopo, sem período e com vazio próprio', () => {
    expect(scopesFor('cidades')).toEqual(['geral']);
    expect(hasPeriod('cidades')).toBe(false);
    expect(hasPeriod('individual')).toBe(true);
    expect(emptyRankingText('cidades', 'geral', 'season', { id: null, city: null, faction: null, district: null })).toMatch(/cidade/);
  });
});
