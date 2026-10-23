/**
 * D-02 — ponte para as regras do app (fonte única: apps/mobile/src/domain).
 *
 * Cada módulo do domain é importado aqui com a extensão `.ts` porque o `supabase functions serve`
 * só monta no container os arquivos que encontra com caminho explícito. Os imports internos do domain
 * não têm extensão (padrão do app); o `deno.json` desta pasta remapeia cada um para o arquivo `.ts`.
 * Se um arquivo novo entrar em src/domain, acrescente-o aqui e no deno.json — o teste
 * `tests/domain_bridge.test.ts` falha enquanto isso não for feito.
 */
import '../../../apps/mobile/src/domain/h3-runtime.ts';

export * from '../../../apps/mobile/src/domain/types.ts';
export * from '../../../apps/mobile/src/domain/geo.ts';
export * from '../../../apps/mobile/src/domain/grid.ts';
export * from '../../../apps/mobile/src/domain/scoring.ts';
export * from '../../../apps/mobile/src/domain/territory.ts';
export * from '../../../apps/mobile/src/domain/anti-cheat.ts';
export * from '../../../apps/mobile/src/domain/trust.ts';
export * from '../../../apps/mobile/src/domain/games.ts';
export * from '../../../apps/mobile/src/domain/run-engine.ts';
export * from '../../../apps/mobile/src/domain/regions.ts';
export * from '../../../apps/mobile/src/domain/season.ts';
export * from '../../../apps/mobile/src/domain/progression.ts';
export * from '../../../apps/mobile/src/domain/missions.ts';
export * from '../../../apps/mobile/src/domain/reminders.ts';
