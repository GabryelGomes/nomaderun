/**
 * Chave HMAC do aparelho (D-04): 32 bytes aleatórios + `deviceId` (UUID), guardados no SecureStore
 * por usuário e registrados uma vez em `register-device`.
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { bytesToBase64 } from './base64';
import { keyStorage } from './key-storage';

export type DeviceKey = { deviceId: string; secret: string; registered: boolean };

export type KeyStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export type DeviceKeyDeps = {
  storage: KeyStorage;
  randomUUID: () => string;
  randomBytes: (n: number) => Uint8Array;
};

export const defaultDeviceKeyDeps: DeviceKeyDeps = {
  storage: keyStorage,
  randomUUID: () => Crypto.randomUUID(),
  randomBytes: (n) => Crypto.getRandomBytes(n),
};

/** Nome da chave no SecureStore (só letras, números, ".", "-" e "_"). */
export const storageKey = (userId: string) => `nomade.device.v1.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

export function newDeviceKey(deps: Pick<DeviceKeyDeps, 'randomUUID' | 'randomBytes'>): DeviceKey {
  return { deviceId: deps.randomUUID(), secret: bytesToBase64(deps.randomBytes(32)), registered: false };
}

export async function loadDeviceKey(userId: string, deps: DeviceKeyDeps = defaultDeviceKeyDeps): Promise<DeviceKey> {
  try {
    const raw = await deps.storage.get(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceKey>;
      if (typeof parsed.deviceId === 'string' && typeof parsed.secret === 'string') {
        return { deviceId: parsed.deviceId, secret: parsed.secret, registered: parsed.registered === true };
      }
    }
  } catch {
    // Valor corrompido: gera outra chave (o servidor aceita registrar um aparelho novo).
  }
  const key = newDeviceKey(deps);
  await saveDeviceKey(userId, key, deps);
  return key;
}

export async function saveDeviceKey(userId: string, key: DeviceKey, deps: DeviceKeyDeps = defaultDeviceKeyDeps): Promise<void> {
  await deps.storage.set(storageKey(userId), JSON.stringify(key));
}

export const devicePlatform = (): 'ios' | 'android' | 'web' =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
