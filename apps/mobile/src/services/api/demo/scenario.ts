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

/** Lido uma vez, no carregamento do módulo: a navegação do expo-router pode trocar a URL depois. */
export const INITIAL_SCENARIO: DemoScenario = scenarioFromLocation();
