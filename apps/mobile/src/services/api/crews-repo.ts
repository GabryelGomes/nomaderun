import type { FactionId } from '@/domain/types';

import { attempt, type Result } from './errors';
import { getIndividualRanking } from './leaderboard-repo';
import { requireSupabase } from './supabase';
import { isFaction } from './types';

/**
 * Crews (RF-011, RN-011): `crews` (criar com `insert({ name, tag })`), `crew_members` (sair / líder remove),
 * `rpc('join_crew', { p_code })` e `rpc('leave_crew')`. As regras (mesma facção, 1 por pessoa, máx. 30)
 * ficam nos triggers do banco; o app só valida o formato antes.
 */
export const CREW_MAX_MEMBERS = 30;

export type Crew = { id: string; name: string; tag: string; faction: FactionId | null; inviteCode: string; leaderId: string | null };
export type CrewMember = { userId: string; username: string; faction: FactionId | null; avatarUrl: string | null; role: 'leader' | 'member'; rp: number; meters: number };
export type MyCrew = { crew: Crew; members: CrewMember[]; isLeader: boolean };

/** Sigla: 3 a 5 letras sem acento (o banco grava em maiúsculas). */
export function normalizeCrewTag(tag: string): string {
  return tag.trim().toUpperCase();
}

export function validateCrewTag(tag: string): string | null {
  const t = normalizeCrewTag(tag);
  if (!t) return 'Informe a sigla da crew.';
  if (!/^[A-Z]{3,5}$/.test(t)) return 'A sigla precisa ter de 3 a 5 letras, sem números nem acentos.';
  return null;
}

export function validateCrewName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return 'O nome da crew precisa ter pelo menos 3 caracteres.';
  if (n.length > 30) return 'O nome da crew pode ter no máximo 30 caracteres.';
  return null;
}

export function validateInviteCode(code: string): string | null {
  return /^[A-Za-z0-9]{6,12}$/.test(code.trim()) ? null : 'Confira o código de convite (letras e números).';
}

type Row = Record<string, unknown>;

export const toCrew = (r: Row): Crew => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  tag: String(r.tag ?? ''),
  faction: isFaction(r.faction) ? r.faction : null,
  inviteCode: String(r.invite_code ?? ''),
  leaderId: typeof r.leader_id === 'string' ? r.leader_id : null,
});

/** Crew do usuário com membros e o ranking interno da temporada (RP); `null` se não está em nenhuma. */
export async function getMyCrew(userId: string): Promise<Result<MyCrew | null>> {
  return attempt(async () => {
    const supabase = requireSupabase();
    const { data: mine, error: e1 } = await supabase.from('crew_members').select('crew_id').eq('user_id', userId).maybeSingle();
    if (e1) throw e1;
    if (!mine) return null;
    const crewId = String((mine as Row).crew_id);
    const [{ data: crewRow, error: e2 }, { data: memberRows, error: e3 }, { data: profiles, error: e4 }] = await Promise.all([
      supabase.from('crews').select('*').eq('id', crewId).single(),
      supabase.from('crew_members').select('user_id,role,joined_at').eq('crew_id', crewId).order('joined_at'),
      supabase.from('public_profiles').select('id,username,faction,avatar_url').eq('crew_id', crewId),
    ]);
    if (e2) throw e2;
    if (e3) throw e3;
    if (e4) throw e4;
    const crew = toCrew(crewRow as Row);
    const ranking = await getIndividualRanking({ crewTag: crew.tag, limit: CREW_MAX_MEMBERS });
    const rpByUser = new Map((ranking.ok ? ranking.data : []).map((r) => [r.userId, r]));
    const profileById = new Map(((profiles ?? []) as Row[]).map((p) => [String(p.id), p]));
    const members: CrewMember[] = ((memberRows ?? []) as Row[])
      .map((m) => {
        const id = String(m.user_id);
        const p = profileById.get(id) ?? {};
        const r = rpByUser.get(id);
        return {
          userId: id,
          username: typeof p.username === 'string' ? p.username : 'Corredor',
          faction: isFaction(p.faction) ? p.faction : crew.faction,
          avatarUrl: typeof p.avatar_url === 'string' ? p.avatar_url : null,
          role: m.role === 'leader' ? ('leader' as const) : ('member' as const),
          rp: r?.rp ?? 0,
          meters: r?.meters ?? 0,
        };
      })
      .sort((a, b) => b.rp - a.rp || a.username.localeCompare(b.username));
    return { crew, members, isLeader: crew.leaderId === userId };
  });
}

export async function createCrew(name: string, tag: string): Promise<Result<Crew>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase()
      .from('crews')
      .insert({ name: name.trim(), tag: normalizeCrewTag(tag) })
      .select('*')
      .single();
    if (error) throw error;
    return toCrew(data as Row);
  });
}

export async function joinCrew(code: string): Promise<Result<{ crewId: string; name: string; tag: string }>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('join_crew', { p_code: code.trim().toUpperCase() });
    if (error) throw error;
    const d = (data ?? {}) as Row;
    return { crewId: String(d.crewId ?? ''), name: String(d.name ?? ''), tag: String(d.tag ?? '') };
  });
}

/**
 * D-88 — meta semanal de km da crew, oficial do servidor (`rpc('crew_week_goal')`; regra em `domain/crew-goal.ts`).
 * Só totais da crew (km somados e quantos correram), nada por pessoa. `null` = sem crew.
 */
export type CrewWeekGoal = {
  crewId: string;
  /** Segunda-feira da semana (AAAA-MM-DD, Brasília). */
  weekStart: string;
  members: number;
  ran: number;
  meters: number;
  goalMeters: number;
  /** 0 a 1. */
  progress: number;
  reached: boolean;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export async function getCrewWeekGoal(): Promise<Result<CrewWeekGoal | null>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('crew_week_goal');
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const d = data as Row;
    return {
      crewId: String(d.crewId ?? ''),
      weekStart: String(d.weekStart ?? ''),
      members: num(d.members),
      ran: num(d.ran),
      meters: num(d.meters),
      goalMeters: num(d.goalMeters),
      progress: Math.min(1, Math.max(0, num(d.progress))),
      reached: d.reached === true,
    };
  });
}

export async function leaveCrew(): Promise<Result<boolean>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().rpc('leave_crew');
    if (error) throw error;
    return data === true;
  });
}

/** Líder remove um membro (policy `crew_members_delete`). */
export async function removeCrewMember(crewId: string, userId: string): Promise<Result<void>> {
  return attempt(async () => {
    const { error, count } = await requireSupabase().from('crew_members').delete({ count: 'exact' }).eq('crew_id', crewId).eq('user_id', userId);
    if (error) throw error;
    if (count === 0) throw Object.assign(new Error('FORBIDDEN: só o líder pode remover membros'), { code: 'P0001', message: 'FORBIDDEN: só o líder pode remover membros' });
  });
}
