/**
 * F8 · C2 (E7 + E8): moldura "Recruta" no cartão de jogador do Você e o eco da crew no topo do feed do Clube
 * (fechar esconde o eco do dia: 1×/dia).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMemory = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (k: string) => (mockMemory.has(k) ? JSON.parse(JSON.stringify(mockMemory.get(k))) : null),
  writeLocal: async (k: string, v: unknown) => {
    if (v === null || v === undefined) mockMemory.delete(k);
    else mockMemory.set(k, v);
  },
}));
const mockEcho = jest.fn(async (): Promise<unknown> => ({ ok: true, data: null }));
jest.mock('@/services/api/crews-repo', () => ({ getCrewEcho: () => mockEcho() }));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render as renderOnce, type Rendered } from '@/components/__tests__/render-helpers';
import { PlayerCard, playerCardLabel } from '@/components/player-card';
import { brtCalendar } from '@/domain/progression';

import { resetCrewEchoCache } from '../crew-echo';
import { CrewEchoCard } from '../crew-echo-card';
/* eslint-enable import/first */

const mounted: Rendered[] = [];
function render(el: ReactElement): Rendered {
  const r = renderOnce(el);
  mounted.push(r);
  return r;
}
/** O card está na tela (nó nativo; o componente também leva o testID nas props). */
const shown = (r: Rendered, id: string) => r.all(id).some((n) => typeof n.type === 'string');
async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  mockMemory.clear();
  jest.clearAllMocks();
  resetCrewEchoCache();
});
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.renderer.unmount();
  });
});

describe('moldura Recruta no cartão de jogador', () => {
  const base = { name: 'voce.demo', faction: 'volt' as const, level: 3, xp: { into: 40, needed: 260 }, testID: 'cartao' };

  it('com a moldura: selo "Moldura Recruta" e o leitor de tela ouve', () => {
    const r = render(<PlayerCard {...base} frameName="Recruta" />);
    expect(r.has('cartao-moldura')).toBe(true);
    expect(r.text()).toContain('Moldura Recruta');
    expect(r.host('cartao').props.accessibilityLabel).toBe(playerCardLabel({ ...base, frameName: 'Recruta' }));
    expect(r.host('cartao').props.accessibilityLabel).toContain('Moldura Recruta');
  });

  it('sem moldura: como antes', () => {
    const r = render(<PlayerCard {...base} />);
    expect(r.has('cartao-moldura')).toBe(false);
    expect(r.host('cartao').props.accessibilityLabel).not.toContain('Moldura');
  });
});

describe('eco da crew no Clube (1×/dia)', () => {
  const now = brtCalendar.at('2026-11-04', 12);
  const echo = (day: string) => ({ available: true, day, mateUsername: 'rafa', cells: 3, othersCount: 0, totalCells: 3, notifyFrom: now - 3_600_000, notifyUntil: now + 3_600_000, isDemo: false });

  it('mostra no topo; fechar esconde o eco deste dia, e o de outro dia volta', async () => {
    mockEcho.mockResolvedValue({ ok: true, data: echo('2026-11-03') });
    const r = render(<CrewEchoCard now={now} testID="clube-eco-da-crew" dismissible />);
    await settle();
    expect(r.text()).toContain('rafa reforçou 3 trechos que você pintou');
    expect(r.host('clube-eco-da-crew-fechar').props.accessibilityLabel).toBe('Fechar o eco da crew de hoje');
    r.press('clube-eco-da-crew-fechar');
    await settle();
    expect(shown(r, 'clube-eco-da-crew')).toBe(false);
    expect(mockMemory.get('crew-echo-dismissed-day')).toBe('2026-11-03');

    resetCrewEchoCache();
    const again = render(<CrewEchoCard now={now} testID="clube-eco-da-crew" dismissible />);
    await settle();
    expect(shown(again, 'clube-eco-da-crew')).toBe(false);

    resetCrewEchoCache();
    mockEcho.mockResolvedValue({ ok: true, data: echo('2026-11-04') });
    const next = render(<CrewEchoCard now={now} testID="clube-eco-da-crew" dismissible />);
    await settle();
    expect(shown(next, 'clube-eco-da-crew')).toBe(true);
  });

  it('na central (sem fechar) continua como antes', async () => {
    mockMemory.set('crew-echo-dismissed-day', '2026-11-03');
    mockEcho.mockResolvedValue({ ok: true, data: echo('2026-11-03') });
    const r = render(<CrewEchoCard now={now} />);
    await settle();
    expect(shown(r, 'eco-da-crew')).toBe(true);
    expect(r.has('eco-da-crew-fechar')).toBe(false);
  });
});
