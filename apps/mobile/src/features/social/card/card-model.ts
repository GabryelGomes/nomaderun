/**
 * T7.1.9 — dados da corrida → modelo do card (puro, sem React). O modelo já traz os textos prontos
 * (pt-BR, sem hora do dia) e a rota como `SharedRoute` (só o corte do domain produz esse tipo).
 *
 * Regras de privacidade que valem aqui:
 *  - data sem hora ("QUINTA · 23 OUT · GOIÂNIA"): a hora entrega a rotina;
 *  - cidade e @ só quando a pessoa deixa (`showCity`, `showUsername`);
 *  - baús nunca aparecem no card (revelariam a área: pedido da E7);
 *  - rota `noRoute`, ou desligada pela pessoa, vira a arte "sem rota".
 */
import { formatDuration, formatKm, formatPace, paceSecPerKm } from '@/domain/geo';
import type { SharedRoute } from '@/domain/share-privacy';
import type { FactionId } from '@/domain/types';
import { factions } from '@/theme/tokens';

import type { CardRoute } from './card-route';

export type CardKind = 'run' | 'zone' | 'level' | 'boss' | 'week';
export type ShareCardFormat = 'stories' | 'feed';

/** Data local da corrida (sem hora). `month` de 1 a 12. */
export type CardDate = { year: number; month: number; day: number };

export type CardRunStatus = 'valid' | 'partial' | 'review' | 'rejected' | 'provisional';

export type CardZone = {
  name: string;
  outcome: 'conquered' | 'defended' | 'influence' | 'none';
  ownerBefore: FactionId | null;
  ownerAfter: FactionId | null;
  /** Pontos da zona nesta corrida. */
  rp: number;
};

export type CardLevel = {
  /** Nível alcançado nesta corrida. */
  reached: number;
  xpToNext: number;
  /** Progresso já feito rumo ao próximo nível, de 0 a 1. */
  progressToNext: number;
  totals: { meters: number; zones: number; runs: number };
};

export type CardBoss = {
  name: string;
  defeated: boolean;
  myDamageMeters: number;
  cityName: string;
  cityMeters: number;
  days: number;
  crew?: { name: string; rank: number; meters: number } | null;
};

/** O que o card de uma corrida precisa (vem do resumo oficial ou provisório). */
export type ShareRunInput = {
  status: CardRunStatus;
  faction: FactionId;
  meters: number;
  movingSeconds: number;
  points: number;
  date: CardDate;
  city?: string | null;
  username?: string | null;
  zones: readonly CardZone[];
  level?: CardLevel | null;
  boss?: CardBoss | null;
  route: SharedRoute;
  isDemo: boolean;
};

/** O que o recap semanal precisa. `dayMeters` vai de segunda (0) a domingo (6). */
export type ShareWeekInput = {
  faction: FactionId;
  weekStart: CardDate;
  dayMeters: readonly number[];
  runs: number;
  movingSeconds: number;
  zones: number;
  streakWeeks: number;
  /** Até 3 rotas da semana, já cortadas (no aparelho ou no servidor: `CardRoute`). */
  routes: readonly CardRoute[];
  city?: string | null;
  username?: string | null;
  isDemo: boolean;
};

/** Escolhas da pessoa na tela de compartilhar. */
export type CardChoices = { withRoute: boolean; showCity: boolean; showUsername: boolean };

export const DEFAULT_CARD_CHOICES: CardChoices = { withRoute: true, showCity: true, showUsername: false };

type CardBase = {
  faction: FactionId;
  isDemo: boolean;
  /** Ex.: "QUINTA · 23 OUT · GOIÂNIA". */
  dateLabel: string;
  /** "@gabryel" quando a pessoa deixa mostrar. */
  username: string | null;
  /** "PROVISÓRIO" / "EM REVISÃO" quando os pontos ainda não são oficiais. */
  statusTag: string | null;
  /** Texto para o leitor de tela. */
  a11yLabel: string;
};

export type RunCardModel = CardBase & {
  kind: 'run';
  /** `null` = desenhar a arte "sem rota". */
  route: SharedRoute | null;
  km: string;
  time: string;
  pace: string;
  /** "+183"; `null` quando os pontos ainda não são oficiais. */
  points: string | null;
  /** "1 zona conquistada · 3 reforçadas"; `null` sem zona. */
  zonesChip: string | null;
};

export type ZoneCardModel = CardBase & {
  kind: 'zone';
  route: SharedRoute | null;
  zoneName: string;
  from: FactionId | null;
  to: FactionId;
  points: string;
  /** "2,02 km · 10:29 · 5:12 /km". */
  statsLine: string;
};

export type LevelCardModel = CardBase & {
  kind: 'level';
  level: number;
  headline: string;
  next: string;
  progress: number;
  totals: readonly { value: string; label: string }[];
};

export type BossCardModel = CardBase & {
  kind: 'boss';
  bossName: string;
  cityLine: string;
  damage: string;
  crewChip: string | null;
};

