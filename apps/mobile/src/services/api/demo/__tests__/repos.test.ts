/**
 * @jest-environment node
 *
 * T7.1.18 (D-77): cada função dos repositórios (contrato da F1, §2.5) responde pelo servidor de
 * demonstração, passando pela costura real (`getSupabase()` com `EXPO_PUBLIC_DEMO=1`), sem rede.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { crewWeekGoalMeters, crewWeekProgress } from '@/domain/crew-goal';
import { districtOf, zoneOf } from '@/domain/grid';
import { DEMO_CENTER } from '@/demo/demo-data';
import { DEMO_USER_ID } from '@/demo/world';

jest.mock('@/services/api/env', () => {
  const actual = jest.requireActual<typeof import('@/services/api/env')>('@/services/api/env');
  const env = { ...actual.env, supabaseUrl: null, supabaseAnonKey: null, oauthProviders: [], demo: true };
  return { ...actual, env, isDemoMode: (e = env) => actual.isDemoMode(e), isBackendConfigured: (e = env) => actual.isBackendConfigured(e) };
});

/* eslint-disable import/first */
import * as account from '../../account-repo';
import * as activities from '../../activities-repo';
import * as auth from '../../auth-repo';
import * as avatar from '../../avatar-repo';
import * as chests from '../../chests-repo';
import * as crews from '../../crews-repo';
import * as leaderboard from '../../leaderboard-repo';
import * as moderation from '../../moderation-repo';
import * as notifications from '../../notifications-repo';
import * as privacy from '../../privacy-zones-repo';
import * as profile from '../../profile-repo';
import { getSupabase, requireSupabase } from '../../supabase';
import * as track from '../../track-repo';
import * as zones from '../../zones-repo';
import * as contacts from '@/services/safety/contacts-repo';
import { createDemoClient, isDemoClient, setDemoClient } from '..';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-23T12:00:00Z');
const realFetch = globalThis.fetch;
const fetchSpy = jest.fn(() => Promise.reject(new Error('rede proibida no modo demonstração')));

beforeAll(() => {
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  expect(fetchSpy).not.toHaveBeenCalled();
});

