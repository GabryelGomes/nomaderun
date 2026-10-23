import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { forAll } from '@/domain/__tests__/prop';
import { isSharedRoute } from '@/domain/share-privacy';

import {
  decodePolyline,
  decodeServerRoute,
  encodePolyline,
  FEED_UNAVAILABLE,
  isFeedUnavailable,
  isServerClippedRoute,
  deleteFeedItem,
  getFeedSettings,
  listCrewFeed,
  listFeedItemKudos,
  reactToFeedItem,
  setFeedSettings,
  toFeedItem,
  toFeedPage,
} from '../feed-repo';
import { recordShare } from '../share-repo';

type AnyFn = (...args: any[]) => any;
const mockRpc = jest.fn<AnyFn>();
jest.mock('../supabase', () => ({ requireSupabase: () => ({ rpc: mockRpc }), getSupabase: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('polyline (precisão 4) do feed', () => {
  it('exemplo conhecido do formato (precisão 5, documentação do Google)', () => {
    const pts = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(pts, 5)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual(pts);
  });

  it('ida e volta: decodificar(codificar(p)) = p arredondado a 4 casas (400 casos)', () => {
    forAll(
      (r) => Array.from({ length: r.int(1, 90) }, () => ({ lat: r.float(-89.9, 89.9), lng: r.float(-179.9, 179.9) })),
      (pts) => {
        const back = decodePolyline(encodePolyline(pts));
        expect(back).not.toBeNull();
        expect(back!.length).toBe(pts.length);
        back!.forEach((p, i) => {
          expect(Math.abs(p.lat - pts[i].lat)).toBeLessThanOrEqual(0.00005 + 1e-9);
          expect(Math.abs(p.lng - pts[i].lng)).toBeLessThanOrEqual(0.00005 + 1e-9);
        });
      },
      400,
    );
  });

  it('texto inválido vira null (nunca lança)', () => {
    expect(decodePolyline('?')).toBeNull(); // número sem a longitude
    expect(decodePolyline('_p~iF ')).toBeNull(); // caractere fora da faixa
    expect(decodePolyline('~~~~~~~~~~~~~~')).toBeNull(); // número que não termina
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('ServerClippedRoute (rota do feed, cortada no servidor)', () => {
  const piece = encodePolyline([
    { lat: -16.71, lng: -49.24 },
    { lat: -16.712, lng: -49.241 },
    { lat: -16.714, lng: -49.239 },
  ]);

  it('aceita uma polyline ou uma lista (1 por pedaço); descarta pedaço inválido ou curto', () => {
    expect(decodeServerRoute(piece)!.pieces).toHaveLength(1);
    const many = decodeServerRoute([piece, 'lixo ', encodePolyline([{ lat: 1, lng: 1 }]), piece, 42]);
    expect(many!.pieces).toHaveLength(2);
    expect(decodeServerRoute(null)).toBeNull();
    expect(decodeServerRoute([])).toBeNull();
    expect(decodeServerRoute(['lixo '])).toBeNull();
  });

  it('é um tipo próprio: não passa como SharedRoute (o card de compartilhar recusa)', () => {
    const r = decodeServerRoute(piece)!;
    expect(isServerClippedRoute(r)).toBe(true);
    expect(isSharedRoute(r)).toBe(false);
    expect(isServerClippedRoute({ ...r })).toBe(false); // cópia montada à mão não vale
    expect(Object.isFrozen(r.pieces)).toBe(true);
  });
});

describe('itens e páginas do feed (contrato v2 — onda 2)', () => {
  it('converte o F do servidor, sem confiar no formato', () => {
    const item = toFeedItem({
      id: 'f1',
      day: '2026-10-22',
      you: false,
      author: { username: 'ana.demo', faction: 'striders', avatarUrl: null },
      meters: 5020,
      movingSeconds: 1690,
      avgPace: 337,
      route: null,
      routeHidden: false,
      highlights: [{ kind: 'zone_conquered', name: 'Jardim Goiás' }, { kind: 'raid_damage', damage: 70, km: 2.1 }, { kind: 'pr', distance: '5 km' }, { kind: 'pr', distance: '10 km' }, { kind: 'x' }],
      kudos: { bora: 3, fogo: -1 },
      myReaction: 'bora',
      isDemo: true,
    });
    expect(item.author).toEqual({ username: 'ana.demo', faction: 'striders', avatarUrl: null });
    expect(item.day).toBe('2026-10-22');
    expect(item.avgPace).toBe(337);
    expect(item.routeHidden).toBe(true); // sem rota → "sem mapa"
    expect(item.highlights).toHaveLength(3);
    expect(item.highlights[1]).toEqual({ kind: 'raid_damage', damage: 70, km: 2.1 });
    expect(item.kudos).toEqual({ bora: 3, fogo: 0, raio: 0 });
    expect(item.myReaction).toBe('bora');

    const odd = toFeedItem({ id: 'f2', author: 'x', day: '22/10', myReaction: 'aplauso', avgPace: -1 });
    expect(odd.author.username).toBe('corredor');
    expect(odd.day).toBe('');
    expect(odd.avgPace).toBeNull();
    expect(odd.myReaction).toBeNull();
  });

  it('página: crew nula = fora de crew; itens sem id são descartados; cursor = id do último', () => {
    expect(toFeedPage(null)).toEqual({ crew: null, items: [], next: null });
    const p = toFeedPage({ crew: { id: 'c', name: 'Flamboyant Runners', tag: 'FLR', faction: 'striders' }, items: [{ id: '' }, { id: 'ok' }], next: 'ok' });
    expect(p.crew?.tag).toBe('FLR');
    expect(p.items.map((i) => i.id)).toEqual(['ok']);
    expect(p.next).toBe('ok');
  });
});

describe('RPCs do feed e do compartilhamento', () => {
  it('crew_feed com p_limit e p_before (id)', async () => {
    mockRpc.mockResolvedValueOnce({ data: { crew: null, items: [], next: null }, error: null });
    const r = await listCrewFeed({ before: 'item-9' });
    expect(mockRpc).toHaveBeenCalledWith('crew_feed', { p_limit: 20, p_before: 'item-9' });
    expect(r.ok).toBe(true);
  });

  it.each([
    ['PGRST202', 'Could not find the function public.crew_feed in the schema cache'],
    ['P0001', 'FEATURE_DISABLED: o feed está desligado'],
  ])('%s vira "indisponível"', async (code, message) => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code, message, details: null, hint: null } });
    const r = await listCrewFeed();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.detail).toBe(FEED_UNAVAILABLE);
      expect(isFeedUnavailable(r.error)).toBe(true);
      expect(r.error.message).toBe('O feed da crew ainda não está disponível.');
    }
  });

  it('reagir devolve o F atualizado; erro do servidor chega com o código', async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: 'f1', kudos: { bora: 4 }, myReaction: 'bora' }, error: null });
    const r = await reactToFeedItem('f1', 'bora');
    expect(mockRpc).toHaveBeenCalledWith('react_feed_item', { p_item: 'f1', p_reaction: 'bora' });
    expect(r.ok && r.data.kudos).toEqual({ bora: 4, fogo: 0, raio: 0 });
    expect(r.ok && r.data.myReaction).toBe('bora');

    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'KUDOS_LIMIT: limite de reações do dia atingido' } });
    const limited = await reactToFeedItem('f1', 'fogo');
    expect(!limited.ok && limited.error.detail).toBe('KUDOS_LIMIT');

    mockRpc.mockResolvedValueOnce({ data: { kudos: { bora: 3 }, myReaction: null }, error: null });
    const off = await reactToFeedItem('f1', null);
    expect(mockRpc).toHaveBeenLastCalledWith('react_feed_item', { p_item: 'f1', p_reaction: null });
    expect(off.ok && off.data.id).toBe('f1');
  });

  it('quem reagiu, tirar do feed e as preferências', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ username: 'bia.demo', faction: 'striders', avatarUrl: null, reaction: 'bora' }, { username: 'x', reaction: 'aplauso' }], error: null });
    const who = await listFeedItemKudos('f1');
    expect(mockRpc).toHaveBeenLastCalledWith('feed_item_kudos', { p_item: 'f1' });
    expect(who.ok && who.data).toEqual([{ username: 'bia.demo', faction: 'striders', avatarUrl: null, reaction: 'bora' }]);

    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await deleteFeedItem('f1')).toEqual({ ok: true, data: true });
    expect(mockRpc).toHaveBeenLastCalledWith('delete_feed_item', { p_item: 'f1' });

    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    expect(await getFeedSettings()).toEqual({ ok: true, data: { shareRunsToFeed: true, feedShowMap: true } }); // ausente = ligado
    expect(mockRpc).toHaveBeenLastCalledWith('my_feed_settings');

    mockRpc.mockResolvedValueOnce({ data: { shareRunsToFeed: true, feedShowMap: false }, error: null });
    expect(await setFeedSettings({ feedShowMap: false })).toEqual({ ok: true, data: { shareRunsToFeed: true, feedShowMap: false } });
    expect(mockRpc).toHaveBeenLastCalledWith('set_feed_settings', { p_share_runs: null, p_show_map: false });
  });

  it('record_share: conta as missões; servidor antigo não é erro', async () => {
    mockRpc.mockResolvedValueOnce({ data: { completed: [{ id: 'm1' }] }, error: null });
    expect(await recordShare('a1')).toEqual({ ok: true, data: { recorded: true, completedMissions: 1 } });
    expect(mockRpc).toHaveBeenCalledWith('record_share', { p_activity: 'a1' });

    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await recordShare('a1')).toEqual({ ok: true, data: { recorded: false, completedMissions: 0 } });

    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'NOT_FOUND: corrida não encontrada' } });
    const nf = await recordShare('x');
    expect(!nf.ok && nf.error.code).toBe('NOT_FOUND');
  });
});
