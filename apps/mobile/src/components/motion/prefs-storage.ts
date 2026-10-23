import Storage from 'expo-sqlite/kv-store';

/**
 * Onde as preferências de motion ficam salvas no celular: o mesmo `expo-sqlite/kv-store` que o app já usa
 * para o cache do perfil e das zonas. Só conveniência (sem segredo): qualquer falha vira "sem valor salvo".
 * Na web, `prefs-storage.web.ts` usa o `localStorage`.
 */
export async function readMotionPrefsRaw(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeMotionPrefsRaw(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value);
  } catch {
    // preferência continua valendo em memória
  }
}
