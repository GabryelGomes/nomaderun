/** "Copiar legenda" e "Copiar código" (expo-clipboard, que vem no Expo Go SDK 57). Nunca lança. */
import * as Clipboard from 'expo-clipboard';

export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
