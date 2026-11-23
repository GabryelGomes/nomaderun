/**
 * Roteiros do modo demonstração (D-77): cada um põe o servidor de demonstração num estado para as capturas,
 * os testes e a apresentação. Na web (só com `EXPO_PUBLIC_DEMO=1`) o roteiro vem de `?cenario=` na URL.
 */
export const DEMO_SCENARIOS = [
  /** Corredor com histórico, crew, notificações (padrão). */
  'cheio',
  /** Conta nova com time: telas nos estados vazios. */
  'vazio',
  /** Conta nova sem time: primeira abertura pela escolha do time. */
  'sem-time',
  /** Sem sessão: começa na tela Entrar (cadastro de demonstração). */
  'primeira-abertura',
  /** Cheio + alerta de invasão chegando pelo Realtime alguns segundos depois de abrir. */
  'sob-ataque',
  /** Todo pedido ao servidor falha com erro 503. */
  'erro',
  /** Sem rede: todo pedido falha como falha de conexão. */
  'offline',
  /** Cada resposta demora 2,5 s (estados "carregando"). */
  'lento',
  /** Cheio + papel de moderador e 3 corridas de terceiros em revisão. */
  'moderador',
] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEFAULT_SCENARIO: DemoScenario = 'cheio';

export const isDemoScenario = (v: unknown): v is DemoScenario => typeof v === 'string' && (DEMO_SCENARIOS as readonly string[]).includes(v);

/** Lê `?cenario=` da URL atual (web). Fora do navegador, ou com valor desconhecido, devolve o padrão. */
export function scenarioFromLocation(search?: string | null): DemoScenario {
  let raw: string | null = null;
  try {
    const s = search ?? (typeof window !== 'undefined' && window.location ? window.location.search : '');
    raw = s ? new URLSearchParams(s).get('cenario') : null;
  } catch {
    raw = null;
  }
  return isDemoScenario(raw) ? raw : DEFAULT_SCENARIO;
}

/** Latência simulada por roteiro, em ms. */
export const scenarioLatency = (s: DemoScenario) => (s === 'lento' ? 2500 : 0);

const SCENARIO_KEY = 'nomade-demo-cenario';

/**
 * Roteiro da aba: o `?cenario=` da URL vale e fica guardado na aba (`sessionStorage`); sem ele na URL, vale o
 * guardado. Antes, recarregar a página (a URL já não tem `?cenario=` depois de navegar) voltava ao roteiro
 * padrão e levava a pessoa para outra conta (5ª bateria: "time pendente some ao recarregar", "dados somem").
 */
export function tabScenario(search?: string | null, storage?: Pick<Storage, 'getItem' | 'setItem'> | null): DemoScenario {
  let store = storage;
  try {
    if (store === undefined) store = typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    store = null;
  }
  let raw: string | null = null;
  try {
    const s = search ?? (typeof window !== 'undefined' && window.location ? window.location.search : '');
    raw = s ? new URLSearchParams(s).get('cenario') : null;
  } catch {
    raw = null;
  }
  try {
    if (isDemoScenario(raw)) {
      store?.setItem(SCENARIO_KEY, raw);
      return raw;
    }
    const saved = store?.getItem(SCENARIO_KEY);
    if (isDemoScenario(saved)) return saved;
  } catch {
    // sem armazenamento (aba anônima bloqueada): só a URL vale
  }
  return isDemoScenario(raw) ? raw : DEFAULT_SCENARIO;
}

/**
 * Entrou (cadastro ou login) num roteiro que começa sem conta: a aba passa a lembrar o roteiro com conta ('cheio'),
 * para recarregar a página depois do cadastro não voltar à tela de boas-vindas (quem tem conta continua logado).
 */
export function rememberSignedIn(storage?: Pick<Storage, 'getItem' | 'setItem'> | null): void {
  try {
    const store = storage === undefined ? (typeof window !== 'undefined' ? window.sessionStorage : null) : storage;
    if (store?.getItem(SCENARIO_KEY) === 'primeira-abertura') store.setItem(SCENARIO_KEY, DEFAULT_SCENARIO);
  } catch {
    // sem armazenamento: nada a lembrar
  }
}

/** Lido uma vez, no carregamento do módulo: a navegação do expo-router pode trocar a URL depois. */
export const INITIAL_SCENARIO: DemoScenario = tabScenario();
