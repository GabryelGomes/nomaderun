/**
 * T7.1.17 — componentes da primeira abertura e das folhas: escolha de time, líder, permissão e ajuda.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- mocks do Jest precisam de require síncrono */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease-out', useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Text as RNText } from 'react-native';

import { FACTION_IDS, type FactionId } from '@/domain/types';
import { factions } from '@/theme/tokens';

import { HelpSheet } from '../help-sheet';
import { LeaderSheet } from '../leader-sheet';
import { PermissionPrimer } from '../permission-primer';
import { TEAM_BALANCE_LINE, TEAM_STORY } from '../team-identity';
import { TeamCarousel, teamCardLabel, TeamPickerCard } from '../team-picker';
import { render } from './render-helpers';
/* eslint-enable import/first */

const noop = () => {};

describe('Identidade dos times (D-70)', () => {
  it('4 times com mascote, líder e textos curtos (D-74)', () => {
    expect(Object.keys(TEAM_STORY).sort()).toEqual([...FACTION_IDS].sort());
    for (const f of FACTION_IDS) {
      const t = TEAM_STORY[f];
      expect(t.bio.length).toBeLessThanOrEqual(90);
      expect(t.style.length).toBeLessThanOrEqual(30);
      expect(t.leaderLine.length).toBeLessThanOrEqual(120);
    }
    expect(TEAM_STORY.owls.mascot).toBe('Breu');
    expect(TEAM_STORY.coyotes.leader).toBe('Bento Rocha');
  });

  it('lema dos Night Owls não incentiva a madrugada', () => {
    expect(factions.owls.motto).toBe('Donos das luzes da cidade');
    const all = [factions.owls.motto, ...Object.values(TEAM_STORY.owls)].join(' ').toLowerCase();
    expect(all).not.toContain('madrugada');
  });
});

describe('TeamPickerCard', () => {
  it('rádio com estado, toque escolhe e o líder tem alvo próprio', () => {
    const picked: FactionId[] = [];
    const leaders: FactionId[] = [];
    const r = render(<TeamPickerCard faction="volt" selected onSelect={(f) => picked.push(f)} onLeader={(f) => leaders.push(f)} />);
    const card = r.host('time-volt');
    expect(card.props.accessibilityRole).toBe('radio');
    expect(card.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(card.props.accessibilityLabel).toBe(teamCardLabel('volt'));
    r.press('time-volt');
    r.press('time-volt-lider');
    expect(picked).toEqual(['volt']);
    expect(leaders).toEqual(['volt']);
  });

  it('a arte do mascote entra pelo slot', () => {
    const r = render(<TeamPickerCard faction="owls" selected={false} onSelect={noop} art={<RNText testID="mascote">Breu</RNText>} />);
    expect(r.has('mascote')).toBe(true);
    expect(r.has('time-owls-lider')).toBe(false);
  });
});

describe('TeamCarousel', () => {
  it('4 cards com testID por time e só o escolhido marcado', () => {
    const r = render(<TeamCarousel value="coyotes" onChange={noop} testID="onboarding-time" />);
    for (const f of FACTION_IDS) expect(r.has(`onboarding-time-${f}`)).toBe(true);
    const checked = FACTION_IDS.filter((f) => r.host(`onboarding-time-${f}`).props.accessibilityState?.checked);
    expect(checked).toEqual(['coyotes']);
  });

  it('nenhum escolhido no começo', () => {
    const r = render(<TeamCarousel value={null} onChange={noop} />);
    expect(FACTION_IDS.some((f) => r.host(`times-${f}`).props.accessibilityState?.checked)).toBe(false);
  });
});

describe('LeaderSheet', () => {
  it('fala do líder, equilíbrio e as duas saídas', () => {
    const calls: string[] = [];
    const r = render(<LeaderSheet faction="striders" onJoin={() => calls.push('entrar')} onBack={() => calls.push('voltar')} />);
    expect(r.text()).toContain('Íris Valente');
    expect(r.text()).toContain(TEAM_BALANCE_LINE);
    r.press('lider-entrar');
    r.press('lider-voltar');
    expect(calls).toEqual(['entrar', 'voltar']);
    expect(r.host('lider-entrar').props.accessibilityLabel).toBe('Entrar para os Neon Striders');
  });

  it('ocupado: "Entrando…" e desativado', () => {
    const r = render(<LeaderSheet faction="owls" busy onJoin={noop} onBack={noop} />);
    expect(r.host('lider-entrar').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
    expect(r.text()).toContain('Entrando…');
  });
});

describe('PermissionPrimer', () => {
  it('pedido com motivo, garantia e "Agora não"', () => {
    const calls: string[] = [];
    const r = render(
      <PermissionPrimer
        testID="gps"
        title="Ligue o GPS para pintar a cidade"
        body="Usamos sua localização só enquanto você corre."
        footnote="Sua casa fica escondida dos outros."
        ctaLabel="Permitir localização"
        onPress={() => calls.push('permitir')}
        secondaryLabel="Agora não"
        onSecondary={() => calls.push('depois')}
      />,
    );
    r.press('gps-permitir');
    r.press('gps-agora-nao');
    expect(calls).toEqual(['permitir', 'depois']);
    expect(r.text()).toContain('Sua casa fica escondida dos outros.');
  });

  it('sem saída secundária, só o pedido', () => {
    const r = render(<PermissionPrimer testID="avisos" title="Avisos" body="Avisamos se atacarem sua zona." ctaLabel="Avisar" icon="bell" onPress={noop} />);
    expect(r.has('avisos-agora-nao')).toBe(false);
  });
});

describe('HelpSheet', () => {
  it('3 cartões numerados e fechar', () => {
    let closed = 0;
    const r = render(
      <HelpSheet
        testID="ajuda-arena"
        title="Como funciona"
        onClose={() => (closed += 1)}
        cards={[
          { key: 'corra', title: 'Corra', body: 'Saia pelas ruas da sua cidade.', icon: 'activities' },
          { key: 'pinte', title: 'Pinte', body: 'Cada rua fica com a cor do seu time.', icon: 'brush' },
          { key: 'defenda', title: 'Defenda', body: 'Volte às suas zonas quando atacarem.', icon: 'shield' },
        ]}
      />,
    );
    const labels = r.renderer.root.findAll((n) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Passo'));
    expect(labels.map((n) => n.props.accessibilityLabel)).toEqual([
      'Passo 1 de 3: Corra. Saia pelas ruas da sua cidade.',
      'Passo 2 de 3: Pinte. Cada rua fica com a cor do seu time.',
      'Passo 3 de 3: Defenda. Volte às suas zonas quando atacarem.',
    ]);
    r.press('ajuda-arena-fechar');
    expect(closed).toBe(1);
  });
});
