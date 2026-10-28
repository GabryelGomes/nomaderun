/**
 * Engajamento v2 (E7, T7.2.4). O que as outras frentes encaixam:
 * - Resumo (E6b): `useRunRewards(official)` + `<RunRewardsBlock block={…} demo={…} />`;
 * - Mapa (E6b): `useTodayStrip()` → `<DailyStrip items={strip.items} />` e `<MissionCoachCard {...strip.coach} />`;
 * - Volta (E6): `<WelcomeBackGate />` (ou `useWelcomeBack()` + `<WelcomeBackSheet />`);
 * - Pausa (E6, conta): `<HealthPauseSheet visible onClose />`;
 * - Rotas próprias: `/missoes` e `/recompensas`.
 */
export { refreshEngagement, recordRunResult, rerollDailyMission, openStoredChests, claimSeasonStep, startPause, endPause, markRankingOpened, ensureConquestHistory } from './controller';
export { useEngagementData, useRunRewards, useTodayStrip, useWelcomeBack, useFirstConquestEver, getFirstConquestEver, type TodayStrip, type WelcomeBack } from './hooks';
export { trackTelemetry, flushTelemetry, setTelemetryOptIn, loadTelemetryConsent, telemetryAllowed } from './telemetry';
export { TELEMETRY_EVENTS, type TelemetryEventName } from './telemetry-model';
export { TelemetryConsentSheet, TelemetrySettingsSection, type TelemetryConsentSheetProps } from './telemetry-consent';
export { RunRewardsBlock, type RunRewardsBlockProps } from './run-rewards-block';
export { HealthPauseSheet, type HealthPauseSheetProps } from './health-pause-sheet';
export { WelcomeBackGate, WelcomeBackSheet, type WelcomeBackSheetProps } from './welcome-back-sheet';
export { MissionsScreen } from './missions-screen';
export { RewardsScreen } from './rewards-screen';
export { rewardSections, rewardPeak } from './run-rewards-model';
export { todayData, featuredMission, type TodayData, type TodayChip, type TodayCoach } from './today';
export { welcomeBackCards, shouldWelcomeBack, WELCOME_BACK_DAYS, type WelcomeCard } from './welcome-back';
