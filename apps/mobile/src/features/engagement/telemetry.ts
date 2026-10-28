/**
 * Telemetria opt-in (E7, T7.3.6; D-82): consentimento e fila de eventos.
 *
 * Regras (testadas em `__tests__/telemetry.test.ts`):
 * - **desligada por padrão**: sem o consentimento lido do servidor com `optIn = true`, `trackTelemetry` não
 *   guarda nada (o evento é descartado na hora, não fica esperando);
 * - **lista fechada** e propriedades filtradas (`telemetry-model.ts`);
 * - **envio em lote**: a fila sai ao chegar a 10, no `flushTelemetry()` (sincronização, resumo) ou quando o
 *   app vai para o segundo plano; no máximo 20 por envio e 50 na fila;
 * - **desligar** esvazia a fila antes de avisar o servidor, e o servidor apaga o que já recebeu. Se o aviso
 *   falhar, o aparelho continua desligado e tenta de novo na próxima leitura (nunca volta a ligar sozinho);
 * - troca de conta zera a fila.
 */
import { AppState, type NativeEventSubscription } from 'react-native';

import { brtCalendar } from '@/domain/progression';
import { AppError, fail, ok, type Result } from '@/services/api/errors';
import * as repo from '@/services/api/telemetry-repo';
import { selectTelemetryOn, useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import {
  enqueue,
  sanitizeEvent,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_CONSENT_VERSION,
  TELEMETRY_FLUSH_AT,
  TELEMETRY_QUEUE_MAX,
  type TelemetryEvent,
  type TelemetryEventName,
} from './telemetry-model';

const currentUser = () => {
  const s = useSession.getState();
  return s.status === 'signedIn' ? (s.session?.userId ?? null) : null;
};

let queue: TelemetryEvent[] = [];
let owner: string | null = null;
let flushing: Promise<void> | null = null;
/** Pessoa que desligou e cujo aviso ao servidor ainda não foi confirmado. */
let pendingRevoke: string | null = null;
let openedDay: { user: string; day: string } | null = null;
let appState: NativeEventSubscription | null = null;

/** Pode enviar agora: conta logada, consentimento dela lido do servidor e ligado, sem desligamento pendente. */
export function telemetryAllowed(): boolean {
  const uid = currentUser();
  const s = useEngagement.getState();
  return !!uid && s.userId === uid && pendingRevoke !== uid && selectTelemetryOn(s);
}

function clearQueue() {
  queue = [];
}

function listenAppState() {
  if (appState) return;
  try {
    appState = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') void flushTelemetry();
    });
  } catch {
    appState = null; // ambiente sem AppState (testes de node): o envio sai pelos outros gatilhos
  }
}

/**
 * Registra um evento da lista fechada. Devolve `false` (e não guarda nada) sem consentimento.
 * `app_open` conta 1 vez por dia (horário de Brasília).
 */
export function trackTelemetry(name: TelemetryEventName, props?: Readonly<Record<string, unknown>>, now: number = Date.now()): boolean {
  if (!telemetryAllowed()) return false;
  const uid = currentUser()!;
  const ev = sanitizeEvent({ name, at: now, props });
  if (!ev) return false;
  if (owner !== uid) {
    clearQueue();
    owner = uid;
  }
  if (name === 'app_open') {
    const day = brtCalendar.clock(now).dayId;
    if (openedDay?.user === uid && openedDay.day === day) return false;
    openedDay = { user: uid, day };
  }
  queue = enqueue(queue, ev);
  listenAppState();
  if (queue.length >= TELEMETRY_FLUSH_AT) void flushTelemetry();
  return true;
}

