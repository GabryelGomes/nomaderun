/**
 * Textos e contas de tela do engajamento (E7, T7.2.4), puros e testáveis. Limites da D-74: título ≤ 30
 * caracteres e bloco ≤ 1 frase de até 90. Nada aqui inventa número: tudo sai do servidor ou do domain.
 */
import type { ChestRarity } from '@/domain/games';
import { FTUE_STEP_IDS, ftueSteps, missionById, missionText, type MissionTier } from '@/domain/missions';
import { brtCalendar, type HealthPause } from '@/domain/progression';
import type { DailyChestState, EngagementMission, EngagementMissions, TrackItem } from '@/services/api/engagement-repo';

import { cosmeticName } from './cosmetics';

export const TITLE_MAX = 30;
export const BLOCK_MAX = 90;

export const TIER_LABEL: Record<MissionTier, string> = { leve: 'Leve', padrao: 'Padrão', desafio: 'Desafio' };
export const RARITY_LABEL: Record<ChestRarity, string> = { comum: 'Comum', raro: 'Raro', lendario: 'Lendário' };

/** Inteiro com ponto de milhar (pt-BR), sem depender do Intl do aparelho. */
export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 0,05 → "5%"; 0,255 → "25,5%". */
export function pct(x: number): string {
  const v = Math.round(Math.max(0, x) * 1000) / 10;
  return `${String(v).replace('.', ',')}%`;
}

const km = (m: number) => String(Math.round((Math.max(0, m) / 1000) * 10) / 10).replace('.', ',');

/* ---------- Missões ---------- */

export function missionRatio(m: Pick<EngagementMission, 'progress' | 'target' | 'completedAt'>): number {
  if (m.completedAt !== null) return 1;
  return m.target > 0 ? Math.min(1, Math.max(0, m.progress / m.target)) : 0;
}

/** "1,2 de 3 km", "8 de 15 min", "1 de 2". */
export function missionProgressLabel(m: Pick<EngagementMission, 'metric' | 'progress' | 'target'>): string {
  if (m.metric === 'meters' || m.metric === 'raidMeters' || m.metric === 'raid_damage_m') return `${km(m.progress)} de ${km(m.target)} km`;
  if (m.metric === 'movingSeconds' || m.metric === 'moving_seconds') return `${Math.floor(m.progress / 60)} de ${Math.round(m.target / 60)} min`;
  return `${fmtInt(m.progress)} de ${fmtInt(m.target)}`;
}

export function missionA11y(m: EngagementMission): string {
  const state = m.completedAt !== null ? 'concluída' : missionProgressLabel(m);
  return `${m.title}. ${state}. Recompensa: ${m.xp} XP`;
}

/** Prazo honesto: diária até 23h59, semanal até domingo, primeira semana e volta sem prazo. */
export function deadlineLabel(m: Pick<EngagementMission, 'cadence'>): string {
  if (m.cadence === 'diaria') return 'Até 23h59';
  if (m.cadence === 'semanal') return 'Até domingo';
  return 'Sem prazo';
}

export function canReroll(m: EngagementMission, rerollsLeft: number): boolean {
  return m.cadence === 'diaria' && m.completedAt === null && rerollsLeft > 0;
}

/* ---------- Primeira semana ---------- */

export const FTUE_SHORT: Record<(typeof FTUE_STEP_IDS)[number], string> = {
  'f1-dominio': 'Domínio',
  'f2-caca': 'Caça',
  'f3-fuga': 'Fuga',
  'f4-raid': 'Raid',
  'f5-crew': 'Crew',
  'f6-liga': 'Liga',
  'f7-compartilhar': 'Card',
};

export type FtueRow = {
  id: string;
  step: number;
  short: string;
  title: string;
  xp: number;
  status: 'done' | 'open' | 'locked';
  unlocksAt: number | null;
  mission: EngagementMission | null;
};

