import {
  applyRunPoints,
  decayZone,
  defenseWindowOpen,
  DEFENSE_WINDOW_MS,
  effectiveRp,
  fortifyZone,
  newZone,
  seasonReset,
  type Zone,
} from '../territory';

const owned = (owner: Zone['owner'], ownerInfluence: number, extra: Partial<Zone['influence']> = {}): Zone => ({
  ...newZone('z1'),
  owner,
  influence: { striders: 0, coyotes: 0, owls: 0, volt: 0, ...(owner ? { [owner]: ownerInfluence } : {}), ...extra },
});

describe('RN-002 — conquista com histerese', () => {
  it('zona neutra é conquistada ao chegar a 30', () => {
    const r1 = applyRunPoints(newZone('z1'), 'striders', 29, 0);
    expect(r1.zone.owner).toBeNull();
    const r2 = applyRunPoints(r1.zone, 'striders', 1, 0);
    expect(r2.zone.owner).toBe('striders');
    expect(r2.events[0]).toMatchObject({ type: 'captured', faction: 'striders', from: null });
  });

  it('CT-06: desafiante com 109,9% não toma a zona', () => {
    const zone = owned('striders', 1000, { coyotes: 1000 });
    expect(applyRunPoints(zone, 'coyotes', 99, 0).zone.owner).toBe('striders');
  });

  it('CT-07: desafiante com 110% toma a zona', () => {
    const zone = owned('striders', 1000, { coyotes: 1000 });
    const r = applyRunPoints(zone, 'coyotes', 100, 0);
    expect(r.zone.owner).toBe('coyotes');
    expect(r.events).toContainEqual({ type: 'captured', zoneId: 'z1', faction: 'coyotes', from: 'striders' });
  });

  it('zona bloqueada nunca tem dono', () => {
    const r = applyRunPoints(newZone('z1', true), 'owls', 500, 0);
    expect(r.zone.owner).toBeNull();
    expect(r.zone.influence.owls).toBe(0);
  });
});

describe('RN-003 — ataque e defesa', () => {
  it('CT-11: rival a 50% abre o ataque e a janela de 24 h', () => {
    const r = applyRunPoints(owned('striders', 1000), 'coyotes', 500, 1_000);
    expect(r.events).toContainEqual({ type: 'under_attack', zoneId: 'z1', owner: 'striders', attacker: 'coyotes' });
    expect(defenseWindowOpen(r.zone, 1_000 + DEFENSE_WINDOW_MS)).toBe(true);
    expect(defenseWindowOpen(r.zone, 1_001 + DEFENSE_WINDOW_MS)).toBe(false);
  });

  it('rival a 49% não abre ataque', () => {
    expect(applyRunPoints(owned('striders', 1000), 'coyotes', 490, 0).zone.attackStartedAt).toBeNull();
  });

  it('a defesa encerra o ataque quando o rival cai abaixo de 40%', () => {
    const attacked = applyRunPoints(owned('striders', 1000), 'coyotes', 500, 0).zone;
    const r = applyRunPoints(attacked, 'striders', 300, 10);
    expect(r.zone.attackStartedAt).toBeNull();
    expect(r.events).toContainEqual({ type: 'defended', zoneId: 'z1', owner: 'striders' });
  });
});

describe('RN-004 — escudo', () => {
  it('reduz os pontos do rival em 10/20/30%', () => {
    expect(effectiveRp({ ...owned('striders', 200), shield: 1 }, 'coyotes', 100)).toBeCloseTo(90);
    expect(effectiveRp({ ...owned('striders', 200), shield: 3 }, 'coyotes', 100)).toBeCloseTo(70);
    expect(effectiveRp({ ...owned('striders', 200), shield: 3 }, 'striders', 100)).toBe(100);
  });

  it('sobe com 500 m do dono no dia, desce sem corrida e trava em 3', () => {
    const z = owned('striders', 200);
    expect(fortifyZone(z, 500).shield).toBe(1);
    expect(fortifyZone({ ...z, shield: 3 }, 900).shield).toBe(3);
    expect(fortifyZone({ ...z, shield: 2 }, 0).shield).toBe(1);
    expect(fortifyZone({ ...z, shield: 2 }, 300).shield).toBe(2);
  });
});

describe('RN-005 e RN-006 — decaimento e temporada', () => {
  it('CT-10: 5,4 × 0,9 = 4,86 é zerado', () => {
    const z = owned('striders', 1000, { owls: 5.4 });
    expect(decayZone(z).zone.influence.owls).toBe(0);
    expect(decayZone(z).zone.influence.striders).toBeCloseTo(900);
  });

  it('dono abaixo de 30 após o decaimento perde a zona', () => {
    expect(decayZone(owned('volt', 34)).zone.owner).toBe('volt');
    const r = decayZone(owned('volt', 33));
    expect(r.zone.owner).toBeNull();
    expect(r.events).toEqual([{ type: 'neutralized', zoneId: 'z1', from: 'volt' }]);
  });

  it('a temporada multiplica toda influência por 0,3', () => {
    expect(seasonReset(owned('owls', 1000)).influence.owls).toBeCloseTo(300);
  });
});
