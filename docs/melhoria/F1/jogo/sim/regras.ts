/**
 * As regras comparadas na simulação.
 *  A  — regra ATUAL, chamando o próprio domain (scoreZone, applyRunPoints, fortifyZone, decayZone, seasonReset)
 *       na mesma ordem do finishRun e dos jobs do servidor (fortificar 00:05, temporada 00:15, decair 03:00).
 *  B  — M4 "barra de domínio" limitada (cabo de guerra de 100 pontos por zona, rua nova vale 2×).
 *  C  — M1 "pintar ruas" (trechos H3 res 11 com até 3 camadas que desbotam; zona = time com mais trechos).
 *  D  — C + M2 "fechar o circuito" (pinta até 40 trechos vazios de dentro da volta).
 *  Variantes: sem decaimento (A0), sem desbotar (C0) e bônus de azarão (C+az / D+az).
 */
import { scoreZone } from '../../../../../apps/mobile/src/domain/scoring';
import {
  applyRunPoints,
  CAPTURE_THRESHOLD,
  decayZone,
  defenseWindowOpen,
  fortifyZone,
  newZone,
  seasonReset,
  SHIELD_MAX,
  SHIELD_REDUCTION,
  TAKEOVER_RATIO,
  type Zone,
} from '../../../../../apps/mobile/src/domain/territory';
import { FACTION_IDS, type FactionId } from '../../../../../apps/mobile/src/domain/types';

import { DIA_MS, T0, type Corredor, type Corrida } from './agentes';
import { h3 } from './base';

export type Captura = { zona: string; de: FactionId | null; para: FactionId; marca: number };

export interface Regra {
  nome: string;
  correr(c: Corrida, k: Corredor): Captura[];
  /** Fim do dia `dia` (jobs da madrugada seguinte). `virada` = começa uma temporada nova. */
  fimDoDia(dia: number, virada: boolean): void;
  dono(z: string): FactionId | null;
  /** zona → corredor que mais contribuiu para o time dono */
  credito(): Map<string, number>;
  /** metros DENTRO da zona que 1 corredor de outro time (esforço 1,0, sem bônus) precisa para tomá-la */
  custoTomar(z: string): number | null;
}

const zero = (): Record<FactionId, number> => ({ striders: 0, coyotes: 0, owls: 0, volt: 0 });

function marcaNaRota(c: Corrida, zona: string, metrosNaZona: number): number {
  let total = 0;
  let naZona = 0;
  for (let i = 0; i < c.rota.passoZona.length; i++) {
    total += c.rota.passoMetros[i];
    if (c.rota.passoZona[i] === zona) {
      naZona += c.rota.passoMetros[i];
      if (naZona >= metrosNaZona) return total;
    }
  }
  return total;
}

/* =============================================================== A — atual */
export class RegraAtual implements Regra {
  nome: string;
  private zonas = new Map<string, Zone>();
  private ganhoHoje = new Map<string, number>();
  private metrosTime = new Map<string, Record<FactionId, number>>();
  private contrib = new Map<string, Map<number, number>>();
  constructor(
    private corredores: Corredor[],
    private opts: { decaimento: boolean } = { decaimento: true },
  ) {
    this.nome = opts.decaimento ? 'A atual' : 'A0 atual sem decaimento';
  }