/**
 * Os 7 passos: os liberados vêm do servidor (com texto e progresso); os outros aparecem trancados com o texto
 * do catálogo. Sem `ftueStartedAt` (conta antiga), não há primeira semana.
 */
export function ftueRows(m: Pick<EngagementMissions, 'ftue' | 'ftueStartedAt'>, now: number): FtueRow[] {
  if (m.ftueStartedAt === null && m.ftue.length === 0) return [];
  const byDef = new Map(m.ftue.map((x) => [x.defId, x]));
  const completedAt = Object.fromEntries(m.ftue.map((x) => [x.defId, x.completedAt]));
  const steps = ftueSteps({ startedAt: m.ftueStartedAt ?? m.ftue[0]?.availableFrom ?? now, completedAt, now });
  return steps.map((s) => {
    const mission = byDef.get(s.id) ?? null;
    const def = missionById(s.id);
    const status = mission?.completedAt != null ? 'done' : mission ? 'open' : s.status === 'done' ? 'done' : 'locked';
    return {
      id: s.id,
      step: s.step,
      short: FTUE_SHORT[s.id as keyof typeof FTUE_SHORT] ?? `Passo ${s.step}`,
      title: mission?.title || (def ? missionText(def, typeof def.target === 'number' ? def.target : 0) : ''),
      xp: mission?.xp ?? def?.xp ?? 0,
      status,
      unlocksAt: s.unlocksAt,
      mission,
    };
  });
}

export const ftueDoneCount = (rows: readonly FtueRow[]) => rows.filter((r) => r.status === 'done').length;

/** Prêmio da primeira semana (o servidor dá ao concluir o 7º passo, que só abre depois dos outros 6). */
export const FTUE_PRIZE = { cosmeticId: 'moldura-primeira-semana', name: 'Primeira Semana' } as const;

/** Os 7 passos feitos. */
export const ftueComplete = (rows: readonly FtueRow[]) => rows.length === FTUE_STEP_IDS.length && rows.every((r) => r.status === 'done');

export type FtueActionHref = '/corrida' | '/arena' | '/clube' | '/clube/crew' | '/perfil/atividades';

/** Onde cada passo aberto se faz de verdade (o atalho leva à tela; quem conta é o servidor). */
export type FtueAction = {
  label: string;
  href: FtueActionHref;
  /** Modo já escolhido na tela Correr. */
  mode?: 'livre' | 'caca' | 'fuga';
  /** O destino mostra o ranking do time: o atalho avisa o servidor (`record_ranking_opened`). */
  ranking?: boolean;
};

export function ftueAction(row: Pick<FtueRow, 'id' | 'status' | 'mission'>): FtueAction | null {
  if (row.status !== 'open') return null;
  const fallback = row.mission?.variant === 'fallback';
  switch (row.id) {
    case 'f1-dominio':
      return { label: 'Correr', href: '/corrida', mode: 'livre' };
    case 'f2-caca':
      return { label: 'Caçar', href: '/corrida', mode: 'caca' };
    case 'f3-fuga':
      return { label: 'Fugir', href: '/corrida', mode: 'fuga' };
    case 'f4-raid':
      return fallback ? { label: 'Correr', href: '/corrida', mode: 'livre' } : { label: 'Ver chefão', href: '/arena' };
    case 'f5-crew':
      return { label: 'Ver crews', href: '/clube/crew' };
    case 'f6-liga':
      return fallback ? { label: 'Ver ranking', href: '/clube', ranking: true } : { label: 'Ver liga', href: '/arena' };
    case 'f7-compartilhar':
      return { label: 'Escolher corrida', href: '/perfil/atividades' };
    default:
      return null;
  }
}

/** "Libera amanhã" para o passo seguinte ao feito hoje; os outros, "Depois do passo N". */
export function unlockLabel(row: FtueRow, now: number): string {
  if (row.unlocksAt !== null && row.unlocksAt > now) {
    const days = brtCalendar.daysBetween(brtCalendar.clock(now).dayId, brtCalendar.clock(row.unlocksAt).dayId);
    return days <= 1 ? 'Libera amanhã' : `Libera em ${days} dias`;
  }
  return `Depois do passo ${row.step - 1}`;
}

