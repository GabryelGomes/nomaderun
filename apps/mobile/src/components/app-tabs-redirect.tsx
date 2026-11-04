import { Redirect } from 'expo-router';

import { ACTIVITIES_ROUTE, RUN_ROUTE } from './app-tabs-config';

/** `/atividades` (links antigos, "Concluir" do resumo) → Atividades dentro de "Você" (D-73). */
export function ActivitiesRedirect() {
  return <Redirect href={ACTIVITIES_ROUTE} />;
}

/** `/correr` (a antiga aba Correr, links antigos) → Nova corrida (D-89). */
export function RunRedirect() {
  return <Redirect href={RUN_ROUTE} />;
}
