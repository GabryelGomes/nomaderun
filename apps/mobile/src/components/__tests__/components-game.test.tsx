/**
 * T7.1.17 — componentes de jogo da v2 (Mapa, Arena, Você, Clube): renderizam, estados, testID e as contas puras.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Text as RNText } from 'react-native';

import { ALERT_PRIORITY, AlertSlot, pickAlert, type SlotAlert } from '../alert-slot';
import { DAILY_MAX, DailyStrip, type DailyItem } from '../daily-strip';
import { FeedRunCard, feedRunLabel } from '../feed-run-card';
import { clampDone, MissionCoachCard } from '../mission-coach-card';
import { ModeCard } from '../mode-card';
import { PlayerCard, playerCardLabel } from '../player-card';
import { routeSvgPath, thinRoute } from '../route-path';
import { WeekBars, weekBarHeights } from '../week-bars';
import { render } from './render-helpers';
/* eslint-enable import/first */

const noop = () => {};

describe('ModeCard', () => {
  it('play: botão com dica e toque', () => {
    let n = 0;
    const r = render(<ModeCard testID="modo-fuga" title="Fuga" body="Vença o fantasma." variant="play" icon="ghost" onPress={() => (n += 1)} />);
    expect(r.host('modo-fuga').props.accessibilityRole).toBe('button');
    expect(r.host('modo-fuga').props.accessibilityHint).toBe('Toque para correr com este modo.');
    r.press('modo-fuga');
    expect(n).toBe(1);
  });

  it('soon: não é botão, nem com onPress, e diz "Em breve"', () => {
    const r = render(<ModeCard testID="modo-raid" title="Raid" body="Um chefão contra a cidade." variant="soon" icon="raid" onPress={noop} />);
    expect(r.host('modo-raid').props.accessibilityRole).toBeUndefined();
    // O próprio ModeCard recebe o onPress; nada abaixo dele pode ser tocável.
    expect(r.all('modo-raid').some((n) => n.type !== ModeCard && typeof n.props.onPress === 'function')).toBe(false);
    expect(r.host('modo-raid').props.accessibilityLabel).toBe('Raid. Em breve. Um chefão contra a cidade.');
  });

  it('info sem ação vira só leitura (sem retorno de toque)', () => {
    const r = render(<ModeCard testID="modo-dominio" title="Domínio" body="Pinte a zona." variant="info" tag="Em toda corrida" />);
    expect(r.all('modo-dominio').some((n) => typeof n.props.onPress === 'function')).toBe(false);
    expect(r.text()).toContain('Em toda corrida');
  });
});

describe('PlayerCard', () => {
  const base = { name: 'ana_run', faction: 'striders' as const, level: 12, xp: { into: 340, needed: 500 }, title: 'Exploradora de bairro' };

  it('lê nome, título, time, nível e XP', () => {
    const r = render(<PlayerCard testID="jogador" {...base} />);
    expect(r.host('jogador').props.accessibilityLabel).toBe(playerCardLabel(base));
    expect(playerCardLabel(base)).toBe('ana_run. Exploradora de bairro. Neon Striders, nível 12. 340 de 500 XP para o nível 13');
    expect(r.text()).toContain('340 / 500 XP');
  });

  it('com o anel da E5, a barra de XP sai; com onPress, vira botão', () => {
    const r = render(<PlayerCard testID="jogador" {...base} ring={<RNText testID="anel">anel</RNText>} onPress={noop} />);
    expect(r.has('anel')).toBe(true);
    expect(r.text()).not.toContain('XP');
    expect(r.host('jogador').props.accessibilityRole).toBe('button');
  });
});

describe('FeedRunCard e o mini-mapa', () => {
  const path = [
    { lat: -16.71, lng: -49.24 },
    { lat: -16.712, lng: -49.238 },
    { lat: -16.715, lng: -49.241 },
  ];

  it('renderiza o traço da rota, os selos (no máximo 3) e o selo de demonstração', () => {
    const r = render(<FeedRunCard testID="corrida-1" path={path} title="Hoje, 6:42 · Livre" distance="5,02 km" detail="28:10 · 5:37 /km" badges={['2 zonas', 'Baú raro', 'Fantasma', 'Extra']} demo onPress={noop} />);
    const paths = r.renderer.root.findAll((n) => typeof n.props.d === 'string' && n.props.d.startsWith('M'));
    expect(paths.length).toBeGreaterThan(0);
    expect(r.text()).not.toContain('Extra');
    expect(r.host('corrida-1').props.accessibilityLabel).toBe('Hoje, 6:42 · Livre, 5,02 km, 28:10 · 5:37 /km, 2 zonas, Baú raro, Fantasma, Demonstração');
  });

  it('versão social com autor', () => {
    expect(feedRunLabel({ title: 'Ontem', distance: '8,2 km', author: { name: 'leo', faction: 'volt' } })).toBe('leo, Ontem, 8,2 km');
    const r = render(<FeedRunCard testID="feed-1" path={path} title="Ontem" distance="8,2 km" author={{ name: 'leo', faction: 'volt' }} />);
    expect(r.text()).toContain('leo');
  });

  it('routeSvgPath: dentro da caixa, proporção mantida, vazio com menos de 2 pontos', () => {
    const d = routeSvgPath(path, 100, 100, 10);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.every((v) => v >= 10 - 0.01 && v <= 90 + 0.01)).toBe(true);
    expect(d.startsWith('M')).toBe(true);
    expect(d.split('L')).toHaveLength(3);
    expect(routeSvgPath([path[0]], 100, 100)).toBe('');
    expect(routeSvgPath([path[0], path[0]], 100, 100)).toBe('');
  });

  it('thinRoute: no máximo N pontos e mantém as pontas', () => {
    const many = Array.from({ length: 1000 }, (_, i) => i);
    const thin = thinRoute(many, 50);
    expect(thin).toHaveLength(50);
    expect(thin[0]).toBe(0);
    expect(thin[49]).toBe(999);
    expect(thinRoute([1, 2, 3], 50)).toEqual([1, 2, 3]);
  });
});

