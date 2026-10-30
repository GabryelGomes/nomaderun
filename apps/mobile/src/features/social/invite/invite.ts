/**
 * T7.2.5 — convites (F1 §7), parte pura: código, link e texto pronto.
 *
 * No Expo Go o esquema `nomaderun://` não abre o app (o Expo Go usa `exp://`), então o convite é um link
 * HTTPS para a prévia web, com uma página de reserva (`/compartilhar/convite/[codigo]`) que mostra o código
 * para colar em Clube → Crew → "Entrar com código". O domínio é configurável:
 *  - `EXPO_PUBLIC_INVITE_BASE_URL` (ex.: o domínio da prévia na Vercel);
 *  - na web, sem a variável, a origem da própria página;
 *  - no aparelho, sem a variável, não há link: o convite vai só com o código.
 */
import type { FactionId } from '@/domain/types';
import { factions } from '@/theme/tokens';

/** Mesma regra do servidor (`crews.invite_code`, 8 caracteres) e do `validateInviteCode`. */
export const INVITE_CODE_RE = /^[A-Z0-9]{4,12}$/;

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Base do link sem a barra final, ou `null` quando não há domínio configurado. */
export function inviteBaseUrl(configured: string | undefined = process.env.EXPO_PUBLIC_INVITE_BASE_URL, origin: string | null = webOrigin()): string | null {
  const raw = (configured ?? '').trim() || origin || '';
  if (!/^https?:\/\/[^\s/]+/i.test(raw)) return null;
  return raw.replace(/\/+$/, '');
}

function webOrigin(): string | null {
  const loc = (globalThis as { location?: { origin?: string; protocol?: string } }).location;
  return process.env.EXPO_OS === 'web' && loc?.origin && /^https?:$/.test(loc.protocol ?? '') ? loc.origin : null;
}

export const crewInvitePath = (code: string) => `/compartilhar/convite/${encodeURIComponent(normalizeInviteCode(code))}`;

export function crewInviteLink(code: string, base: string | null = inviteBaseUrl()): string | null {
  const c = normalizeInviteCode(code);
  return base && INVITE_CODE_RE.test(c) ? `${base}${crewInvitePath(c)}` : null;
}

export function appInviteLink(base: string | null = inviteBaseUrl()): string | null {
  return base ? `${base}/` : null;
}

/** Cor do time em palavra, para o texto ("pinta Goiânia de azul"). */
export const TEAM_COLOR_WORD: Record<FactionId, string> = { striders: 'azul', volt: 'verde', owls: 'vermelho', coyotes: 'amarelo' };

export type CrewInviteInput = { crewName: string; faction: FactionId | null; code: string; city?: string | null; link?: string | null; isDemo?: boolean };

/** "Bora correr com a {Crew} no NOMADE RUN? A gente pinta {cidade} de {cor}. Entra com o código {CÓDIGO}: {link}" */
export function crewInviteText(i: CrewInviteInput): string {
  const code = normalizeInviteCode(i.code);
  const paint = i.faction ? ` A gente pinta ${i.city?.trim() || 'a cidade'} de ${TEAM_COLOR_WORD[i.faction]} (${factions[i.faction].name}).` : '';
  const link = i.link === undefined ? crewInviteLink(code) : i.link;
  const tail = link ? `Entra com o código ${code}: ${link}` : `Entra com o código ${code} em Clube → Crew → Entrar com código.`;
  return `Bora correr com a ${i.crewName.trim()} no NOMADE RUN?${paint} ${tail}${i.isDemo ? ' (demonstração)' : ''}`;
}

export type AppInviteInput = { place?: string | null; faction?: FactionId | null; link?: string | null; isDemo?: boolean };

/** "Tô dominando {bairro} no NOMADE RUN. Escolhe seu time e vem: {link}" */
export function appInviteText(i: AppInviteInput = {}): string {
  const where = i.place?.trim() ? `Tô dominando ${i.place.trim()} no NOMADE RUN` : 'Tô correndo e pintando a cidade no NOMADE RUN';
  const team = i.faction ? ` com os ${factions[i.faction].name}` : '';
  const link = i.link === undefined ? appInviteLink() : i.link;
  return `${where}${team}. Escolhe seu time e vem${link ? `: ${link}` : '!'}${i.isDemo ? ' (demonstração)' : ''}`;
}
