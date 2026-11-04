/**
 * @jest-environment node
 *
 * F8 · C2 (E8 + E7): telemetria dos eventos novos de ponta a ponta na demonstração — compartilhar o card
 * (`share`) e a missão que o compartilhamento conclui (`mission_complete`) saem da tela pelo `recordShareDone`,
 * passam pelo `record_share` do servidor de demonstração e chegam a `track_events`. E a moldura "Recruta" lida
 * do servidor + aparelho (`hasRecruitFrame`). Sem rede.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { ftueAssignment } from '@/domain/missions';
import { createDemoClient, getDemoClient, setDemoClient } from '@/services/api/demo';
import { demoEngagementState } from '@/services/api/demo/engagement';
import { demoTelemetryState } from '@/services/api/demo/telemetry';
import * as engagementRepo from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import { recordShareDone } from '../controller';
import { hasRecruitFrame } from '../recruit-frame';
import { loadTelemetryConsent, resetTelemetryForTests, setTelemetryOptIn, telemetryQueue } from '../telemetry';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z'); // sexta, 09:00 em Brasília
const realFetch = globalThis.fetch;
const network = jest.fn(() => Promise.reject(new Error('rede proibida no modo demonstração')));

beforeAll(() => {
  globalThis.fetch = network as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  setDemoClient(null);
  useSession.getState().reset();
  expect(network).not.toHaveBeenCalled();
});

const db = () => (getDemoClient() as unknown as { db: Parameters<typeof demoTelemetryState>[0] }).db;

function signIn() {
  setDemoClient(createDemoClient({ clock: () => NOW + 60_000, latencyMs: 0 }));
  useEngagement.getState().reset();
  resetTelemetryForTests();
  useSession.getState().setSession({ userId: DEMO_USER_ID, email: 'demo@exemplo.invalid' } as never);
}

describe('C2 — telemetria de ponta a ponta na demonstração', () => {
  it('compartilhar a corrida oficial: share + mission_complete da missão que o servidor concluiu, já enviados', async () => {
    signIn();
    await loadTelemetryConsent();
    const on = await setTelemetryOptIn(true, NOW);
    expect(on.ok && on.data.optIn).toBe(true);
    await engagementRepo.fetchMissions();
    const st = demoEngagementState(db(), DEMO_USER_ID)!;
    const a = ftueAssignment('f7-compartilhar', NOW - 1000, { raidActive: false, leagueActive: false })!;
    st.assignments.push({ ...a, id: 'teste-f7-compartilhar', rerolledAt: null, claimedAt: null, createdAt: NOW });
    const runId = String(db().tables.activities.find((x) => x.user_id === DEMO_USER_ID && x.status !== 'recording')!.id);

    await recordShareDone(runId, NOW);

    expect(telemetryQueue()).toHaveLength(0);
    const events = demoTelemetryState(db())!.events;
    expect(events.map((e) => e.event)).toEqual(['share', 'mission_complete']);
    expect(events[1].props).toMatchObject({ missionId: expect.any(String) });
    expect(events.every((e) => e.day === '2026-10-23' && !('at' in e))).toBe(true);
  });

  it('recap (sem corrida): só share; sem consentimento, nada sai do aparelho', async () => {
    signIn();
    await loadTelemetryConsent();
    await recordShareDone(null, NOW);
    expect(demoTelemetryState(db())?.events ?? []).toHaveLength(0);
    await setTelemetryOptIn(true, NOW);
    await recordShareDone(null, NOW);
    expect(demoTelemetryState(db())!.events.map((e) => e.event)).toEqual(['share']);
  });
});

describe('C2 — moldura "Recruta" no cartão do Você', () => {
  it('servidor ou aparelho bastam; nenhum dos dois, sem moldura', () => {
    expect(hasRecruitFrame([{ id: 'moldura-recruta' }], [])).toBe(true);
    expect(hasRecruitFrame(null, ['moldura-recruta'])).toBe(true);
    expect(hasRecruitFrame([{ id: 'moldura-bronze' }], [])).toBe(false);
    expect(hasRecruitFrame(null, [])).toBe(false);
  });
});
