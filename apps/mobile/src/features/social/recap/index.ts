/** Recap semanal (E8, T7.3.7): tela `/compartilhar/semana`, botão, link e o modelo puro. */
export { RecapScreen } from './recap-screen';
export { RecapButton, type RecapButtonProps } from './recap-button';
export { recapHref, mondayOf, addDaysIso, buildRecapWeekInput, recapFromActivities, recapCaption } from './recap-model';
export { useWeeklyRecap, type WeeklyRecapState } from './use-weekly-recap';
