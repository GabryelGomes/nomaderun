/**
 * Planejador puro de notificações locais (Fase 7, E7; D-69). Recebe o estado conhecido, as preferências e
 * `now`; devolve a lista de notificações de engajamento a agendar nos próximos 7 dias. O app cancela e
 * replaneja a cada abertura, sincronização e corrida, então cada aviso fala de um fato que o app sabe.
 *
 * Limites (prompt §5.4 e D-69):
 * - engajamento: no máximo 1 por dia e 4 em quaisquer 7 dias seguidos (1 se as 3 últimas foram ignoradas);
 * - só das 8h às 21h de Brasília (a pessoa pode ampliar o silêncio, nunca reduzir);
 * - nada no dia em que a pessoa já correu;
 * - escada de volta aos 7, 14, 21 e 30 dias sem atividade e depois silêncio total;
 * - cada tipo tem a sua preferência; textos ≤ 60 caracteres e sem culpa.
 */
import type { HealthPause } from './progression';
import { brtCalendar } from './progression';

export const REMINDER_TEXT_MAX = 60;

export type ReminderKind =
  | 'bau'
  | 'sequencia'
  | 'liga'
  | 'missao'
  | 'chefao'
  | 'temporada'
  | 'recap'
  | 'ftue'
  | 'volta'
  | 'invasao'
  | 'conquista'
  | 'moderacao';

/** Chaves de `NotificationPrefs` (as 4 primeiras já existem; ausente = ligada). */
export type ReminderPrefKey =
  | 'invasions'
  | 'conquests'
  | 'missions'
  | 'moderation'
  | 'chests'
  | 'streak'
  | 'league'
  | 'raid'
  | 'season'
  | 'recap'
  | 'comeback';

export type ReminderDef = {
  id: string;
  kind: ReminderKind;
  /** engajamento = entra no orçamento de 1 por dia; jogo = alerta real com limite próprio (servidor). */
  budget: 'engajamento' | 'jogo';
  pref: ReminderPrefKey;
  delivery: 'local' | 'servidor';
  /** Modelo do texto: {x}, {y}, {mes}, {passo}, {zona}. */
  template: string;
};

export const REMINDER_CATALOG: readonly ReminderDef[] = [
  { id: 'n-chefao', kind: 'chefao', budget: 'engajamento', pref: 'raid', delivery: 'servidor', template: 'O chefão está com {x}% de vida. Sua corrida conta!' },
  { id: 'n-liga', kind: 'liga', budget: 'engajamento', pref: 'league', delivery: 'servidor', template: 'A liga fecha hoje: você está a {x} de subir.' },
  { id: 'n-sequencia', kind: 'sequencia', budget: 'engajamento', pref: 'streak', delivery: 'local', template: 'Falta 1 atividade para garantir a semana. Caminhar vale!' },
  { id: 'n-missao', kind: 'missao', budget: 'engajamento', pref: 'missions', delivery: 'local', template: '{x} km para a missão da semana.' },
  { id: 'n-bau', kind: 'bau', budget: 'engajamento', pref: 'chests', delivery: 'local', template: 'Seus 3 baús do dia estão guardados. Uma corrida abre todos.' },
  { id: 'n-ftue', kind: 'ftue', budget: 'engajamento', pref: 'missions', delivery: 'local', template: 'Passo {x} de 7 liberado: {passo}.' },
  { id: 'n-recap', kind: 'recap', budget: 'engajamento', pref: 'recap', delivery: 'local', template: 'Sua semana: {x} km e {y}. Veja o recap.' },
  { id: 'n-temporada', kind: 'temporada', budget: 'engajamento', pref: 'season', delivery: 'local', template: 'Temporada de {mes} começou: trilha nova e troca de time.' },
  { id: 'n-volta-7', kind: 'volta', budget: 'engajamento', pref: 'comeback', delivery: 'local', template: 'Sua missão de volta está pronta: 10 minutos já contam.' },
  { id: 'n-volta-14', kind: 'volta', budget: 'engajamento', pref: 'comeback', delivery: 'local', template: 'Baú raro garantido na sua próxima atividade. Sem pressa.' },
  { id: 'n-volta-14-zona', kind: 'volta', budget: 'engajamento', pref: 'comeback', delivery: 'servidor', template: '{zona} está sob ataque. Bora defender?' },
  { id: 'n-volta-21', kind: 'volta', budget: 'engajamento', pref: 'comeback', delivery: 'local', template: 'Precisa de uma pausa? Sua sequência fica guardada.' },
  { id: 'n-volta-30', kind: 'volta', budget: 'engajamento', pref: 'comeback', delivery: 'local', template: 'Quando quiser voltar, tem um baú lendário te esperando.' },
  { id: 'n-invasao', kind: 'invasao', budget: 'jogo', pref: 'invasions', delivery: 'servidor', template: 'Alerta de invasão! {zona} está sob ataque.' },
  { id: 'n-conquista', kind: 'conquista', budget: 'jogo', pref: 'conquests', delivery: 'servidor', template: 'Você conquistou {x} para o seu time!' },
];

