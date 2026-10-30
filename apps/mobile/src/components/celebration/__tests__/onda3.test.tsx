/**
 * T7.3.5 — leitor de tela na web (o react-native-web diz sempre "ligado"), item do baú (`Chest layer="item"`),
 * clarão com a silhueta do `Boss` e a chama e o gelo da E4 (`StreakArt`) no `StreakFlame`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type ReactElement } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('../../motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('../../motion/__tests__/render-mocks').worklets);
jest.mock('react-native-svg', () => require('../../motion/__tests__/render-mocks').svg);
jest.mock('expo-haptics', () => require('../../motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('../../motion/__tests__/render-mocks').safeArea);
jest.mock('@/components/motion/prefs-storage', () => ({ readMotionPrefsRaw: async () => null, writeMotionPrefsRaw: async () => undefined }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Boss, Chest, Medal, StreakArt } from '@/components/art';
import { useMotionPrefs } from '@/store/motion-prefs-store';

import { mockState } from '../../motion/__tests__/render-mocks';
import { resetHaptics } from '../../motion/haptics';
import { ReducedMotionOverride } from '../../motion/reduced-motion';
import { canDetectScreenReader, useScreenReaderEnabled } from '../../motion/screen-reader';
import { BossDefeated, BossHit } from '../boss';
import { CelebrationSequence } from '../celebration-sequence';
import { ChestOpening } from '../chest-opening';
import { renderCelebrationMoment } from '../default-moment';
import { StreakFlame } from '../progress-moments';
import type { CelebrationEvent } from '../queue';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];
function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  mounted.push(r!);
  return r!;
}

function artOf<P>(r: ReactTestRenderer, type: (p: P) => unknown): P[] {
  return r.root.findAll((n: ReactTestInstance) => n.type === type).map((n: ReactTestInstance) => n.props as P);
}

const hosts = (r: ReactTestRenderer, testID: string) => r.root.findAll((n: ReactTestInstance) => n.props.testID === testID && typeof n.type === 'string');

/** Estilos animados (com quadros-chave) de toda a árvore. */
function keyframesOf(r: ReactTestRenderer): Record<string, Record<string, unknown>>[] {
  const out: Record<string, Record<string, unknown>>[] = [];
  const flat = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(flat);
    else if (s && typeof s === 'object' && (s as { animationName?: unknown }).animationName) out.push((s as { animationName: Record<string, Record<string, unknown>> }).animationName);
  };
  r.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style !== undefined).forEach((n: ReactTestInstance) => flat(n.props.style));
  return out;
}

const EVENTS: CelebrationEvent[] = [
  { id: 'z', kind: 'zone-captured', level: 'medium', label: 'conquistou Setor Bueno', payload: { zone: 'Setor Bueno', faction: 'owls', points: 120 } },
  { id: 'n', kind: 'level-up', level: 'epic', label: 'chegou ao nível 7', payload: { level: 7, title: 'Desbravador' } },
];
const ANNOUNCEMENT = 'Corrida concluída. Você conquistou Setor Bueno e chegou ao nível 7.';

const realOS = Platform.OS;
const setOS = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });

let announce: ReturnType<typeof jest.spyOn>;
let isReader: ReturnType<typeof jest.spyOn>;
let listeners: ((v: boolean) => void)[];
beforeEach(() => {
  jest.useFakeTimers();
  resetHaptics();
  listeners = [];
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  // como o react-native-web 0.21: "leitor de tela ligado", sempre
  isReader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(() => Promise.resolve(true));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_e: string, fn: (v: boolean) => void) => {
    listeners.push(fn);
    return { remove: () => listeners.splice(listeners.indexOf(fn), 1) };
  }) as never);
  // o spy pode ser o mesmo objeto entre testes: começa sem chamadas
  isReader.mockClear();
  announce.mockClear();
});
afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((r) => r.unmount());
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
  setOS(realOS);
  mockState.reduced = false;
  mockState.timingEnds = true;
  act(() => {
    useMotionPrefs.getState().reset();
  });
});

