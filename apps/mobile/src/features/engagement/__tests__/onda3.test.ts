/**
 * @jest-environment node
 *
 * T7.3.6 (E7): telemetria opt-in (D-82), "Sua 1ª zona!" (`firstConquestEver`), primeira semana ligada às
 * missões reais (compartilhar e ranking contam no servidor de demonstração) e o recorte da trilha. Sem rede.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

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
import { AppError, fail } from '@/services/api/errors';
import * as telemetryRepo from '@/services/api/telemetry-repo';
import { recordShare } from '@/services/api/share-repo';
import { selectFirstConquestEver, useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import { ensureConquestHistory, markRankingOpened, recordRunResult } from '../controller';
import { getFirstConquestEver } from '../hooks';
import { ftueAction, ftueComplete, trackWindow, type FtueRow } from '../model';
import { flushTelemetry, loadTelemetryConsent, resetTelemetryForTests, setTelemetryOptIn, telemetryAllowed, telemetryQueue, trackTelemetry } from '../telemetry';
import { enqueue, freshEvents, sanitizeEvent, TELEMETRY_COPY, TELEMETRY_EVENTS, TELEMETRY_QUEUE_MAX, toWire } from '../telemetry-model';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z'); // sexta, 09:00 em Brasília
const DAY = 86_400_000;
let clock = NOW;
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

function signIn(scenario?: 'vazio') {
  clock = NOW;
  setDemoClient(createDemoClient({ clock: () => clock, latencyMs: 0, ...(scenario ? { scenario } : {}) }));
  useEngagement.getState().reset();
  resetTelemetryForTests();
  useSession.getState().setSession({ userId: DEMO_USER_ID, email: 'demo@exemplo.invalid' } as never);
}

/** Deixa as promessas soltas (recarga, envio) terminarem. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 5));
};

const db = () => (getDemoClient() as unknown as { db: Parameters<typeof demoTelemetryState>[0] }).db;

describe('telemetria: parte pura', () => {
  it('lista fechada de 5 eventos; nome fora da lista não entra; props fora da regra somem', () => {
    expect(TELEMETRY_EVENTS).toEqual(['app_open', 'run_finish', 'zone_conquer', 'share', 'mission_complete']);
    expect(sanitizeEvent({ name: 'tela_vista', at: NOW })).toBeNull();
    const e = sanitizeEvent({ name: 'mission_complete', at: NOW, props: { kind: 'diaria', missionId: 'd-km', lat: -15.8, rota: 'x' } })!;
    expect(e.props).toEqual({ kind: 'diaria', missionId: 'd-km' });
    expect(sanitizeEvent({ name: 'mission_complete', at: NOW, props: { kind: 'qualquer', missionId: '-15.79,-47.88' } })!.props).toEqual({});
    expect(sanitizeEvent({ name: 'zone_conquer', at: NOW, props: { count: 900 } })!.props).toEqual({ count: 50 });
    expect(sanitizeEvent({ name: 'run_finish', at: NOW, props: { pace: 300 } })!.props).toEqual({});
  });

  it('no envio só vai o dia (Brasília), nunca a hora; evento com mais de 2 dias não viaja; fila com teto', () => {
    const e = sanitizeEvent({ name: 'app_open', at: Date.parse('2026-10-23T02:00:00Z') })!; // 22/10, 23:00 em Brasília
    const wire = toWire(e, 'android');
    expect(wire).toEqual({ event: 'app_open', day: '2026-10-22', platform: 'android' });
    expect(JSON.stringify(wire)).not.toContain(String(e.at));
    const old = sanitizeEvent({ name: 'share', at: NOW - 3 * DAY })!;
    expect(freshEvents([old, e], NOW)).toEqual([e]);
    let q: ReturnType<typeof enqueue> = [];
    for (let i = 0; i < TELEMETRY_QUEUE_MAX + 5; i++) q = enqueue(q, sanitizeEvent({ name: 'share', at: NOW + i })!);
    expect(q).toHaveLength(TELEMETRY_QUEUE_MAX);
    expect(q[0].at).toBe(NOW + 5);
  });

  it('folha de consentimento: o que coleta, o que nunca coleta, por quanto tempo e como desligar (frases curtas)', () => {
    expect(TELEMETRY_COPY.sections.map((s) => s.key)).toEqual(['coleta', 'nunca', 'tempo', 'desligar']);
    expect(TELEMETRY_COPY.sections.find((s) => s.key === 'tempo')!.body).toContain('30 dias');
    for (const s of TELEMETRY_COPY.sections) {
      expect(s.title.length).toBeLessThanOrEqual(30);
      expect(s.body.length).toBeLessThanOrEqual(90);
    }
  });
});

describe('telemetria opt-in no servidor de demonstração', () => {
  beforeEach(() => signIn());

  it('desligada por padrão: nada fica na fila e nada chega ao servidor', async () => {
    await loadTelemetryConsent();
    expect(useEngagement.getState().telemetry.data?.optIn).toBe(false);
    expect(telemetryAllowed()).toBe(false);
    expect(trackTelemetry('app_open', undefined, NOW)).toBe(false);
    expect(trackTelemetry('run_finish', undefined, NOW)).toBe(false);
    expect(telemetryQueue()).toHaveLength(0);
    await flushTelemetry(NOW);
    expect(demoTelemetryState(db())?.events ?? []).toHaveLength(0);
    // E o servidor recusa direto, mesmo que alguém tente enviar.
    const direct = await telemetryRepo.sendTelemetryEvents([{ event: 'app_open', day: '2026-10-23' }]);
    expect(!direct.ok && direct.error.detail).toBe('TELEMETRY_CONSENT');
  });

  it('ligado: lote com o dia, 1 app_open por dia; desligar esvazia a fila e apaga no servidor', async () => {
    await loadTelemetryConsent();
    const on = await setTelemetryOptIn(true, NOW);
    expect(on.ok && on.data.optIn).toBe(true);
    expect(trackTelemetry('app_open', undefined, NOW)).toBe(true);
    expect(trackTelemetry('app_open', undefined, NOW + 1000)).toBe(false);
    trackTelemetry('zone_conquer', { count: 2 }, NOW);
    trackTelemetry('mission_complete', { kind: 'ftue', missionId: 'f1-dominio' }, NOW);
    expect(telemetryQueue()).toHaveLength(3);
    await flushTelemetry(NOW);
    expect(telemetryQueue()).toHaveLength(0);
    const events = demoTelemetryState(db())!.events;
    expect(events.map((e) => e.event)).toEqual(['app_open', 'zone_conquer', 'mission_complete']);
    expect(events.every((e) => e.day === '2026-10-23' && !('at' in e))).toBe(true);
    expect(events[1].props).toEqual({ count: 2 });

    trackTelemetry('share', undefined, NOW);
    const off = await setTelemetryOptIn(false, NOW);
    expect(off.ok && off.data.deletedEvents).toBe(3);
    expect(telemetryQueue()).toHaveLength(0);
    expect(demoTelemetryState(db())!.events).toHaveLength(0);
    expect(trackTelemetry('share', undefined, NOW)).toBe(false);
  });

  it('desligado em outro aparelho: o servidor recusa (TELEMETRY_CONSENT), a fila some e o app relê o consentimento', async () => {
    await setTelemetryOptIn(true, NOW);
    expect(trackTelemetry('run_finish', undefined, NOW)).toBe(true);
    demoTelemetryState(db())!.consents.set(DEMO_USER_ID, { optedIn: false, policyVersion: 1, updatedAt: NOW });
    await flushTelemetry(NOW);
    await settle();
    expect(telemetryQueue()).toHaveLength(0);
    expect(useEngagement.getState().telemetry.data?.optIn).toBe(false);
    expect(demoTelemetryState(db())!.events).toHaveLength(0);
  });

  it('desligar sem rede: continua desligado no aparelho e tenta avisar o servidor de novo na próxima leitura', async () => {
    await setTelemetryOptIn(true, NOW);
    const spy = jest.spyOn(telemetryRepo, 'setTelemetryConsent').mockResolvedValueOnce(fail(new AppError('NETWORK', 'sem rede')));
    const off = await setTelemetryOptIn(false, NOW);
    expect(off.ok).toBe(false);
    expect(telemetryAllowed()).toBe(false);
    expect(trackTelemetry('share', undefined, NOW)).toBe(false);
    spy.mockRestore();
    await loadTelemetryConsent(); // refaz o "desligar"
    expect(demoTelemetryState(db())!.consents.get(DEMO_USER_ID)?.optedIn).toBe(false);
    expect(telemetryAllowed()).toBe(false);
  });

  it('flag do servidor desligada (enabled = false): indisponível, nada é enviado', async () => {
    const spy = jest.spyOn(telemetryRepo, 'fetchTelemetryConsent').mockResolvedValueOnce({ ok: true, data: { available: false, reason: 'disabled' } });
    await loadTelemetryConsent();
    expect(useEngagement.getState().telemetry.status).toBe('unavailable');
    expect(trackTelemetry('app_open', undefined, NOW)).toBe(false);
    spy.mockRestore();
  });

  it('corrida confirmada: run_finish, zone_conquer e mission_complete vão na fila (só com consentimento)', async () => {
    await setTelemetryOptIn(true, NOW);
    const official = { activityId: 'a1', zones: [{ zoneId: 'z1', outcome: 'conquered' }, { zoneId: 'z2', outcome: 'influence' }] };
    recordRunResult(official, NOW);
    await settle();
    await flushTelemetry(NOW);
    const names = demoTelemetryState(db())!.events.map((e) => e.event);
    expect(names).toEqual(expect.arrayContaining(['run_finish', 'zone_conquer']));
  });
});

describe('firstConquestEver ("Sua 1ª zona!" no HUD)', () => {
  it('conta nova: nunca conquistou → true; depois de uma corrida com conquista → false', async () => {
    signIn('vazio');
    expect(getFirstConquestEver()).toBe(false); // sem dado, nunca promete
    await ensureConquestHistory();
    expect(useEngagement.getState().everConquered).toBe(false);
    expect(getFirstConquestEver()).toBe(true);
    recordRunResult({ activityId: 'a1', zones: [{ zoneId: 'z1', outcome: 'conquered' }] }, NOW);
    expect(getFirstConquestEver()).toBe(false);
    // Uma releitura atrasada nunca volta para "nunca conquistou".
    useEngagement.getState().setEverConquered(false);
    expect(selectFirstConquestEver(useEngagement.getState())).toBe(false);
  });

  it('perfil cheio (já conquistou nas corridas semeadas) → false', async () => {
    signIn();
    expect(await engagementRepo.fetchEverConquered(DEMO_USER_ID)).toBe(true);
    await ensureConquestHistory();
    expect(getFirstConquestEver()).toBe(false);
  });
});

describe('primeira semana ligada às missões reais', () => {
  beforeEach(() => signIn());

  it('compartilhar o card conclui o passo 7 e dá a moldura "Primeira Semana"; ranking aberto conclui o passo 6 (alternativa)', async () => {
    await engagementRepo.fetchMissions(); // cria o estado
    const st = demoEngagementState(db(), DEMO_USER_ID)!;
    const ctx = { raidActive: false, leagueActive: false };
    for (const id of ['f6-liga', 'f7-compartilhar']) {
      const a = ftueAssignment(id, NOW - 1000, ctx)!;
      st.assignments.push({ ...a, id: `teste-${id}`, rerolledAt: null, claimedAt: null, createdAt: NOW });
    }
    const runId = String(db().tables.activities.find((a) => a.user_id === DEMO_USER_ID && a.status !== 'recording')!.id);
    clock = NOW + 60_000;
    const shared = await recordShare(runId);
    expect(shared.ok && shared.data.completedMissions).toBeGreaterThanOrEqual(1);
    expect(st.assignments.find((a) => a.id === 'teste-f7-compartilhar')!.completedAt).not.toBeNull();
    expect(db().tables.user_cosmetics.some((c) => c.user_id === DEMO_USER_ID && c.cosmetic_id === 'moldura-primeira-semana')).toBe(true);

    const opened = await markRankingOpened(clock);
    expect(opened.ok && opened.data.completed.map((c) => c.id)).toContain('f6-liga');
    // 1 aviso por dia: o segundo nem sai do aparelho.
    const again = await markRankingOpened(clock + 1000);
    expect(again.ok && again.data.completed).toEqual([]);
  });

  it('cada passo aberto leva ao lugar onde se faz; o passo 6 sem liga avisa o ranking; os 7 feitos = prêmio', () => {
    const row = (id: string, status: FtueRow['status'], variant: 'base' | 'fallback' = 'base') =>
      ({ id, status, mission: { variant } as FtueRow['mission'] }) as Pick<FtueRow, 'id' | 'status' | 'mission'>;
    expect(ftueAction(row('f1-dominio', 'open'))).toEqual({ label: 'Correr', href: '/corrida', mode: 'livre' });
    expect(ftueAction(row('f2-caca', 'open'))?.mode).toBe('caca');
    expect(ftueAction(row('f3-fuga', 'open'))?.mode).toBe('fuga');
    expect(ftueAction(row('f4-raid', 'open', 'fallback'))?.href).toBe('/corrida');
    expect(ftueAction(row('f5-crew', 'open'))?.href).toBe('/clube/crew');
    expect(ftueAction(row('f6-liga', 'open', 'fallback'))).toEqual({ label: 'Ver ranking', href: '/clube', ranking: true });
    expect(ftueAction(row('f7-compartilhar', 'open'))?.href).toBe('/perfil/atividades');
    expect(ftueAction(row('f2-caca', 'locked'))).toBeNull();
    expect(ftueAction(row('f2-caca', 'done'))).toBeNull();
    const all = ['f1-dominio', 'f2-caca', 'f3-fuga', 'f4-raid', 'f5-crew', 'f6-liga', 'f7-compartilhar'].map((id, i) => ({ id, step: i + 1, status: 'done' }) as FtueRow);
    expect(ftueComplete(all)).toBe(true);
    expect(ftueComplete(all.map((r, i) => (i === 6 ? { ...r, status: 'open' as const } : r)))).toBe(false);
  });
});

describe('trilha curta na tela', () => {
  const steps = Array.from({ length: 24 }, (_, i) => ({ step: i + 1, unlocked: i < 5, claimed: i < 3 }));
  it('até 2 para resgatar e os próximos, em ordem, no máximo 4', () => {
    expect(trackWindow(steps, 5).map((s) => s.step)).toEqual([4, 5, 6, 7]);
    expect(trackWindow(steps.map((s) => ({ ...s, claimed: s.unlocked })), 5).map((s) => s.step)).toEqual([6, 7, 8, 9]);
    const done = steps.map((s) => ({ ...s, unlocked: true, claimed: true }));
    expect(trackWindow(done, 24).map((s) => s.step)).toEqual([21, 22, 23, 24]);
  });
});
