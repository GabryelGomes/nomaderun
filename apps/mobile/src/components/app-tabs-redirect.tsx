import { Redirect } from 'expo-router';

import { ACTIVITIES_ROUTE } from './app-tabs-config';

/** `/atividades` (links antigos, "Concluir" do resumo) → Atividades dentro de "Você" (D-73). */
export function ActivitiesRedirect() {
  return <Redirect href={ACTIVITIES_ROUTE} />;
}
