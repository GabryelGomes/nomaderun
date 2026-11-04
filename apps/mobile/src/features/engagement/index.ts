/**
 * Engajamento v2 (E7, T7.2.4). O que as outras frentes encaixam:
 * - Resumo (E6b): `useRunRewards(official)` + `<RunRewardsBlock block={…} demo={…} />`;
 * - Mapa (E6b): `useTodayStrip()` → `<DailyStrip items={strip.items} />` e `<MissionCoachCard {...strip.coach} />`;
 * - Volta (E6): `<WelcomeBackGate />` (ou `useWelcomeBack()` + `<WelcomeBackSheet />`);
 * - Pausa (E6, conta): `<HealthPauseSheet visible onClose />`;
 * - Rotas próprias: `/missoes` e `/recompensas`.
 */
export { recordShareDone, refreshEngagement, recordRunResult, rerollDailyMission, openStoredChests, claimSeasonStep, startPause, endPause, markRankingOpened, ensureConquestHistory } from './controller';
export { useEngagementData, useRunRewards, useTodayStrip, useWelcomeBack, useFirstConquestEver, getFirstConquestEver, type TodayStrip, type WelcomeBack } from './hooks';
export { trackTelemetry, flushTelemetry, setTelemetryOptIn, loadTelemetryConsent, telemetryAllowed } from './telemetry';
export { TELEMETRY_EVENTS, type TelemetryEventName } from './telemetry-model';
export { TelemetryConsentSheet, TelemetrySettingsSection, type TelemetryConsentSheetProps } from './telemetry-consent';
export { RunRewardsBlock, type RunRewardsBlockProps } from './run-rewards-block';
export { HealthPauseSheet, type HealthPauseSheetProps } from './health-pause-sheet';
export { WelcomeBackGate, WelcomeBackSheet, type WelcomeBackSheetProps } from './welcome-back-sheet';
export { MissionsScreen } from './missions-screen';
export { RewardsScreen } from './rewards-screen';
export { hasRecruitFrame, RECRUIT_FRAME_ID, useRecruitFrame } from './recruit-frame';
export { rewardSections, rewardPeak } from './run-rewards-model';
export { todayData, featuredMission, type TodayData, type TodayChip, type TodayCoach } from './today';
export { welcomeBackCards, shouldWelcomeBack, WELCOME_BACK_DAYS, type WelcomeCard } from './welcome-back';
export { NextRunPlanCard, type NextRunPlanCardProps } from './next-run-plan-card';
export { answerPlan, planQuestionDue, readPendingPlan, readPlanMemory } from './next-run-plan';
export { SummaryMoments, FirstPaintMoment, DistrictStampMoment, LeaderComment, type SummaryMomentsProps } from './summary-moments';
export { leaderLine, LEADER_LINES, LEADER_LINE_MAX, type LeaderFeat, type LeaderFeatKind } from './leader-lines';
export { districtStamps, newDistrictStamp, recapLeaderFeat, summaryLeaderFeat, firstPaintLiveEligible, type DistrictStamp } from './moments';
export { echoNow, echoText, loadCrewEcho, useCrewEcho } from './crew-echo';
export { useWelcomeDone, WelcomeDoneToast, welcomeDoneDue } from './welcome-done';
export { TeamWeekBanner, teamWeekBody, teamWeekDue, TEAM_WEEK_MS } from './team-week';
export { MedalSheet, medalInfo, type MedalInfo, type MedalMetric } from './medal-sheet';
export { AtlasStamps, STAMPS_SHOWN } from './atlas-stamps';
export { CosmeticThumb, trailColors, TRAIL_COLORS } from './cosmetic-thumb';
export { howToPlayCards, useHowToPlayFirstVisit, HOW_TO_PLAY_SEEN } from './how-to-play';
export { streakLine, missionGo, pctInt, ftueBarValue, TIER_LABEL } from './model';
export { TeamBoostBadge, useFactionBoost, loadFactionBoost, boostLabel, type FactionBoost } from './team-boost';
export { CrewEchoCard } from './crew-echo-card';
