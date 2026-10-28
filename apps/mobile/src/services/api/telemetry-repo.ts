/**
 * Telemetria opt-in (E7, T7.3.6; D-82): consentimento registrado e envio em lote. Contrato (E7 → E9):
 * `docs/melhoria/relatorios/E7-onda3.md` §4.
 *
 * - `my_telemetry()` → `{ optIn, version, decidedAt, retentionDays, events }`;
 * - `set_telemetry_consent(p_opt_in, p_version)` → o mesmo formato (desligar apaga os eventos da pessoa);
 * - `log_events(p_events)` → `{ accepted, dropped }`; recusa com `TELEMETRY_OFF` sem consentimento.
 *
 * Servidor antigo (`PGRST202`) ou recurso desligado (`FEATURE_DISABLED`) não é erro: vira `{ available: false }`
 * e a tela de ajustes mostra "ainda não disponível". Quem decide **se** pode enviar é
 * `features/engagement/telemetry.ts`; aqui só se fala com o servidor.
 */
import { asMaybe, type Maybe } from './engagement-repo';
import { attempt, type Result } from './errors';
import { requireSupabase } from './supabase';

export type TelemetryConsent = {
  optIn: boolean;
  /** Versão do texto aceito (nula enquanto a pessoa nunca decidiu). */
  version: string | null;
  /** Quando a pessoa decidiu pela última vez (ms; nulo = nunca decidiu, e então está desligado). */
  decidedAt: number | null;
  retentionDays: number;
};

type Row = Record<string, unknown>;

/** Retenção padrão dos eventos brutos (D-82), quando o servidor não informa. */
export const DEFAULT_RETENTION_DAYS = 30;

/** Evento como viaja (a lista fechada e as propriedades permitidas ficam em `features/engagement/telemetry-model`). */
export type TelemetryWireEvent = { name: string; at: number; props: Readonly<Record<string, string | number>> };

const ms = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

/** Leitura tolerante. Na dúvida, desligado: `optIn` só é verdadeiro quando o servidor diz `true`. */
export function parseConsent(data: unknown): TelemetryConsent {
  const d = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Row;
  const days = typeof d.retentionDays === 'number' && d.retentionDays > 0 ? d.retentionDays : DEFAULT_RETENTION_DAYS;
  return {
    optIn: d.optIn === true,
    version: typeof d.version === 'string' && d.version.length > 0 ? d.version : null,
    decidedAt: ms(d.decidedAt),
    retentionDays: days,
  };
}

export async function fetchTelemetryConsent(): Promise<Result<Maybe<TelemetryConsent>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_telemetry');
      if (error) throw error;
      return parseConsent(data);
    }),
  );
}

/** Registra a decisão (LGPD: quem, quando e qual texto). Desligar apaga no servidor os eventos já enviados. */
export async function setTelemetryConsent(optIn: boolean, version: string): Promise<Result<Maybe<TelemetryConsent>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('set_telemetry_consent', { p_opt_in: optIn, p_version: version });
      if (error) throw error;
      return parseConsent(data);
    }),
  );
}

export type TelemetryBatchResult = { accepted: number; dropped: number };

/** Envia um lote (`[{ name, at, props }]`). Só é chamado com o consentimento ligado. */
export async function sendTelemetryEvents(events: readonly TelemetryWireEvent[]): Promise<Result<Maybe<TelemetryBatchResult>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('log_events', { p_events: events.map((e) => ({ name: e.name, at: e.at, props: e.props })) });
      if (error) throw error;
      const d = (data && typeof data === 'object' ? data : {}) as Row;
      return { accepted: typeof d.accepted === 'number' ? d.accepted : 0, dropped: typeof d.dropped === 'number' ? d.dropped : 0 };
    }),
  );
}
