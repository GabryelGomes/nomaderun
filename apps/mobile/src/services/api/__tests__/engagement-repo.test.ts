/**
 * @jest-environment node
 *
 * T7.2.4 (E7): repositório do engajamento v2 contra o servidor de demonstração (sem rede) e a leitura
 * tolerante das respostas. "Indisponível" (servidor antigo ou recurso desligado) não é erro.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { FTUE_STEP_IDS } from '@/domain/missions';
import { DAILY_CHEST, levelProgress } from '@/domain/progression';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import { createDemoClient, setDemoClient } from '../demo';
import * as repo from '../engagement-repo';
import { AppError, fail, ok } from '../errors';
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
  expect(network).not.toHaveBeenCalled();
});

function data<T>(r: { ok: true; data: repo.Maybe<T> } | { ok: false; error: AppError }): T {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.error.message}`);
  if (!r.data.available) throw new Error('esperava disponível');
  return r.data.data;
}

describe('indisponível não é erro', () => {
  it('PGRST202 (servidor antigo) e FEATURE_DISABLED viram { available: false }', () => {
    expect(repo.asMaybe(fail(new AppError('SERVER', 'x', { detail: 'PGRST202' })))).toEqual(ok({ available: false, reason: 'old_server' }));
    expect(repo.asMaybe(fail(new AppError('VALIDATION', 'x', { detail: 'FEATURE_DISABLED' })))).toEqual(ok({ available: false, reason: 'disabled' }));
    const other = repo.asMaybe(fail(new AppError('NETWORK', 'sem rede')));
    expect(other.ok).toBe(false);
    expect(repo.asMaybe(ok(1))).toEqual(ok({ available: true, data: 1 }));
  });

  it('servidor sem a RPC: a chamada devolve indisponível', async () => {
    const client = createDemoClient({ clock: () => NOW });
    setDemoClient(client);
    const res = await client.rpc('rpc_que_nao_existe');
    expect((res.error as { code: string }).code).toBe('PGRST202');
  });
});

describe('leitura tolerante', () => {
  it('missão sem id ou com tipo desconhecido é descartada; progresso fica entre 0 e o alvo', () => {
    expect(repo.parseMission({ id: 'a', defId: 'd-km', kind: 'mensal' })).toBeNull();
    expect(repo.parseMission(null)).toBeNull();
    const m = repo.parseMission({ id: 'a', defId: 'd-km', kind: 'diaria', tier: 'x', progress: 9999, target: 3000, bonus: { dailyChest: 'ouro', cosmetic: 'c' } })!;
    expect(m.progress).toBe(3000);
    expect(m.tier).toBe('leve');
    expect(m.bonus).toEqual({ cosmetic: 'c' });
  });

  it('baú sem chances no payload usa as do domain (as chances nunca somem da tela)', () => {
    const c = repo.parseDailyChest({ stored: 7 });
    expect(c.stored).toBe(3);
    expect(c.odds).toEqual(DAILY_CHEST.odds);
    expect(c.pityLeft).toBe(DAILY_CHEST.pity);
  });

  it('extras.engagement ausente (servidor v1) → null; presente → linhas com rótulo', () => {
    expect(repo.parseRunEngagement({ activityId: 'x', xp: 10 })).toBeNull();
    const e = repo.parseRunEngagement({
      extras: {
        engagement: {
          xp: { total: 80, lines: [{ source: 'run_distance', amount: 50 }, { source: 'run_complete', amount: 30, label: 'Atividade concluída' }, { source: 'fog', amount: 0 }] },
          level: { before: 4, after: 5, titleAfter: { id: 'pe-na-rua', name: 'Pé na Rua' } },
          dailyChests: { opened: [], reason: 'distance', stored: 2 },
          missions: [{ id: 'd-km', userMissionId: 'u1', cadence: 'diaria', text: 'Corra 3 km hoje', xp: 30 }],
        },
      },
    })!;
    expect(e.xp.lines.map((l) => l.label)).toEqual(['Distância', 'Atividade concluída']);
    expect(e.level.titleAfter?.name).toBe('Pé na Rua');
    expect(e.dailyChests).toEqual({ opened: [], pityLeft: null, reason: 'distance', stored: 2 });
    expect(e.missions[0].text).toBe('Corra 3 km hoje');
  });

  it('fatos das corridas: semana atual, anterior e última atividade (só pontuadas)', () => {
    const at = (d: string, h = 18) => Date.parse(`${d}T${String(h + 3).padStart(2, '0')}:00:00Z`);
    const runs = [
      { status: 'valid' as const, startedAt: at('2026-10-22'), meters: 3000, result: { zones: [{ zoneId: 'z1', rp: 10 }, { zoneId: 'z2', rp: 0 }] } },
      { status: 'review' as const, startedAt: at('2026-10-21'), meters: 9000, result: null },
      { status: 'partial' as const, startedAt: at('2026-10-15'), meters: 2000, result: null },
    ] as unknown as Parameters<typeof repo.activityFacts>[0];
    const f = repo.activityFacts(runs, NOW);
    expect(f.week).toEqual({ activities: 1, meters: 3000, zones: 1 });
    expect(f.previousWeek).toEqual({ activities: 1, meters: 2000, zones: 0 });
    expect(f.lastActivityAt).toBe(at('2026-10-22'));
  });
});

describe('servidor de demonstração (roteiro cheio)', () => {
  beforeEach(() => setDemoClient(createDemoClient({ clock: () => NOW })));

  it('missões: 3 do dia e 3 da semana (1 de cada nível), primeira semana com o passo 1 feito e o 2 aberto', async () => {
    const m = data(await repo.fetchMissions());
    expect(m.periods).toEqual({ daily: '2026-10-23', weekly: '2026-W43' });
    expect(m.daily.map((x) => x.tier)).toEqual(['leve', 'padrao', 'desafio']);
    expect(m.weekly.map((x) => x.tier)).toEqual(['leve', 'padrao', 'desafio']);
    expect(m.daily.every((x) => x.title.length > 0 && x.title.length <= 40 && !x.title.includes('{x}'))).toBe(true);
    expect(m.ftue.map((x) => x.defId)).toEqual(FTUE_STEP_IDS.slice(0, 2));
    expect(m.ftue[0].completedAt).not.toBeNull();
    expect(m.ftue[1].completedAt).toBeNull();
    expect(m.rerollsLeft).toBe(1);
    // A semana já tem 2 atividades: "Faça 2 atividades" (se sorteada) está concluída e paga.
    const twoRuns = m.weekly.find((x) => x.defId === 's-2-atividades');
    if (twoRuns) expect(twoRuns.completedAt).not.toBeNull();
  });

  it('trocar 1 missão por dia: a 2ª troca é recusada com a mensagem do servidor', async () => {
    const m = data(await repo.fetchMissions());
    const open = m.daily.find((x) => x.completedAt === null)!;
    const swapped = data(await repo.rerollMission(open.id));
    expect(swapped.id).toBe(open.id);
    expect(swapped.slot).toBe(open.slot);
    expect(swapped.tier).toBe(open.tier);
    expect(swapped.defId).not.toBe(open.defId);
    expect(swapped.rerolled).toBe(true);
    const again = await repo.rerollMission(m.daily.find((x) => x.id !== open.id && x.completedAt === null)?.id ?? open.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.detail).toBe('MISSION_REROLL_LIMIT');
    expect(data(await repo.fetchMissions()).rerollsLeft).toBe(0);
  });

  it('baú do dia: 1 guardado (abriu ontem), o bônus raro da primeira semana e as chances públicas', async () => {
    const c = data(await repo.fetchDailyChest());
    expect(c.stored).toBe(1);
    expect(c.bonus).toEqual(['raro']);
    expect(c.openedToday).toBe(false);
    expect(c.odds).toEqual({ comum: 0.7, raro: 0.25, lendario: 0.05 });
    expect(c.pityLeft).toBeGreaterThanOrEqual(1);
    expect(c.pityLeft).toBeLessThanOrEqual(20);
    const locked = await repo.openDailyChests();
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error.detail).toBe('DAILY_CHEST_LOCKED');
  });

  it('trilha: degraus alcançados, o último ainda para resgatar; resgatar é idempotente', async () => {
    const t = data(await repo.fetchTrack());
    expect(t.seasonId).toBe('2026-10');
    expect(t.rewards).toHaveLength(24);
    expect(t.step).toBeGreaterThan(0);
    const pending = t.rewards.filter((r) => r.unlocked && !r.claimed).map((r) => r.step);
    expect(pending).toEqual([t.step]);
    expect(data(await repo.claimTrackStep(t.step)).alreadyClaimed).toBe(false);
    expect(data(await repo.claimTrackStep(t.step)).alreadyClaimed).toBe(true);
    const locked = await repo.claimTrackStep(24);
    expect(!locked.ok && locked.error.detail).toBe('TRACK_LOCKED');
  });

  it('situação: nível pela curva v2, título, faixa, sequência e cosméticos', async () => {
    const s = (await repo.fetchEngagementStatus(DEMO_USER_ID, NOW)) as { ok: true; data: repo.EngagementStatus };
    expect(s.ok).toBe(true);
    expect(s.data.source).toBe('server');
    expect(s.data.level).toBe(levelProgress(s.data.xp).level);
    expect(s.data.title.name).toBe(levelProgress(s.data.xp).title.name);
    expect(s.data.band?.name).toBeTruthy();
    expect(s.data.streak.weeks).toBe(2);
    expect(s.data.streak.activitiesThisWeek).toBe(2);
    expect(s.data.streak.pauseAvailable).toBeNull(); // o my_engagement da E9 não informa
    expect(s.data.cosmetics?.map((c) => c.id)).toEqual(expect.arrayContaining(['rastro-faisca', 'moldura-asfalto']));
    expect(s.data.lastActivityAt).not.toBeNull();
  });

  it('pausa de saúde: começa na segunda, 1 por temporada; encerrar protege só a semana atual', async () => {
    const p = data(await repo.startHealthPause(2));
    expect(p).toEqual({ from: '2026-10-19', until: '2026-11-01', seasonId: '2026-10' });
    const again = await repo.startHealthPause(1);
    expect(!again.ok && again.error.detail).toBe('PAUSE_ACTIVE');
    expect(data(await repo.endHealthPause())).toEqual({ from: '2026-10-19', until: '2026-10-25', seasonId: '2026-10' });
    const used = await repo.startHealthPause(1);
    expect(!used.ok && used.error.detail).toBe('PAUSE_ACTIVE');
  });
});

describe('servidor de demonstração (conta nova)', () => {
  it('primeira semana com o passo 1 aberto, 1 baú guardado e nível 1', async () => {
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'vazio' }));
    const m = data(await repo.fetchMissions());
    expect(m.ftue.map((x) => x.defId)).toEqual(['f1-dominio']);
    expect(m.ftue[0].completedAt).toBeNull();
    expect(data(await repo.fetchDailyChest()).stored).toBe(1);
    const s = await repo.fetchEngagementStatus(DEMO_USER_ID, NOW);
    expect(s.ok && s.data.level).toBe(1);
    expect(s.ok && s.data.lastActivityAt).toBeNull();
  });
});
