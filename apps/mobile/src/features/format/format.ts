/**
 * Formatos únicos da interface (regra 2 da Fase 8: "um dado, uma forma"). Toda tela que mostra XP, pontos, nível,
 * prazo de defesa ou "há quanto tempo" passa por aqui, para o mesmo número sair igual em todo lugar:
 *  - XP: "+1.130 XP"; pontos: "+81 pontos" / "1.130 pontos"; nível: "Nível 5";
 *  - prazo de defesa na tela: "Faltam 17 h 30 min" (contagem); "até 02h30" (horário) só nos avisos;
 *  - dado salvo: "há 2 h" (D-95); sem dado: "—", nunca "0".
 * Puro e sem `Intl` (o mesmo resultado no Hermes, na web e no Jest). Horário em Brasília (sem horário de verão
 * desde 2019, a mesma regra de `brtCalendar` no domain).
 */

/** Traço de "sem dado" (D-95): offline, erro ou carregando nunca mostram um zero que pareça verdade. */
export const NO_DATA = '—';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const BRT_OFFSET = 3 * HOUR;

/** Inteiro com separador de milhar pt-BR: 1130 → "1.130"; −2500 → "−2.500" (arredonda). */
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return NO_DATA;
  const r = Math.round(n);
  const digits = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r < 0 ? `−${digits}` : digits;
}

/** Com "+" no ganho (zero e negativo saem sem "+"): 1130 → "+1.130". */
export function signedInt(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${formatInt(r)}` : formatInt(r);
}

/** XP ganho ou total: "+1.130 XP" (padrão, ganho) ou "1.130 XP" (`signed: false`, total acumulado). */
export function formatXp(n: number, { signed = true }: { signed?: boolean } = {}): string {
  return `${signed ? signedInt(n) : formatInt(n)} XP`;
}

/** Pontos de território: "+81 pontos", "+1 ponto", "1.130 pontos" (`signed: false`). Nunca "pts". */
export function formatPoints(n: number, { signed = true }: { signed?: boolean } = {}): string {
  const r = Math.round(n);
  return `${signed ? signedInt(r) : formatInt(r)} ${Math.abs(r) === 1 ? 'ponto' : 'pontos'}`;
}

/** "Nível 5". */
export function formatLevel(level: number): string {
  return `Nível ${Math.max(1, Math.round(level))}`;
}

/**
 * Tempo que falta, por extenso curto: "17 h 30 min", "2 h", "45 min", "menos de 1 min". Arredonda para baixo
 * (nunca promete mais tempo do que há). Zero ou negativo = "0 min".
 */
export function formatTimeLeft(ms: number): string {
  if (!(ms > 0)) return '0 min';
  if (ms < MIN) return 'menos de 1 min';
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Prazo de defesa na tela: "Faltam 17 h 30 min", "Falta 1 min", "Falta menos de 1 min"; acabado: "Prazo encerrado". */
export function formatCountdown(endsAt: number, now: number): string {
  const left = endsAt - now;
  if (!(left > 0)) return 'Prazo encerrado';
  const text = formatTimeLeft(left);
  const singular = text === '1 min' || text === '1 h' || text.startsWith('menos');
  return `${singular ? 'Falta' : 'Faltam'} ${text}`;
}

/** Horário em Brasília no formato dos avisos: "02h30". */
export function formatClock(atMs: number): string {
  const b = new Date(atMs - BRT_OFFSET);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(b.getUTCHours())}h${pad(b.getUTCMinutes())}`;
}

/** Prazo por horário, só para avisos (notificação, alerta curto): "até 02h30". */
export function formatUntil(atMs: number): string {
  return `até ${formatClock(atMs)}`;
}

/**
 * Há quanto tempo o dado foi salvo (D-95): "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias". Sem data:
 * `null` (a tela diz só "último salvo", sem inventar hora).
 */
export function formatAgo(at: number | null | undefined, now: number): string | null {
  if (at === null || at === undefined || !Number.isFinite(at)) return null;
  const d = Math.max(0, now - at);
  if (d < MIN) return 'agora';
  if (d < HOUR) return `há ${Math.floor(d / MIN)} min`;
  if (d < DAY) return `há ${Math.floor(d / HOUR)} h`;
  if (d < 2 * DAY) return 'ontem';
  return `há ${Math.floor(d / DAY)} dias`;
}

/** Valor ou traço (D-95): `known` falso (offline, erro, carregando sem dado) vira "—", nunca "0". */
export function orDash(known: boolean, value: string): string {
  return known ? value : NO_DATA;
}

/**
 * Nome da zona na tela (UX-29, regra 2): "Jardim Goiás · perto do Estádio", sem o número que o servidor usa como
 * id ("Jardim Goiás 59", "Setor Pedro Ludovico 35/36"). Sem nome: "Zona".
 */
export function zoneDisplayName(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/\s+\d+(?:\/\d+)?$/, '').trim();
  return clean || 'Zona';
}
