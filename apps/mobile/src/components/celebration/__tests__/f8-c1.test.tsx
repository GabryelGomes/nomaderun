/**
 * F8 · onda C, frente C1 (E5): as animações da fase. Contas puras (tempos, ordem das zonas que acendem, fase do
 * chefão, vibração por time) e cada componente novo: renderiza, respeita "Reduzir movimento" (só opacidade) e não
 * anima fora de foco / quando não deve tocar.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('../../motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('../../motion/__tests__/render-mocks').worklets);
jest.mock('react-native-svg', () => require('../../motion/__tests__/render-mocks').svg);
jest.mock('expo-haptics', () => require('../../motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('../../motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Mascot } from '@/components/art';
import { TeamCover } from '@/components/art/team/cover';
import { COVER_TAP } from '@/components/art/team/cover-art';
import { TeamCoverCard } from '@/components/team-cover-carousel';
import { cellCenter, zoneOf } from '@/domain/grid';
import { BossPhaseMoment, DistrictStampMoment, FirstPaintMoment, LeaderComment } from '@/features/engagement/summary-moments';
import { contrastRatio } from '@/features/run/banner-color';
import { raidPhaseHitOf } from '@/features/run/summary-extras';
import { neon, neonTeam } from '@/theme/neon';
import { factions } from '@/theme/tokens';

import { mockHapticCalls, mockState } from '../../motion/__tests__/render-mocks';
import { resetHaptics, TEAM_HAPTIC_STEP_MS, TEAM_HAPTICS, teamHaptic } from '../../motion/haptics';
import { ReducedMotionOverride } from '../../motion/reduced-motion';
import { pulseKeyframes, StampIn } from '../../motion/stamp-in';
import { glowDashOffset, TRAIL_GLOW_LENGTH, TRAIL_GLOW_SEGMENT, TrailGlow } from '../../motion/trail-glow';
import { BossHit } from '../boss';
import {
  BOSS_PHASE,
  bossPhaseOpened,
  FIRST_PAINT,
  firstPaintHoldMs,
  flippedZones,
  flipLightDelays,
  flipTotalMs,
  leaderCommentDelay,
  NEIGHBORHOOD_FLIP,
  recordCountEndMs,
  TRAIL_REVEAL,
} from '../f8-choreography';
import { FirstPaintSeal } from '../first-paint';
import { NeighborhoodFlip, neighborhoodFlipLabel } from '../neighborhood-flip';
import { BLOB_RADIUS, neighborhoodZonesFrom, projectNeighborhood } from '../neighborhood-math';
import { PRStamp } from '../progress-moments';
import { planCelebrations, type CelebrationEvent } from '../queue';
import { TeamWeekCard } from '../team-week-card';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}

function hostStyles(r: ReactTestRenderer): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const flat = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(flat);
    else if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  };
  r.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style !== undefined).forEach((n: ReactTestInstance) => flat(n.props.style));
  return out;
}

/** Quadros-chave só de transform e opacidade (nada de layout). */
function onlyTransformAndOpacity(r: ReactTestRenderer) {
  for (const s of hostStyles(r)) {
    const kf = s.animationName as Record<string, Record<string, unknown>> | undefined;
    if (kf) for (const frame of Object.values(kf)) for (const k of Object.keys(frame)) expect(['opacity', 'transform']).toContain(k);
  }
}

/** "Reduzir movimento": nenhuma animação CSS desloca, escala nem gira (só opacidade). */
function onlyOpacity(r: ReactTestRenderer) {
  for (const s of hostStyles(r)) {
    const kf = s.animationName as Record<string, Record<string, unknown>> | undefined;
    if (kf) for (const frame of Object.values(kf)) expect(Object.keys(frame)).toEqual(['opacity']);
  }
}

const has = (r: ReactTestRenderer, id: string) => r.root.findAll((n: ReactTestInstance) => n.props.testID === id).length > 0;
const runnerAnimated = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => typeof n.type === 'function' && n.props.team !== undefined && 'animated' in n.props && n.props.size !== undefined && n.props.quality !== undefined).map((n) => n.props.animated);

let announce: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  mockHapticCalls.length = 0;
  resetHaptics();
});
afterEach(() => {
  jest.useRealTimers();
  announce.mockRestore();
  mockState.reduced = false;
});

