/**
 * @jest-environment node
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { districtOf } from '@/domain/grid';
import { createFallbackPolling } from '@/features/notifications/realtime-fallback';
import { rankingQuery } from '@/features/screens/club-ranking';

import * as accountRepo from '../account-repo';
import * as authRepo from '../auth-repo';
import * as leaderboardRepo from '../leaderboard-repo';
import * as notificationsRepo from '../notifications-repo';
import * as privacyRepo from '../privacy-zones-repo';
import * as profileRepo from '../profile-repo';
import * as trackRepo from '../track-repo';

/**
 * Integração real das pendências P-20, P-24, P-25 e P-27 (A3) contra o Supabase local:
 * rankings com período/escopo (RPCs `ranking_*`, `district_label`), zonas de privacidade, trechos
 * inválidos pelo `seq` e Realtime da central de notificações. Precisa da stack de pé, de NOMADE_IT=1 e
 * de NOMADE_IT_DB (psql grava as contribuições e a notificação de teste da conta temporária):
 *   NOMADE_IT=1 NOMADE_IT_ANON=<anon> NOMADE_IT_DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx jest integration.phase3 --forceExit
 * Cria 1 conta temporária e apaga no fim (as linhas inseridas caem em cascata).
 */
const RUN = process.env.NOMADE_IT === '1' && !!process.env.NOMADE_IT_DB;
const URL = process.env.NOMADE_IT_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NOMADE_IT_ANON ?? '';
const DB = process.env.NOMADE_IT_DB ?? '';
/** Zona do seed (Parque Flamboyant): a zona e o distrito existem em qualquer estado do banco. */
const PARK = { lat: -16.7097, lng: -49.2388 };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = (RUN ? require('node-fetch') : undefined) as typeof fetch | undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wsTransport = RUN ? require('ws') : undefined;
const memory = new Map<string, string>();
let mockRealClient: SupabaseClient | null = null;
if (RUN) {
  mockRealClient = createClient(URL, ANON, {
    global: { fetch: nodeFetch },
    realtime: { transport: wsTransport },
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
const sql = (q: string) => execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', q]).toString().trim();

suite('integração das pendências do A3 da Fase 3 (P-20, P-24, P-25, P-27)', () => {
  const stamp = Date.now().toString(36);
  const temp = { email: `it3_${stamp}@nomaderun.test`, password: 'Corrida2026!', username: `it3_${stamp}`.slice(0, 20) };
  let tempId = '';
  let parkZone = '';
  const activityId = randomUUID();
  const oldActivityId = randomUUID();

  beforeAll(async () => {
    parkZone = sql(`select id from public.zones where name = 'Parque Flamboyant' limit 1`);
    expect(parkZone).toMatch(/^[0-9a-f]{15}$/);
    await authRepo.signOut();
    const su = await authRepo.signUp({ email: temp.email, password: temp.password, username: temp.username, birthdate: '1999-01-01', acceptedTerms: true, acceptedPrivacy: true });
    if (!su.ok) throw new Error(su.error.message);
    tempId = su.data.session?.userId ?? '';
    expect((await profileRepo.chooseFaction('volt')).ok).toBe(true);
    sql(`update public.profiles set city = 'Goiânia' where id = '${tempId}'`);
    // Corrida desta semana (777 RP no parque, com 10 pontos) e uma antiga (fora da semana e da temporada).
    sql(`
      insert into public.activities (id, user_id, status, started_at, ended_at, finished_at, meters, rp_total, last_seq, scored, invalid_segments)
        values ('${activityId}', '${tempId}', 'partial', now() - interval '20 minutes', now() - interval '5 minutes', now(), 900, 777, 9, true,
                '[{"fromSeq":3,"toSeq":5,"code":"VEHICLE_SUSPECTED","reason":"teste"}]'::jsonb),
               ('${oldActivityId}', '${tempId}', 'valid', now() - interval '40 days', now() - interval '40 days', now() - interval '40 days', 500, 55, -1, true, '[]'::jsonb);
      insert into public.activity_zones (activity_id, zone_id, user_id, faction, meters, rp, outcome, created_at)
        values ('${activityId}', '${parkZone}', '${tempId}', 'volt', 900, 777, 'influence', now()),
               ('${oldActivityId}', '${parkZone}', '${tempId}', 'volt', 500, 55, 'influence', now() - interval '40 days');
      insert into public.activity_points (activity_id, seq, lat, lng, t)
        select '${activityId}', g, ${PARK.lat} + g * 0.0001, ${PARK.lng}, 1760000000000 + g * 1000 from generate_series(0, 9) g;`);
  });

  afterAll(async () => {
    if (tempId) {
      await authRepo.signIn(temp.email, temp.password).catch(() => undefined);
      await accountRepo.deleteMyAccount(temp.password);
    }
    await mockRealClient?.removeAllChannels();
    mockRealClient?.realtime.disconnect();
    await authRepo.signOut();
  });

  it('P-25: corredores por semana/temporada e por cidade, time e distrito', async () => {
    const recent = await leaderboardRepo.getMyRecentZoneId(tempId);
    expect(recent).toEqual({ ok: true, data: parkZone });
    const district = districtOf(parkZone);
    const label = await leaderboardRepo.getDistrictLabel(district);
    expect(label.ok && label.data.length).toBeGreaterThan(0);
    console.log(`[it] distrito do parque: ${label.ok ? label.data : '?'}`);

    const me = { id: tempId, city: 'Goiânia', faction: 'volt' as const, district };
    const mine = async (board: 'individual', scope: 'geral' | 'cidade' | 'time' | 'distrito', period: 'week' | 'season') => {
      const q = rankingQuery(board, scope, period, me, 500)!;
      const r = await leaderboardRepo.rankRunners(q);
      expect(r.ok).toBe(true);
      return r.ok ? r.data.find((x) => x.userId === tempId) : undefined;
    };
    for (const scope of ['geral', 'cidade', 'time', 'distrito'] as const) {
      expect(await mine('individual', scope, 'week')).toMatchObject({ rp: 777, meters: 900, runs: 1, faction: 'volt', city: 'Goiânia' });
      expect((await mine('individual', scope, 'season'))?.rp).toBe(777); // a corrida de 40 dias atrás não entra
    }
    // escopo de outro time / outra cidade / outro distrito não traz o corredor
    const other = await leaderboardRepo.rankRunners({ period: 'week', scope: 'faction', value: 'owls', limit: 500 });
    expect(other.ok && other.data.some((x) => x.userId === tempId)).toBe(false);
    const elsewhere = await leaderboardRepo.rankRunners({ period: 'week', scope: 'district', value: districtOf('89a8c0e24a3ffff') === district ? '87a8c0000ffffff' : districtOf('89a8c0e24a3ffff'), limit: 500 });
    expect(elsewhere.ok && elsewhere.data.some((x) => x.userId === tempId)).toBe(false);
    // o servidor recusa distrito malformado
    expect(await leaderboardRepo.rankRunners({ period: 'week', scope: 'district', value: 'xyz' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('P-25: times e crews no distrito, na semana', async () => {
    const district = districtOf(parkZone);
    const f = await leaderboardRepo.rankFactions({ period: 'week', scope: 'district', value: district });
    expect(f.ok && f.data.map((x) => x.faction).sort()).toEqual(['coyotes', 'owls', 'striders', 'volt']);
    if (f.ok) expect(f.data.find((x) => x.faction === 'volt')!.rp).toBeGreaterThanOrEqual(777);
    const c = await leaderboardRepo.rankCrews({ period: 'week', scope: 'district', value: district });
    expect(c.ok).toBe(true);
    const cs = await leaderboardRepo.rankCrews({ period: 'season', scope: 'faction', value: 'volt' });
    expect(cs.ok && cs.data.every((x) => x.faction === 'volt')).toBe(true);
  });

  it('P-27: até 3 zonas de privacidade com raio padrão de 200 m; a 4ª é recusada; remover libera', async () => {
    const created: string[] = [];
    for (const [i, label] of ['Casa', 'Trabalho', null].entries()) {
      const r = await privacyRepo.addPrivacyZone({ label, lat: PARK.lat + i * 0.01, lng: PARK.lng });
      expect(r).toMatchObject({ ok: true, data: { label, radiusM: 200 } });
      if (r.ok) created.push(r.data.id);
    }
    const fourth = await privacyRepo.addPrivacyZone({ label: 'Academia', lat: PARK.lat, lng: PARK.lng + 0.01 });
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(privacyRepo.isPrivacyLimitError(fourth.error)).toBe(true);
      expect(fourth.error.message).toMatch(/3 zonas de privacidade/);
    }
    const list = await privacyRepo.listPrivacyZones();
    expect(list.ok && list.data.map((z) => z.id)).toEqual(created);
    expect((await privacyRepo.removePrivacyZone(created[0])).ok).toBe(true);
    expect((await privacyRepo.addPrivacyZone({ label: 'Academia', lat: PARK.lat, lng: PARK.lng + 0.01 })).ok).toBe(true);
    const after = await privacyRepo.listPrivacyZones();
    expect(after.ok && after.data).toHaveLength(3);
    // outra conta não vê as zonas desta
    expect(Number(sql(`select count(*) from public.privacy_zones where user_id = '${tempId}'`))).toBe(3);
  });

  it('P-20: pontos dos trechos inválidos pelo seq (com o ponto anterior)', async () => {
    const r = await trackRepo.getInvalidStretches(activityId, [{ fromSeq: 3, toSeq: 5 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(1);
    expect(r.data[0].map((p) => Math.round((p.lat - PARK.lat) / 0.0001))).toEqual([2, 3, 4, 5]);
  });

  it('P-24: notificação chega pelo Realtime e a consulta periódica fica desligada enquanto o canal está SUBSCRIBED', async () => {
    const session = await mockRealClient!.auth.getSession();
    await mockRealClient!.realtime.setAuth(session.data.session!.access_token);
    const refresh = jest.fn();
    const polling = createFallbackPolling({ refresh, intervalMs: 60_000 });
    expect(polling.isPolling()).toBe(true);
    const received: notificationsRepo.AppNotification[] = [];
    const subscribed = new Promise<void>((resolve) => {
      const sub = notificationsRepo.subscribeNotifications(
        tempId,
        (n) => received.push(n),
        (status) => {
          polling.onChannelStatus(status);
          if (status === 'SUBSCRIBED') resolve();
        },
      );
      expect(sub.ok).toBe(true);
    });
    await Promise.race([subscribed, new Promise((_, rej) => setTimeout(() => rej(new Error('Realtime não conectou em 10 s')), 10_000))]);
    expect(polling.isPolling()).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1); // consulta de recuperação ao conectar
    // P-22: logo depois de um reset o primeiro evento pode demorar; tenta algumas vezes.
    for (let i = 0; i < 3 && received.length === 0; i++) {
      sql(`insert into public.notifications (user_id, type, title, body, data) values ('${tempId}', 'conquest', 'Zona conquistada', 'Teste do Realtime ${i}', '{}'::jsonb)`);
      for (let k = 0; k < 30 && received.length === 0; k++) await new Promise((res) => setTimeout(res, 100));
    }
    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toMatchObject({ type: 'conquest', title: 'Zona conquistada', readAt: null });
    polling.onChannelStatus('CHANNEL_ERROR');
    expect(polling.isPolling()).toBe(true);
    polling.stop();
  }, 30_000);
});
