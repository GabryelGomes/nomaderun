/**
 * T7.3.2 (E6b) — folha da zona: placar de 2 cores, 1 frase de regra (≤ 90 caracteres), "faltam X m" pela regra
 * certa (v2: `paintZoneGap`; v1: `influenceGapV1`) e a ação.
 */
import { describe, expect, it } from '@jest/globals';

import { cellCenter } from '@/domain/grid';
import type { LiveSnapshot } from '@/domain/live-events';
import { paintCellOf, paintZoneGap, paintZoneOf } from '@/domain/paint';
import { DEFENSE_WINDOW_MS, influenceGapV1, newZone, type Zone } from '@/domain/territory';

import { countdownText, paintCountsOf, shortTeam, zoneBar, zoneView } from '../zone-sheet.model';

const NOW = Date.UTC(2026, 9, 28, 15);
const HERE = { lat: -16.7097, lng: -49.2388 };
const ZONE_ID = paintZoneOf(paintCellOf(HERE));
const zone = (patch: Partial<Zone> = {}): Zone => ({ ...newZone(ZONE_ID), ...patch });
const BASE = 360;

/** n trechos de um time dentro da zona (de oeste para leste, pelo centro). */
function cells(n: number, faction: 'owls' | 'striders', dLat = 0): LiveSnapshot['cells'] {
  const c = cellCenter(ZONE_ID);
  const out: Record<string, { faction: 'owls' | 'striders'; layers: number }> = {};
  for (let i = 0; Object.keys(out).length < n && i < 200; i++) {
    const cell = paintCellOf({ lat: c.lat + dLat, lng: c.lng - 0.0015 + i * 0.0001 });
    if (paintZoneOf(cell) === ZONE_ID) out[cell] = { faction, layers: 2 };
  }
  return out;
}

describe('paintCountsOf / zoneBar', () => {
  it('conta só os trechos vivos da zona e soma a herança do dono', () => {
    const snap: LiveSnapshot = { cells: { ...cells(4, 'owls'), ...cells(2, 'striders', 0.0004) }, zones: { [ZONE_ID]: { owner: 'owls', inherited: 3 } } };
    expect(paintCountsOf(snap, ZONE_ID)).toMatchObject({ owls: 7, striders: 2, volt: 0, coyotes: 0 });
  });

  it('dono × rival mais forte; zona neutra mostra o seu time à esquerda; sem nada, sem barra', () => {
    expect(zoneBar({ owls: 7, striders: 2, volt: 3, coyotes: 0 }, 'owls', 'striders')).toEqual({ left: 'owls', leftValue: 7, right: 'volt', rightValue: 3, share: 0.7 });
    expect(zoneBar({ owls: 0, striders: 0, volt: 2, coyotes: 0 }, null, 'striders')).toMatchObject({ left: 'striders', right: 'volt', share: 0 });
    expect(zoneBar({ owls: 0, striders: 0, volt: 0, coyotes: 0 }, null, 'striders')).toBeNull();
    expect(shortTeam('owls')).toBe('Owls');
  });
});

