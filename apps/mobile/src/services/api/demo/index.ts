/**
 * Servidor de demonstração em memória (D-77, T7.1.18). Ligado por `EXPO_PUBLIC_DEMO=1`: `getSupabase()`
 * devolve `getDemoClient()` e nenhum repositório ou tela muda. Ver `docs/QA.md` (Fase 7) para ligar e usar.
 */
export { asSupabaseClient, createDemoClient, getDemoClient, isDemoClient, setDemoClient, type DemoClient, type DemoClientOptions } from './client';
export { DEMO_BUCKETS, DEMO_TABLES } from './db';
export { DEMO_FUNCTIONS } from './functions';
export { DEMO_RPCS } from './rpc';
export { DEMO_SCENARIOS, type DemoScenario } from './scenario';
