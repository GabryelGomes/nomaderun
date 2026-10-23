import { Stack } from 'expo-router';

import { ActivitiesScreen } from '@/features/screens/activities-screen';

/** Atividades dentro de "Você" (D-73). `/atividades` redireciona para cá. */
export default function VoceAtividades() {
  return (
    <>
      <Stack.Screen options={{ title: 'Atividades' }} />
      <ActivitiesScreen />
    </>
  );
}
