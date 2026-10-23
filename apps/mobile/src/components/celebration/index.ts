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
