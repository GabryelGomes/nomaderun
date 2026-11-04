/** Celebrações da v2 (T7.1.14): orquestrador e momentos de recompensa. Arte (E4) entra por props. */
export {
  a11ySummary,
  defaultLevel,
  MOMENT_SPECS,
  momentState,
  nextStepAt,
  planCelebrations,
  skipHaptic,
  skipTo,
  type CelebrationEvent,
  type CelebrationEventKind,
  type CelebrationKind,
  type CelebrationLevel,
  type CelebrationPayloads,
  type CelebrationPlan,
  type ChestRarity,
  type PlanOptions,
  type ScheduledMoment,
} from './queue';
export { CelebrationSequence, type CelebrationSequenceProps, type MomentContext } from './celebration-sequence';
export { renderCelebrationMoment, type CelebrationArt } from './default-moment';
export { type MomentBaseProps } from './moment';
export { RewardToast, type RewardToastProps } from './reward-toast';
export { ZoneCaptured, type ZoneCapturedProps } from './zone-captured';
export { ChestOpening, type ChestOpeningProps } from './chest-opening';
export { BossDefeated, BossHit, type BossDefeatedProps, type BossHitProps } from './boss';
export { LevelUp, PRStamp, RankShift, StreakFlame, type LevelUpProps, type PRStampProps, type RankRow, type RankShiftProps, type StreakFlameProps } from './progress-moments';
export { TeamConfirm, type TeamConfirmProps } from './team-confirm';
export { RARITY_COLORS } from './choreography';

// onda 2 (T7.2.9)
export { BoraReaction, type BoraReactionProps } from './bora';
export { boraFeedback, BORA_TIMELINE, bossDamageFor, RARITY_PALETTES, RARITY_TEXT, resolveBossId } from './choreography';
export * from './adapters';

// Fase 8 · onda C (C1)
export { FirstPaintSeal, type FirstPaintSealProps } from './first-paint';
export { NeighborhoodFlip, neighborhoodFlipLabel, type NeighborhoodFlipProps } from './neighborhood-flip';
export { neighborhoodZonesFrom, projectNeighborhood, type NeighborhoodZone } from './neighborhood-math';
export { TeamWeekCard, type TeamWeekCardProps } from './team-week-card';
export * from './f8-choreography';
