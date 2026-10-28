/**
 * Mapa v2 (T7.2.7, E6b) — contas puras do topo e do espaço de alerta. Sem React e sem relógio (o `now`
 * vem da tela, por `useNow`). Regra: **sem dado verdadeiro, o bloco não existe** (nada inventado).
 */
import type { AlertKind } from '@/components/alert-slot';
import type { IconName } from '@/components/icon';
import { DEFENSE_WINDOW_MS, isUnderAttackAt, type Zone } from '@/domain/territory';
import type { FactionId } from '@/domain/types';
import type { AppNotification } from '@/services/api/notifications-repo';

/**
 * Dados de engajamento do dia. Quem preenche é o hook da E7 (sequência, baú do dia, missão) e o da Raid
 * (E3/E9). Cada campo ausente = o chip/alerta correspondente não aparece. `demo` marca dado de demonstração.
 */
export type MapToday = {
  /** Sequência semanal (D-63): atividades feitas na semana e a meta (2). */
  streak?: { done: number; goal: number; atRisk?: boolean; paused?: boolean } | null;
  /** Baú do dia (D-66): créditos acumulados (0..3) e, se houver, a distância até o baú mais perto. */
  chest?: { credits: number; meters?: number | null } | null;
  /** Chefão da semana (D-67): nome e vida (0..1). */
  boss?: { name: string; hp: number } | null;
  /** Missão em destaque (boas-vindas, volta ou a do dia). */
  mission?: MapMission | null;
  /** Chip da missão aberta mais adiantada (E7: "40%" ou "Feitas"). */
  featured?: { value: string; label: string } | null;
  demo?: boolean;
};

export type MapMission = {
  id: string;
  title: string;
  steps: readonly string[];
  done: number;
  eyebrow?: string;
  reward?: string;
  /** Para onde o cartão leva (padrão: Correr). As missões da E7 abrem `/missoes`. */
  href?: '/corrida' | '/missoes';
};

export type TodayHref = '/recompensas' | '/missoes' | '/arena';
export type TodayChip = {
  key: 'streak' | 'chest' | 'boss' | 'mission';
  testID: string;
  icon: IconName;
  value: string;
  label: string;
  tone: 'action' | 'villain' | 'neutral';
  /** Tela que o chip abre (só quando o dado veio do engajamento/Raid). */
  href?: TodayHref;
};

/**
 * Faixa de hoje: até 3 chips (sequência, baú do dia, chefão), só os verdadeiros. A sequência v1 (semanas,
 * do servidor) entra enquanto a E7 não entrega a v2 ("1/2" na semana).
 */
export function todayChips(today: MapToday | null | undefined, streakWeeks: number): TodayChip[] {
  const out: TodayChip[] = [];
  if (today?.streak && today.streak.goal > 0) {
    const s = today.streak;
    out.push({ key: 'streak', testID: 'mapa-hoje-sequencia', icon: 'fire', value: s.paused ? 'Pausa' : `${Math.min(Math.max(0, s.done), s.goal)}/${s.goal}`, label: 'Semana', tone: 'action', href: '/recompensas' });
  } else if (streakWeeks > 0) {
    out.push({ key: 'streak', testID: 'mapa-hoje-sequencia', icon: 'fire', value: String(streakWeeks), label: streakWeeks === 1 ? 'semana' : 'semanas', tone: 'action' });
  }
  if (today?.chest && today.chest.credits > 0) {
    out.push({ key: 'chest', testID: 'mapa-hoje-bau', icon: 'chest', value: String(today.chest.credits), label: today.chest.credits > 1 ? 'Baús' : 'Baú', tone: 'action', href: '/recompensas' });
  }
  if (today?.boss && Number.isFinite(today.boss.hp)) {
    out.push({ key: 'boss', testID: 'mapa-hoje-chefao', icon: 'raid', value: `${Math.round(Math.max(0, Math.min(1, today.boss.hp)) * 100)}%`, label: 'Chefão', tone: 'villain', href: '/arena' });
  }
  // A missão em destaque entra se sobrar espaço (a faixa mostra no máximo 3 chips).
  if (today?.featured) out.push({ key: 'mission', testID: 'mapa-hoje-missao', icon: 'trophy', value: today.featured.value, label: today.featured.label, tone: 'action', href: '/missoes' });
  return out;
}

/** Hora em que a janela de defesa fecha (24 h depois do início do ataque), "18:40". */
export function defenseEndsAt(zone: Pick<Zone, 'attackStartedAt'>, timeZone?: string): string {
  if (zone.attackStartedAt === null) return '';
  return new Date(zone.attackStartedAt + DEFENSE_WINDOW_MS).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : null) });
}

/** Zonas do time sob ataque agora (E-03/E-04: só dentro da janela; `isUnderAttackAt`). A mais recente primeiro. */
export function zonesUnderAttack(zones: Readonly<Record<string, Zone>>, faction: FactionId, now: number): Zone[] {
  return Object.values(zones)
    .filter((z) => z.owner === faction && isUnderAttackAt(z, now))
    .sort((a, b) => (b.attackStartedAt ?? 0) - (a.attackStartedAt ?? 0));
}

