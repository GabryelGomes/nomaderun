/**
 * T7.3.2 (E6b) — adaptador da faixa de hoje do Mapa: `useTodayStrip()` (E7) + `fetchRaidCurrent()` (E3) →
 * `MapToday`. Só verdades: sem dado, o chip some.
 */
import { describe, expect, it } from '@jest/globals';

import type { RaidBoss, RaidCurrent } from '@/services/api/raid-repo';

import { mapAlerts, mapCityOf, todayChips } from '../map-screen.model';
import { bossOf, mapTodayFrom, streakAtRisk, weekdayIn, type StripInput } from '../map-screen.today';

// Quarta-feira, 28/10/2026, 12:00 em Brasília (15:00 UTC); sexta = +2 dias.
const WED = Date.UTC(2026, 9, 28, 15);
const FRI = WED + 2 * 86_400_000;
const SUN_NIGHT = Date.UTC(2026, 10, 2, 2); // domingo 23:00 em Brasília (já segunda em UTC)

const boss = (patch: Partial<RaidBoss> = {}): RaidBoss => ({
  id: 'r1',
  bossId: 'soneca',
  name: 'Soneca',
  theme: '',
  weakness: '',
  introLine: '',
  defeatLine: '',
  artKey: '',
  city: null,
  weekStart: '2026-10-26',
  startsAt: 0,
  endsAt: 0,
  hp: 300,
  hpMax: 1000,
  phase: 2,
  status: 'active',
  participants: 4,
  defeatedAt: null,
  isDemo: false,
  weakPoints: [],
  ...patch,
});
const raid = (b: RaidBoss | null): RaidCurrent => ({
  available: true,
  raid: b,
  me: { damage: 0, meters: 0, hits: 0, todayMeters: 0, rank: null, rewards: [] },
  share: 0,
  sinceLastVisit: null,
  topRunners: [],
  topCrews: [],
  params: {},
});

const strip = (patch: Partial<StripInput> = {}): StripInput => ({
  streak: { activities: 1, target: 2, weeks: 3, paused: false },
  chest: { stored: 1, bonus: 1, openedToday: false },
  items: [{ key: 'missao', testID: 'hoje-missao', icon: 'trophy', value: '40%', label: 'Missão' }],
  coach: null,
  ...patch,
});

describe('mapCityOf (cidade do mapa, não a natal — QA E10)', () => {
  it('a cidade mais frequente entre as zonas visíveis; sem cidade, null', () => {
    const meta = { a: { city: 'Goiânia' }, b: { city: 'Goiânia' }, c: { city: 'Anápolis' }, d: { city: null } };
    expect(mapCityOf(['a', 'b', 'c', 'd'], meta)).toBe('Goiânia');
    expect(mapCityOf(['c'], meta)).toBe('Anápolis');
    expect(mapCityOf(['d', 'x'], meta)).toBeNull();
  });
});

describe('weekdayIn / streakAtRisk', () => {
  it('lê o dia da semana em Brasília', () => {
    expect(weekdayIn(WED)).toBe(3);
    expect(weekdayIn(SUN_NIGHT)).toBe(0);
  });

  it('em risco só da sexta ao domingo, faltando atividade e sem pausa', () => {
    expect(streakAtRisk(1, 2, false, WED)).toBe(false);
    expect(streakAtRisk(1, 2, false, FRI)).toBe(true);
    expect(streakAtRisk(1, 2, false, SUN_NIGHT)).toBe(true);
    expect(streakAtRisk(2, 2, false, FRI)).toBe(false);
    expect(streakAtRisk(0, 2, true, FRI)).toBe(false);
  });
});

describe('bossOf (chefão da E3)', () => {
  it('vida de 0 a 1 só com o Raid ativo', () => {
    expect(bossOf(raid(boss()))).toEqual({ name: 'Soneca', hp: 0.3 });
  });

  it('available: false, sem chefão, derrotado ou fugido: o chip some', () => {
    expect(bossOf({ available: false, reason: 'desligada' })).toBeNull();
    expect(bossOf({ available: false, reason: 'servidor-antigo' })).toBeNull();
    expect(bossOf(raid(null))).toBeNull();
    expect(bossOf(raid(boss({ status: 'defeated', hp: 0 })))).toBeNull();
    expect(bossOf(raid(boss({ status: 'escaped' })))).toBeNull();
    expect(bossOf(null)).toBeNull();
  });
});