const CATALOG_BY_ID = new Map(REMINDER_CATALOG.map((r) => [r.id, r]));

export const REMINDER_LIMITS = {
  perDay: 1,
  perWeek: 4,
  /** 3 notificações seguidas sem abrir: o orçamento cai para 1 por semana (sinal de que não ajudam). */
  fatigueAfterIgnored: 3,
  fatiguedPerWeek: 1,
  windowStartHour: 8,
  windowEndHour: 21,
  /** Silêncio padrão do jogo (invasão e conquista vão só para a central). */
  quietStartHour: 22,
  quietEndHour: 7,
  horizonDays: 7,
  comebackLadder: [7, 14, 21, 30] as readonly number[],
  ftueDays: 14,
  /** Sem histórico, o "horário habitual" vira 19h (aviso às 18h). */
  defaultUsualHour: 19,
  latestUsualReminderHour: 19,
} as const;

/** Prioridade quando há mais de um aviso no mesmo dia (menor = mais importante). */
const PRIORITY: Readonly<Record<string, number>> = {
  'n-chefao': 0,
  'n-liga': 1,
  'n-sequencia': 2,
  'n-missao': 3,
  'n-bau': 4,
  'n-ftue': 5,
  'n-recap': 6,
  'n-temporada': 7,
  'n-volta-7': 8,
  'n-volta-14': 8,
  'n-volta-14-zona': 8,
  'n-volta-21': 8,
  'n-volta-30': 8,
};

/** Intervalo mínimo entre dois avisos iguais ("1 por semana" contado em 7 dias corridos, não por semana ISO). */
const MIN_DAYS_BETWEEN: Readonly<Record<string, number>> = { 'n-bau': 7 };

/* ---------- Textos ---------- */

/** Palavras de culpa ou pressão proibidas em notificações e missões (checklist anti-culpa, E1 §14). */
export const GUILT_PATTERN =
  /(abandon|decepcion|sumiu|esqueceu|perder tudo|última chance|ultima chance|vai perder|não desista|nao desista|falhou|culpa|vergonha|preguiç|sentimos sua falta)/i;