describe('zoneView', () => {
  it('v2 (com o retrato): "faltam X m" é o do paintZoneGap e a regra fala de ruas', () => {
    const snap: LiveSnapshot = { cells: cells(5, 'owls'), zones: { [ZONE_ID]: { owner: 'owls', inherited: 3 } } };
    const v = zoneView({ zone: zone({ owner: 'owls' }), faction: 'striders', now: NOW, paint: snap, basePaceSecPerKm: BASE });
    const g = paintZoneGap(paintCountsOf(snap, ZONE_ID), 'striders', 'owls');
    expect(v.rule).toBe('v2');
    expect(v.gapLine).toBe(`Faltam ~${g.meters} m de ruas para conquistar`);
    expect(v.ruleLine).toBe('A zona fica com o time que pintou mais ruas nela.');
    expect(v).toMatchObject({ ownerLine: 'Dos Night Owls', cta: 'Correr aqui', attackEndsAt: null });
  });

  it('v1 (sem o retrato): "faltam X m" é o do influenceGapV1 e a regra fala de domínio', () => {
    const z = zone({ owner: 'owls', influence: { owls: 400, striders: 50, volt: 0, coyotes: 0 } });
    const v = zoneView({ zone: z, faction: 'striders', now: NOW, paint: null, basePaceSecPerKm: BASE });
    const g = influenceGapV1({ zone: z, faction: 'striders', now: NOW, paceSecPerKm: BASE, basePaceSecPerKm: BASE });
    expect(v.rule).toBe('v1');
    expect(v.gapLine).toBe(g.reachableToday ? `Faltam ~${g.meters} m aqui para conquistar` : 'Teto de hoje atingido: volte amanhã');
    expect(v.bar).toMatchObject({ left: 'owls', leftValue: 400, right: 'striders', rightValue: 50 });
  });

  it('sua zona sob ataque: relógio da defesa, "Defender esta zona" e a frase da defesa', () => {
    const started = NOW - 2 * 3_600_000;
    const z = zone({ owner: 'striders', attacker: 'owls', attackStartedAt: started, influence: { striders: 100, owls: 80, volt: 0, coyotes: 0 } });
    const v1 = zoneView({ zone: z, faction: 'striders', now: NOW, paint: null, basePaceSecPerKm: BASE });
    expect(v1).toMatchObject({ ownerLine: 'Dos Neon Striders · sob ataque', cta: 'Defender esta zona', attackEndsAt: started + DEFENSE_WINDOW_MS, ruleLine: 'Corra aqui: seus pontos valem em dobro.' });
    const v2 = zoneView({ zone: z, faction: 'striders', now: NOW, paint: { cells: {}, zones: {} }, basePaceSecPerKm: BASE });
    expect(v2.ruleLine).toBe('Pinte as ruas de volta para expulsar o rival.');
  });

  it('ataque vencido: sem relógio, "Reforçar esta zona"', () => {
    const z = zone({ owner: 'striders', attacker: 'owls', attackStartedAt: NOW - DEFENSE_WINDOW_MS - 1 });
    expect(zoneView({ zone: z, faction: 'striders', now: NOW, paint: null, basePaceSecPerKm: BASE })).toMatchObject({ attackEndsAt: null, cta: 'Reforçar esta zona', ownerLine: 'Dos Neon Striders' });
  });

  it('zona neutra e zona fechada', () => {
    expect(zoneView({ zone: zone(), faction: 'volt', now: NOW, paint: null, basePaceSecPerKm: BASE }).ownerLine).toBe('Zona neutra');
    expect(zoneView({ zone: zone({ blocked: true }), faction: 'volt', now: NOW, paint: null, basePaceSecPerKm: BASE }).gapLine).toBe('Zona fechada para disputa');
  });

  it('todas as frases cabem em 1 linha curta (D-74: ≤ 90 caracteres, 1 frase)', () => {
    const z = zone({ owner: 'striders', attacker: 'owls', attackStartedAt: NOW - 1000 });
    for (const paint of [null, { cells: {}, zones: {} }]) {
      for (const f of ['striders', 'owls'] as const) {
        const v = zoneView({ zone: z, faction: f, now: NOW, paint, basePaceSecPerKm: BASE });
        for (const line of [v.ruleLine, v.gapLine ?? '', v.ownerLine]) {
          expect(line.length).toBeLessThanOrEqual(90);
          expect(line.replace(/\.$/, '')).not.toMatch(/[.!?]\s/);
        }
      }
    }
  });
});

describe('countdownText', () => {
  it('contagem por extenso até o fim da defesa (UX-09), nunca negativo nem "h:mm"', () => {
    expect(countdownText(NOW + 17 * 3_600_000 + 27 * 60_000 + 30_000, NOW)).toBe('Faltam 17 h 27 min');
    expect(countdownText(NOW + 5 * 60_000, NOW)).toBe('Faltam 5 min');
    expect(countdownText(NOW - 1, NOW)).toBe('Prazo encerrado');
  });
});