/* ---------- Baú do dia ---------- */

export type OddsRow = { rarity: ChestRarity; label: string; chance: string; xp: string; cosmetic: string | null };

/** Chances visíveis (ética §5.4, D-66): raridade, chance, XP e chance de cosmético. */
export function oddsRows(c: Pick<DailyChestState, 'odds' | 'xp' | 'cosmeticChance'>): OddsRow[] {
  return (['comum', 'raro', 'lendario'] as const).map((rarity) => ({
    rarity,
    label: RARITY_LABEL[rarity],
    chance: pct(c.odds[rarity]),
    xp: `${c.xp[rarity]} XP`,
    cosmetic: c.cosmeticChance[rarity] > 0 ? `${pct(c.cosmeticChance[rarity])} de item` : null,
  }));
}

export function pityLabel(pityLeft: number): string {
  return pityLeft <= 1 ? 'O próximo baú é lendário garantido.' : `Lendário garantido em até ${pityLeft} baús.`;
}

export function storedLabel(c: Pick<DailyChestState, 'stored' | 'bonus' | 'openedToday'>): string {
  const total = c.stored + c.bonus.length;
  if (c.openedToday && total === 0) return 'Baús de hoje já abertos';
  if (total === 0) return 'Nenhum baú guardado';
  return total === 1 ? '1 baú guardado' : `${total} baús guardados`;
}

/** Mensagem curta para a recusa do servidor ao abrir. */
export function chestRefusal(detail: string | undefined): string {
  if (detail === 'DAILY_CHEST_LOCKED') return 'Corra ou caminhe 1 km hoje para abrir.';
  if (detail === 'DAILY_CHEST_REVIEW') return 'Seus baús esperam a revisão da corrida.';
  return 'Não deu para abrir agora. Tente de novo.';
}

/* ---------- Trilha ---------- */

export function trackItemLabel(i: TrackItem): string {
  switch (i.kind) {
    case 'chest':
      return `Baú ${RARITY_LABEL[i.rarity ?? 'comum'].toLowerCase()}`;
    case 'cosmetic':
      return i.cosmeticId ? cosmeticName(i.cosmeticId) : 'Item';
    case 'xp':
      return `+${i.amount ?? 0} XP`;
    case 'medal':
      return `Medalha de ${i.medalTier ?? 'bronze'}`;
    case 'freeze':
      return '+1 congelamento';
  }
}

/**
 * Recorte curto da trilha para a tela (T7.3.6, ≤ 120 palavras): até 2 degraus prontos para resgatar e os
 * próximos a alcançar, até `size`. Quando nada falta resgatar e a trilha acabou, os últimos degraus.
 */
export function trackWindow<T extends { step: number; unlocked: boolean; claimed: boolean }>(rewards: readonly T[], step: number, size = 4): T[] {
  const sorted = [...rewards].sort((a, b) => a.step - b.step);
  const pending = sorted.filter((r) => r.unlocked && !r.claimed).slice(0, 2);
  const ahead = sorted.filter((r) => r.step > step && !pending.includes(r));
  const picked = [...pending, ...ahead].slice(0, size);
  if (picked.length < size) {
    const rest = sorted.filter((r) => !picked.includes(r)).slice(-(size - picked.length));
    picked.push(...rest);
  }
  return picked.sort((a, b) => a.step - b.step);
}

/* ---------- Pausa de saúde ---------- */

export const PAUSE_WEEKS = [1, 2, 3, 4] as const;

/** '2026-11-01' → '01/11'. */
export function shortDate(dayId: string): string {
  const [, m, d] = dayId.split('-');
  return `${d}/${m}`;
}

export function pauseActive(p: HealthPause | null, now: number): boolean {
  const today = brtCalendar.clock(now).dayId;
  return !!p && p.from <= today && today <= p.until;
}