  correr(c: Corrida, k: Corredor): Captura[] {
    const caps: Captura[] = [];
    for (const [z, m] of c.rota.zonaMetros) {
      const before = this.zonas.get(z) ?? newZone(z);
      const defending = before.owner === k.time && defenseWindowOpen(before, c.agora);
      const key = `${k.id}|${z}`;
      const { rp } = scoreZone({
        meters: m,
        paceSecPerKm: c.ritmo,
        basePaceSecPerKm: c.ritmoBase,
        streakDays: c.sequenciaSemanas,
        defending,
        earnedTodayInZone: this.ganhoHoje.get(key) ?? 0,
      });
      const { zone: after, events } = applyRunPoints(before, k.time, rp, c.agora);
      this.zonas.set(z, after);
      this.ganhoHoje.set(key, (this.ganhoHoje.get(key) ?? 0) + rp);
      const mt = this.metrosTime.get(z) ?? zero();
      mt[k.time] += m;
      this.metrosTime.set(z, mt);
      const cz = this.contrib.get(z) ?? new Map<number, number>();
      cz.set(k.id, (cz.get(k.id) ?? 0) + rp);
      this.contrib.set(z, cz);
      for (const e of events) {
        if (e.type !== 'captured') continue;
        let marca = c.rota.metros;
        if (e.faction === k.time && rp > 0) {
          const red = before.owner && before.owner !== k.time ? 1 - SHIELD_REDUCTION[Math.min(before.shield, SHIELD_MAX)] : 1;
          const alvo = before.owner === null ? CAPTURE_THRESHOLD : Math.max(before.influence[before.owner] * TAKEOVER_RATIO, CAPTURE_THRESHOLD);
          const falta = Math.max(0, alvo - before.influence[k.time]) / red;
          marca = marcaNaRota(c, z, (falta / rp) * m);
        }
        caps.push({ zona: z, de: e.from, para: e.faction, marca });
      }
    }
    return caps;
  }

  fimDoDia(_dia: number, virada: boolean) {
    // 00:05 — fortificar (RN-004): metros do time dono na zona no dia
    for (const [id, z] of this.zonas) {
      if (!z.owner) continue;
      this.zonas.set(id, fortifyZone(z, this.metrosTime.get(id)?.[z.owner] ?? 0));
    }
    this.metrosTime.clear();
    this.ganhoHoje.clear();
    // 00:15 do dia 1 — temporada (RN-006)
    if (virada) {
      for (const [id, z] of this.zonas) this.zonas.set(id, seasonReset(z));
      for (const cz of this.contrib.values()) for (const [k, v] of cz) cz.set(k, v * 0.3);
    }
    // 03:00 — decaimento (RN-005)
    if (this.opts.decaimento) {
      for (const [id, z] of this.zonas) this.zonas.set(id, decayZone(z).zone);
      for (const cz of this.contrib.values()) for (const [k, v] of cz) cz.set(k, v * 0.9);
    }
  }

  dono(z: string) {
    return this.zonas.get(z)?.owner ?? null;
  }

  credito() {
    const out = new Map<string, number>();
    for (const [id, z] of this.zonas) {
      if (!z.owner) continue;
      let best = -1;
      let v = 0;
      for (const [k, rp] of this.contrib.get(id) ?? []) {
        if (this.corredores[k].time === z.owner && rp > v) (v = rp), (best = k);
      }
      if (best >= 0) out.set(id, best);
    }
    return out;
  }

  custoTomar(id: string) {
    const z = this.zonas.get(id);
    if (!z?.owner) return null;
    const red = 1 - SHIELD_REDUCTION[Math.min(z.shield, SHIELD_MAX)];
    const alvo = Math.max(z.influence[z.owner] * TAKEOVER_RATIO, CAPTURE_THRESHOLD);
    return alvo / 0.1 / red;
  }
}

/* =============================================================== B — barra limitada (M4) */
export const BARRA = { CAP: 100, MIN: 30, PONTOS_POR_M: 0.1, NOVO: 2, DECAI: 0.95, VIRADA: 0.5 };

export class RegraBarra implements Regra {
  nome: string;
  private ctl = new Map<string, Record<FactionId, number>>();
  private donos = new Map<string, FactionId | null>();
  private neblina: Set<string>[];
  private ganhoHoje = new Map<string, number>();
  private contrib = new Map<string, Map<number, number>>();
  private P: typeof BARRA;
  constructor(
    private corredores: Corredor[],
    P: Partial<typeof BARRA> = {},
  ) {
    this.P = { ...BARRA, ...P };
    this.nome = `B barra limitada (M4) cap ${this.P.CAP}`;
    this.neblina = corredores.map(() => new Set<string>());
  }