/** Envia o que está na fila (em lotes de até 20). Sem consentimento, só esvazia. */
export function flushTelemetry(): Promise<void> {
  if (flushing) return flushing;
  if (!telemetryAllowed() || owner !== currentUser()) {
    clearQueue();
    return Promise.resolve();
  }
  if (queue.length === 0) return Promise.resolve();
  flushing = (async () => {
    try {
      while (queue.length > 0 && telemetryAllowed()) {
        const batch = queue.slice(0, TELEMETRY_BATCH_MAX);
        queue = queue.slice(batch.length);
        const res = await repo.sendTelemetryEvents(batch);
        if (res.ok && res.data.available) continue;
        if (res.ok) {
          // Servidor sem telemetria (flag desligada): nada fica guardado no aparelho.
          clearQueue();
          break;
        }
        if (res.error.detail === 'TELEMETRY_OFF') {
          // O servidor não tem o consentimento (desligado em outro aparelho): desliga aqui também.
          clearQueue();
          void loadTelemetryConsent();
          break;
        }
        if (res.error.code === 'NETWORK' && telemetryAllowed()) queue = [...batch, ...queue].slice(0, TELEMETRY_QUEUE_MAX);
        break;
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Lê o consentimento da conta logada (desligado até o servidor dizer o contrário). */
export async function loadTelemetryConsent(): Promise<void> {
  const uid = currentUser();
  if (!uid) return;
  if (pendingRevoke === uid) {
    await setTelemetryOptIn(false);
    return;
  }
  useEngagement.getState().setUser(uid);
  useEngagement.getState().setLoading('telemetry');
  const res = await repo.fetchTelemetryConsent();
  if (useEngagement.getState().userId !== uid || currentUser() !== uid) return;
  if (!res.ok) useEngagement.getState().setError('telemetry', res.error);
  else if (!res.data.available) useEngagement.getState().setUnavailable('telemetry', res.data.reason);
  else useEngagement.getState().setReady('telemetry', res.data.data);
  if (!selectTelemetryOn(useEngagement.getState())) clearQueue();
}

/**
 * Liga ou desliga (consentimento livre, informado e revogável, LGPD art. 8º). Desligar esvazia a fila **antes**
 * de falar com o servidor; se o servidor não responder, o aparelho fica desligado mesmo assim.
 */
export async function setTelemetryOptIn(optIn: boolean, now: number = Date.now()): Promise<Result<repo.TelemetryConsent>> {
  const uid = currentUser();
  if (!uid) return fail(new AppError('UNAUTHORIZED', 'Entre de novo para mudar esta opção.'));
  const s = useEngagement.getState();
  if (!optIn) {
    clearQueue();
    pendingRevoke = uid;
    const prev = s.telemetry.data;
    s.setReady('telemetry', { optIn: false, version: prev?.version ?? null, decidedAt: now, retentionDays: prev?.retentionDays ?? repo.DEFAULT_RETENTION_DAYS });
  }
  const res = await repo.setTelemetryConsent(optIn, TELEMETRY_CONSENT_VERSION);
  if (currentUser() !== uid) return fail(new AppError('UNAUTHORIZED', 'A conta mudou. Tente de novo.'));
  if (!res.ok) return res;
  if (!res.data.available) {
    if (!optIn) pendingRevoke = null; // servidor sem telemetria: não há nada guardado lá
    useEngagement.getState().setUnavailable('telemetry', res.data.reason);
    return fail(new AppError('SERVER', 'Esta opção ainda não está disponível no servidor.', { detail: 'FEATURE_DISABLED' }));
  }
  if (!optIn) pendingRevoke = null;
  useEngagement.getState().setReady('telemetry', res.data.data);
  if (optIn) {
    owner = uid;
    openedDay = null;
  }
  return ok(res.data.data);
}

/** Só para testes: zera a fila e os marcadores do módulo. */
export function resetTelemetryForTests() {
  queue = [];
  owner = null;
  flushing = null;
  pendingRevoke = null;
  openedDay = null;
}

/** Só para testes: o que está na fila. */
export function telemetryQueue(): readonly TelemetryEvent[] {
  return queue;
}