describe('mapTodayFrom', () => {
  it('sequência, baú (guardados + bônus), chefão com vida e a missão em destaque', () => {
    const t = mapTodayFrom({ strip: strip(), raid: raid(boss()), now: WED, demo: false });
    expect(t).toMatchObject({
      streak: { done: 1, goal: 2, paused: false, atRisk: false },
      chest: { credits: 2, meters: null },
      boss: { name: 'Soneca', hp: 0.3 },
      featured: { value: '40%', label: 'Missão' },
      mission: null,
      demo: false,
    });
    const chips = todayChips(t, 0);
    expect(chips.map((c) => c.testID)).toEqual(['mapa-hoje-sequencia', 'mapa-hoje-bau', 'mapa-hoje-chefao', 'mapa-hoje-missao']);
    expect(chips.map((c) => c.href)).toEqual(['/recompensas', '/recompensas', '/arena', '/missoes']);
    expect(chips[2]).toMatchObject({ value: '30%', tone: 'villain' });
  });

  it('Raid indisponível: sem chip do chefão (a missão ocupa o lugar)', () => {
    const t = mapTodayFrom({ strip: strip(), raid: { available: false, reason: 'desligada' }, now: WED, demo: false });
    expect(t.boss).toBeNull();
    expect(todayChips(t, 0).map((c) => c.key)).toEqual(['streak', 'chest', 'mission']);
  });

  it('sem dado do engajamento: cai na sequência v1 do servidor e nada mais é inventado', () => {
    const t = mapTodayFrom({ strip: null, raid: null, now: WED, demo: false });
    expect(t).toMatchObject({ streak: null, chest: null, boss: null, mission: null, featured: null });
    expect(todayChips(t, 3)).toEqual([expect.objectContaining({ key: 'streak', value: '3', label: 'semanas' })]);
  });

  it('baú zerado não vira chip; pausa de saúde mostra "Pausa" e não avisa risco', () => {
    const t = mapTodayFrom({ strip: strip({ chest: { stored: 0, bonus: 0, openedToday: true }, streak: { activities: 0, target: 2, weeks: 1, paused: true } }), raid: null, now: FRI, demo: false });
    expect(t.chest).toBeNull();
    expect(todayChips(t, 0)[0]).toMatchObject({ key: 'streak', value: 'Pausa' });
    expect(mapAlerts({ attacked: [], zoneName: (id) => id, attackerName: () => '', today: t }).some((a) => a.kind === 'streak')).toBe(false);
  });

  it('sexta com 1 de 2: o alerta da sequência aparece', () => {
    const t = mapTodayFrom({ strip: strip(), raid: null, now: FRI, demo: false });
    expect(mapAlerts({ attacked: [], zoneName: (id) => id, attackerName: () => '', today: t }).map((a) => a.title)).toContain('1 corrida mantém a sequência');
  });

  it('cartão da primeira semana (E7) vira a missão do Mapa e abre /missoes', () => {
    const coach = { testID: 'hoje-primeira-semana', eyebrow: 'Passo 2 de 7', title: 'Corra 1 km', done: 1, steps: ['a', 'b', 'c'], reward: '+20 XP' };
    const t = mapTodayFrom({ strip: strip({ coach }), raid: null, now: WED, demo: true });
    expect(t.mission).toEqual({ id: 'hoje-primeira-semana', eyebrow: 'Passo 2 de 7', title: 'Corra 1 km', done: 1, steps: ['a', 'b', 'c'], reward: '+20 XP', href: '/missoes' });
    expect(t.demo).toBe(true);
  });

  it('chefão do seed de demonstração marca a faixa como demonstração', () => {
    expect(mapTodayFrom({ strip: null, raid: raid(boss({ isDemo: true })), now: WED, demo: false }).demo).toBe(true);
  });
});
