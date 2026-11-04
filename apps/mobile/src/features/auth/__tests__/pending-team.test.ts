/**
 * D-91 — o time escolhido antes da conta fica no aparelho até o cadastro terminar; nunca guarda dado de pessoa e
 * recusa valor inválido.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (name: string) => mockStore.get(name) ?? null,
  writeLocal: async (name: string, value: unknown) => {
    if (value === null || value === undefined) mockStore.delete(name);
    else mockStore.set(name, JSON.parse(JSON.stringify(value)));
  },
}));

/* eslint-disable import/first */
import { clearPendingTeam, getPendingTeam, hydratePendingTeam, savePendingTeam, usePendingTeam } from '../pending-team';
/* eslint-enable import/first */

beforeEach(() => {
  mockStore.clear();
  usePendingTeam.setState({ team: null, hydrated: false });
});

describe('time pendente (antes da conta)', () => {
  it('guarda na memória e no aparelho; apagar limpa os dois', async () => {
    await savePendingTeam('volt');
    expect(usePendingTeam.getState().team).toBe('volt');
    expect(mockStore.get('pending-team')).toBe('volt');
    await clearPendingTeam();
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);
  });

  it('numa sessão nova do app, lê o aparelho uma vez (sobrevive a fechar o app entre a cerimônia e o cadastro)', async () => {
    mockStore.set('pending-team', 'coyotes');
    expect(await getPendingTeam()).toBe('coyotes');
    expect(usePendingTeam.getState()).toMatchObject({ team: 'coyotes', hydrated: true });
    mockStore.delete('pending-team');
    // já hidratado: a memória vale, não relê
    expect(await getPendingTeam()).toBe('coyotes');
  });

  it('valor inválido no aparelho vira "nenhum"', async () => {
    mockStore.set('pending-team', 'dragons');
    expect(await getPendingTeam()).toBeNull();
  });

  it('hydratePendingTeam só lê quando ainda não leu', async () => {
    mockStore.set('pending-team', 'owls');
    hydratePendingTeam();
    await new Promise((r) => setTimeout(r, 0));
    expect(usePendingTeam.getState().team).toBe('owls');
    mockStore.set('pending-team', 'volt');
    hydratePendingTeam();
    await new Promise((r) => setTimeout(r, 0));
    expect(usePendingTeam.getState().team).toBe('owls');
  });
});