export function hasGuiltWords(text: string): boolean {
  return GUILT_PATTERN.test(text);
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ZONE_NAME_MAX = 22;

/** Nome de zona com mais de 22 caracteres é cortado com reticências. */
export function shortZoneName(name: string): string {
  const n = name.trim();
  return n.length > ZONE_NAME_MAX ? `${n.slice(0, ZONE_NAME_MAX - 1).trimEnd()}…` : n;
}

function km(meters: number): string {
  const v = Math.max(0, meters) / 1000;
  const shown = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(shown).replace('.', ',');
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export type ReminderVars = {
  x?: number;
  y?: number;
  /** Mês (1..12) da temporada. */
  month?: number;
  /** Texto do passo da primeira semana. */
  step?: string;
  zone?: string;
  /** Distância em metros (missão, recap). */
  meters?: number;
};

function fit(text: string): string {
  return text.length > REMINDER_TEXT_MAX ? `${text.slice(0, REMINDER_TEXT_MAX - 1)}…` : text;
}

/** Texto final de uma notificação do catálogo, com singular e plural tratados e no máximo 60 caracteres. */
export function reminderText(id: string, vars: ReminderVars = {}): string {
  const def = CATALOG_BY_ID.get(id);
  if (!def) return '';
  const x = Math.max(0, Math.round(vars.x ?? 0));
  const y = Math.max(0, Math.round(vars.y ?? 0));
  let text = def.template;
  switch (id) {
    case 'n-liga':
      text = text.replace('{x}', x === 1 ? '1 posição' : `${x} posições`);
      break;
    case 'n-missao': {
      const left = km(vars.meters ?? 0);
      text = text.replace('{x}', `${(vars.meters ?? 0) < 2000 ? 'Falta' : 'Faltam'} ${left}`);
      break;
    }
    case 'n-ftue':
      text = text.replace('{x}', String(x)).replace('{passo}', lowerFirst(vars.step ?? ''));
      break;
    case 'n-recap':
      text = text.replace('{x}', km(vars.meters ?? 0)).replace('{y}', y === 1 ? '1 zona pintada' : `${y} zonas pintadas`);
      break;
    case 'n-temporada':
      text = text.replace('{mes}', MONTHS[Math.min(12, Math.max(1, vars.month ?? 1)) - 1]);
      break;
    case 'n-conquista':
      text = text.replace('{x}', x === 1 ? '1 zona' : `${x} zonas`);
      break;
    default:
      text = text.replace('{x}', String(x)).replace('{zona}', shortZoneName(vars.zone ?? ''));
  }
  return fit(text);
}

/* ---------- Planejador ---------- */

export type ReminderPrefs = Partial<Record<ReminderPrefKey, boolean>> & {
  /** Início do silêncio da pessoa (hora, 9..21). Só amplia o silêncio padrão das 22h. */
  quietStart?: number;
  /** Fim do silêncio da pessoa (hora, 8..21). Só amplia o silêncio padrão até as 7h. */
  quietEnd?: number;
  /** "Pausar lembretes por 7 dias": nada antes deste instante (ms). */
  snoozeUntil?: number | null;
};

export type SentReminder = { id: string; key: string; at: number };

export type ReminderState = {
  createdAt: number;
  lastActivityAt: number | null;
  /** Início (ms) das últimas atividades, para o horário habitual (mediana das 10 mais novas). */
  recentStartTimes: readonly number[];
  /** Semana atual (Brasília). */
  week: { activities: number; meters: number; zones: number };
  /** Semana anterior, para o recap da segunda de manhã. */
  previousWeek?: { activities: number; meters: number; zones: number } | null;
  dailyChestsStored: number;
  /** Missão semanal mais adiantada que ainda está aberta. */
  weeklyMission: { ratio: number; remainingMeters: number } | null;
  /** Próximo passo da primeira semana ainda não feito. */
  ftue: { startedAt: number; step: number; stepText: string; unlocksAt: number } | null;
  pause: HealthPause | null;
  /** Notificações de engajamento já entregues (locais e do servidor). */
  sent: readonly SentReminder[];
  /** Quantas das últimas notificações de engajamento seguidas não foram abertas. */
  ignoredInARow: number;
};

export type PlannedReminder = {
  /** Id do catálogo (`n-bau`…). */
  id: string;
  kind: ReminderKind;
  pref: ReminderPrefKey;
  /** Chave de deduplicação ("1 por semana", "1 por passo", "1 vez por ausência"). */
  key: string;
  /** Identificador estável para o agendador do app. */
  identifier: string;
  at: number;
  text: string;
};

type Candidate = { id: string; key: string; hour: number; minute: number; vars: ReminderVars };

/** Hora habitual (Brasília) da pessoa: mediana das horas de início das 10 atividades mais novas. */
export function usualStartHour(recentStartTimes: readonly number[]): number {
  const hours = recentStartTimes
    .slice(0, 10)
    .map((t) => brtCalendar.clock(t).hour)
    .sort((a, b) => a - b);
  if (hours.length === 0) return REMINDER_LIMITS.defaultUsualHour;
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 ? hours[mid] : Math.floor((hours[mid - 1] + hours[mid]) / 2);
}

/** Silêncio efetivo da pessoa: só vale o que amplia o padrão de 22h às 7h. */
function quietHours(prefs: ReminderPrefs): { start: number; end: number } {
  const L = REMINDER_LIMITS;
  const qs = prefs.quietStart;
  const qe = prefs.quietEnd;
  return {
    start: qs !== undefined && Number.isFinite(qs) && qs >= 9 && qs < L.quietStartHour ? Math.floor(qs) : L.quietStartHour,
    end: qe !== undefined && Number.isFinite(qe) && qe > L.quietEndHour && qe <= L.windowEndHour ? Math.ceil(qe) : L.quietEndHour,
  };
}

/** Janela permitida em minutos do dia: [8h, 21h] fora do silêncio da pessoa. */
function allowedWindow(prefs: ReminderPrefs): { start: number; end: number } {
  const q = quietHours(prefs);
  return {
    start: Math.max(REMINDER_LIMITS.windowStartHour, q.end) * 60,
    end: Math.min(REMINDER_LIMITS.windowEndHour * 60, q.start * 60 - 1),
  };
}

const enabled = (prefs: ReminderPrefs, key: ReminderPrefKey) => prefs[key] !== false;

/**
 * Lista do que agendar agora (ordenada por horário). Nunca devolve mais do que os limites permitem,
 * contando o que já foi entregue em `state.sent`.
 */
export function planReminders(state: ReminderState, prefs: ReminderPrefs, now: number): PlannedReminder[] {
  const L = REMINDER_LIMITS;
  const today = brtCalendar.clock(now).dayId;
  const currentWeek = brtCalendar.weekIdOf(today);
  const win = allowedWindow(prefs);
  if (win.start > win.end) return [];

  const ranToday = state.lastActivityAt !== null && brtCalendar.clock(state.lastActivityAt).dayId === today;
  const anchorDay = brtCalendar.clock(state.lastActivityAt ?? state.createdAt).dayId;
  const everRan = state.lastActivityAt !== null;
  const usualHour = Math.min(L.latestUsualReminderHour, Math.max(L.windowStartHour, usualStartHour(state.recentStartTimes) - 1));
  const perWeek = state.ignoredInARow >= L.fatigueAfterIgnored ? L.fatiguedPerWeek : L.perWeek;

  const usedKeys = new Set(state.sent.map((s) => s.key));
  const taken: string[] = state.sent.map((s) => brtCalendar.clock(s.at).dayId);
  const lastDayById = new Map<string, string>();
  for (const s of state.sent) {
    const d = brtCalendar.clock(s.at).dayId;
    if ((lastDayById.get(s.id) ?? '') < d) lastDayById.set(s.id, d);
  }
  const coolingDown = (id: string, day: string) => {
    const last = lastDayById.get(id);
    return last !== undefined && brtCalendar.daysBetween(last, day) < (MIN_DAYS_BETWEEN[id] ?? 0);
  };
  const plan: PlannedReminder[] = [];

  for (let offset = 0; offset < L.horizonDays; offset++) {
    const day = brtCalendar.addDays(today, offset);
    if (offset === 0 && ranToday) continue;
    if (state.pause && state.pause.from <= day && day <= state.pause.until) continue;
    if (taken.includes(day)) continue;
    const windowStartDay = brtCalendar.addDays(day, -6);
    if (taken.filter((d) => d >= windowStartDay && d <= day).length >= perWeek) continue;

    const clock = brtCalendar.clock(brtCalendar.at(day, 12));
    const daysAway = brtCalendar.daysBetween(anchorDay, day);
    const candidates: Candidate[] = [];

    if (daysAway > 30) continue; // silêncio total até a pessoa voltar
    if (daysAway >= 7) {
      // Longe há 7 dias ou mais: só a escada de volta (para quem já correu alguma vez).
      if (everRan && L.comebackLadder.includes(daysAway)) {
        candidates.push({ id: `n-volta-${daysAway}`, key: `n-volta-${daysAway}:${anchorDay}`, hour: usualHour, minute: 0, vars: {} });
      }
    } else {
      const sameWeek = brtCalendar.weekIdOf(day) === currentWeek;
      if (sameWeek && clock.weekday === 5 && state.week.activities === 1) {
        candidates.push({ id: 'n-sequencia', key: `n-sequencia:${currentWeek}`, hour: usualHour, minute: 0, vars: {} });
      }
      const wm = state.weeklyMission;
      if (sameWeek && (clock.weekday === 4 || clock.weekday === 5) && wm && wm.ratio >= 0.7 && wm.ratio < 1 && wm.remainingMeters > 0) {
        candidates.push({ id: 'n-missao', key: `n-missao:${currentWeek}`, hour: usualHour, minute: 0, vars: { meters: wm.remainingMeters } });
      }
      if (Math.min(3, state.dailyChestsStored + offset) >= 3) {
        candidates.push({ id: 'n-bau', key: `n-bau:${day}`, hour: usualHour, minute: 0, vars: {} });
      }
      const f = state.ftue;
      if (f && brtCalendar.clock(f.unlocksAt).dayId <= day && brtCalendar.daysBetween(brtCalendar.clock(f.startedAt).dayId, day) < L.ftueDays) {
        candidates.push({ id: 'n-ftue', key: `n-ftue:${f.step}`, hour: 9, minute: 0, vars: { x: f.step, step: f.stepText } });
      }
      if (clock.weekday === 0) {
        const recapWeek = offset === 0 ? state.previousWeek : state.week;
        const lastSunday = brtCalendar.addDays(day, -1);
        const fromThisWeek = offset > 0 && brtCalendar.weekIdOf(lastSunday) === currentWeek;
        if (recapWeek && recapWeek.activities >= 1 && (offset === 0 || fromThisWeek)) {
          candidates.push({
            id: 'n-recap',
            key: `n-recap:${brtCalendar.weekIdOf(lastSunday)}`,
            hour: 8,
            minute: 0,
            vars: { meters: recapWeek.meters, y: recapWeek.zones },
          });
        }
      }
      if (clock.day === 1) {
        candidates.push({ id: 'n-temporada', key: `n-temporada:${day.slice(0, 7)}`, hour: 9, minute: 0, vars: { month: Number(day.slice(5, 7)) } });
      }
    }

    const chosen = candidates
      .filter((c) => {
        const def = CATALOG_BY_ID.get(c.id);
        return !!def && enabled(prefs, def.pref) && !usedKeys.has(c.key) && !coolingDown(c.id, day);
      })
      .map((c) => {
        const minutes = Math.min(win.end, Math.max(win.start, c.hour * 60 + c.minute));
        return { c, at: brtCalendar.at(day, Math.floor(minutes / 60), minutes % 60) };
      })
      .filter(({ at }) => at > now && !(prefs.snoozeUntil && at < prefs.snoozeUntil))
      .sort((a, b) => (PRIORITY[a.c.id] ?? 99) - (PRIORITY[b.c.id] ?? 99) || a.at - b.at)[0];
    if (!chosen) continue;

    const def = CATALOG_BY_ID.get(chosen.c.id) as ReminderDef;
    usedKeys.add(chosen.c.key);
    taken.push(day);
    lastDayById.set(def.id, day);
    plan.push({
      id: def.id,
      kind: def.kind,
      pref: def.pref,
      key: chosen.c.key,
      identifier: `eng:${chosen.c.key}`,
      at: chosen.at,
      text: reminderText(def.id, chosen.c.vars),
    });
  }
  return plan.sort((a, b) => a.at - b.at);
}

/* ---------- Alertas de jogo (invasão, conquista) ---------- */

/**
 * Invasão e conquista entre 22h e 7h (ou no silêncio maior da pessoa) ficam só na central, sem banner nem som.
 * Alertas de segurança não passam por aqui.
 */
export function gameAlertMode(at: number, prefs: ReminderPrefs = {}): 'banner' | 'central' {
  const c = brtCalendar.clock(at);
  const minutes = c.hour * 60 + c.minute;
  const q = quietHours(prefs);
  return minutes >= q.start * 60 || minutes < q.end * 60 ? 'central' : 'banner';
}