describe('contas puras (F8 · C1)', () => {
  it('as zonas viradas acendem a cada 120 ms, no máximo 5, e nenhuma com movimento reduzido', () => {
    expect(flipLightDelays(7, false)).toEqual([400, 520, 640, 760, 880, null, null]);
    expect(flipLightDelays(3, true)).toEqual([null, null, null]);
    expect(flipLightDelays(-2, false)).toEqual([]);
    expect(flipLightDelays(Number.NaN, false)).toEqual([]);
    expect(NEIGHBORHOOD_FLIP).toMatchObject({ crossMs: 800, stepMs: 120, maxLit: 5 });
    expect(flipTotalMs(0, false)).toBe(800);
    expect(flipTotalMs(5, false)).toBe(880 + NEIGHBORHOOD_FLIP.lightMs);
    expect(flipTotalMs(5, true)).toBe(150);
  });

  it('zona virada = o depois tem dono e é outro', () => {
    const z = [
      { id: 'a', before: 'owls', after: 'volt' },
      { id: 'b', before: null, after: 'volt' },
      { id: 'c', before: 'volt', after: 'volt' },
      { id: 'd', before: 'owls', after: null },
    ] as const;
    expect(flippedZones(z).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('o golpe abre a fase 2 abaixo de 67% e a 3 abaixo de 33% (vale a maior); sem mudança, nada', () => {
    expect(bossPhaseOpened(2500, 2350, 3600)).toBe(2); // 69% → 65%
    expect(bossPhaseOpened(1300, 1100, 3600)).toBe(3); // 36% → 31%
    expect(bossPhaseOpened(3000, 1000, 3600)).toBe(3); // pulou as duas
    expect(bossPhaseOpened(1500, 1404, 3600)).toBeNull(); // 42% → 39%: segue na 2
    expect(bossPhaseOpened(1200, 1104, 3600)).toBe(3); // 33,3% → 30,7%: abre a 3
    expect(bossPhaseOpened(2000, 2100, 3600)).toBeNull(); // vida subiu: dado incoerente
    expect(bossPhaseOpened(10, 5, 0)).toBeNull();
    expect(bossPhaseOpened(Number.NaN, 5, 10)).toBeNull();
    expect(BOSS_PHASE.bannerAt).toBeGreaterThan(400); // depois do cambaleio (achatamento de 420 ms)
  });

  it('tempos: rota em 600 ms, moldura de 0,9; selo do 1º trecho em 1,5 s com brilho de 400 ms; líder 300 ms depois dos números', () => {
    expect(TRAIL_REVEAL).toEqual({ drawMs: 600, frameFrom: 0.9 });
    expect(FIRST_PAINT.lifeMs).toBe(1500);
    expect(FIRST_PAINT.glowMs).toBe(400);
    expect(firstPaintHoldMs()).toBe(1500 - FIRST_PAINT.enterMs - FIRST_PAINT.exitMs);
    expect(firstPaintHoldMs({ lifeMs: 100, enterMs: 350, exitMs: 200 })).toBe(0);
    expect(leaderCommentDelay(null)).toBe(300);
    expect(leaderCommentDelay(recordCountEndMs())).toBe(recordCountEndMs() + 300);
    expect(leaderCommentDelay(-5)).toBe(300);
    expect(COVER_TAP.scales).toEqual([0.98, 1.02, 1]);
    expect(COVER_TAP.mottoFrom).toBe(0.6);
  });

  it('vibração por time: Striders 1 toque, Volt 2 curtos, Owls 1 longo, Coyotes 3 curtos, sempre ≥ 150 ms entre toques', () => {
    expect(TEAM_HAPTICS.striders.map((s) => s.pattern)).toEqual(['tap']);
    expect(TEAM_HAPTICS.volt.map((s) => s.pattern)).toEqual(['tap', 'tap']);
    expect(TEAM_HAPTICS.owls.map((s) => s.pattern)).toEqual(['heavy']);
    expect(TEAM_HAPTICS.coyotes.map((s) => s.pattern)).toEqual(['tap', 'tap', 'tap']);
    for (const steps of Object.values(TEAM_HAPTICS)) for (let i = 1; i < steps.length; i++) expect(steps[i].offsetMs - steps[i - 1].offsetMs).toBeGreaterThanOrEqual(150);
    expect(TEAM_HAPTIC_STEP_MS).toBeGreaterThanOrEqual(150);
  });

  it('teamHaptic toca os passos do time no aparelho (nenhum descartado pelo portão) e nada na web', () => {
    teamHaptic('coyotes', { os: 'ios' });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(mockHapticCalls).toEqual(['impact:light', 'impact:light', 'impact:light']);
    mockHapticCalls.length = 0;
    resetHaptics();
    teamHaptic('owls', { os: 'android' });
    expect(mockHapticCalls).toEqual(['android:long-press']);
    mockHapticCalls.length = 0;
    teamHaptic('volt', { os: 'web' });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(mockHapticCalls).toEqual([]);
  });

  it('o brilho entra antes do começo e sai depois do fim da linha; o pulso repete N vezes', () => {
    expect(glowDashOffset(0)).toBe(TRAIL_GLOW_SEGMENT);
    expect(glowDashOffset(1)).toBe(-TRAIL_GLOW_LENGTH);
    expect(glowDashOffset(2)).toBe(-TRAIL_GLOW_LENGTH);
    expect(glowDashOffset(Number.NaN)).toBe(TRAIL_GLOW_SEGMENT);
    const k = pulseKeyframes(2, 1.08);
    expect(Object.keys(k)).toEqual(['0%', '25%', '50%', '75%', '100%']);
    expect(k['25%'].transform[0].scale).toBe(1.08);
    expect(k['100%'].transform[0].scale).toBe(1);
  });

  it('a cena do bairro cabe na caixa, com manchas de raio limitado; sem pontos, vazia', () => {
    const path = Array.from({ length: 30 }, (_, i) => ({ lat: -16.7097 + i * 0.0002, lng: -49.2388 + Math.sin(i / 4) * 0.001 }));
    const ids = [...new Set(path.map(zoneOf))];
    const zones = ids.map((id) => ({ id, center: cellCenter(id), before: 'owls' as const, after: 'volt' as const }));
    const s = projectNeighborhood(path, zones, 320, 180);
    expect(s.route.startsWith('M')).toBe(true);
    expect(s.zones).toHaveLength(ids.length);
    for (const z of s.zones) {
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.x).toBeLessThanOrEqual(320);
      expect(z.y).toBeGreaterThanOrEqual(0);
      expect(z.y).toBeLessThanOrEqual(180);
    }
    expect(s.radius).toBeGreaterThanOrEqual(BLOB_RADIUS.min);
    expect(s.radius).toBeLessThanOrEqual(BLOB_RADIUS.max);
    expect(projectNeighborhood([], [], 320, 180)).toEqual({ route: '', zones: [], radius: BLOB_RADIUS.min });
    expect(projectNeighborhood(path, zones, 0, 180).zones).toEqual([]);
  });

  it('zonas do resultado oficial: id que não é célula fica fora; nada virado = sem cena', () => {
    const id = zoneOf({ lat: -16.7097, lng: -49.2388 });
    const official = [
      { zoneId: id, ownerBefore: 'owls' as const, ownerAfter: 'volt' as const },
      { zoneId: 'nao-e-celula', ownerBefore: null, ownerAfter: 'volt' as const },
    ];
    expect(neighborhoodZonesFrom(official, cellCenter)?.map((z) => z.id)).toEqual([id]);
    expect(neighborhoodZonesFrom([{ zoneId: id, ownerBefore: 'volt', ownerAfter: 'volt' }], cellCenter)).toBeNull();
    expect(neighborhoodFlipLabel(2, 'volt')).toContain('2 zonas agora são dos');
    expect(neighborhoodFlipLabel(1, 'volt')).toContain('1 zona agora é');
    expect(neighborhoodFlipLabel(0, 'volt')).toContain('nenhuma zona');
  });

  it('fase do chefão só com `phaseChanged` do servidor, sem derrota e com números coerentes', () => {
    const raid = { raidId: 'r1', bossId: 'mormaco', damage: 150, countedKm: 6, hpAfter: 2350, hpMax: 3600, phaseBefore: 1, phaseAfter: 2, phaseChanged: true, defeated: false, repeated: false };
    expect(raidPhaseHitOf({ extras: { raid } })).toEqual({ bossId: 'mormaco', damage: 150, countedKm: 6, hpBefore: 2500, hpAfter: 2350, hpMax: 3600, phaseAfter: 2 });
    expect(raidPhaseHitOf({ extras: { raid: { ...raid, phaseChanged: false } } })).toBeNull();
    expect(raidPhaseHitOf({ extras: { raid: { ...raid, defeated: true } } })).toBeNull();
    expect(raidPhaseHitOf({ extras: { raid: { ...raid, phaseAfter: 1 } } })).toBeNull();
    expect(raidPhaseHitOf({ extras: { raid: { ...raid, hpAfter: 9999 } } })).toBeNull();
    expect(raidPhaseHitOf({ extras: { raid: { ...raid, damage: 0 } } })).toBeNull();
    expect(raidPhaseHitOf(null)).toBeNull();
  });

  it('no orquestrador, o golpe que abre fase (médio) ganha tempo para a tarja; o comum continua com 800 ms', () => {
    const hit = (hpBefore: number, hpAfter: number, level: 'small' | 'medium'): CelebrationEvent => ({ id: 'g', kind: 'boss-hit', level, label: 'golpe', payload: { boss: 'Mormaço', damageKm: 6, hpBefore, hpAfter, hpMax: 3600 } });
    expect(planCelebrations([hit(2500, 2350, 'medium')], { reduced: false, screenReader: false }).moments[0].durationMs).toBe(BOSS_PHASE.totalMs);
    expect(planCelebrations([hit(1200, 1104, 'small')], { reduced: false, screenReader: false }).moments[0].durationMs).toBe(800);
  });
});

describe('componentes novos (renderizam, reduzido = só opacidade, não animam fora de hora)', () => {
  const CASES: [string, () => ReactElement][] = [
    ['FirstPaintSeal', () => <FirstPaintSeal testID="selo" color="#00E0FF" />],
    ['NeighborhoodFlip', () => <NeighborhoodFlip testID="bairro" path={[{ lat: -16.7, lng: -49.24 }, { lat: -16.71, lng: -49.23 }]} zones={[]} team="volt" />],
    ['BossHit com fase', () => <BossHit testID="chefao" bossName="Mormaço" hpFrom={2500} hpTo={2350} hpMax={3600} damageLabel="−6,0 km" />],
    ['TeamWeekCard', () => <TeamWeekCard testID="semana" team="owls" body="2º na temporada" first={false} onPress={() => {}} accessibilityLabel="Semana nova" />],
    ['StampIn com pulso', () => <StampIn testID="carimbo" pulses={2} haptics><></></StampIn>],
    ['PRStamp com contagem', () => <PRStamp testID="recorde" label="Recorde" metric="47 trechos" count={{ value: 47, unit: 'trechos' }} pulses={2} />],
    ['TrailGlow', () => <TrailGlow testID="brilho" color="#FF2E88" />],
    ['DistrictStampMoment', () => <DistrictStampMoment name="Setor Bueno" />],
    ['LeaderComment', () => <LeaderComment team="striders" text="Texto de teste." delay={leaderCommentDelay(900)} />],
    ['FirstPaintMoment', () => <FirstPaintMoment team="coyotes" />],
    ['TeamCover tocada', () => <TeamCover team="volt" animated tap={1} testID="capa" />],
  ];

  for (const [name, make] of CASES) {
    it(`${name}: renderiza (só transform e opacidade) e, com "Reduzir movimento", só opacidade`, () => {
      const full = render(make());
      onlyTransformAndOpacity(full);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      const reduced = render(<ReducedMotionOverride reduced>{make()}</ReducedMotionOverride>);
      mockState.reduced = true; // os que olham o ajuste do sistema direto (FadeUp, capa)
      const reducedSys = render(<ReducedMotionOverride reduced>{make()}</ReducedMotionOverride>);
      onlyOpacity(reduced);
      onlyOpacity(reducedSys);
    });
  }

  it('golpe que abre fase: tarja "Você abriu a fase 2!", 3 pontos fracos e o anúncio diz a fase; sem fase, nada disso', () => {
    const r = render(<BossHit testID="chefao" bossName="Mormaço" hpFrom={2500} hpTo={2350} hpMax={3600} damageLabel="−6,0 km" />);
    expect(has(r, 'chefao-fase')).toBe(true);
    expect([0, 1, 2].every((i) => has(r, `chefao-ponto-fraco-${i}`))).toBe(true);
    expect(JSON.stringify(r.toJSON())).toContain('Você abriu a fase 2!');
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('Você abriu a fase 2!'));
    const plain = render(<BossHit testID="comum" bossName="Mormaço" hpFrom={1500} hpTo={1404} hpMax={3600} damageLabel="−8,4 km" />);
    expect(has(plain, 'comum-fase')).toBe(false);
    const off = render(<BossHit testID="desligado" bossName="Mormaço" hpFrom={2500} hpTo={2350} hpMax={3600} damageLabel="−6,0 km" phaseOpened={null} />);
    expect(has(off, 'desligado-fase')).toBe(false);
  });

  it('BossPhaseMoment usa o dado do servidor (nome do chefão, km com 1 casa)', () => {
    const r = render(<BossPhaseMoment hit={{ bossId: 'mormaco', damage: 150, countedKm: 6, hpBefore: 2500, hpAfter: 2350, hpMax: 3600, phaseAfter: 2 }} />);
    const txt = JSON.stringify(r.toJSON());
    expect(txt).toContain('Sua parte: 6,0 km');
    expect(txt).toContain('Você abriu a fase 2!');
  });

  it('antes e depois do bairro: as zonas viradas acendem (máx. 5) e, reduzido, nenhuma acende', () => {
    const path = Array.from({ length: 40 }, (_, i) => ({ lat: -16.7097 + i * 0.0003, lng: -49.2388 + Math.sin(i / 5) * 0.002 }));
    const ids = [...new Set(path.map(zoneOf))];
    const zones = ids.map((id, i) => ({ id, center: cellCenter(id), before: i % 2 ? ('owls' as const) : null, after: 'volt' as const }));
    const layout = (r: ReactTestRenderer) =>
      act(() => {
        r.root.findAll((n: ReactTestInstance) => n.props.testID === 'bairro' && typeof n.props.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { width: 340, height: 180 } } });
      });
    const full = render(<NeighborhoodFlip testID="bairro" path={path} zones={zones} team="volt" />);
    layout(full);
    const lit = Array.from({ length: 8 }, (_, i) => has(full, `bairro-acende-${i}`)).filter(Boolean).length;
    expect(lit).toBe(Math.min(5, ids.length));
    const reduced = render(
      <ReducedMotionOverride reduced>
        <NeighborhoodFlip testID="bairro" path={path} zones={zones} team="volt" />
      </ReducedMotionOverride>,
    );
    layout(reduced);
    expect(has(reduced, 'bairro-acende-0')).toBe(false);
    onlyOpacity(reduced);
  });

  it('brilho do rastro: some com movimento reduzido e quando não deve tocar', () => {
    const live = render(<TrailGlow testID="brilho" color="#FF2E88" />);
    const svgs = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Svg').length;
    expect(svgs(live)).toBe(2);
    expect(svgs(render(<TrailGlow testID="brilho" color="#FF2E88" play={false} />))).toBe(1);
    expect(
      svgs(
        render(
          <ReducedMotionOverride reduced>
            <TrailGlow testID="brilho" color="#FF2E88" />
          </ReducedMotionOverride>,
        ),
      ),
    ).toBe(1);
  });

  it('capa: o corredor só trota no card em foco; fora de foco (ou reduzido) fica no quadro 0', () => {
    expect(runnerAnimated(render(<TeamCover team="owls" animated focused />))).toEqual([true]);
    expect(runnerAnimated(render(<TeamCover team="owls" animated focused={false} />))).toEqual([false]);
    mockState.reduced = true;
    expect(runnerAnimated(render(<TeamCover team="owls" animated focused />))).toEqual([false]);
  });

  it('capa: o toque pisca o lema (0,6 → 1) e o corredor pula; reduzido, só o lema em 150 ms', () => {
    const r = render(<TeamCover team="volt" animated tap={2} testID="capa" />);
    const flash = r.root.findAll((n: ReactTestInstance) => n.props.testID === 'capa-lema-flash' && typeof n.type === 'string')[0];
    expect(JSON.stringify(flash.props.style)).toContain('"opacity":0.6');
    // o pulo é por valor compartilhado: o corredor (2 Svg) não remonta a cada toque
    const runnerOf = (x: ReactTestRenderer) => x.root.findAll((n: ReactTestInstance) => n.props.testID === 'capa-corredor' && typeof n.type === 'string')[0].children[0];
    const before = runnerOf(r);
    act(() => {
      r.update(<TeamCover team="volt" animated tap={3} testID="capa" />);
    });
    expect(runnerOf(r)).toBe(before);
    mockState.reduced = true;
    const red = render(<TeamCover team="volt" animated tap={2} testID="capa" />);
    const f2 = red.root.findAll((n: ReactTestInstance) => n.props.testID === 'capa-lema-flash' && typeof n.type === 'string')[0];
    expect(f2.props.style.animationDuration).toBe(150);
    onlyOpacity(red);
    // sem toque, nenhum flash
    expect(render(<TeamCover team="volt" animated testID="capa" />).root.findAll((n: ReactTestInstance) => n.props.testID === 'capa-lema-flash')).toHaveLength(0);
  });

  it('card da capa: o toque escolhe, vibra no padrão do time e liga o flash do lema', () => {
    const prev = process.env.EXPO_OS;
    process.env.EXPO_OS = 'ios';
    try {
      const onSelect = jest.fn();
      const r = render(<TeamCoverCard faction="volt" selected={false} focused onSelect={onSelect} width={320} testID="card" />);
      act(() => {
        r.root.findAll((n: ReactTestInstance) => n.props.testID === 'card' && typeof n.props.onPress === 'function')[0].props.onPress();
      });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(onSelect).toHaveBeenCalledWith('volt');
      expect(mockHapticCalls).toEqual(['impact:light', 'impact:light']);
      expect(has(r, 'card-capa-lema-flash')).toBe(true);
    } finally {
      process.env.EXPO_OS = prev;
    }
  });

  it('a semana do time: mascote vivo enquanto a faixa está na tela, parado ao sair e com movimento reduzido', () => {
    const mascots = (r: ReactTestRenderer) => r.root.findAll((n: ReactTestInstance) => n.type === Mascot).map((n) => n.props.animated);
    expect(mascots(render(<TeamWeekCard testID="s" team="owls" body="x" first onPress={() => {}} accessibilityLabel="x" />))).toEqual([true]);
    expect(mascots(render(<TeamWeekCard testID="s" team="owls" body="x" first leaving onPress={() => {}} accessibilityLabel="x" />))).toEqual([false]);
    expect(
      mascots(
        render(
          <ReducedMotionOverride reduced>
            <TeamWeekCard testID="s" team="owls" body="x" first onPress={() => {}} accessibilityLabel="x" />
          </ReducedMotionOverride>,
        ),
      ),
    ).toEqual([false]);
  });

  it('F8-D · D-90: a semana do time usa o neon do time (nunca o sólido do mapa) e a tinta passa 4,5:1 nos 4 times', () => {
    for (const team of ['striders', 'volt', 'owls', 'coyotes'] as const) {
      const r = render(<TeamWeekCard testID="s" team={team} body="2º na temporada" first={false} onPress={() => {}} accessibilityLabel="x" />);
      const flat = JSON.stringify(r.toJSON());
      expect(flat).toContain(neonTeam[team]);
      expect(flat).not.toContain(factions[team].color);
      expect(contrastRatio(neonTeam[team], neon.bg)).toBeGreaterThanOrEqual(4.5);
      expect(r.root.findAll((n: ReactTestInstance) => n.type === Mascot)[0].props.color).toBe(neon.bg);
    }
  });

  it('o selo do 1º trecho vibra 1× leve, anuncia e termina em 1,5 s', () => {
    const prev = process.env.EXPO_OS;
    process.env.EXPO_OS = 'ios';
    try {
      const onDone = jest.fn();
      render(<FirstPaintSeal testID="selo" color="#00E0FF" onDone={onDone} />);
      act(() => {
        jest.advanceTimersByTime(1499);
      });
      expect(onDone).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(2);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(mockHapticCalls).toEqual(['impact:light']);
      expect(announce).toHaveBeenCalledWith(expect.stringContaining('Primeiro trecho!'));
    } finally {
      process.env.EXPO_OS = prev;
    }
  });
});
