import { router, Stack } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { ProfileScreen } from '@/features/screens/profile-screen';
import { ACTIVITIES_ROUTE } from '@/components/app-tabs-config';
import { Button } from '@/components/button';

/** Atalho para as Atividades no cabeçalho de "Você" (D-73). A reforma da tela "Você" é da onda 3 (T7.3.2). */
function ActivitiesShortcut() {
  return <Button testID="voce-atividades" label="Atividades" accessibilityLabel="Abrir suas atividades" icon="activities" kind="ghost" onPress={() => router.push(ACTIVITIES_ROUTE)} />;
}

export default function VoceIndex() {
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <ActivitiesShortcut /> }} />
      <ProfileScreen />
    </>
  );
}
