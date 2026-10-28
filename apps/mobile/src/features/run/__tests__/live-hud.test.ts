/**
 * T7.2.7 (E6b) — HUD da corrida ativa: retrato para o `createLiveTracker`, estado do cartão da zona, avisos
 * ao vivo com o nível de cada evento e a fila curta de avisos.
 * T7.3.2: os avisos saem do `createLiveFeedback` da E5 (`liveEffects`), no lugar do antigo `toastForEvent`.
 */
import { describe, expect, it } from '@jest/globals';

import { cellCenter, zoneOf } from '@/domain/grid';
import { createLiveTracker, type LiveEvent, type LiveZoneState } from '@/domain/live-events';
import { emptyPaintCounts } from '@/domain/paint';
import { DEFENSE_WINDOW_MS, newZone, type Zone } from '@/domain/territory';
import type { GeoPoint } from '@/domain/types';

import { createLiveFeedback } from '@/components/celebration/adapters';

import { anchorFromKey, enqueueToast, hudFor, lazyLiveSnapshot, liveEffects, liveSnapshotFromZones, mapAnchorKey, TOAST_QUEUE_MAX, type RunToast } from '../live-hud';

const NOW = Date.UTC(2026, 9, 23, 12);
const HERE = { lat: -16.7097, lng: -49.2388 };

function zone(id: string, patch: Partial<Zone> = {}): Zone {
  return { ...newZone(id), ...patch };
}

describe('liveSnapshotFromZones', () => {
  it('zona com dono vale 3 trechos virtuais (herança da D-62); neutra, nenhum; sem trechos pintados', () => {
    const owned = zone('z1', { owner: 'owls' });
    const neutral = zone('z2');
    const snap = liveSnapshotFromZones({ z1: owned, z2: neutral }, { z1: { name: 'Setor Bueno' } }, NOW);
    expect(snap.cells).toEqual({});
    expect(snap.zones.z1).toMatchObject({ owner: 'owls', name: 'Setor Bueno', inherited: 3 });
    expect(snap.zones.z2).toMatchObject({ owner: null, name: null, inherited: 0 });
  });

  it('ataque só dentro da janela de 24 h (isUnderAttackAt, E-03)', () => {
    const fresh = zone('a', { owner: 'striders', attacker: 'volt', attackStartedAt: NOW - 1000 });
    const old = zone('b', { owner: 'striders', attacker: 'volt', attackStartedAt: NOW - DEFENSE_WINDOW_MS - 1 });
    const snap = liveSnapshotFromZones({ a: fresh, b: old }, {}, NOW);
    expect(snap.zones.a.underAttack).toBe(true);
    expect(snap.zones.b.underAttack).toBe(false);
  });

  it('com o tracker do domain: atravessar uma zona neutra conquista e o aviso é "Zona conquistada"', () => {
    const id = zoneOf(HERE);
    const c = cellCenter(id);
    const snap = liveSnapshotFromZones({ [id]: zone(id) }, { [id]: { name: 'Parque' } }, NOW);
    const tracker = createLiveTracker({ runId: 'r', faction: 'striders', snapshot: snap });
    const events: LiveEvent[] = [];
    // 400 m em linha reta pelo centro da zona, 1 ponto a cada 10 m (3,3 m/s)
    for (let i = 0; i <= 40; i++) {
      const p: GeoPoint = { lat: c.lat, lng: c.lng - 0.0018 + i * 0.00009, t: NOW + i * 3000, accuracy: 5 };
      events.push(...tracker.push(p));
    }
    const conquest = events.find((e) => e.type === 'zona_conquistada');
    expect(conquest).toBeDefined();
    const fx = liveEffects(conquest!, createLiveFeedback({ faction: 'striders' }).push(conquest!), 'striders');
    // A vibração sai do feedback da E5 (a conquista fura o ritmo); o aviso não vibra sozinho.
    expect(fx.toast).toMatchObject({ size: 'medium', title: 'Zona conquistada', subtitle: 'Parque', edgeGlow: true, haptics: false, faction: 'striders' });
    expect(fx.haptic).toBe('success');
    expect(fx.voice).toBe('Zona conquistada!');
    expect(tracker.summary().conquered).toContain(id);
  });
});

