/**
 * Mapa (T7.3.2, E6b) — adaptador puro: faixa de hoje da E7 (`useTodayStrip()`) + chefão da E3
 * (`fetchRaidCurrent()`) → `MapToday`. Sem React, sem relógio (o `now` vem da tela).
 *
 * Regra (D-76): só entra o que é verdade. Raid indisponível (`available: false`), sem chefão aberto ou já
 * derrotado/fugido → sem chip do chefão. Sem dado do engajamento → a faixa cai na sequência v1 do servidor.
 */
import type { TodayStrip } from '@/features/engagement';
import type { RaidCurrent, Unavailable } from '@/services/api/raid-repo';

import type { MapMission, MapToday } from './map-screen.model';

/** O que o adaptador lê da faixa da E7 (o hook devolve mais coisa). */
export type StripInput = Pick<TodayStrip, 'streak' | 'chest' | 'items'> & {
  coach: Pick<NonNullable<TodayStrip['coach']>, 'testID' | 'eyebrow' | 'title' | 'done' | 'steps' | 'reward'> | null;
};

export const SAO_PAULO = 'America/Sao_Paulo';

/** Dia da semana em Brasília (0 = domingo … 6 = sábado). */
export function weekdayIn(now: number, timeZone: string = SAO_PAULO): number {
  const name = new Date(now).toLocaleDateString('en-US', { weekday: 'short', timeZone });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * Sequência em risco (D-63, semana de segunda a domingo): da sexta em diante, faltando atividade e sem pausa.
 * Antes disso não há aviso (a semana ainda tem tempo).
 */
export function streakAtRisk(done: number, goal: number, paused: boolean, now: number, timeZone?: string): boolean {
  if (paused || done >= goal) return false;
  const d = weekdayIn(now, timeZone);
  return d === 5 || d === 6 || d === 0;
}

/** Chefão da semana com vida, só com o Raid ativo de verdade. */
export function bossOf(raid: RaidCurrent | Unavailable | null | undefined): MapToday['boss'] {
  if (!raid || !raid.available || !raid.raid) return null;
  const b = raid.raid;
  if (b.status !== 'active' || b.hpMax <= 0) return null;
  return { name: b.name, hp: Math.max(0, Math.min(1, b.hp / b.hpMax)) };
}

export function mapTodayFrom(input: { strip: StripInput | null; raid: RaidCurrent | Unavailable | null; now: number; demo: boolean; timeZone?: string }): MapToday {
  const { strip, raid, now } = input;
  const st = strip?.streak ?? null;
  const streak = st ? { done: st.activities, goal: st.target, paused: st.paused, atRisk: streakAtRisk(st.activities, st.target, st.paused, now, input.timeZone) } : null;
  const ch = strip?.chest ?? null;
  const chest = ch && ch.stored + ch.bonus > 0 ? { credits: ch.stored + ch.bonus, meters: null } : null;
  const c = strip?.coach ?? null;
  const mission: MapMission | null = c ? { id: c.testID, eyebrow: c.eyebrow, title: c.title, steps: c.steps, done: c.done, reward: c.reward, href: '/missoes' } : null;
  const m = strip?.items.find((i) => i.key === 'missao');
  const featured = m ? { value: m.value, label: m.label } : null;
  const isDemoRaid = !!raid && raid.available && !!raid.raid?.isDemo;
  return { streak, chest, boss: bossOf(raid), mission, featured, demo: input.demo || isDemoRaid };
}