describe('WeekBars', () => {
  it('alturas proporcionais, dia vazio com traço e máximo opcional', () => {
    expect(weekBarHeights([0, 5, 10, 0, 0, 0, 0], 80)).toEqual([3, 40, 80, 3, 3, 3, 3]);
    expect(weekBarHeights([1, 0, 0, 0, 0, 0, 0], 80, 20)).toEqual([8, 3, 3, 3, 3, 3, 3]);
    expect(weekBarHeights([0, 0, 0, 0, 0, 0, 0], 80)).toEqual([3, 3, 3, 3, 3, 3, 3]);
    expect(weekBarHeights([Number.NaN, -2, 4, 0, 0, 0, 0], 40)).toEqual([3, 3, 40, 3, 3, 3, 3]);
  });

  it('lê a semana inteira para o leitor de tela', () => {
    const r = render(<WeekBars testID="semana" days={[3.2, 0, 5, 0, 0, 0, 0]} today={2} />);
    expect(r.host('semana').props.accessibilityLabel).toBe(
      'Semana: segunda 3,2 km, terça sem corrida, quarta 5 km, quinta sem corrida, sexta sem corrida, sábado sem corrida, domingo sem corrida',
    );
  });
});

describe('DailyStrip', () => {
  const items: DailyItem[] = [
    { key: 'seq', testID: 'hoje-sequencia', icon: 'fire', value: '1/2', label: 'Sequência', onPress: noop },
    { key: 'bau', testID: 'hoje-bau', icon: 'chest', value: '1', label: 'Baú do dia' },
    { key: 'chefe', testID: 'hoje-chefao', icon: 'raid', value: '36%', label: 'Chefão', tone: 'villain' },
    { key: 'extra', testID: 'hoje-extra', icon: 'flag', value: '9', label: 'Extra' },
  ];

  it(`mostra no máximo ${DAILY_MAX} chips`, () => {
    const r = render(<DailyStrip items={items} />);
    expect(r.has('hoje-chefao')).toBe(true);
    expect(r.has('hoje-extra')).toBe(false);
    expect(r.host('hoje-sequencia').props.accessibilityLabel).toBe('Sequência: 1/2');
  });

  it('sem dado não desenha nada (nunca inventa)', () => {
    expect(render(<DailyStrip items={[]} />).renderer.toJSON()).toBeNull();
  });
});

describe('AlertSlot', () => {
  const mk = (kind: SlotAlert['kind'], id: string = kind): SlotAlert => ({ id, kind, title: `t-${id}`, body: 'b', onPress: noop });

  it('a prioridade segue a ordem da E6 (ataque > missão > baú > chefão > sequência)', () => {
    expect(ALERT_PRIORITY).toEqual(['attack', 'mission', 'chest', 'boss', 'streak']);
    expect(pickAlert([mk('streak'), mk('boss'), mk('chest')])?.kind).toBe('chest');
    expect(pickAlert([mk('mission', 'm1'), mk('mission', 'm2')])?.id).toBe('m1');
    expect(pickAlert([])).toBeNull();
  });

  it('mostra só 1 alerta, com fechar quando dá', () => {
    let closed = 0;
    const r = render(<AlertSlot alerts={[mk('boss'), { ...mk('attack'), onDismiss: () => (closed += 1) }]} />);
    expect(r.has('alerta-attack')).toBe(true);
    expect(r.has('alerta-boss')).toBe(false);
    r.press('alerta-fechar');
    expect(closed).toBe(1);
  });

  it('sem alerta, nada', () => {
    expect(render(<AlertSlot alerts={[]} />).renderer.toJSON()).toBeNull();
  });
});

describe('MissionCoachCard', () => {
  it('passo atual no rótulo; progresso nunca passa do total', () => {
    const r = render(<MissionCoachCard testID="missao-1" eyebrow="Missão 1" title="Corra 500 m e pinte sua primeira zona" done={2} steps={['Conta', 'Time', 'Correr 500 m']} reward="+50 XP" onPress={noop} />);
    expect(r.host('missao-1').props.accessibilityLabel).toBe('Missão 1: Corra 500 m e pinte sua primeira zona. Passo 3 de 3. Recompensa: +50 XP');
    expect(clampDone(9, 3)).toBe(3);
    expect(clampDone(-1, 3)).toBe(0);
    expect(clampDone(Number.NaN, 3)).toBe(0);
  });

  it('demonstração aparece no rótulo e no selo', () => {
    const r = render(<MissionCoachCard testID="m" title="Corra 1 km" done={0} steps={['Correr 1 km']} demo />);
    expect(r.host('m').props.accessibilityLabel).toContain('Demonstração');
    expect(r.text()).toContain('Demonstração');
  });
});
