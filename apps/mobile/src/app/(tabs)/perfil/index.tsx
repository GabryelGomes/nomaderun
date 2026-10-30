import { router, Stack, type Href } from 'expo-router';

// A tela vem primeiro: a régua de texto (`medir-texto.mjs`) liga a rota ao 1º import `@/`.
import { ProfileScreen, VOCE_ROUTES } from '@/features/screens/profile-screen';
import { IconButton } from '@/components/button';

/** Engrenagem no cabeçalho de "Você": os ajustes saem da tela e ficam a 1 toque (F1 §5.8). */
function SettingsShortcut() {
  return <IconButton testID="voce-ajustes" icon="gear" label="Ajustes" tone="sunken" size={44} onPress={() => router.push(VOCE_ROUTES.ajustes as Href)} />;
}

export default function VoceIndex() {
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SettingsShortcut /> }} />
      <ProfileScreen />
    </>
  );
}
