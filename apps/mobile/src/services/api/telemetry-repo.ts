/**
 * Telemetria opt-in (E7, T7.3.6; D-82): consentimento registrado e envio em lote. Contrato da E9
 * (`docs/API_CONTRATO.md`, "Telemetria opt-in"):
 *
 * - `my_telemetry_consent()` → `{ optedIn, policyVersion, enabled }` (`enabled` = flag `features.telemetry`);
 * - `set_telemetry_consent(p_opt_in, p_policy_version)` → `{ optedIn, policyVersion, deletedEvents }`
 *   (retirar apaga na hora os eventos da pessoa);
 * - `track_events(p_events)` → `{ accepted, dropped }`; 1 a 50 `{ event, day?, props?, appVersion?, platform? }`;
 *   recusa com `TELEMETRY_CONSENT` (sem consentimento), `FEATURE_DISABLED` ou `VALIDATION` (lote inteiro).
 *
 * Servidor antigo (`PGRST202`), flag desligada (`FEATURE_DISABLED` ou `enabled = false`) não é erro: vira
 * `{ available: false }` e o ajuste mostra "ainda não disponível". Quem decide **se** pode enviar é
 * `features/engagement/telemetry.ts`; aqui só se fala com o servidor.
 */
import { asMaybe, type Maybe } from './engagement-repo';
import { attempt, ok, type Result } from './errors';
import { requireSupabase } from './supabase';

export type TelemetryConsent = {
  optIn: boolean;
  /** Versão da política aceita (1 quando a pessoa nunca decidiu). */
  policyVersion: number;
  /** Quando a pessoa decidiu neste aparelho (ms); o servidor não devolve a data. */
  decidedAt: number | null;
  /** Eventos apagados no servidor ao retirar o consentimento. */
  deletedEvents: number | null;
};

type Row = Record<string, unknown>;

/** Evento como viaja (lista fechada e propriedades permitidas em `features/engagement/telemetry-model`). */
export type TelemetryWireEvent = { event: string; day: string; props?: Readonly<Record<string, string | number | boolean>>; platform?: string };

const obj = (data: unknown): Row => (data && typeof data === 'object' && !Array.isArray(data) ? (data as Row) : {});

/** Leitura tolerante. Na dúvida, desligado: `optIn` só é verdadeiro quando o servidor diz `true`. */
export function parseConsent(data: unknown, decidedAt: number | null = null): TelemetryConsent {
  const d = obj(data);
  return {
    optIn: d.optedIn === true,
    policyVersion: typeof d.policyVersion === 'number' ? d.policyVersion : 1,
    decidedAt,
    deletedEvents: typeof d.deletedEvents === 'number' ? d.deletedEvents : null,
  };
}

export async function fetchTelemetryConsent(): Promise<Result<Maybe<TelemetryConsent>>> {
  const res = asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('my_telemetry_consent');
      if (error) throw error;
      return data as unknown;
    }),
  );
  if (!res.ok || !res.data.available) return res as Result<Maybe<TelemetryConsent>>;
  // Flag do servidor desligada: o ajuste aparece como "ainda não disponível" e nada é enviado.
  if (obj(res.data.data).enabled === false) return ok({ available: false, reason: 'disabled' });
  return ok({ available: true, data: parseConsent(res.data.data) });
}

/** Registra a decisão (LGPD: quem, quando e qual versão da política). Retirar apaga os eventos já enviados. */
export async function setTelemetryConsent(optIn: boolean, policyVersion: number, now: number = Date.now()): Promise<Result<Maybe<TelemetryConsent>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('set_telemetry_consent', { p_opt_in: optIn, p_policy_version: policyVersion });
      if (error) throw error;
      return parseConsent(data, now);
    }),
  );
}

export type TelemetryBatchResult = { accepted: number; dropped: number };

/** Envia um lote. Só é chamado com o consentimento ligado. */
export async function sendTelemetryEvents(events: readonly TelemetryWireEvent[]): Promise<Result<Maybe<TelemetryBatchResult>>> {
  return asMaybe(
    await attempt(async () => {
      const { data, error } = await requireSupabase().rpc('track_events', { p_events: events });
      if (error) throw error;
      const d = obj(data);
      return { accepted: typeof d.accepted === 'number' ? d.accepted : 0, dropped: typeof d.dropped === 'number' ? d.dropped : 0 };
    }),
  );
}