export type MapAlert = { id: string; kind: AlertKind; title: string; body: string; zoneId?: string };

/**
 * Candidatos ao espaço único de alerta (o `AlertSlot` escolhe 1 pela prioridade: ataque > missão > baú >
 * chefão > sequência). Textos ≤ 30 caracteres no título e 1 linha no apoio (D-74).
 */
export function mapAlerts(input: {
  attacked: readonly Zone[];
  zoneName: (id: string) => string;
  attackerName: (f: FactionId | null) => string;
  today?: MapToday | null;
  timeZone?: string;
}): MapAlert[] {
  const out: MapAlert[] = [];
  const a = input.attacked[0];
  if (a) {
    const ends = defenseEndsAt(a, input.timeZone);
    out.push({ id: `ataque-${a.id}`, kind: 'attack', zoneId: a.id, title: `${input.zoneName(a.id)} sob ataque`, body: `${input.attackerName(a.attacker)} · dobro até ${ends}` });
  }
  const m = input.today?.mission;
  if (m && m.done < m.steps.length) out.push({ id: `missao-${m.id}`, kind: 'mission', title: m.title, body: m.reward ?? '' });
  const c = input.today?.chest;
  if (c && c.credits > 0 && c.meters !== null && c.meters !== undefined && c.meters <= 1000) {
    out.push({ id: 'bau-do-dia', kind: 'chest', title: `Baú do dia a ${Math.round(c.meters / 10) * 10} m`, body: 'Passe por ele na próxima corrida' });
  }
  const b = input.today?.boss;
  if (b && b.hp > 0 && b.hp < 0.2) out.push({ id: 'chefao', kind: 'boss', title: `${b.name} com ${Math.round(b.hp * 100)}% de vida`, body: 'Seu próximo km pode derrubar' });
  const s = input.today?.streak;
  if (s && s.atRisk && !s.paused && s.done < s.goal) {
    const left = s.goal - s.done;
    out.push({ id: 'sequencia', kind: 'streak', title: `${left} corrida${left > 1 ? 's' : ''} mantém a sequência`, body: 'A semana fecha domingo' });
  }
  return out;
}

/** "O que mudou desde ontem": zonas ganhas e perdidas nas últimas 24 h (notificações do servidor). */
export const CHANGES_WINDOW_MS = 24 * 60 * 60 * 1000;

export function changesSinceYesterday(items: readonly Pick<AppNotification, 'type' | 'createdAt'>[], now: number): { gained: number; lost: number } | null {
  let gained = 0;
  let lost = 0;
  for (const n of items) {
    if (now - n.createdAt > CHANGES_WINDOW_MS || n.createdAt > now) continue;
    if (n.type === 'conquest') gained++;
    else if (n.type === 'territory_lost') lost++;
  }
  return gained || lost ? { gained, lost } : null;
}

/** Frase curta do "o que mudou" (≤ 40 caracteres): "Desde ontem: +2 zonas · −1". */
export function changesText(c: { gained: number; lost: number }): string {
  const parts: string[] = [];
  if (c.gained) parts.push(`+${c.gained} zona${c.gained > 1 ? 's' : ''}`);
  if (c.lost) parts.push(`${c.lost} perdida${c.lost > 1 ? 's' : ''}`);
  return `Desde ontem: ${parts.join(' · ')}`;
}

/**
 * Missão de boas-vindas (D-72), só quando é verdade: a conta e o time existem e o servidor diz que a pessoa
 * ainda não tem nenhuma corrida. Sem a resposta do servidor (`runs === null`), nada aparece.
 */
export function welcomeMission(runs: number | null): MapMission | null {
  if (runs === null || runs > 0) return null;
  return { id: 'boas-vindas', eyebrow: 'Missão 1', title: 'Corra e pinte sua 1ª zona', steps: ['Conta', 'Time', '1ª corrida'], done: 2 };
}

/** Assinatura das zonas com ataque vencido (muda só quando um ataque expira, não a cada minuto). */
export function expiredAttackKey(zones: Readonly<Record<string, Zone>>, now: number): string {
  const ids: string[] = [];
  for (const z of Object.values(zones)) if (z.attackStartedAt !== null && !isUnderAttackAt(z, now)) ids.push(z.id);
  return ids.sort().join(',');
}

/** Cidade mais frequente entre as zonas da área visível (o servidor manda a cidade de cada zona). */
export function mapCityOf(ids: readonly string[], meta: Readonly<Record<string, { city?: string | null } | undefined>>): string | null {
  const n = new Map<string, number>();
  for (const id of ids) {
    const c = meta[id]?.city?.trim();
    if (c) n.set(c, (n.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [c, k] of n) if (best === null || k > (n.get(best) ?? 0)) best = c;
  return best;
}