  private avaliar(z: string): FactionId | null {
    const c = this.ctl.get(z)!;
    const atual = this.donos.get(z) ?? null;
    let top: FactionId | null = null;
    for (const f of FACTION_IDS) if (top === null || c[f] > c[top]) top = f;
    let novo = atual;
    if (top && c[top] >= this.P.MIN && (atual === null || c[top] > c[atual])) novo = top;
    if (novo && c[novo] < this.P.MIN) novo = null;
    this.donos.set(z, novo);
    return novo;
  }

  private empurrar(c: Record<FactionId, number>, f: FactionId, p: number) {
    const livre = this.P.CAP - FACTION_IDS.reduce((s, x) => s + c[x], 0);
    const a = Math.min(p, Math.max(0, livre));
    c[f] += a;
    p -= a;
    while (p > 1e-9) {
      let r: FactionId | null = null;
      for (const x of FACTION_IDS) if (x !== f && c[x] > 0 && (r === null || c[x] > c[r])) r = x;
      if (!r) break;
      const d = Math.min(p, c[r]);
      c[r] -= d;
      c[f] += d;
      p -= d;
    }
  }

  correr(c: Corrida, k: Corredor): Captura[] {
    const caps: Captura[] = [];
    const fog = this.neblina[k.id];
    let total = 0;
    for (let i = 0; i < c.rota.passoZona.length; i++) {
      const z = c.rota.passoZona[i];
      const m = c.rota.passoMetros[i];
      total += m;
      const novo = !fog.has(c.rota.passoNeblina[i]);
      fog.add(c.rota.passoNeblina[i]);
      const key = `${k.id}|${z}`;
      const room = this.P.CAP - (this.ganhoHoje.get(key) ?? 0);
      const p = Math.min(room, m * this.P.PONTOS_POR_M * c.esforco * (novo ? this.P.NOVO : 1));
      if (p <= 0) continue;
      this.ganhoHoje.set(key, (this.ganhoHoje.get(key) ?? 0) + p);
      const ctl = this.ctl.get(z) ?? zero();
      this.ctl.set(z, ctl);
      const antes = this.donos.get(z) ?? null;
      this.empurrar(ctl, k.time, p);
      const cz = this.contrib.get(z) ?? new Map<number, number>();
      cz.set(k.id, (cz.get(k.id) ?? 0) + p);
      this.contrib.set(z, cz);
      const depois = this.avaliar(z);
      if (depois && depois !== antes) caps.push({ zona: z, de: antes, para: depois, marca: total });
    }
    return caps;
  }

  fimDoDia(_dia: number, virada: boolean) {
    this.ganhoHoje.clear();
    for (const [z, c] of this.ctl) {
      for (const f of FACTION_IDS) c[f] *= this.P.DECAI * (virada ? this.P.VIRADA : 1);
      this.avaliar(z);
    }
    for (const cz of this.contrib.values()) for (const [k, v] of cz) cz.set(k, v * this.P.DECAI);
  }

  dono(z: string) {
    return this.donos.get(z) ?? null;
  }

  credito() {
    const out = new Map<string, number>();
    for (const [z, o] of this.donos) {
      if (!o) continue;
      let best = -1;
      let v = 0;
      for (const [k, p] of this.contrib.get(z) ?? []) if (this.corredores[k].time === o && p > v) (v = p), (best = k);
      if (best >= 0) out.set(z, best);
    }
    return out;
  }

  custoTomar(z: string) {
    const o = this.donos.get(z);
    if (!o) return null;
    const c = { ...this.ctl.get(z)! };
    let x: FactionId = FACTION_IDS.find((f) => f !== o)!;
    for (const f of FACTION_IDS) if (f !== o && c[f] < c[x]) x = f;
    let p = 0;
    while (p < 1000) {
      this.empurrar(c, x, 1);
      p += 1;
      if (c[x] >= this.P.MIN && c[x] > c[o]) break;
    }
    return p / this.P.PONTOS_POR_M;
  }
}

