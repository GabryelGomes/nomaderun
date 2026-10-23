/**
 * Prova de fidelidade: a regra A da simulação dá o MESMO resultado que o `finishRun` do domain
 * (o cálculo oficial que o servidor roda), corrida a corrida, com pontos de GPS sintéticos completos.
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/verifica-atual.ts
 */
import { finishRun, startRun } from '../../../../../apps/mobile/src/domain/run-engine';
import { decayZone, fortifyZone, type Zone } from '../../../../../apps/mobile/src/domain/territory';
import type { GeoPoint } from '../../../../../apps/mobile/src/domain/types';
import { distanceMeters } from '../../../../../apps/mobile/src/domain/geo';

import { montarAgenda } from './agentes';
import { mapaBairro271 } from './base';
import { RegraAtual } from './regras';

const g = mapaBairro271();
const agenda = montarAgenda(g, { semente: 1, times: 'equilibrados', densidade: 90 });
const regra = new RegraAtual(agenda.corredores);
const zonas: Record<string, Zone> = {};
const ganho: Record<string, number> = {};
const metrosTime: Record<string, Record<string, number>> = {};
const N = 400;
let dia = 0;
let difMax = 0;
let comparadas = 0;
let conquistasIguais = 0;
for (const c of agenda.corridas.slice(0, N)) {
  while (dia < c.dia) {
    regra.fimDoDia(dia, false);
    for (const [id, z] of Object.entries(zonas)) zonas[id] = fortifyZone(z, z.owner ? (metrosTime[id]?.[z.owner] ?? 0) : 0);
    for (const k of Object.keys(metrosTime)) delete metrosTime[k];
    for (const k of Object.keys(ganho)) delete ganho[k];
    for (const [id, z] of Object.entries(zonas)) zonas[id] = decayZone(z).zone;
    dia++;
  }
  const k = agenda.corredores[c.corredor];
  // pontos de GPS completos: tempo pelo ritmo, precisão 5 m, ~170 passos/min
  let t = c.agora;
  const pts: GeoPoint[] = c.rota.pontos.map((p, i) => {
    if (i > 0) t += (distanceMeters(c.rota.pontos[i - 1], p) / 1000) * c.ritmo * 1000;
    const dt = i > 0 ? (distanceMeters(c.rota.pontos[i - 1], p) / 1000) * c.ritmo : 0;
    return { lat: p.lat, lng: p.lng, t, accuracy: 5, steps: Math.round((dt * 170) / 60) };
  });
  const earned: Record<string, number> = {};
  for (const [kk, v] of Object.entries(ganho)) if (kk.startsWith(`${k.id}|`)) earned[kk.split('|')[1]] = v;
  const oficial = finishRun({ ...startRun(c.agora), points: pts }, {
    faction: k.time,
    basePace: c.ritmoBase,
    streakDays: c.sequenciaSemanas,
    zones: zonas,
    revealedFog: new Set(),
    now: c.agora,
    earnedTodayByZone: earned,
  });
  const caps = regra.correr(c, k);
  for (const o of oficial.zones) {
    ganho[`${k.id}|${o.zoneId}`] = (ganho[`${k.id}|${o.zoneId}`] ?? 0) + o.rp;
    (metrosTime[o.zoneId] ??= {})[k.time] = (metrosTime[o.zoneId]?.[k.time] ?? 0) + o.meters;
  }
  Object.assign(zonas, oficial.updatedZones);
  for (const [id, z] of Object.entries(oficial.updatedZones)) {
    for (const f of Object.keys(z.influence) as (keyof Zone['influence'])[]) {
      difMax = Math.max(difMax, Math.abs(z.influence[f] - (regra as unknown as { zonas: Map<string, Zone> }).zonas.get(id)!.influence[f]));
    }
    comparadas++;
  }
  const capsOficiais = oficial.events.filter((e) => e.type === 'captured').length;
  if (capsOficiais === caps.length) conquistasIguais++;
}
console.log(`corridas comparadas: ${N}; zonas comparadas: ${comparadas}`);
console.log(`maior diferença de influência (sim × finishRun): ${difMax.toFixed(6)}`);
console.log(`corridas com o mesmo nº de conquistas: ${conquistasIguais}/${N}`);
if (difMax > 1e-6 || conquistasIguais !== N) process.exit(1);
