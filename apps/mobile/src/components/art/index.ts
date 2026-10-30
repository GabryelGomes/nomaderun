/**
 * Sistema de arte do NOMADE RUN (E4, T7.1.10): ilustração "neon line-art geométrico" em react-native-svg,
 * com brilho por camadas (sem filtro de desfoque) e 3 níveis de qualidade. Sem lógica de jogo: a tela
 * decide pose, estado, raridade, nível e dano. Guia: `docs/melhoria/relatorios/E4-onda1.md`.
 */
export { resolveQuality, type Quality, type QualityProp } from './neon/core';
export { ART, PRISM, VILLAIN, EMBER, ICE, mix } from './neon/palette';
export { ArtFrame, type ArtA11y } from './neon/render';
export { InSvgArt, fitTransform, type InSvgArtProps, type SvgArtBox } from './neon/in-svg';
export { BossSvgArt, bossSlot, LeaderSvgArt, LogoSvgArt, MascotSvgArt, mascotSlot, RunnerSvgArt, TeamEmblemInSvg, type SvgArtSlot } from './svg-art';

export { Logo, type LogoProps } from './logo/logo';
export { LOGO_BOX, LOGO_COLORS, LOGO_LABEL, LOGO_VARIANTS, type LogoVariant } from './logo/logo-art';

export { Mascot, type MascotPart, type MascotProps } from './team/mascot';
export { TeamEmblem, type TeamEmblemProps } from './team/emblem';
export { EMBLEM_BOX, EMBLEM_LINE_ART_MIN, EMBLEM_MIN_SIZE, EMBLEM_VARIANTS, emblemLabel, resolveEmblemVariant, type EmblemVariant, type EmblemVariantProp } from './team/emblem-art';
export { MascotRunner, type MascotRunnerProps, type RunnerPart } from './team/mascot-runner';
export { RUNNER_BOX, RUNNER_PIVOTS } from './team/runner-art';
export { MASCOT_BOX, MASCOT_NAMES, MASCOT_PIVOTS, MASCOT_POSES, type MascotPose } from './team/mascot-art';

export { LeaderBust, type LeaderBustProps, type LeaderPart } from './leader/leader-bust';
export { LEADER_BOX, LEADER_NAMES, LEADER_PIVOTS, LEADER_POSES, type LeaderPose } from './leader/leader-art';

export { Boss, bossLabel, type BossPart, type BossProps } from './boss/boss';
export { BOSS_BOX, BOSS_IDS, BOSS_NAMES, BOSS_PIVOTS, BOSS_STATES, type BossDamage, type BossId, type BossState } from './boss/boss-art';

export { Chest, chestLabel, type ChestPart, type ChestProps } from './chest/chest';
export { CHEST_BOX, CHEST_LAYERS, CHEST_PIVOTS, CHEST_RARITIES, CHEST_STATES, type ChestLayer, type ChestRarity, type ChestState } from './chest/chest-art';

export { Medal, medalLabel, type MedalProps } from './medal/medal';
export { MEDAL_BOX, MEDAL_KINDS, MEDAL_LABELS, MEDAL_PIVOTS, tierColor, type MedalKind, type MedalTier } from './medal/medal-art';

export { ModeIcon, type ModeIconProps } from './mode-icons/mode-icon';
export { MODE_ICON_KINDS, MODE_ICON_LABELS, type ModeIconKind } from './mode-icons/mode-icon-art';

export { EmptyArt, type EmptyArtProps } from './empty/empty-illustration';
export { EMPTY_KINDS, EMPTY_LABELS, EMPTY_USES_TEAM, type EmptyKind } from './empty/empty-art';

export { TutorialArt, type TutorialArtProps } from './tutorial/tutorial-card';
export { TUTORIAL_LABELS, TUTORIAL_STEPS, type TutorialStep } from './tutorial/tutorial-art';

export { StreakArt, streakLabel, type StreakArtProps, type StreakPart } from './streak/streak';
export { STREAK_BOX, STREAK_LABELS, STREAK_LAYERS, STREAK_PIVOTS, STREAK_STATES, type StreakLayer, type StreakState } from './streak/streak-art';

export { RunTabIcon, type RunTabIconProps } from './tab-icon/run-tab-icon';
export { RUN_TAB_BOX, RUN_TAB_VARIANTS, type RunTabVariant } from './tab-icon/run-tab-art';

export { TabBackground, type TabBackgroundProps } from './backgrounds/tab-background';
export { BACKGROUND_OPACITY, MAX_BACKGROUND_OPACITY, TAB_BACKGROUND_KINDS, TAB_BACKGROUND_LABELS, type TabBackgroundKind } from './backgrounds/background-art';