/* =============================================================== C/D — pintar ruas (M1) + circuito (M2) */
export const PINTURA = { CAMADAS_MAX: 3, DESBOTA_DIAS: 7, MIN_TRECHOS: 3, MIOLO_MAX: 40, AZARAO_PARTE: 0.15, METROS_POR_TRECHO: 40 };

type Trecho = { t: FactionId; l: number; last: number; by: number; z: string };

export class RegraPintura implements Regra {
  nome: string;
  private cel = new Map<string, Trecho>();
  private porZona = new Map<string, Set<string>>();
  private cont = new Map<string, Record<FactionId, number>>();
  private donos = new Map<string, FactionId | null>();
  private parte: Record<FactionId, number> = { striders: 0.25, coyotes: 0.25, owls: 0.25, volt: 0.25 };
  constructor(
    private corredores: Corredor[],
    private opts: { miolo: boolean; azarao: boolean; desbotar: boolean; protecaoH?: number; margem?: number; reforcoConquista?: boolean },
  ) {
    this.nome = `${opts.miolo ? 'D pintura + circuito (M1+M2)' : 'C pintura (M1)'}${opts.azarao ? ' + azarão' : ''}${opts.desbotar ? '' : ' sem desbotar'}${opts.protecaoH ? ` + proteção ${opts.protecaoH} h` : ''}${opts.margem && opts.margem > 1 ? ` + margem ${opts.margem}` : ''}${opts.reforcoConquista ? ' + reforço na conquista' : ''}`;
  }
  private protegidaAte = new Map<string, number>();

  private avaliar(z: string, agora = 0): FactionId | null {
    const c = this.cont.get(z) ?? zero();
    const atual = this.donos.get(z) ?? null;
    if (atual && (this.protegidaAte.get(z) ?? 0) > agora) return atual;
    let top: FactionId | null = null;
    for (const f of FACTION_IDS) if (top === null || c[f] > c[top]) top = f;
    let novo = atual;
    const margem = this.opts.margem ?? 1;
    if (top && c[top] >= PINTURA.MIN_TRECHOS && (atual === null || c[top] >= c[atual] + margem)) novo = top;
    if (novo && c[novo] < PINTURA.MIN_TRECHOS) novo = top && top !== novo && c[top] >= PINTURA.MIN_TRECHOS ? top : null;
    if (novo && novo !== atual && this.opts.protecaoH) this.protegidaAte.set(z, agora + this.opts.protecaoH * 3_600_000);
    this.donos.set(z, novo);
    return novo;
  }

  private add(z: string, cell: string, t: Trecho) {
    this.cel.set(cell, t);
    let s = this.porZona.get(z);
    if (!s) this.porZona.set(z, (s = new Set()));
    s.add(cell);
    const c = this.cont.get(z) ?? zero();
    c[t.t]++;
    this.cont.set(z, c);
  }

  private pintar(cell: string, z: string, k: Corredor, dia: number, remove: number) {
    const e = this.cel.get(cell);
    if (!e) return this.add(z, cell, { t: k.time, l: 1, last: dia, by: k.id, z });
    if (e.t === k.time) {
      e.l = Math.min(PINTURA.CAMADAS_MAX, e.l + 1);
      e.last = dia;
      e.by = k.id;
      return;
    }
    e.l -= remove;
    if (e.l <= 0) {
      const c = this.cont.get(z)!;
      c[e.t]--;
      c[k.time]++;
      e.t = k.time;
      e.l = 1;
      e.last = dia;
      e.by = k.id;
    }
  }

