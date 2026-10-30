/**
 * Ordem do bloco "Recompensas" do resumo (E7, T7.2.4), regra do pico-fim: a lembrança de uma experiência fica
 * no momento mais forte e no fim. Então: o XP linha a linha prepara (transparência), o que é menor vem antes,
 * o **pico** (subiu de nível com título novo > baú lendário > subiu de nível > baú raro > missão > baú comum)
 * fica perto do fim, e o **fim** é sempre uma frase boa e verdadeira sobre a semana (nunca uma perda).
 */
import { titleForLevel } from '@/domain/progression';
import type { RunEngagement } from '@/services/api/engagement-repo';

export type RewardSection = 'xp' | 'level' | 'chests' | 'missions' | 'streak';

type Peak = { section: RewardSection; weight: number };

function peakOf(b: RunEngagement): Peak | null {
  const candidates: Peak[] = [];
  const leveled = b.level.after > b.level.before;
  if (leveled) candidates.push({ section: 'level', weight: b.level.titleAfter ? 6 : 4 });
  const opened = b.dailyChests.opened;
  if (opened.length > 0) {
    const best = opened.some((c) => c.rarity === 'lendario') ? 5 : opened.some((c) => c.rarity === 'raro') ? 3 : 1;
    candidates.push({ section: 'chests', weight: best });
  }
  if (b.missions.length > 0) candidates.push({ section: 'missions', weight: 2 });
  return candidates.sort((a, c) => c.weight - a.weight)[0] ?? null;
}

/** A seção do pico (a que ganha destaque), ou `null` quando a corrida não teve pico. */
export function rewardPeak(b: RunEngagement): RewardSection | null {
  return peakOf(b)?.section ?? null;
}

/** Seções presentes, na ordem de exibição. */
export function rewardSections(b: RunEngagement): RewardSection[] {
  const present = new Set<RewardSection>();
  if (b.xp.lines.length > 0) present.add('xp');
  present.add('level');
  if (b.dailyChests.opened.length > 0 || b.dailyChests.reason === 'distance') present.add('chests');
  if (b.missions.length > 0) present.add('missions');
  if (b.streak) present.add('streak');
  const peak = peakOf(b)?.section ?? null;
  const middle = (['level', 'missions', 'chests'] as const).filter((s) => present.has(s) && s !== peak);
  return [
    ...(present.has('xp') ? (['xp'] as const) : []),
    ...middle,
    ...(peak && present.has(peak) ? [peak] : []),
    ...(present.has('streak') ? (['streak'] as const) : []),
  ];
}

/** A frase do fim: sempre verdadeira e positiva (D-63: descanso nunca é punido). */
export function streakLine(s: NonNullable<RunEngagement['streak']>): { title: string; body: string } {
  if (s.paused) return { title: 'Pausa de saúde ativa', body: 'Sua sequência fica guardada enquanto você descansa.' };
  if (s.weekKept) return { title: 'Semana garantida', body: s.weeks > 0 ? `Sequência de ${s.weeks + 1} semanas a caminho.` : 'A sequência começa nesta semana.' };
  if (s.activitiesThisWeek >= 2) return { title: `${s.activitiesThisWeek} atividades na semana`, body: 'A semana já está garantida.' };
  return { title: `${s.activitiesThisWeek} de 2 na semana`, body: 'Mais 1 atividade garante a semana. Caminhar vale.' };
}

export function levelLine(b: RunEngagement): { title: string; body: string } {
  if (b.level.after > b.level.before) {
    const t = b.level.titleAfter?.name ?? titleForLevel(b.level.after).name;
    return { title: `Nível ${b.level.after}!`, body: b.level.titleAfter ? `Título novo: ${t}.` : t };
  }
  return { title: `Nível ${b.level.after}`, body: titleForLevel(b.level.after).name };
}

/** Leitura completa para o leitor de tela, numa frase por seção. */
export function rewardsA11y(b: RunEngagement): string {
  const parts = [`Você ganhou ${b.xp.total} XP`];
  if (b.level.after > b.level.before) parts.push(`subiu para o nível ${b.level.after}`);
  if (b.dailyChests.opened.length) parts.push(`${b.dailyChests.opened.length === 1 ? 'abriu 1 baú' : `abriu ${b.dailyChests.opened.length} baús`}`);
  if (b.missions.length) parts.push(b.missions.length === 1 ? 'concluiu 1 missão' : `concluiu ${b.missions.length} missões`);
  return `${parts.join(', ')}.`;
}
