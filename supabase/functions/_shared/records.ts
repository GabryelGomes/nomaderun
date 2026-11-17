/**
 * Recordes pessoais e parciais: a conta mora no domain (`apps/mobile/src/domain/records.ts`), igual no app e no
 * servidor. Este arquivo só mantém o caminho de import antigo das functions.
 */
export { bestEffort, computeRunStats, MAX_PACE_SERIES, MAX_SPLITS, RECORD_DISTANCES, type RecordKind, type RunStats, splitTimes } from './domain.ts';
