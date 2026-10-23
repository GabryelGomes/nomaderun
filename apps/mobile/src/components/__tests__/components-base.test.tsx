/**
 * T7.1.17 — componentes base da v2: renderizam, mostram os estados e expõem testID e rótulo para o leitor de tela.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Text as RNText } from 'react-native';

import { dark } from '@/theme/tokens';

import { BigRunButton } from '../big-run-button';
import { Button } from '../button';
import { DemoBadge } from '../demo-badge';
import { EmptyState } from '../empty-state';
import { HeroHeader, heroToneColor } from '../hero-header';
import { SectionHeader } from '../section-header';
import { SettingsRow } from '../settings-row';
import { StatTile, statTileLabel } from '../stat-tile';
import { EmptyState as EmptyFromSurface, SectionHeader as SectionFromSurface } from '../surface';
import { render } from './render-helpers';
/* eslint-enable import/first */

const noop = () => {};

describe('Button (acessibilidade e contraste, D-75)', () => {
  it('anuncia desativado e ocupado ao leitor de tela', () => {
    const r = render(<Button testID="b" label="Entrar" disabled busy onPress={noop} />);
    expect(r.host('b').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  });

  it('ativo: disabled falso e rótulo = label', () => {
    const r = render(<Button testID="b" label="Correr" onPress={noop} />);
    expect(r.host('b').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    expect(r.host('b').props.accessibilityLabel).toBe('Correr');
  });

  it('texto escuro no laranja e no vermelho; teto de fonte no rótulo', () => {
    const primary = render(<Button testID="p" label="Correr" onPress={noop} />);
    const label = primary.renderer.root.findByType(RNText);
    expect(JSON.stringify(label.props.style)).toContain(dark.onAction);
    expect(label.props.maxFontSizeMultiplier).toBeGreaterThan(1);
    const danger = render(<Button testID="d" label="Excluir" kind="danger" onPress={noop} />);
    expect(JSON.stringify(danger.renderer.root.findByType(RNText).props.style)).toContain(dark.onDanger);
  });
});

describe('EmptyState', () => {
  it('título, 1 frase, etiqueta e ação', () => {
    const r = render(<EmptyState testID="v" tag="Em breve" title="Nada aqui" body="Sua primeira corrida aparece aqui." icon="activities" action={<Button testID="v-acao" label="Correr" onPress={noop} />} />);
    expect(r.has('v')).toBe(true);
    expect(r.has('v-acao')).toBe(true);
    expect(r.text()).toContain('Em breve');
    expect(r.text()).toContain('Sua primeira corrida aparece aqui.');
  });

  it('a arte entra pelo slot e fica fora do leitor de tela', () => {
    const r = render(<EmptyState testID="v" title="Sem crew" art={<RNText testID="arte">arte</RNText>} />);
    const art = r.host('arte');
    const wrapper = art.parent?.parent;
    expect(wrapper?.props['aria-hidden']).toBe(true);
  });

  it('sem corpo nem arte continua renderizando (compatível com o EmptyState antigo)', () => {
    const r = render(<EmptyFromSurface title="Vazio" body="Nada ainda." />);
    expect(r.text()).toBe('Vazio Nada ainda.');
  });
});

describe('SectionHeader', () => {
  it('"Ver todas" vira link com testID e rótulo completo', () => {
    let opened = 0;
    const r = render(<SectionHeader testID="missoes" title="Missões de hoje" actionLabel="Ver todas" onAction={() => (opened += 1)} />);
    expect(r.host('missoes-acao').props.accessibilityLabel).toBe('Ver todas: Missões de hoje');
    r.press('missoes-acao');
    expect(opened).toBe(1);
  });

  it('sem ação, só o título (e continua exportado por surface.tsx)', () => {
    const r = render(<SectionFromSurface title="Conquistas" />);
    expect(r.text()).toBe('Conquistas');
  });
});

describe('HeroHeader', () => {
  it('renderiza título, linha de cima, frase, filhos e arte', () => {
    const r = render(
      <HeroHeader testID="h" eyebrow="Raid da semana" title="Mormaço" body="Toda corrida da cidade causa dano." tone="villain" art={<RNText>arte</RNText>}>
        <RNText testID="h-filho">36%</RNText>
      </HeroHeader>,
    );
    expect(r.has('h')).toBe(true);
    expect(r.has('h-filho')).toBe(true);
    expect(r.text()).toContain('Mormaço');
  });

  it('cor do tom: neon do time, laranja ou violeta dos vilões', () => {
    expect(heroToneColor('villain', '#X')).toBe('#B15CFF');
    expect(heroToneColor('action', '#FF7A2A')).toBe('#FF7A2A');
    expect(heroToneColor('owls', '#X')).toBe('#FF2D55');
  });
});

describe('BigRunButton', () => {
  it('rótulo com a linha de apoio e toque', () => {
    let runs = 0;
    const r = render(<BigRunButton testID="correr" sublabel="Missão 1 · 500 m" onPress={() => (runs += 1)} />);
    expect(r.host('correr').props.accessibilityLabel).toBe('Correr. Missão 1 · 500 m');
    r.press('correr');
    expect(runs).toBe(1);
  });

  it('desativado é anunciado', () => {
    const r = render(<BigRunButton testID="correr" disabled onPress={noop} />);
    expect(r.host('correr').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });
});

describe('StatTile', () => {
  it('lê tudo numa frase só', () => {
    const r = render(<StatTile testID="s" label="Distância" value="5,02" unit="km" delta={{ value: '+1,2 km', good: true }} />);
    expect(r.host('s').props.accessibilityLabel).toBe('Distância: 5,02 km, +1,2 km');
    expect(statTileLabel('Zonas', '12')).toBe('Zonas: 12');
  });

  it('aceita o número animado da E5 pelo slot', () => {
    const r = render(<StatTile testID="s" label="Tempo" value="28:10" valueSlot={<RNText testID="contador">0</RNText>} />);
    expect(r.has('contador')).toBe(true);
    expect(r.text()).not.toContain('28:10');
  });
});

describe('DemoBadge', () => {
  it('rótulo padrão e personalizado', () => {
    expect(render(<DemoBadge testID="d" />).host('d').props.accessibilityLabel).toContain('Demonstração');
    expect(render(<DemoBadge testID="d" label="Exemplo" />).text()).toBe('Exemplo');
  });
});

describe('SettingsRow', () => {
  it('título + valor no rótulo e toque', () => {
    let n = 0;
    const r = render(<SettingsRow testID="ajuste-contatos" icon="shield" title="Contatos de segurança" value="2 contatos" onPress={() => (n += 1)} />);
    expect(r.host('ajuste-contatos').props.accessibilityLabel).toBe('Contatos de segurança, 2 contatos');
    r.press('ajuste-contatos');
    expect(n).toBe(1);
  });

  it('destrutiva: sem seta', () => {
    const r = render(<SettingsRow testID="sair" icon="close" title="Sair" destructive onPress={noop} />);
    expect(r.text()).toBe('Sair');
  });
});
