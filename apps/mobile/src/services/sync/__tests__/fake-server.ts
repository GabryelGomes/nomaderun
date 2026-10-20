import { canonicalBatch, signBatch } from '@/services/signing/canonical';
import type { DeviceKey } from '@/services/signing/device-key';

import type { KeyRing } from '../sync-engine';
import type { ApiResult, IngestBody, OfficialResult, SyncTransport } from '../types';

/**
 * Servidor falso com as mesmas regras do `ingest-points`/`finish-activity` (contrato):
 * assinatura, aparelho, ordem, idempotência por (activityId, seq), REPLAY_MISMATCH, fechamento.
 */
export function createFakeServer() {
  const devices = new Map<string, { userId: string; secret: string }>();
  const acts = new Map<string, { deviceId: string; points: Map<number, string>; closed: OfficialResult | null }>();
  const received: number[] = [];
  const state = {
    online: true,
    /** O servidor grava, mas a resposta se perde (rede cai na volta). */
    dropNextResponse: false,
    expiredToken: false,
    /** finish de corrida já fechada responde ACTIVITY_CLOSED (em vez do resultado). */
    closedAnswersError: false,
    calls: { ingest: 0, finish: 0, register: 0, refresh: 0 },
  };

  const fail = <T,>(status: number, code: string, details?: { lastSeq: number }): ApiResult<T> => ({ ok: false, error: { code, status, message: code, details } });
  const offline = <T,>(): ApiResult<T> => ({ ok: false, error: { code: 'NETWORK', status: 0, message: 'sem rede' } });

  const transport: SyncTransport = {
    async registerDevice(b) {
      state.calls.register++;
      if (!state.online) return offline();
      const owner = devices.get(b.deviceId);
      if (owner && owner.userId !== 'me') return fail(409, 'DEVICE_TAKEN');
      devices.set(b.deviceId, { userId: 'me', secret: b.secret });
      return { ok: true, data: { deviceId: b.deviceId } };
    },
    async ingest(b: IngestBody) {
      state.calls.ingest++;
      if (!state.online) return offline();
      if (state.expiredToken) return fail(401, 'UNAUTHORIZED');
      const dev = devices.get(b.deviceId);
      if (!dev) return fail(401, 'UNKNOWN_DEVICE');
      const { signature, ...rest } = b;
      if (signBatch(dev.secret, rest) !== signature) return fail(401, 'INVALID_SIGNATURE');
      let act = acts.get(b.activityId);
      if (!act) {
        act = { deviceId: b.deviceId, points: new Map(), closed: null };
        acts.set(b.activityId, act);
      }
      const last = act.points.size ? Math.max(...act.points.keys()) : -1;
      if (act.closed) return fail(409, 'ACTIVITY_CLOSED', { lastSeq: last });
      if (act.deviceId !== b.deviceId) return fail(409, 'DEVICE_MISMATCH');
      if (b.fromSeq > last + 1) return fail(409, 'OUT_OF_ORDER', { lastSeq: last });
      let accepted = 0;
      let duplicates = 0;
      for (const p of b.points) {
        const json = canonicalBatch({ activityId: '', deviceId: '', fromSeq: 0, toSeq: 0, points: [p] });
        const prev = act.points.get(p.seq);
        if (prev !== undefined) {
          if (prev !== json) return fail(409, 'REPLAY_MISMATCH');
          duplicates++;
          continue;
        }
        act.points.set(p.seq, json);
        received.push(p.seq);
        accepted++;
      }
      const lastSeq = Math.max(...act.points.keys());
      if (state.dropNextResponse) {
        state.dropNextResponse = false;
        return offline();
      }
      return { ok: true, data: { accepted, duplicates, lastSeq } };
    },
    async finish(b) {
      state.calls.finish++;
      if (!state.online) return offline();
      const act = acts.get(b.activityId);
      if (!act) return fail(409, 'MISSING_POINTS', { lastSeq: -1 });
      if (act.closed) return state.closedAnswersError ? fail(409, 'ACTIVITY_CLOSED') : { ok: true, data: act.closed };
      const last = Math.max(...act.points.keys());
      if (last < b.lastSeq) return fail(409, 'MISSING_POINTS', { lastSeq: last });
      act.closed = {
        activityId: b.activityId,
        status: 'valid',
        meters: act.points.size * 3,
        movingSeconds: act.points.size,
        avgPace: 312,
        rpTotal: 42,
        xp: 10,
        flags: [],
        invalidSegments: [],
        zones: [{ zoneId: '89a8c0000000fff', name: 'Parque Flamboyant 1', meters: 300, rp: 42, outcome: 'conquered', ownerBefore: null, ownerAfter: 'striders' }],
        newFogCells: 3,
        beatGhost: null,
        trust: 100,
        review: null,
      };
      return { ok: true, data: act.closed };
    },
    async refreshSession() {
      state.calls.refresh++;
      state.expiredToken = false;
      return state.online;
    },
    async fetchResult(id) {
      return { ok: true, data: acts.get(id)?.closed ?? null };
    },
  };

  return {
    transport,
    state,
    devices,
    acts,
    /** Seqs gravados pelo servidor, na ordem (sem duplicados por construção: conferimos contagem). */
    received,
    storedSeqs: (id: string) => [...(acts.get(id)?.points.keys() ?? [])].sort((a, b) => a - b),
    /** Simula o servidor "esquecendo" pontos além de `upTo` (para provocar OUT_OF_ORDER). */
    truncate(id: string, upTo: number) {
      const a = acts.get(id);
      if (a) for (const k of [...a.points.keys()]) if (k > upTo) a.points.delete(k);
    },
  };
}

export function memoryKeyRing(): KeyRing & { keys: Map<string, DeviceKey>; n: number } {
  const ring = {
    keys: new Map<string, DeviceKey>(),
    n: 0,
    async load(userId: string) {
      let k = ring.keys.get(userId);
      if (!k) {
        k = { deviceId: `dev-${ring.n++}`, secret: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=', registered: false };
        ring.keys.set(userId, k);
      }
      return k;
    },
    async save(userId: string, key: DeviceKey) {
      ring.keys.set(userId, key);
    },
    async regenerate(userId: string) {
      const k = { deviceId: `dev-${ring.n++}`, secret: 'HxwdHh8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo=', registered: false };
      ring.keys.set(userId, k);
      return k;
    },
  };
  return ring;
}