describe('lazyLiveSnapshot', () => {
  it('lê a zona do store na hora em que a corrida a toca: zona carregada depois da largada também vale', () => {
    const store: Record<string, Zone> = {};
    const snap = lazyLiveSnapshot(() => ({ zones: store, names: {} }), NOW);
    expect(snap.zones.z9).toBeUndefined();
    store.z9 = zone('z9', { owner: 'volt' });
    expect(snap.zones.z9).toMatchObject({ owner: 'volt', inherited: 3 });
    const id = zoneOf(HERE);
    store[id] = zone(id, { owner: 'owls' });
    const t = createLiveTracker({ runId: 'r', faction: 'striders', snapshot: snap });
    const ev = t.push({ ...HERE, t: NOW, accuracy: 5 });
    expect(ev[0]).toMatchObject({ type: 'zona_rival_entrou', owner: 'owls' });
  });
});

const zs = (patch: Partial<LiveZoneState>): LiveZoneState => ({
  zoneId: 'z',
  name: null,
  owner: null,
  counts: emptyPaintCounts(),
  gapCells: 3,
  gapMeters: 120,
  mine: false,
  ...patch,
});

describe('hudFor', () => {
  it('sem zona: procurando', () => {
    expect(hudFor(null, 'striders', [])).toEqual({ kind: 'searching' });
  });

  it('zona do time: "mine"; conquistada nesta corrida: "conquered" (texto do Maestro)', () => {
    expect(hudFor(zs({ owner: 'striders', gapCells: 0, gapMeters: 0, mine: true }), 'striders', []).kind).toBe('mine');
    expect(hudFor(zs({ owner: 'striders', gapCells: 0 }), 'striders', ['z']).kind).toBe('conquered');
  });

  it('falta pintar: progresso = meus ÷ (meus + faltam), entre 0 e 1, e os metros do domain', () => {
    const counts = { ...emptyPaintCounts(), striders: 1, owls: 4 };
    const h = hudFor(zs({ owner: 'owls', counts, gapCells: 4, gapMeters: 160 }), 'striders', []);
    expect(h).toEqual({ kind: 'gap', zoneId: 'z', owner: 'owls', progress: 0.2, gapMeters: 160, mine: 1 });
    const zero = hudFor(zs({ owner: null, gapCells: 3 }), 'striders', []);
    expect(zero.kind === 'gap' && zero.progress).toBe(0);
  });
});

