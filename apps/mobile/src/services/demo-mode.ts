/**
 * Interruptor do modo demonstração em tempo de execução (D-77, T7.2.10). É a interface do botão
 * "Ver demonstração" e do selo "Demonstração" (E6a):
 *
 *   await enterDemo();   // liga: o app passa a falar só com o servidor em memória
 *   await exitDemo();    // desliga e apaga tudo o que a demonstração deixou no aparelho
 *   isDemoActive();      // build com EXPO_PUBLIC_DEMO=1 ou interruptor ligado
 *   onDemoSwitch(fn);    // avisa a camada de features depois de cada troca (zerar stores, refazer a sessão)
 *
 * Entrar não toca na conta real: a sessão do Supabase continua guardada no SecureStore, e a fila, os caches
 * e a chave HMAC da demonstração usam nomes próprios (D-77). Sair apaga a fila, os caches e a chave da
 * demonstração e descarta o servidor em memória; ao entrar de novo, o mundo recomeça do zero.
 *
 * As stores (Zustand) não são importadas aqui: `src/services` não depende de `src/store` (ARQUITETURA §2).
 * Quem as zera é o ouvinte que a camada de features registra com `onDemoSwitch` (ver `docs/QA.md` §16).
 */
import { DEMO_USER_ID } from '@/demo/world';
import { createDemoClient, setDemoClient, type DemoClient, type DemoScenario } from '@/services/api/demo';
import { env, isDemoMode, setRuntimeDemo } from '@/services/api/env';
import { writeCachedProfile } from '@/services/api/profile-cache';
import { writeCachedZones } from '@/services/api/zones-cache';
import { stopBackgroundUpdates } from '@/services/location/tracker';
import { getQueueStore, setQueueStore } from '@/services/offline/queue';
import { defaultDeviceKeyDeps, storageKey } from '@/services/signing/device-key';
import { setSyncEngine } from '@/services/sync/sync-service';

export type DemoSwitchListener = (active: boolean) => void | Promise<void>;

export type EnterDemoOptions = {
  /** Roteiro do mundo de demonstração (padrão: o da URL na web, `?cenario=`, ou `cheio`). */
  scenario?: DemoScenario;
};

const listeners = new Set<DemoSwitchListener>();
/** Uma troca por vez: tocar duas vezes no botão não intercala limpeza e entrada. */
let chain: Promise<unknown> = Promise.resolve();

/** O modo demonstração está ligado (pelo build ou pelo interruptor). */
export const isDemoActive = () => isDemoMode();

/** Build de demonstração (`EXPO_PUBLIC_DEMO=1`): não há servidor real para onde voltar, `exitDemo` não sai. */
export const isDemoBuild = () => env.demo === true;

/**
 * Avisa depois de cada troca (`true` ao entrar, `false` ao sair), na ordem de registro; ouvintes assíncronos
 * são esperados. Serve também como `subscribe` do `useSyncExternalStore(onDemoSwitch, isDemoActive)`.
 */
export function onDemoSwitch(listener: DemoSwitchListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

/** Zera os singletons de `services/` que guardam o modo: fila, motor do sync e servidor em memória. */
function resetSingletons(nextClient: DemoClient | null) {
  setSyncEngine(null);
  setQueueStore(null);
  setDemoClient(nextClient);
}

async function notify(active: boolean) {
  for (const l of [...listeners]) {
    try {
      await l(active);
    } catch (e) {
      // Um ouvinte com defeito não pode deixar o app meio trocado.
      if (__DEV__) console.warn('[demo-mode] ouvinte falhou na troca do modo demonstração', e);
    }
  }
}

/**
 * Liga o modo demonstração. Devolve `false` se ele já estava ligado (nada muda).
 * Fila, sync e servidor em memória começam do zero; a conta real fica intacta.
 */
export function enterDemo(opts: EnterDemoOptions = {}): Promise<boolean> {
  return serialize(async () => {
    if (isDemoMode()) return false;
    if (__DEV__ && listeners.size === 0) console.warn('[demo-mode] enterDemo sem ouvinte de onDemoSwitch: as stores não serão zeradas.');
    setRuntimeDemo(true);
    resetSingletons(opts.scenario ? createDemoClient({ scenario: opts.scenario }) : null);
    // Sobra de uma demonstração que não saiu direito (app fechado no meio): começa limpa.
    await wipeDemoData();
    await notify(true);
    return true;
  });
}

/**
 * Desliga o modo demonstração e apaga o que ele deixou no aparelho: corridas e pontos da fila da
 * demonstração, caches de zonas e perfil da demonstração, a chave HMAC do corredor de demonstração e o
 * servidor em memória. Devolve `false` se não estava ligado ou se o build é de demonstração.
 */
export function exitDemo(): Promise<boolean> {
  return serialize(async () => {
    if (!isDemoMode() || isDemoBuild()) return false;
    await wipeDemoData();
    setRuntimeDemo(false);
    resetSingletons(null);
    await notify(false);
    return true;
  });
}

/**
 * Apaga, ainda no modo demonstração (as chaves e o arquivo da fila são os da demonstração), tudo o que a
 * demonstração gravou no aparelho. Cada parte é independente: uma falha não impede as outras.
 */
async function wipeDemoData(): Promise<void> {
  await attemptQuietly(async () => {
    const store = getQueueStore();
    const runs = await store.listRuns();
    if (runs.some((r) => r.state === 'recording')) await stopBackgroundUpdates();
    for (const r of runs) await store.deleteRun(r.id);
  });
  await attemptQuietly(() => writeCachedZones(null));
  await attemptQuietly(() => writeCachedProfile(null));
  // O Auth de demonstração só abre sessão como `DEMO_USER_ID`: é a única chave HMAC que ela grava.
  await attemptQuietly(() => defaultDeviceKeyDeps.storage.remove(storageKey(DEMO_USER_ID)));
}

async function attemptQuietly(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (e) {
    if (__DEV__) console.warn('[demo-mode] limpeza parcial da demonstração', e);
  }
}