function expectOk<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.error.message}`);
  return r.data;
}

describe('costura: getSupabase() no modo demonstração', () => {
  it('devolve o cliente em memória, nunca o supabase-js', () => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
    expect(isDemoClient(getSupabase())).toBe(true);
    expect(isDemoClient(requireSupabase())).toBe(true);
  });
});

describe('repositórios contra o servidor de demonstração (roteiro cheio)', () => {
  beforeEach(() => {
    setDemoClient(createDemoClient({ clock: () => NOW }));
  });

  it('auth: entra direto na sessão de demonstração; sair, entrar, cadastrar e recuperar senha', async () => {
    const s = expectOk(await auth.getCurrentSession());
    expect(s?.userId).toBe(DEMO_USER_ID);
    const events: string[] = [];
    const sub = auth.onAuthChange((e) => events.push(e));
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toContain('INITIAL_SESSION');
    expectOk(await auth.signOut());
    expect(expectOk(await auth.getCurrentSession())).toBeNull();
    expect(expectOk(await auth.signIn('qualquer@exemplo.invalid', 'qualquer')).userId).toBe(DEMO_USER_ID);
    const up = expectOk(await auth.signUp({ email: 'x@exemplo.invalid', password: 'Senha2026!', username: 'nova.demo', birthdate: '2000-01-01', acceptedTerms: true, acceptedPrivacy: true }));
    expect(up.needsConfirmation).toBe(false);
    expectOk(await auth.sendPasswordReset('x@exemplo.invalid', 'nomaderun://nova-senha'));
    expectOk(await auth.updatePassword('Outra2026!'));
    const oauth = await auth.oauthUrl('google', 'nomaderun://');
    expect(oauth.ok ? null : oauth.error.message).toBe('Indisponível na demonstração.');
    const link = await auth.sessionFromCallback({ kind: 'code', code: 'abc' } as never);
    expect(link.ok).toBe(false);
    sub?.unsubscribe();
  });

  it('perfil, facção, nome de usuário e avatar', async () => {
    const me = expectOk(await profile.getMyProfile(DEMO_USER_ID));
    expect(me.username).toBe('voce.demo');
    expect(me.faction).toBe('striders');
    const edited = expectOk(await profile.updateMyProfile(DEMO_USER_ID, { city: 'Anápolis', unit: 'mi' }));
    expect(edited.city).toBe('Anápolis');
    expect(edited.unit).toBe('mi');
    expectOk(await profile.chooseFaction('owls'));
    const twice = await profile.chooseFaction('volt');
    expect(twice.ok ? null : twice.error.detail).toBe('FACTION_CHANGE_LIMIT');
    expect(expectOk(await profile.isUsernameAvailable('voce.demo'))).toBe(false);
    expect(expectOk(await profile.isUsernameAvailable('livre.demo'))).toBe(true);
    const withPhoto = expectOk(await avatar.uploadAvatar(DEMO_USER_ID, { body: new ArrayBuffer(8), mimeType: 'image/png', size: 8 }));
    expect(withPhoto.avatarUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it('corridas, percurso, neblina, baús abertos e progresso (histórico calculado pelo domain)', async () => {
    const list = expectOk(await activities.listMyActivities());
    expect(list.length).toBe(6);
    expect(list.every((a) => a.status === 'valid' && a.result !== null && a.meters > 0)).toBe(true);
    expect(list[0].startedAt).toBeGreaterThan(list[1].startedAt);
    const week = expectOk(await activities.listMyActivities({ from: NOW - 7 * 86_400_000, to: NOW }));
    expect(week.length).toBeGreaterThan(0);
    expect(week.length).toBeLessThan(list.length);
    expect(expectOk(await activities.getActivity(list[0].id))?.id).toBe(list[0].id);
    expect(expectOk(await activities.getActivityResult(list[0].id))?.rpTotal).toBe(list[0].rpTotal);
    expect(expectOk(await activities.getActivityPath(list[0].id, 50))).toHaveLength(50);
    expect(expectOk(await activities.listMyFogCells()).length).toBeGreaterThan(0);
    expect(expectOk(await activities.listMyChestOpens())).toEqual([]);
    const prog = expectOk(await activities.getMyProgress(DEMO_USER_ID));
    expect(prog.recentPaces.length).toBe(6);
    expect(prog.xp).toBeGreaterThan(0);
    expect(expectOk(await track.getInvalidStretches(list[0].id, [{ fromSeq: 10, toSeq: 30 }]))[0]).toHaveLength(22);
  });

  it('baús do dia, crew, rankings e distrito', async () => {
    const daily = expectOk(await chests.fetchDailyChests(DEMO_CENTER));
    expect(daily.chests.length).toBeGreaterThanOrEqual(5);
    expect(expectOk(await chests.fetchDailyChests()).chests.map((c) => c.id)).toEqual(daily.chests.map((c) => c.id));

    const mine = expectOk(await crews.getMyCrew(DEMO_USER_ID));
    expect(mine?.crew.tag).toBe('FLR');
    expect(mine?.members.some((m) => m.userId === DEMO_USER_ID)).toBe(true);
    // D-88: meta oficial da semana da crew (par de crew_week_goal), mesma regra do domain
    const goal = expectOk(await crews.getCrewWeekGoal())!;
    expect(goal.members).toBe(mine!.members.length);
    expect(goal.goalMeters).toBe(crewWeekGoalMeters(mine!.members.length));
    expect(goal.ran).toBeLessThanOrEqual(goal.members);
    expect(goal.progress).toBeCloseTo(crewWeekProgress(goal.meters, goal.goalMeters), 4);
    expect(goal.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${goal.weekStart}T12:00:00Z`).getUTCDay()).toBe(1);
    expect(expectOk(await crews.leaveCrew())).toBe(true);
    expect(expectOk(await crews.getMyCrew(DEMO_USER_ID))).toBeNull();
    expect(expectOk(await crews.getCrewWeekGoal())).toBeNull();
    expect(expectOk(await crews.joinCrew('demoflr1')).tag).toBe('FLR');
    expectOk(await crews.leaveCrew());
    const created = expectOk(await crews.createCrew('Crew de Teste', 'tst'));
    expect(created.tag).toBe('TST');
    expect(created.leaderId).toBe(DEMO_USER_ID);
    const removal = await crews.removeCrewMember(created.id, 'demo-ninguem');
    expect(removal.ok).toBe(false);

    const individual = expectOk(await leaderboard.getIndividualRanking());
    expect(individual.length).toBeGreaterThan(10);
    expect(individual.some((r) => r.userId === DEMO_USER_ID)).toBe(true);
    expect(individual.every((r) => r.username.endsWith('.demo'))).toBe(true);
    expect(expectOk(await leaderboard.getIndividualRanking({ faction: 'owls', limit: 3 })).every((r) => r.faction === 'owls')).toBe(true);
    expect(expectOk(await leaderboard.getCrewRanking()).length).toBeGreaterThan(0);
    expect(expectOk(await leaderboard.getFactionRanking())).toHaveLength(4);
    expect(expectOk(await leaderboard.getCityRanking())[0].city).toBeTruthy();
    expect(expectOk(await leaderboard.rankRunners({ period: 'week', scope: 'general' })).length).toBeGreaterThan(0);
    expect(expectOk(await leaderboard.rankCrews({ period: 'season', scope: 'faction', value: 'coyotes' })).every((c) => c.faction === 'coyotes')).toBe(true);
    expect(expectOk(await leaderboard.rankFactions({ period: 'season', scope: 'faction' }))).toHaveLength(4);
    const zoneId = expectOk(await leaderboard.getMyRecentZoneId(DEMO_USER_ID));
    expect(zoneId).toMatch(/^[0-9a-f]{15}$/);
    expect(expectOk(await leaderboard.getDistrictLabel(districtOf(zoneOf(DEMO_CENTER))))).not.toMatch(/^Distrito/);
  });

  it('notificações: lista, marca como lidas e Realtime', async () => {
    const list = expectOk(await notifications.listNotifications());
    expect(list.length).toBe(4);
    expect(list.filter((n) => n.readAt === null)).toHaveLength(2);
    expect(expectOk(await notifications.markNotificationsRead([list[0].id]))).toBe(1);
    expect(expectOk(await notifications.markNotificationsRead(null))).toBe(1);
    const statuses: string[] = [];
    const sub = expectOk(notifications.subscribeNotifications(DEMO_USER_ID, () => undefined, (s) => statuses.push(s)));
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toContain('SUBSCRIBED');
    sub.unsubscribe();
  });

  it('zonas: bbox, detalhe e Realtime', async () => {
    const box = expectOk(await zones.fetchZonesInBbox(zones.bboxAround(DEMO_CENTER, 2500)));
    expect(box.length).toBeGreaterThan(50);
    const park = box.find((z) => z.zone.id === zoneOf(DEMO_CENTER));
    expect(park?.zone.attacker).toBe('coyotes');
    expect(park?.meta.name).toBe('Parque Flamboyant');
    const detail = expectOk(await zones.fetchZoneDetail(zoneOf(DEMO_CENTER)));
    expect(detail.events[0]?.type).toBe('under_attack');
    expect(detail.topRunners.length).toBeGreaterThan(0);
    const missing = await zones.fetchZoneDetail('89a8100c6b7ffff');
    expect(missing.ok ? null : missing.error.code).toBe('NOT_FOUND');
    const sub = expectOk(zones.subscribeZones(() => undefined));
    sub.unsubscribe();
  });

  it('zonas de privacidade e contatos com os limites do banco', async () => {
    expect(expectOk(await privacy.listPrivacyZones())).toHaveLength(1);
    expectOk(await privacy.addPrivacyZone({ lat: -16.7, lng: -49.24 }));
    const third = expectOk(await privacy.addPrivacyZone({ label: 'Trabalho', lat: -16.71, lng: -49.25, radiusM: 300 }));
    const fourth = await privacy.addPrivacyZone({ lat: -16.72, lng: -49.26 });
    expect(!fourth.ok && privacy.isPrivacyLimitError(fourth.error)).toBe(true);
    expectOk(await privacy.removePrivacyZone(third.id));

    expect(expectOk(await contacts.listContacts())).toHaveLength(2);
    const c = expectOk(await contacts.addContact('Irmã', '+55 62 90000-0003'));
    expect(expectOk(await contacts.updateContact(c.id, 'Irmã mais velha', '+55 62 90000-0004')).name).toBe('Irmã mais velha');
    expectOk(await contacts.addContact('Quatro', '+55 62 90000-0005'));
    expectOk(await contacts.addContact('Cinco', '+55 62 90000-0006'));
    const sixth = await contacts.addContact('Seis', '+55 62 90000-0007');
    expect(!sixth.ok && contacts.isLimitError(sixth.error)).toBe(true);
    expectOk(await contacts.removeContact(c.id));
  });

  it('LGPD: exportação marcada como demonstração e exclusão', async () => {
    const data = expectOk(await account.exportMyData()) as { demonstracao: boolean; activities: unknown[] };
    expect(data.demonstracao).toBe(true);
    expect(data.activities).toHaveLength(6);
    expect((await account.deleteMyAccount('')).ok).toBe(false);
    expectOk(await account.deleteMyAccount('qualquer'));
  });

  it('moderação: corredor comum não vê nada; moderador decide', async () => {
    expect(expectOk(await moderation.listActivitiesInReview())).toEqual([]);
    expect(expectOk(await moderation.listUsers(''))).toEqual([]);
    setDemoClient(createDemoClient({ clock: () => NOW, scenario: 'moderador' }));
    const queue = expectOk(await moderation.listActivitiesInReview());
    expect(queue).toHaveLength(3);
    const detail = expectOk(await moderation.getReviewDetail(queue[0].id));
    expect(detail.points.length).toBeGreaterThan(1000);
    const approved = expectOk(await moderation.moderateActivity(queue[0].id, 'approve', 'Percurso coerente com o ritmo.'));
    expect(approved.status).toBe('valid');
    const rejected = expectOk(await moderation.moderateActivity(queue[1].id, 'reject', 'Trecho de carro evidente.'));
    expect(rejected.status).toBe('rejected');
    expect(expectOk(await moderation.listActivitiesInReview())).toHaveLength(1);
    const users = expectOk(await moderation.listUsers('ana'));
    expect(users[0].username).toBe('ana.demo');
    const denied = await moderation.setUserStatus(users[0].id, 'suspended');
    expect(denied.ok ? null : denied.error.detail).toBe('FORBIDDEN');
  });
});
