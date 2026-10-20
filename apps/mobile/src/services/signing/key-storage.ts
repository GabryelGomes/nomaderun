import * as SecureStore from 'expo-secure-store';

/** Chave do aparelho no Keychain/Keystore (D-04, RNF-007). */
export const keyStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