describe('liveEffects (createLiveFeedback da E5 no lugar do toastForEvent)', () => {
  const base = { runId: 'r', t: 1, atMeters: 10 };
  const name = (id: string) => `Zona ${id}`;
  const fx = (e: LiveEvent, faction: 'striders' | 'owls' = 'striders') => liveEffects(e, createLiveFeedback({ faction, zoneName: name }).push(e), faction);

  it('micro (trecho pintado, "faltam X m") não vira aviso nem vibra: só atualiza o HUD', () => {
    expect(fx({ ...base, level: 'micro', type: 'trecho_pintado', cell: 'c', zoneId: 'z', kind: 'novo', layers: 1 })).toEqual({ toast: null, haptic: null, voice: null });
    expect(fx({ ...base, level: 'micro', type: 'faltam_metros', zoneId: 'z', gapCells: 2, gapMeters: 80 })).toEqual({ toast: null, haptic: null, voice: null });
  });

  it('entrar em zona rival: sem aviso, sem vibração e sem voz aqui (a faixa do HUD e o Guia já avisam)', () => {
    const e: LiveEvent = { ...base, level: 'pequena', type: 'zona_rival_entrou', zoneId: 'z', name: null, owner: 'volt', counts: emptyPaintCounts(), gapCells: 4, gapMeters: 160 };
    expect(fx(e)).toEqual({ toast: null, haptic: null, voice: null });
  });

  it('progresso: aviso pequeno com "Faltam ~X m" e a vibração leve', () => {
    const p = fx({ ...base, level: 'pequena', type: 'zona_progresso', zoneId: 'z', pct: 50, gapCells: 2, gapMeters: 80 });
    expect(p.toast).toMatchObject({ size: 'small', title: 'Metade da zona', subtitle: 'Faltam ~80 m', haptics: false });
    expect(p.haptic).toBe('tap');
  });

  it('épica (1ª conquista da vida) vira médio com a borda acesa e "Sua 1ª zona!": nada pesado durante a corrida', () => {
    const t = fx({ ...base, level: 'epica', type: 'zona_conquistada', zoneId: 'z', name: 'Lago', from: null, counts: emptyPaintCounts(), provisional: true, first: true }, 'owls');
    expect(t.toast).toMatchObject({ size: 'medium', edgeGlow: true, title: 'Sua 1ª zona!', subtitle: 'Lago', faction: 'owls' });
  });

  it('defesa: aviso médio com o nome do cache quando o evento não traz', () => {
    const t = fx({ ...base, level: 'media', type: 'zona_defendida', zoneId: 'z', name: null, retaken: 3, counts: emptyPaintCounts(), provisional: true });
    expect(t.toast).toMatchObject({ size: 'medium', title: 'Zona defendida', subtitle: 'Zona z' });
    expect(t.haptic).toBe('impact');
  });

  it('ritmo da E3: duas vibrações de progresso em menos de 10 s viram uma só', () => {
    const feedback = createLiveFeedback({ faction: 'striders' });
    const a: LiveEvent = { ...base, t: 1000, level: 'pequena', type: 'zona_progresso', zoneId: 'z', pct: 25, gapCells: 3, gapMeters: 120 };
    const b: LiveEvent = { ...a, t: 5000, pct: 50 };
    expect(liveEffects(a, feedback.push(a), 'striders').haptic).toBe('tap');
    const second = liveEffects(b, feedback.push(b), 'striders');
    expect(second.haptic).toBeNull();
    expect(second.toast).not.toBeNull();
  });
});

describe('enqueueToast', () => {
  const t = (id: string, size: RunToast['size']): RunToast => ({ id, size, haptics: false, edgeGlow: false, title: id, faction: 'striders' });

  it('sem repetir o mesmo aviso', () => {
    expect(enqueueToast([t('a', 'small')], t('a', 'small'))).toHaveLength(1);
  });

  it(`no máximo ${TOAST_QUEUE_MAX}; sai o mais fraco que espera, nunca o que está na tela`, () => {
    let q: RunToast[] = [];
    q = enqueueToast(q, t('tela', 'small'));
    q = enqueueToast(q, t('p1', 'small'));
    q = enqueueToast(q, t('m1', 'medium'));
    q = enqueueToast(q, t('m2', 'medium'));
    expect(q.map((x) => x.id)).toEqual(['tela', 'm1', 'm2']);
    q = enqueueToast(q, t('p2', 'small'));
    expect(q.map((x) => x.id)).toEqual(['tela', 'm1', 'm2']);
  });
});

describe('âncora do mapa da corrida', () => {
  it('muda só ao cruzar a grade de ~500 m (as regiões não são refeitas a cada ponto)', () => {
    const k = mapAnchorKey(HERE);
    expect(mapAnchorKey({ lat: HERE.lat + 0.0001, lng: HERE.lng + 0.0001 })).toBe(k);
    expect(mapAnchorKey({ lat: HERE.lat + 0.01, lng: HERE.lng })).not.toBe(k);
    const a = anchorFromKey(k);
    expect(Math.abs(a.lat - HERE.lat)).toBeLessThan(0.003);
    expect(Math.abs(a.lng - HERE.lng)).toBeLessThan(0.003);
  });
});
