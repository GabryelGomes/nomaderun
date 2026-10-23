import { describe, expect, it } from '@jest/globals';

import { forAll } from '@/domain/__tests__/prop';
import { decodeServerRoute, encodePolyline, FEED_REACTIONS, type FeedItem, type FeedReaction } from '@/services/api/feed-repo';

import { feedDateLabel, feedItemLabel, feedStats, highlightLabel, localToday, miniMapPaths, toggleReaction, totalReactions } from '../feed-model';

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'f1',
  author: { username: 'ana.demo', faction: 'striders', avatarUrl: null },
  you: false,
  day: '2026-10-22',
  meters: 5020,
  movingSeconds: 1690,
  avgPace: 337,
  route: null,
  routeHidden: true,
  highlights: [{ kind: 'zone_conquered', name: 'Jardim Goiás' }],
  kudos: { bora: 3, fogo: 1, raio: 0 },
  myReaction: null,
  isDemo: true,
  ...over,
});

describe('textos do feed', () => {
  it('data sem hora: Hoje, Ontem, dia e mês (ano só quando muda)', () => {
    expect(feedDateLabel('2026-10-23', '2026-10-23')).toBe('Hoje');
    expect(feedDateLabel('2026-10-22', '2026-10-23')).toBe('Ontem');
    expect(feedDateLabel('2026-02-28', '2026-03-01')).toBe('Ontem');
    expect(feedDateLabel('2026-10-18', '2026-10-23')).toBe('18 out');
    expect(feedDateLabel('2025-12-31', '2026-01-05')).toBe('31 dez 2025');
    expect(feedDateLabel('', '2026-10-23')).toBe('');
    expect(localToday(new Date(2026, 9, 23, 23, 59).getTime())).toBe('2026-10-23');
  });

  it('números, conquistas e a frase do leitor de tela', () => {
    expect(feedStats(item())).toEqual({ km: '5,02 km', time: '28:10', pace: '5:37 /km' });
    expect(feedStats(item({ meters: 0, movingSeconds: 0 })).pace).toBe('--:-- /km');
    expect(highlightLabel({ kind: 'zone_conquered', name: 'Jardim Goiás' })).toBe('Conquistou Jardim Goiás');
    expect(highlightLabel({ kind: 'raid_damage', km: 2.1, damage: 70 })).toBe('−2,1 km no chefão');
    expect(highlightLabel({ kind: 'pr', distance: '5 km' })).toBe('Recorde: 5 km');
    expect(feedItemLabel(item(), '2026-10-23')).toBe('ana.demo, Ontem, 5,02 km, 28:10, ritmo 5:37 /km, Conquistou Jardim Goiás, rota escondida, demonstração');
    expect(feedItemLabel(item({ you: true, isDemo: false, routeHidden: false }), '2026-10-22')).toBe('Você, Hoje, 5,02 km, 28:10, ritmo 5:37 /km, Conquistou Jardim Goiás');
  });
});

describe('reação otimista', () => {
  it('põe, troca e tira', () => {
    const put = toggleReaction(item(), 'bora');
    expect(put).toEqual({ kudos: { bora: 4, fogo: 1, raio: 0 }, myReaction: 'bora' });
    const swap = toggleReaction({ ...item(), ...put }, 'raio');
    expect(swap).toEqual({ kudos: { bora: 3, fogo: 1, raio: 1 }, myReaction: 'raio' });
    const off = toggleReaction({ ...item(), ...swap }, 'raio');
    expect(off).toEqual({ kudos: { bora: 3, fogo: 1, raio: 0 }, myReaction: null });
  });

  it('propriedade (500 sequências): no máximo 1 reação minha; total muda só por ±1; nunca negativo', () => {
    forAll(
      (r) => ({ start: { bora: r.int(0, 5), fogo: r.int(0, 5), raio: r.int(0, 5) }, taps: Array.from({ length: r.int(1, 20) }, () => r.pick(FEED_REACTIONS)) }),
      ({ start, taps }) => {
        let state: { kudos: Record<FeedReaction, number>; myReaction: FeedReaction | null } = { kudos: start, myReaction: null };
        const base = totalReactions(start);
        for (const t of taps) {
          state = toggleReaction(state, t);
          const total = totalReactions(state.kudos);
          expect(total - base).toBe(state.myReaction ? 1 : 0);
          for (const k of FEED_REACTIONS) expect(state.kudos[k]).toBeGreaterThanOrEqual(0);
        }
      },
      500,
    );
  });
});

describe('mini-mapa da rota cortada', () => {
  const pieces = [
    [
      { lat: -16.71, lng: -49.24 },
      { lat: -16.712, lng: -49.238 },
      { lat: -16.715, lng: -49.239 },
    ],
    [
      { lat: -16.72, lng: -49.235 },
      { lat: -16.721, lng: -49.233 },
    ],
  ];
  const route = decodeServerRoute(pieces.map((p) => encodePolyline(p)));

  it('1 caminho por pedaço, dentro da caixa com margem', () => {
    const paths = miniMapPaths(route, 320, 180, 12);
    expect(paths).toHaveLength(2);
    for (const d of paths)
      for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(11.9);
        expect(Number(m[1])).toBeLessThanOrEqual(308.1);
        expect(Number(m[2])).toBeGreaterThanOrEqual(11.9);
        expect(Number(m[2])).toBeLessThanOrEqual(168.1);
      }
  });

  it('sem rota → nada a desenhar', () => {
    expect(miniMapPaths(null, 320, 180)).toEqual([]);
  });
});