/** Deixa as promessas resolvidas chegarem ao React. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('leitor de tela na web', () => {
  it('só o celular informa o leitor de tela; a web não', () => {
    expect(canDetectScreenReader('web')).toBe(false);
    expect(canDetectScreenReader('ios')).toBe(true);
    expect(canDetectScreenReader('android')).toBe(true);
  });

  it('hook: na web nem pergunta (fica false); no celular segue o sistema e a troca; `forced` vence', async () => {
    const seen: boolean[] = [];
    function Probe({ forced }: { forced?: boolean }) {
      seen.push(useScreenReaderEnabled(forced));
      return null;
    }
    setOS('web');
    render(<Probe />);
    await flush();
    expect(isReader).not.toHaveBeenCalled();
    expect(seen.at(-1)).toBe(false);

    setOS('ios');
    seen.length = 0;
    render(<Probe />);
    await flush();
    expect(isReader).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toBe(true);
    act(() => listeners.forEach((fn) => fn(false)));
    expect(seen.at(-1)).toBe(false);

    seen.length = 0;
    render(<Probe forced={false} />);
    await flush();
    expect(isReader).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([false]);
  });

  it('web: o roteiro toca com "Pular" (não pula tudo) e o anúncio sai pela região viva escondida', async () => {
    setOS('web');
    mockState.timingEnds = false;
    const onDone = jest.fn();
    const r = render(<CelebrationSequence testID="resumo" events={EVENTS} intro="Corrida concluída." renderMoment={renderCelebrationMoment()} onDone={onDone} />);
    await flush();
    expect(isReader).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(hosts(r, 'resumo-pular').length).toBeGreaterThan(0);
    const live = () => hosts(r, 'resumo-anuncio')[0];
    expect(live().props.accessibilityLiveRegion).toBe('polite');
    // a região existe vazia antes do texto (senão o leitor não lê a mudança)
    expect(live().props.children).toBe('');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(live().props.children).toBe('');
    act(() => {
      r.root.findAll((n: ReactTestInstance) => n.props.testID === 'resumo-pular' && typeof n.props.onPress === 'function')[0].props.onPress({});
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(live().props.children).toBe(ANNOUNCEMENT);
    // na web o announceForAccessibility não faz nada: não é por ele que o texto sai
    expect(announce).not.toHaveBeenCalled();
  });

  it('web com o modo leitor forçado (galeria): tudo no fim e o anúncio também na região viva', () => {
    setOS('web');
    const r = render(<CelebrationSequence testID="g" events={EVENTS} intro="Corrida concluída." renderMoment={renderCelebrationMoment()} screenReader />);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(hosts(r, 'g-pular')).toHaveLength(0);
    expect(hosts(r, 'g-anuncio')[0].props.children).toBe(ANNOUNCEMENT);
  });

  it('celular com leitor ligado: sem roteiro, 1 anúncio do sistema e nenhuma região viva extra', async () => {
    setOS('android');
    // como no aparelho: a resposta do sistema chega antes de o roteiro acabar
    mockState.timingEnds = false;
    const onDone = jest.fn();
    const r = render(<CelebrationSequence testID="resumo" events={EVENTS} intro="Corrida concluída." renderMoment={renderCelebrationMoment()} onDone={onDone} />);
    await flush();
    expect(isReader).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls).toEqual([[ANNOUNCEMENT]]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(hosts(r, 'resumo-pular')).toHaveLength(0);
    expect(hosts(r, 'resumo-anuncio')).toHaveLength(0);
  });
});

describe('item do baú (Chest layer="item")', () => {
  it('padrão: o prêmio da E4 na raridade sobe de dentro com mola, só transform e opacidade', () => {
    const r = render(<ChestOpening testID="b" rarity="raro" xp={40} />);
    const items = artOf(r, Chest).filter((c) => c.layer === 'item');
    expect(items).toHaveLength(1);
    expect(items[0].rarity).toBe('raro');
    expect(items[0].decorative).toBe(true);
    const rise = keyframesOf(r).find((k) => JSON.stringify(k).includes('"scale":0.35'));
    expect(rise).toBeTruthy();
    expect(Object.keys(rise!.from).sort()).toEqual(['opacity', 'transform']);
    expect(rise!.from.opacity).toBe(0);
    expect(rise!.to).toEqual({ opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] });
    for (const k of keyframesOf(r)) for (const f of Object.values(k)) for (const key of Object.keys(f)) expect(['opacity', 'transform']).toContain(key);
  });

  it('estado final e reduzido: o item já no lugar; `item` de fora troca; `null` tira; arte de fora sem item padrão', () => {
    const reduced = render(
      <ReducedMotionOverride reduced>
        <ChestOpening testID="b" rarity="lendario" xp={120} />
      </ReducedMotionOverride>,
    );
    expect(artOf(reduced, Chest).map((c) => c.layer ?? c.state)).toEqual(['aberto', 'item']);
    expect(JSON.stringify(keyframesOf(reduced))).not.toContain('scale":0.35');

    const own = render(<ChestOpening testID="b" rarity="comum" xp={10} item={<Medal kind="cacador" />} />);
    expect(artOf(own, Chest).filter((c) => c.layer === 'item')).toHaveLength(0);
    expect(artOf(own, Medal).map((m) => m.kind)).toEqual(['cacador']);

    const none = render(<ChestOpening testID="b" rarity="comum" xp={10} item={null} />);
    expect(artOf(none, Chest).filter((c) => c.layer === 'item')).toHaveLength(0);

    // a tela de recompensas (E7) passa o baú aberto e uma tampa vazia: nada muda para ela
    const custom = render(<ChestOpening testID="b" rarity="raro" xp={40} chest={<Chest rarity="raro" state="aberto" size={110} decorative />} lid={<View />} />);
    expect(artOf(custom, Chest).map((c) => c.layer ?? c.state)).toEqual(['aberto']);
  });

  it('camadas da E4 por fora (corpo + tampa + item) ficam empilhadas na mesma caixa', () => {
    const r = render(
      <ChestOpening
        testID="b"
        rarity="raro"
        xp={40}
        chest={<Chest rarity="raro" layer="corpo" size={150} />}
        lid={<Chest rarity="raro" layer="tampa" size={150} />}
        item={<Chest rarity="raro" layer="item" size={150} />}
      />,
    );
    expect(artOf(r, Chest).map((c) => c.layer)).toEqual(['tampa', 'corpo', 'item']);
    const lidWrap = r.root.findAll((n: ReactTestInstance) => n.type === Chest && n.props.layer === 'tampa')[0].parent!;
    const style = Object.assign({}, ...[lidWrap.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
  });
});

describe('clarão do chefão com a silhueta da E4', () => {
  it('golpe e derrota usam `Boss silhouette`, decorativa, só no tocar; `bossFlash` de fora ainda troca', () => {
    const hit = render(<BossHit testID="g" bossName="Mormaço" hpFrom={1200} hpTo={1104} hpMax={3600} damageLabel="−96" />);
    const flash = artOf(hit, Boss).filter((b) => b.silhouette);
    expect(flash).toHaveLength(1);
    expect(flash[0]).toMatchObject({ id: 'mormaco', state: 'golpe', silhouette: true, decorative: true });
    const done = render(<BossHit testID="g" bossName="Mormaço" hpFrom={1200} hpTo={1104} hpMax={3600} damageLabel="−96" state="done" announce={false} />);
    expect(artOf(done, Boss).filter((b) => b.silhouette)).toHaveLength(0);
    const end = render(<BossDefeated testID="d" bossName="Paredão" city="Goiânia" myKm={3} />);
    expect(artOf(end, Boss).filter((b) => b.silhouette).map((b) => [b.id, b.state])).toEqual([['paredao', 'furioso']]);
    const own = render(<BossHit testID="g" bossName="Mormaço" bossFlash={<Medal kind="crew" />} hpFrom={10} hpTo={5} hpMax={10} damageLabel="−5" />);
    expect(artOf(own, Boss).filter((b) => b.silhouette)).toHaveLength(0);
  });
});

describe('chama e gelo da E4 no StreakFlame (StreakArt)', () => {
  it('mantida: a chama acesa, parada (sem laço), sem a medalha provisória', () => {
    const r = render(<StreakFlame testID="s" weeks={3} status="kept" />);
    const art = artOf(r, StreakArt);
    expect(art.map((a) => [a.state, a.layer])).toEqual([['acesa', 'chama']]);
    expect(art[0].animated).toBeFalsy();
    expect(artOf(r, Medal)).toHaveLength(0);
  });

  it('congelamento: a chama congelada e o cristal de gelo por cima, na mesma caixa; só transform e opacidade', () => {
    const r = render(<StreakFlame testID="s" weeks={3} status="frozen" />);
    const art = artOf(r, StreakArt);
    expect(art.map((a) => [a.state, a.layer])).toEqual([
      ['gelo', 'chama'],
      ['gelo', 'gelo'],
    ]);
    expect(art[0].size).toBe(art[1].size);
    for (const k of keyframesOf(r)) for (const f of Object.values(k)) for (const key of Object.keys(f)) expect(['opacity', 'transform']).toContain(key);
    const reduced = render(
      <ReducedMotionOverride reduced>
        <StreakFlame testID="s" weeks={3} status="frozen" />
      </ReducedMotionOverride>,
    );
    expect(artOf(reduced, StreakArt).map((a) => a.layer)).toEqual(['chama', 'gelo']);
    expect(JSON.stringify(keyframesOf(reduced))).not.toContain('scale');
  });

  it('`flame`/`ice` de fora ainda trocam cada camada', () => {
    const r = render(<StreakFlame testID="s" weeks={2} status="frozen" flame={<View testID="chama-propria" />} ice={<View testID="gelo-proprio" />} />);
    expect(artOf(r, StreakArt)).toHaveLength(0);
    expect(hosts(r, 'chama-propria')).toHaveLength(1);
    expect(hosts(r, 'gelo-proprio')).toHaveLength(1);
  });
});