  correr(c: Corrida, k: Corredor): Captura[] {
    const caps: Captura[] = [];
    const remove = this.opts.azarao && this.parte[k.time] < PINTURA.AZARAO_PARTE ? 2 : 1;
    const checar = (z: string, marca: number) => {
      const antes = this.donos.get(z) ?? null;
      const depois = this.avaliar(z, c.agora);
      if (depois && depois !== antes) {
        caps.push({ zona: z, de: antes, para: depois, marca });
        if (this.opts.reforcoConquista && depois === k.time) {
          for (const cell of this.porZona.get(z) ?? []) {
            const e = this.cel.get(cell)!;
            if (e.t === k.time) e.l = Math.min(PINTURA.CAMADAS_MAX, e.l + 1);
          }
        }
      }
    };
    for (const { cell, zona, marca } of c.rota.celulas) {
      this.pintar(cell, zona, k, c.dia, remove);
      checar(zona, marca);
    }
    if (this.opts.miolo) {
      let n = 0;
      const tocadas = new Set<string>();
      for (const cell of c.rota.miolo) {
        if (n >= PINTURA.MIOLO_MAX) break;
        const e = this.cel.get(cell);
        const z = h3.cellToParent(cell, 9);
        if (!e) {
          this.add(z, cell, { t: k.time, l: 1, last: c.dia, by: k.id, z });
          n++;
          tocadas.add(z);
        } else if (e.t === k.time) e.last = c.dia;
      }
      for (const z of tocadas) checar(z, c.rota.metros);
    }
    return caps;
  }

  fimDoDia(dia: number, virada: boolean) {
    const mexidas = new Set<string>();
    if (this.opts.desbotar) {
      for (const [cell, e] of this.cel) {
        if (dia + 1 - e.last < PINTURA.DESBOTA_DIAS) continue;
        e.l--;
        e.last = dia + 1;
        if (e.l <= 0) {
          this.cel.delete(cell);
          this.porZona.get(e.z)!.delete(cell);
          this.cont.get(e.z)![e.t]--;
        }
        mexidas.add(e.z);
      }
    }
    if (virada) {
      for (const e of this.cel.values()) e.l = 1;
    }
    const madrugada = T0 + (dia + 1) * DIA_MS + 3 * 3_600_000;
    for (const z of mexidas) this.avaliar(z, madrugada);
    const tot = zero();
    for (const e of this.cel.values()) tot[e.t]++;
    const soma = FACTION_IDS.reduce((s, f) => s + tot[f], 0) || 1;
    for (const f of FACTION_IDS) this.parte[f] = tot[f] / soma;
  }

  dono(z: string) {
    return this.donos.get(z) ?? null;
  }

  credito() {
    const out = new Map<string, number>();
    for (const [z, o] of this.donos) {
      if (!o) continue;
      const por = new Map<number, number>();
      for (const cell of this.porZona.get(z) ?? []) {
        const e = this.cel.get(cell)!;
        if (e.t === o) por.set(e.by, (por.get(e.by) ?? 0) + 1);
      }
      let best = -1;
      let v = 0;
      for (const [k, n] of por) if (n > v) (v = n), (best = k);
      if (best >= 0) out.set(z, best);
    }
    return out;
  }

  custoTomar(z: string) {
    const o = this.donos.get(z);
    if (!o) return null;
    const c = this.cont.get(z)!;
    const segundo = Math.max(...FACTION_IDS.filter((f) => f !== o).map((f) => c[f]));
    const camadas = [...(this.porZona.get(z) ?? [])].map((x) => this.cel.get(x)!).filter((e) => e.t === o).map((e) => e.l).sort((a, b) => a - b);
    // menor k com k > (dono − k) e k > segundo colocado e k ≥ mínimo
    let k = 1;
    while (k <= camadas.length && !(k > c[o] - k && k > segundo && k >= PINTURA.MIN_TRECHOS)) k++;
    const passadas = camadas.slice(0, Math.min(k, camadas.length)).reduce((s, l) => s + l, 0) + Math.max(0, k - camadas.length);
    return passadas * PINTURA.METROS_POR_TRECHO;
  }
}
