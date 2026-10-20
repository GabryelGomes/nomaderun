/**
 * No navegador não há Keychain: a chave fica no localStorage (mesma origem do app). O painel web
 * é usado para moderação; correr pelo navegador é só demonstração.
 */
const ls = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const keyStorage = {
  get: async (key: string) => ls()?.getItem(key) ?? null,
  set: async (key: string, value: string) => void ls()?.setItem(key, value),
  remove: async (key: string) => void ls()?.removeItem(key),
};
