/**
 * T7.3.7 — rotas que o card aceita (puro).
 *
 * - `SharedRoute`: cortada no aparelho pelo domain (`clipRouteForSharing`): card da corrida, adesivo, GPX.
 * - `OwnServerRoute`: rota **da própria pessoa** já cortada no servidor pelo mesmo `clipRouteForSharing`
 *   (Edge Function `weekly-recap`: semente nova, ≤ 80 pontos, precisão 4, conferida contra as zonas de
 *   privacidade). O app **não corta de novo**: este adaptador só transforma as polylines decodificadas no tipo
 *   do card. Único chamador: o recap semanal (`recap/recap-model.ts`); um teste confere isso.
 *
 * As duas são tipos nominais com registro em tempo de execução: objeto montado à mão (ou o `LatLng[]` cru da
 * corrida) não passa por `isCardRoute` e o card não desenha. A rota do feed (de outra pessoa) continua fora:
 * ela nunca passa por aqui.
 */
import { isSharedRoute, type SharedRoute } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';

declare const OWN_SERVER_ROUTE_BRAND: unique symbol;

export type OwnServerRoute = {
  readonly mode: 'route';
  /** Pedaços visíveis (cada um com ≥ 2 pontos). */
  readonly pieces: readonly (readonly LatLng[])[];
  /** O servidor sempre esconde começo e fim. */
  readonly endsHidden: true;
  readonly [OWN_SERVER_ROUTE_BRAND]: true;
};

export type CardRoute = SharedRoute | OwnServerRoute;

const issued = new WeakSet<object>();

const finite = (p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/**
 * Pedaços já cortados pelo servidor (polylines do `weekly-recap` decodificadas) → rota do card. Sem pedaço
 * com 2 pontos válidos → `null` (o card fica sem a mini-rota).
 */
export function ownRouteFromServer(route: { readonly pieces: readonly (readonly LatLng[])[] } | null | undefined): OwnServerRoute | null {
  if (!route) return null;
  const pieces = route.pieces.map((p) => p.filter(finite)).filter((p) => p.length >= 2);
  if (!pieces.length) return null;
  const sealed = Object.freeze({
    mode: 'route' as const,
    pieces: Object.freeze(pieces.map((p) => Object.freeze(p.map((q) => Object.freeze({ lat: q.lat, lng: q.lng }))))),
    endsHidden: true as const,
  }) as OwnServerRoute;
  issued.add(sealed);
  return sealed;
}

export function isOwnServerRoute(value: unknown): value is OwnServerRoute {
  return typeof value === 'object' && value !== null && issued.has(value);
}

/** A rota saiu de um dos dois cortes (aparelho ou servidor) e pode ser desenhada no card. */
export function isCardRoute(value: unknown): value is CardRoute {
  return isSharedRoute(value) || isOwnServerRoute(value);
}
