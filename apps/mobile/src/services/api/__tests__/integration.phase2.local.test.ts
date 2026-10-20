/**
 * @jest-environment node
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import * as accountRepo from '../account-repo';
import * as authRepo from '../auth-repo';
import { MESSAGES, toAppError } from '../errors';
import * as avatarRepo from '../avatar-repo';
import * as crewsRepo from '../crews-repo';
import * as leaderboardRepo from '../leaderboard-repo';
import * as moderationRepo from '../moderation-repo';
import * as notificationsRepo from '../notifications-repo';
import * as profileRepo from '../profile-repo';
import * as zonesRepo from '../zones-repo';

/**
 * Integração real da Fase 2/3 do A3 contra o Supabase local (zonas, ranking, crews, moderação,
 * notificações, foto de perfil). Só roda com a stack de pé (db + functions serve) e NOMADE_IT=1:
 *   NOMADE_IT=1 NOMADE_IT_ANON=<anon> [NOMADE_IT_DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres] npx jest integration.phase2
 * Com NOMADE_IT_DB o teste clona a corrida em revisão do seed (via psql) e modera a cópia, deixando a
 * original para a demonstração. Usa as contas de demonstração do seed e cria 1 conta temporária (apagada no fim).
 */
const RUN = process.env.NOMADE_IT === '1';
const URL = process.env.NOMADE_IT_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NOMADE_IT_ANON ?? '';
const DB = process.env.NOMADE_IT_DB ?? '';
const SEED_REVIEW = '00000000-0000-4000-b000-000000000001';
const PARK = { lat: -16.7097, lng: -49.2388 };

