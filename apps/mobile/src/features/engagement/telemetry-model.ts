/**
 * Telemetria opt-in (E7, T7.3.6; D-82), parte pura: lista fechada de eventos, propriedades permitidas,
 * limites do lote e textos do consentimento. Nada aqui envia; quem envia é `telemetry.ts`, e só com o
 * consentimento registrado.
 *
 * Fora da telemetria, sempre: localização, rota, ritmo, tempo de tela, contatos e texto digitado.
 */
import type { IconName } from '@/components/icon';

/** Os 5 eventos (lista fechada; o servidor recusa qualquer outro nome). */
export const TELEMETRY_EVENTS = ['app_open', 'run_finished', 'zone_conquered', 'share', 'mission_completed'] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

export type TelemetryProps = Readonly<Record<string, string | number>>;

export type TelemetryEvent = { name: TelemetryEventName; at: number; props: TelemetryProps };

/** Retenção dos eventos brutos no servidor (D-82). */
export const TELEMETRY_RETENTION_DAYS = 30;
/** Versão do texto do consentimento (o servidor guarda qual texto a pessoa aceitou). */
export const TELEMETRY_CONSENT_VERSION = 'v1-2026-10';
/** Eventos por envio (o servidor aceita até 50). */
export const TELEMETRY_BATCH_MAX = 20;
/** Fila máxima no aparelho; acima disso, os mais antigos saem (nunca cresce sem limite). */
export const TELEMETRY_QUEUE_MAX = 50;
/** O lote sai sozinho ao chegar a este tamanho; antes disso, sai no próximo envio (app em segundo plano, sincronização). */
export const TELEMETRY_FLUSH_AT = 10;

const CADENCES = ['diaria', 'semanal', 'ftue', 'volta'] as const;

type PropRule = (v: unknown) => string | number | null;

const oneOf =
  (list: readonly string[]): PropRule =>
  (v) =>
    typeof v === 'string' && list.includes(v) ? v : null;

const smallInt =
  (min: number, max: number): PropRule =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min ? Math.min(v, max) : null;

/** Propriedades permitidas por evento: só contagens pequenas e categorias fechadas. */
export const TELEMETRY_PROPS: Readonly<Record<TelemetryEventName, Readonly<Record<string, PropRule>>>> = {
  app_open: {},
  run_finished: {},
  zone_conquered: { count: smallInt(1, 50) },
  share: {},
  mission_completed: { cadence: oneOf(CADENCES) },
};

export const isTelemetryEvent = (v: unknown): v is TelemetryEventName => typeof v === 'string' && (TELEMETRY_EVENTS as readonly string[]).includes(v);

/**
 * Evento pronto para a fila, ou `null` quando o nome não está na lista. Propriedades fora da regra do evento
 * são descartadas em silêncio (nunca viajam).
 */
export function sanitizeEvent(input: { name: unknown; at: number; props?: Readonly<Record<string, unknown>> }): TelemetryEvent | null {
  if (!isTelemetryEvent(input.name) || !Number.isFinite(input.at)) return null;
  const rules = TELEMETRY_PROPS[input.name];
  const props: Record<string, string | number> = {};
  for (const [k, rule] of Object.entries(rules)) {
    const v = rule(input.props?.[k]);
    if (v !== null) props[k] = v;
  }
  return { name: input.name, at: Math.round(input.at), props };
}

/** Junta um evento à fila respeitando o teto (os mais antigos saem primeiro). */
export function enqueue(queue: readonly TelemetryEvent[], ev: TelemetryEvent, max: number = TELEMETRY_QUEUE_MAX): TelemetryEvent[] {
  const next = [...queue, ev];
  return next.length > max ? next.slice(next.length - max) : next;
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
    { key: 'coleta', icon: 'check', title: 'O que coleta', body: 'Só 5 fatos: abriu o app, correu, conquistou zona, compartilhou e concluiu missão.' },
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
