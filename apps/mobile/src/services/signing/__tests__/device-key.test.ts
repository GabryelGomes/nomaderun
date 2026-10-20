import { describe, expect, it } from '@jest/globals';

import { base64ToBytes } from '../base64';
import { loadDeviceKey, saveDeviceKey, storageKey, type DeviceKeyDeps } from '../device-key';

function deps(): DeviceKeyDeps & { mem: Map<string, string> } {
  const mem = new Map<string, string>();
  let n = 0;
  return {
    mem,
    storage: { get: async (k) => mem.get(k) ?? null, set: async (k, v) => void mem.set(k, v), remove: async (k) => void mem.delete(k) },
    randomUUID: () => `00000000-0000-4000-8000-00000000000${n++}`,
    randomBytes: (len) => Uint8Array.from({ length: len }, (_, i) => i),
  };
}

describe('chave do aparelho (D-04)', () => {
  it('gera 32 bytes e um deviceId na primeira vez e reaproveita depois', async () => {
    const d = deps();
    const a = await loadDeviceKey('user-1', d);
    expect(base64ToBytes(a.secret)).toHaveLength(32);
    expect(a.registered).toBe(false);
    const b = await loadDeviceKey('user-1', d);
    expect(b).toEqual(a);
    await saveDeviceKey('user-1', { ...a, registered: true }, d);
    expect((await loadDeviceKey('user-1', d)).registered).toBe(true);
  });

  it('uma chave por usuário, com nome válido para o SecureStore', async () => {
    const d = deps();
    const a = await loadDeviceKey('7c0e-aa', d);
    const b = await loadDeviceKey('outro', d);
    expect(a.deviceId).not.toBe(b.deviceId);
    expect(storageKey('7c0e-aa/x')).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('valor corrompido gera uma chave nova em vez de quebrar', async () => {
    const d = deps();
    d.mem.set(storageKey('u'), '{nao e json');
    const k = await loadDeviceKey('u', d);
    expect(k.deviceId).toBeTruthy();
  });
});
