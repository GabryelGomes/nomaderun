import { describe, expect, it, jest } from '@jest/globals';

import { buildFunctionPath, errorFromFunctions } from '../functions';
import { parseProviders, isBackendConfigured } from '../env';
import { toProfile, toProfileRow } from '../types';

jest.mock('../supabase', () => ({ requireSupabase: jest.fn(), getSupabase: jest.fn() }));

describe('toProfile', () => {
  it('lê a linha do banco com notification_prefs jsonb', () => {
    const p = toProfile({
      id: 'u1',
      username: 'ana',
      birthdate: '2000-01-02',
      faction: 'owls',
      city: 'Goiânia',
      units: 'mi',
      notification_prefs: { invasion: false, conquest: true, missions: true, moderation: true },
      xp: 120,
      trust: 90,
      role: 'moderator',
      status: 'active',
    });
    expect(p).toMatchObject({ id: 'u1', username: 'ana', faction: 'owls', city: 'Goiânia', unit: 'mi', xp: 120, trust: 90, role: 'moderator' });
    expect(p.notificationPrefs).toEqual({ invasions: false, conquests: true, missions: true, moderation: true });
  });

  it('tolera colunas notify_*, distance_unit e valores inválidos', () => {
    const p = toProfile({ id: 'u2', username: null, faction: 'dragons', distance_unit: 'km', notify_missions: false, role: 'root' });
    expect(p.faction).toBeNull();
    expect(p.username).toBe('');
    expect(p.unit).toBe('km');
    expect(p.role).toBe('runner');
    expect(p.notificationPrefs.missions).toBe(false);
    expect(p.trust).toBe(100);
  });

  it('toProfileRow só envia campos editáveis', () => {
    expect(toProfileRow({ username: ' ana ', city: '  ', unit: 'km' })).toEqual({ username: 'ana', city: null, units: 'km' });
    expect(toProfileRow({ notificationPrefs: { invasions: true, conquests: false, missions: true, moderation: true } })).toEqual({
      notification_prefs: { invasion: true, conquest: false, missions: true, moderation: true },
    });
  });
});

describe('env', () => {
  it('parseProviders aceita só google/apple, sem repetir', () => {
    expect(parseProviders(' Google, apple ,facebook,google')).toEqual(['google', 'apple']);
    expect(parseProviders(undefined)).toEqual([]);
  });

  it('isBackendConfigured exige URL e chave', () => {
    expect(isBackendConfigured({ supabaseUrl: 'http://x', supabaseAnonKey: 'k', oauthProviders: [] })).toBe(true);
    expect(isBackendConfigured({ supabaseUrl: 'http://x', supabaseAnonKey: null, oauthProviders: [] })).toBe(false);
  });
});

describe('functions', () => {
  it('monta a query string', () => {
    expect(buildFunctionPath('zones', { bbox: '-49.3,-16.7,-49.2,-16.6' })).toBe('zones?bbox=-49.3%2C-16.7%2C-49.2%2C-16.6');
    expect(buildFunctionPath('account-export')).toBe('account-export');
  });

  it('lê o corpo de erro do contrato em FunctionsHttpError', async () => {
    const res = { status: 409, clone: () => ({ json: async () => ({ error: { code: 'MISSING_POINTS', message: 'Faltam pontos.' } }) }) };
    const e = await errorFromFunctions({ name: 'FunctionsHttpError', context: res });
    expect(e).toMatchObject({ code: 'CONFLICT', detail: 'MISSING_POINTS', message: 'Faltam pontos.' });
  });

  it('corpo ilegível cai no status', async () => {
    const res = { status: 500, clone: () => ({ json: async () => Promise.reject(new Error('x')) }) };
    expect((await errorFromFunctions({ name: 'FunctionsHttpError', context: res })).code).toBe('SERVER');
    expect((await errorFromFunctions({ name: 'FunctionsFetchError' })).code).toBe('NETWORK');
  });
});