const DEMO = {
  runner: { email: 'corredor.demo@nomaderun.app', password: 'Corrida@2026' },
  moderator: { email: 'moderador.demo@nomaderun.app', password: 'Moderacao@2026' },
  admin: { email: 'admin.demo@nomaderun.app', password: 'Admin@2026demo' },
  suspect: { email: 'suspeito.demo@nomaderun.app', password: 'Suspeito@2026' },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = (RUN ? require('node-fetch') : undefined) as typeof fetch | undefined;
const memory = new Map<string, string>();
let mockRealClient: SupabaseClient | null = null;
if (RUN) {
  mockRealClient = createClient(URL, ANON, {
    global: { fetch: nodeFetch },
    auth: {
      storage: { getItem: async (k: string) => memory.get(k) ?? null, setItem: async (k: string, v: string) => void memory.set(k, v), removeItem: async (k: string) => void memory.delete(k) },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
jest.mock('../supabase', () => ({ requireSupabase: () => mockRealClient, getSupabase: () => mockRealClient }));

const suite = RUN ? describe : describe.skip;

async function as(who: { email: string; password: string }) {
  await authRepo.signOut();
  const r = await authRepo.signIn(who.email, who.password);
  if (!r.ok) throw new Error(`login ${who.email}: ${r.error.message}`);
  return r.data.userId;
}

function cloneReviewActivity(): string | null {
  if (!DB) return null;
  const id = randomUUID();
  const sql = `
    insert into public.activities (id, user_id, device_id, status, mission, started_at, ended_at, finished_at, meters, moving_seconds, avg_pace,
      rp_total, xp, flags, invalid_segments, last_seq, scored, trust_after, review_reason, result)
    select '${id}', user_id, device_id, 'review', mission, started_at, ended_at, now(), meters, moving_seconds, avg_pace,
      0, 0, flags, invalid_segments, last_seq, false, trust_after, review_reason, result
      from public.activities where id = '${SEED_REVIEW}';
    insert into public.activity_points (activity_id, seq, lat, lng, t, accuracy, speed, altitude, mocked, steps)
    select '${id}', seq, lat, lng, t, accuracy, speed, altitude, mocked, steps from public.activity_points where activity_id = '${SEED_REVIEW}';`;
  execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql]);
  return id;
}

suite('integração Fase 2/3 (A3) com o Supabase local', () => {
  const stamp = Date.now().toString(36);
  const temp = { email: `it2_${stamp}@nomaderun.test`, password: 'Corrida2026!', username: `it2_${stamp}`.slice(0, 20) };
  let tempId = '';
  let runnerId = '';
  let reviewId = '';

  beforeAll(() => {
    reviewId = cloneReviewActivity() ?? SEED_REVIEW;
  });

  afterAll(async () => {
    if (tempId) {
      await as(temp).catch(() => undefined);
      await crewsRepo.leaveCrew();
      await accountRepo.deleteMyAccount(temp.password);
    }
    await as(DEMO.runner).catch(() => undefined);
    await crewsRepo.leaveCrew();
    await authRepo.signOut();
  });

  it('zonas por bbox (seed de Goiânia) e detalhe da zona do parque sob ataque', async () => {
    runnerId = await as(DEMO.runner);
    const r = await zonesRepo.fetchZonesInBbox(zonesRepo.bboxAround(PARK, 2000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.length).toBeGreaterThan(100);
    expect(r.data.every((z) => z.meta.name)).toBe(true);
    // O estado das zonas muda com as corridas aprovadas; o parque do seed sempre existe e tem nome.
    const park = r.data.find((z) => z.meta.name === 'Parque Flamboyant');
    expect(park).toBeDefined();
    const attacked = r.data.filter((z) => z.zone.attackStartedAt !== null);
    expect(attacked.every((z) => z.zone.attacker !== null)).toBe(true);
    const d = await zonesRepo.fetchZoneDetail(park!.zone.id);
    expect(d).toMatchObject({ ok: true, data: { zone: { id: park!.zone.id }, meta: { name: 'Parque Flamboyant' } } });
    expect(d.ok && Array.isArray(d.data.topRunners) && Array.isArray(d.data.events)).toBe(true);
    const missing = await zonesRepo.fetchZoneDetail('8fffffffffffff0'.padEnd(15, 'f'));
    expect(missing.ok).toBe(false);
  });

  it('rankings: individual, crews, facções e cidades respondem', async () => {
    for (const r of [await leaderboardRepo.getIndividualRanking({ city: 'Goiânia' }), await leaderboardRepo.getCrewRanking(), await leaderboardRepo.getCityRanking()]) {
      expect(r.ok).toBe(true);
    }
    const f = await leaderboardRepo.getFactionRanking();
    expect(f.ok && f.data.map((x) => x.faction).sort()).toEqual(['coyotes', 'owls', 'striders', 'volt']);
    if (f.ok) expect(f.data.reduce((n, x) => n + x.zones, 0)).toBeGreaterThan(100);
  });

  it('corredor comum não vê a fila e é recusado ao moderar', async () => {
    const list = await moderationRepo.listActivitiesInReview();
    expect(list).toEqual({ ok: true, data: [] });
    const r = await moderationRepo.moderateActivity(reviewId, 'approve', 'Tentativa de corredor comum');
    expect(r).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED', detail: 'FORBIDDEN' } });
  });

  it('crew: criar, convite, outro corredor do mesmo time entra, ranking interno, líder remove, sair', async () => {
    await crewsRepo.leaveCrew();
    const tag = `T${stamp.replace(/[^a-z]/gi, '').toUpperCase()}XYZ`.slice(0, 5);
    const created = await crewsRepo.createCrew(`Crew IT ${stamp}`, tag);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.faction).toBe('striders');
    const dup = await crewsRepo.createCrew('Outra crew', 'ABCD');
    expect(dup).toMatchObject({ ok: false, error: { detail: 'ALREADY_IN_CREW' } });

    await authRepo.signOut();
    const su = await authRepo.signUp({ email: temp.email, password: temp.password, username: temp.username, birthdate: '1999-01-01', acceptedTerms: true, acceptedPrivacy: true });
    expect(su.ok).toBe(true);
    tempId = su.ok ? (su.data.session?.userId ?? '') : '';
    expect((await profileRepo.chooseFaction('striders')).ok).toBe(true);
    const joined = await crewsRepo.joinCrew(created.data.inviteCode.toLowerCase());
    expect(joined).toMatchObject({ ok: true, data: { crewId: created.data.id } });
    const mine = await crewsRepo.getMyCrew(tempId);
    expect(mine.ok && mine.data?.members.map((m) => m.userId).sort()).toEqual([runnerId, tempId].sort());
    expect(mine.ok && mine.data?.isLeader).toBe(false);
    expect((await crewsRepo.removeCrewMember(created.data.id, runnerId)).ok).toBe(false);

    await as(DEMO.runner);
    const leaderView = await crewsRepo.getMyCrew(runnerId);
    expect(leaderView.ok && leaderView.data?.isLeader).toBe(true);
    expect((await crewsRepo.removeCrewMember(created.data.id, tempId)).ok).toBe(true);
    const after = await crewsRepo.getMyCrew(runnerId);
    expect(after.ok && after.data?.members).toHaveLength(1);
    expect((await crewsRepo.leaveCrew()).ok).toBe(true);
    expect(await crewsRepo.getMyCrew(runnerId)).toEqual({ ok: true, data: null });
  });

  it('foto de perfil vai para a pasta do usuário e a URL pública fica no perfil', async () => {
    await as(temp);
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    const r = await avatarRepo.uploadAvatar(tempId, { body: png.buffer as ArrayBuffer, mimeType: 'image/png', size: png.byteLength });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.avatarUrl).toContain(`/avatars/${tempId}/`);
    const res = await nodeFetch!(r.data.avatarUrl!);
    expect(res.status).toBe(200);
  });

  it('admin inativa e reativa uma conta; moderador não pode', async () => {
    await as(DEMO.moderator);
    expect(await moderationRepo.setUserStatus(tempId, 'inactive')).toMatchObject({ ok: false, error: { detail: 'FORBIDDEN' } });
    await as(DEMO.admin);
    const users = await moderationRepo.listUsers(temp.username);
    expect(users.ok && users.data.map((u) => u.id)).toEqual([tempId]);
    // P-39: a conta temporária, já com sessão em outro aparelho, perde o acesso ao ser inativada (401 ACCOUNT_INACTIVE)
    const other = createClient(URL, ANON, { global: { fetch: nodeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
    await other.auth.signInWithPassword({ email: temp.email, password: temp.password });
    expect(await moderationRepo.setUserStatus(tempId, 'inactive')).toEqual({ ok: true, data: { userId: tempId, status: 'inactive' } });
    const blocked = await other.from('profiles').select('id').eq('id', tempId);
    expect(blocked.error).not.toBeNull();
    expect(toAppError(blocked.error)).toMatchObject({ code: 'UNAUTHORIZED', detail: 'ACCOUNT_INACTIVE', message: MESSAGES.accountInactive });
    expect(await moderationRepo.setUserStatus(tempId, 'active')).toEqual({ ok: true, data: { userId: tempId, status: 'active' } });
    expect((await other.from('profiles').select('id').eq('id', tempId)).error).toBeNull();
  });

  it('moderador vê a corrida em revisão com percurso e aprova com justificativa; o corredor é avisado', async () => {
    await as(DEMO.moderator);
    const list = await moderationRepo.listActivitiesInReview();
    expect(list.ok && list.data.some((a) => a.id === reviewId && a.username === 'suspeito_demo')).toBe(true);
    const detail = await moderationRepo.getReviewDetail(reviewId);
    expect(detail.ok && detail.data.points.length).toBe(1186); // mais que o limite de 1.000 linhas do PostgREST
    expect(detail.ok && detail.data.flags).toContain('VEHICLE_SUSPECTED');

    const short = await moderationRepo.moderateActivity(reviewId, 'approve', 'curta');
    expect(short).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    const ok = await moderationRepo.moderateActivity(reviewId, 'approve', 'Trecho de carro já descontado; o resto do percurso é corrida a pé.');
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(['valid', 'partial']).toContain(ok.data.status);
    const again = await moderationRepo.moderateActivity(reviewId, 'reject', 'Segunda decisão deve falhar.');
    expect(again).toMatchObject({ ok: false, error: { detail: 'NOT_IN_REVIEW' } });

    await as(DEMO.suspect);
    const notes = await notificationsRepo.listNotifications();
    expect(notes.ok).toBe(true);
    if (!notes.ok) return;
    const mod = notes.data.find((n) => n.type === 'moderation' && n.data.activityId === reviewId);
    expect(mod).toBeDefined();
    const marked = await notificationsRepo.markNotificationsRead([mod!.id]);
    expect(marked).toEqual({ ok: true, data: 1 });
    const after = await notificationsRepo.listNotifications();
    expect(after.ok && after.data.find((n) => n.id === mod!.id)?.readAt).not.toBeNull();
  });

  (DB ? it : it.skip)('Realtime: zona alterada pela aprovação chega ao mapa de outro usuário em até 3 s (RNF-003)', async () => {
    // O ambiente node do Jest não expõe WebSocket: usa o pacote `ws` (dependência transitiva) como transporte.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const transport = require('ws');
    const watcher = createClient(URL, ANON, { global: { fetch: nodeFetch }, realtime: { transport }, auth: { persistSession: false, autoRefreshToken: false } });
    const login = await watcher.auth.signInWithPassword(DEMO.runner);
    expect(login.error).toBeNull();
    await watcher.realtime.setAuth(login.data.session!.access_token);
    const received: { at: number; id: string }[] = [];
    const subscribed = new Promise<void>((resolve) => {
      watcher
        .channel('it-zones')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, (p: { new?: { id?: string } }) => {
          received.push({ at: Date.now(), id: String(p.new?.id ?? '') });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
    });
    await Promise.race([subscribed, new Promise((_, rej) => setTimeout(() => rej(new Error('Realtime não conectou em 10 s')), 10_000))]);
    const id = cloneReviewActivity()!;
    await as(DEMO.moderator);
    const t0 = Date.now();
    const r = await moderationRepo.moderateActivity(id, 'approve', 'Aprovação para medir o tempo do Realtime no mapa.');
    expect(r.ok).toBe(true);
    const zonesTouched = r.ok ? (r.data.result?.zones?.length ?? 0) : 0;
    console.log(`[it] zonas tocadas: ${zonesTouched}`);
    if (zonesTouched > 0) {
      for (let i = 0; i < 30 && received.length === 0; i++) await new Promise((res) => setTimeout(res, 100));
      expect(received.length).toBeGreaterThan(0);
        console.log(`[it] Realtime em ${received[0].at - t0} ms`);
      expect(received[0].at - t0).toBeLessThanOrEqual(3000);
    }
    await watcher.removeAllChannels();
    watcher.realtime.disconnect();
    await watcher.auth.signOut();
  }, 30_000);
});

