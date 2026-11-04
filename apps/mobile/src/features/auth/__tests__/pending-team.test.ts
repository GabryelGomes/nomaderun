/**
 * D-91 — o time escolhido antes da conta fica no aparelho até o cadastro terminar; nunca guarda dado de pessoa e
 * recusa valor inválido. F8-D · B3: tem validade (24 h) e origem; some ao abrir Entrar (menos logo depois do próprio
 * cadastro), ao abrir o cadastro sem vir da escolha e na troca de modo / saída da conta.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, unknown>();
jest.mock('@/features/engagement/local-store', () => ({
  readLocal: async (name: string) => mockStore.get(name) ?? null,
  writeLocal: async (name: string, value: unknown) => {
    if (value === null || value === undefined) mockStore.delete(name);
    else mockStore.set(name, JSON.parse(JSON.stringify(value)));
  },
}));

/* eslint-disable import/first */
import {
  clearPendingTeam,
  clearPendingTeamOnSignIn,
  clearPendingTeamOutsideChoice,
  getPendingTeam,
  hydratePendingTeam,
  markPendingTeamSignedUp,
  parsePendingTeam,
  PENDING_TEAM_TTL_MS,
  resetPendingTeam,
  savePendingTeam,
  usePendingTeam,
} from '../pending-team';
/* eslint-enable import/first */

const NOW = 1_800_000_000_000;
const rec = (team: string, origin = 'escolha', at = NOW) => ({ team, at, origin });

beforeEach(() => {
  mockStore.clear();
  usePendingTeam.setState({ team: null, record: null, hydrated: false });
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('time pendente (antes da conta)', () => {
  it('guarda na memória e no aparelho (só time, hora e origem); apagar limpa os dois', async () => {
    await savePendingTeam('volt');
    expect(usePendingTeam.getState().team).toBe('volt');
    expect(mockStore.get('pending-team')).toEqual({ team: 'volt', at: NOW, origin: 'escolha' });
    await clearPendingTeam();
    expect(usePendingTeam.getState().team).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);
  });

  it('numa sessão nova do app, lê o aparelho uma vez (sobrevive a fechar o app entre a cerimônia e o cadastro)', async () => {
    mockStore.set('pending-team', rec('coyotes'));
    expect(await getPendingTeam()).toBe('coyotes');
    expect(usePendingTeam.getState()).toMatchObject({ team: 'coyotes', hydrated: true });
    mockStore.delete('pending-team');
    // já hidratado: a memória vale, não relê
    expect(await getPendingTeam()).toBe('coyotes');
  });

  it('valor inválido ou do formato antigo (só o id, sem dono nem hora) vira "nenhum" e some do aparelho', async () => {
    mockStore.set('pending-team', rec('dragons'));
    expect(await getPendingTeam()).toBeNull();
    usePendingTeam.setState({ team: null, record: null, hydrated: false });
    mockStore.set('pending-team', 'volt');
    expect(await getPendingTeam()).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);
    expect(parsePendingTeam({ team: 'volt', at: NOW, origin: 'outra' }, NOW)).toBeNull();
  });

  it('F8-D · B3: vale por 24 h; depois disso (ou com hora no futuro) não vale e é apagada', async () => {
    expect(parsePendingTeam(rec('owls', 'escolha', NOW - PENDING_TEAM_TTL_MS + 1), NOW)).not.toBeNull();
    expect(parsePendingTeam(rec('owls', 'escolha', NOW - PENDING_TEAM_TTL_MS), NOW)).toBeNull();
    expect(parsePendingTeam(rec('owls', 'escolha', NOW + 5 * 60_000), NOW)).toBeNull();
    mockStore.set('pending-team', rec('owls', 'escolha', NOW - PENDING_TEAM_TTL_MS - 1));
    expect(await getPendingTeam()).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);
    // na memória também vence (app aberto por mais de 24 h)
    await savePendingTeam('volt');
    jest.spyOn(Date, 'now').mockReturnValue(NOW + PENDING_TEAM_TTL_MS);
    expect(await getPendingTeam()).toBeNull();
    expect(usePendingTeam.getState().team).toBeNull();
  });

  it('F8-D · B3: abrir "Entrar" apaga a escolha largada por alguém, mas não a de quem acabou de se cadastrar', async () => {
    mockStore.set('pending-team', rec('owls', 'escolha'));
    await clearPendingTeamOnSignIn();
    expect(await getPendingTeam()).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);

    await savePendingTeam('volt');
    await markPendingTeamSignedUp();
    expect(mockStore.get('pending-team')).toMatchObject({ team: 'volt', origin: 'cadastro' });
    await clearPendingTeamOnSignIn();
    expect(await getPendingTeam()).toBe('volt');
  });

  it('F8-D · B3: cadastro aberto fora da escolha apaga qualquer escolha guardada', async () => {
    mockStore.set('pending-team', rec('striders', 'cadastro'));
    await clearPendingTeamOutsideChoice();
    expect(await getPendingTeam()).toBeNull();
    expect(mockStore.has('pending-team')).toBe(false);
  });

  it('F8-D · B3: troca de modo / saída da conta zera a memória e o aparelho do modo atual', async () => {
    await savePendingTeam('coyotes');
    await resetPendingTeam();
    expect(usePendingTeam.getState()).toMatchObject({ team: null, record: null, hydrated: true });
    expect(mockStore.has('pending-team')).toBe(false);
    expect(await getPendingTeam()).toBeNull();
  });

  it('hydratePendingTeam só lê quando ainda não leu', async () => {
    mockStore.set('pending-team', rec('owls'));
    hydratePendingTeam();
    await new Promise((r) => setTimeout(r, 0));
    expect(usePendingTeam.getState().team).toBe('owls');
    mockStore.set('pending-team', rec('volt'));
    hydratePendingTeam();
    await new Promise((r) => setTimeout(r, 0));
    expect(usePendingTeam.getState().team).toBe('owls');
  });
});