export type WeekCardModel = CardBase & {
  kind: 'week';
  rangeLabel: string;
  km: string;
  bars: readonly { day: string; meters: number; label: string }[];
  totals: readonly { value: string; label: string }[];
  streakChip: string | null;
  /** Rotas com algo visível (no máximo 3); vazio = só barras e números. */
  routes: readonly CardRoute[];
};

export type CardModel = RunCardModel | ZoneCardModel | LevelCardModel | BossCardModel | WeekCardModel;

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEKDAYS = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const DAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Dia da semana (0 = domingo) pelo algoritmo de Sakamoto, sem relógio nem fuso. */
export function weekdayOf({ year, month, day }: CardDate): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7;
}

function addDays({ year, month, day }: CardDate, days: number): CardDate {
  const dim = (y: number, m: number) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  let y = year;
  let m = month;
  let d = day + days;
  while (d > dim(y, m)) {
    d -= dim(y, m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return { year: y, month: m, day: d };
}

const upper = (s: string) => s.toUpperCase();
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "QUINTA · 23 OUT · GOIÂNIA" (a cidade só quando a pessoa deixa). */
export function cardDateLabel(date: CardDate, city: string | null | undefined, showCity: boolean): string {
  const parts = [WEEKDAYS[weekdayOf(date)], `${date.day} ${MONTHS[date.month - 1]}`];
  const c = clean(city);
  if (showCity && c) parts.push(upper(c));
  return parts.join(' · ');
}

/** Inteiro com ponto de milhar (pt-BR): 3600 → "3.600". */
export function formatThousands(n: number): string {
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r < 0 ? `-${s}` : s;
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${formatThousands(n)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1h04" para resumos (tempo em movimento da semana); "52 min" abaixo de 1 hora. */
function hoursLabel(seconds: number): string {
  const min = Math.max(0, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** Leitura de duração para o leitor de tela: "10 minutos e 29 segundos". */
function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [h ? plural(h, 'hora', 'horas') : '', m ? plural(m, 'minuto', 'minutos') : '', sec || (!h && !m) ? plural(sec, 'segundo', 'segundos') : ''].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0];
}

function statusTag(status: CardRunStatus): string | null {
  if (status === 'provisional') return 'PROVISÓRIO';
  if (status === 'review') return 'EM REVISÃO';
  return null;
}

const officialPoints = (status: CardRunStatus) => status === 'valid' || status === 'partial';

function base(input: { faction: FactionId; isDemo: boolean; city?: string | null; username?: string | null }, date: CardDate, choices: CardChoices, status: CardRunStatus): Omit<CardBase, 'a11yLabel'> {
  const user = clean(input.username).replace(/^@+/, '');
  return {
    faction: input.faction,
    isDemo: input.isDemo,
    dateLabel: cardDateLabel(date, input.city, choices.showCity),
    username: choices.showUsername && user ? `@${user}` : null,
    statusTag: statusTag(status),
  };
}

const routeFor = (route: SharedRoute, choices: CardChoices) => (choices.withRoute && route.mode === 'route' ? route : null);

function zonesChip(zones: readonly CardZone[]): string | null {
  const conquered = zones.filter((z) => z.outcome === 'conquered').length;
  const reinforced = zones.filter((z) => z.outcome === 'defended' || z.outcome === 'influence').length;
  if (conquered && reinforced) return `${plural(conquered, 'zona conquistada', 'zonas conquistadas')} · ${reinforced} ${reinforced === 1 ? 'reforçada' : 'reforçadas'}`;
  if (conquered) return plural(conquered, 'zona conquistada', 'zonas conquistadas');
  if (reinforced) return plural(reinforced, 'zona reforçada', 'zonas reforçadas');
  return null;
}

function runStats(input: ShareRunInput) {
  const pace = paceSecPerKm(input.meters, input.movingSeconds);
  return { km: formatKm(input.meters), time: formatDuration(input.movingSeconds), pace: formatPace(pace) };
}

function spokenRun(input: ShareRunInput): string {
  const pace = formatPace(paceSecPerKm(input.meters, input.movingSeconds));
  return `${formatKm(input.meters)} quilômetros, ${spokenDuration(input.movingSeconds)}, ritmo ${pace} por quilômetro`;
}

export function buildRunCard(input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): RunCardModel {
  const stats = runStats(input);
  const chip = zonesChip(input.zones);
  const points = officialPoints(input.status) ? signed(input.points) : null;
  const tail = [points ? `${points} pontos` : '', chip ?? ''].filter(Boolean).join(', ');
  return {
    ...base(input, input.date, choices, input.status),
    kind: 'run',
    route: routeFor(input.route, choices),
    ...stats,
    points,
    zonesChip: chip,
    a11yLabel: `Card de corrida: ${spokenRun(input)}${tail ? `, ${tail}` : ''}.`,
  };
}

/** A zona do card de conquista: a de mais pontos entre as conquistadas. `null` se nenhuma foi conquistada. */
export function featuredZone(zones: readonly CardZone[]): CardZone | null {
  const conquered = zones.filter((z) => z.outcome === 'conquered' && z.ownerAfter);
  if (!conquered.length) return null;
  return conquered.reduce((best, z) => (z.rp > best.rp ? z : best));
}

export function buildZoneCard(input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): ZoneCardModel | null {
  const zone = featuredZone(input.zones);
  if (!zone || !zone.ownerAfter) return null;
  const stats = runStats(input);
  const from = zone.ownerBefore && zone.ownerBefore !== zone.ownerAfter ? zone.ownerBefore : null;
  const name = clean(zone.name) || 'Zona';
  return {
    ...base(input, input.date, choices, input.status),
    kind: 'zone',
    route: routeFor(input.route, choices),
    zoneName: name,
    from,
    to: zone.ownerAfter,
    points: signed(zone.rp),
    statsLine: `${stats.km} km · ${stats.time} · ${stats.pace} /km`,
    a11yLabel: `Card de zona conquistada: ${name}${from ? `, tomada de ${factions[from].name}` : ''} para ${factions[zone.ownerAfter].name}, ${signed(zone.rp)} pontos. ${spokenRun(input)}.`,
  };
}

export function buildLevelCard(input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): LevelCardModel | null {
  const lv = input.level;
  if (!lv || lv.reached < 1) return null;
  const progress = Math.min(1, Math.max(0, lv.progressToNext));
  return {
    ...base(input, input.date, choices, input.status),
    kind: 'level',
    level: lv.reached,
    headline: `Cheguei ao nível ${lv.reached}`,
    next: `Faltam ${formatThousands(lv.xpToNext)} XP para o nível ${lv.reached + 1}`,
    progress,
    totals: [
      { value: formatThousands(lv.totals.meters / 1000), label: 'KM NO TOTAL' },
      { value: formatThousands(lv.totals.zones), label: 'ZONAS' },
      { value: formatThousands(lv.totals.runs), label: 'CORRIDAS' },
    ],
    a11yLabel: `Card de nível novo: cheguei ao nível ${lv.reached}. Faltam ${formatThousands(lv.xpToNext)} XP para o próximo.`,
  };
}

export function buildBossCard(input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): BossCardModel | null {
  const boss = input.boss;
  if (!boss || !boss.defeated || boss.myDamageMeters <= 0) return null;
  const damage = formatKm(boss.myDamageMeters, 1);
  const crew = boss.crew ? `${clean(boss.crew.name)} · ${boss.crew.rank}º lugar · ${formatThousands(boss.crew.meters / 1000)} km` : null;
  const city = clean(boss.cityName) || 'A cidade';
  return {
    ...base(input, input.date, choices, input.status),
    kind: 'boss',
    bossName: clean(boss.name),
    cityLine: `${city} correu ${formatThousands(boss.cityMeters / 1000)} km em ${plural(boss.days, 'dia', 'dias')}`,
    damage,
    crewChip: crew,
    a11yLabel: `Card de chefão derrotado: ${clean(boss.name)}. Meu dano: ${damage} quilômetros.`,
  };
}

export function buildWeekCard(input: ShareWeekInput, choices: CardChoices = DEFAULT_CARD_CHOICES): WeekCardModel {
  const end = addDays(input.weekStart, 6);
  const sameMonth = end.month === input.weekStart.month;
  const rangeLabel = sameMonth
    ? `${input.weekStart.day} – ${end.day} ${MONTHS[end.month - 1]}`
    : `${input.weekStart.day} ${MONTHS[input.weekStart.month - 1]} – ${end.day} ${MONTHS[end.month - 1]}`;
  const days = Array.from({ length: 7 }, (_, i) => Math.max(0, input.dayMeters[i] ?? 0));
  const total = days.reduce((s, m) => s + m, 0);
  const routes = choices.withRoute ? input.routes.filter((r) => r.mode === 'route').slice(0, 3) : [];
  return {
    ...base(input, input.weekStart, choices, 'valid'),
    dateLabel: rangeLabel,
    kind: 'week',
    rangeLabel,
    km: formatKm(total, 1),
    bars: days.map((m, i) => ({ day: DAY_LETTERS[i], meters: m, label: m > 0 ? formatKm(m, 1) : '' })),
    totals: [
      { value: formatThousands(input.runs), label: input.runs === 1 ? 'CORRIDA' : 'CORRIDAS' },
      { value: hoursLabel(input.movingSeconds), label: 'EM MOVIMENTO' },
      { value: formatThousands(input.zones), label: input.zones === 1 ? 'ZONA' : 'ZONAS' },
    ],
    streakChip: input.streakWeeks >= 2 ? `Sequência de ${input.streakWeeks} semanas` : null,
    routes,
    a11yLabel: `Card da semana ${rangeLabel}: ${formatKm(total, 1)} quilômetros em ${plural(input.runs, 'corrida', 'corridas')}.`,
  };
}

/** Monta o modelo de um tipo de card da corrida (`null` quando os dados não sustentam esse tipo). */
export function buildCardModel(kind: Exclude<CardKind, 'week'>, input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): CardModel | null {
  switch (kind) {
    case 'run':
      return buildRunCard(input, choices);
    case 'zone':
      return buildZoneCard(input, choices);
    case 'level':
      return buildLevelCard(input, choices);
    case 'boss':
      return buildBossCard(input, choices);
  }
}
