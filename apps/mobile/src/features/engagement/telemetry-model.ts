/**
 * Telemetria opt-in (E7, T7.3.6; D-82), parte pura: lista fechada de eventos, propriedades permitidas,
 * limites do lote e textos do consentimento. Nada aqui envia; quem envia é `telemetry.ts`, e só com o
 * consentimento registrado. Contrato da E9: `track_events` (docs/API_CONTRATO.md, "Telemetria opt-in").
 *
 * O evento viaja só com o **dia** (Brasília), nunca com a hora. Fora da telemetria, sempre: localização,
 * rota, ritmo, tempo de tela, contatos e texto digitado.
 */
import type { IconName } from '@/components/icon';

/** Os 5 eventos (lista fechada do servidor: abrir, correr, conquistar, compartilhar, missão concluída). */
export const TELEMETRY_EVENTS = ['app_open', 'run_finish', 'zone_conquer', 'share', 'mission_complete'] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

export type TelemetryProps = Readonly<Record<string, string | number | boolean>>;

/** Na fila: `at` fica só no aparelho (para descartar evento velho); no envio vira `day`. */
export type TelemetryEvent = { name: TelemetryEventName; at: number; day: string; props: TelemetryProps };

/** Formato do `track_events` (E9). */
export type TelemetryWire = { event: TelemetryEventName; day: string; props?: TelemetryProps; platform?: 'ios' | 'android' | 'web' };

/** Retenção dos eventos brutos no servidor (D-82; `job_telemetry_retention`). */
export const TELEMETRY_RETENTION_DAYS = 30;
/** Versão da política aceita (`p_policy_version`, 1–100). Mudou o texto da folha → sobe a versão. */
export const TELEMETRY_POLICY_VERSION = 1;
/** Eventos por envio (o servidor aceita até 50). */
export const TELEMETRY_BATCH_MAX = 20;
/** Fila máxima no aparelho; acima disso, os mais antigos saem (nunca cresce sem limite). */
export const TELEMETRY_QUEUE_MAX = 50;
/** O lote sai sozinho ao chegar a este tamanho; antes disso, no próximo envio (segundo plano, resumo, abertura). */
export const TELEMETRY_FLUSH_AT = 10;
/** O servidor aceita o dia de hoje ou até 2 dias atrás; mais velho que isso não viaja. */
export const TELEMETRY_MAX_AGE_DAYS = 2;

const CADENCES = ['diaria', 'semanal', 'ftue', 'volta'] as const;

type PropRule = (v: unknown) => string | number | boolean | null;

const oneOf =
  (list: readonly string[]): PropRule =>
  (v) =>
    typeof v === 'string' && list.includes(v) ? v : null;

/** Texto curto no formato que o servidor aceita (`^[a-z0-9_-]{1,32}$`: sem ponto, então sem coordenada). */
const slug: PropRule = (v) => (typeof v === 'string' && /^[a-z0-9_-]{1,32}$/.test(v) ? v : null);

const smallInt =
  (min: number, max: number): PropRule =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min ? Math.min(v, max) : null;

/** Propriedades permitidas por evento (subconjunto das chaves do servidor: `kind`, `missionId`, `count`). */
export const TELEMETRY_PROPS: Readonly<Record<TelemetryEventName, Readonly<Record<string, PropRule>>>> = {
  app_open: {},
  run_finish: {},
  zone_conquer: { count: smallInt(1, 50) },
  share: {},
  mission_complete: { kind: oneOf(CADENCES), missionId: slug },
};

export const isTelemetryEvent = (v: unknown): v is TelemetryEventName => typeof v === 'string' && (TELEMETRY_EVENTS as readonly string[]).includes(v);

/** '2026-10-28' no horário de Brasília. */
export const brtDay = (at: number) => new Date(at - 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Evento pronto para a fila, ou `null` quando o nome não está na lista. Propriedades fora da regra do evento
 * são descartadas em silêncio (nunca viajam).
 */
export function sanitizeEvent(input: { name: unknown; at: number; props?: Readonly<Record<string, unknown>> }): TelemetryEvent | null {
  if (!isTelemetryEvent(input.name) || !Number.isFinite(input.at)) return null;
  const rules = TELEMETRY_PROPS[input.name];
  const props: Record<string, string | number | boolean> = {};
  for (const [k, rule] of Object.entries(rules)) {
    const v = rule(input.props?.[k]);
    if (v !== null) props[k] = v;
  }
  return { name: input.name, at: Math.round(input.at), day: brtDay(input.at), props };
}

/** Junta um evento à fila respeitando o teto (os mais antigos saem primeiro). */
export function enqueue(queue: readonly TelemetryEvent[], ev: TelemetryEvent, max: number = TELEMETRY_QUEUE_MAX): TelemetryEvent[] {
  const next = [...queue, ev];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Só o que o servidor ainda aceita (hoje ou até 2 dias atrás). */
export function freshEvents(queue: readonly TelemetryEvent[], now: number): TelemetryEvent[] {
  const oldest = brtDay(now - TELEMETRY_MAX_AGE_DAYS * 86_400_000);
  const today = brtDay(now);
  return queue.filter((e) => e.day >= oldest && e.day <= today);
}

/** Evento no formato do `track_events` (sem `at`: a hora nunca sai do aparelho). */
export function toWire(e: TelemetryEvent, platform?: string): TelemetryWire {
  const p = platform === 'ios' || platform === 'android' || platform === 'web' ? platform : undefined;
  return { event: e.name, day: e.day, ...(Object.keys(e.props).length ? { props: e.props } : {}), ...(p ? { platform: p } : {}) };
}

/* ---------- Textos do consentimento (D-74: título ≤ 30, frase ≤ 90) ---------- */

export const TELEMETRY_COPY: {
  title: string;
  intro: string;
  sections: readonly { key: string; icon: IconName; title: string; body: string }[];
  why: string;
  accept: string;
  decline: string;
} = {
  title: 'Ajudar a melhorar o app',
  intro: 'Opcional e desligado até você ligar. O jogo funciona igual sem isso.',
  sections: [
    { key: 'coleta', icon: 'check', title: 'O que coleta', body: 'Só 5 fatos e o dia: abriu o app, correu, conquistou, compartilhou, fez missão.' },
    { key: 'nunca', icon: 'eyeOff', title: 'O que nunca coleta', body: 'Localização, rota, ritmo, tempo de tela, contatos ou o que você digita.' },
    { key: 'tempo', icon: 'timer', title: 'Por quanto tempo', body: `Cada evento fica ${TELEMETRY_RETENTION_DAYS} dias no servidor e depois é apagado.` },
    { key: 'desligar', icon: 'close', title: 'Como desligar', body: 'Em Ajustes, a qualquer hora. Ao desligar, apagamos o que foi coletado.' },
  ],
  why: 'Serve para saber se o app ajuda as pessoas a voltar a correr.',
  accept: 'Ligar',
  decline: 'Agora não',
};

/** "28/10/2026" (horário de Brasília). */
export function consentDate(at: number): string {
  const d = new Date(at - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
