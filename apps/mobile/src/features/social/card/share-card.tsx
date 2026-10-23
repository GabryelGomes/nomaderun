/**
 * T7.1.9 — `<ShareCard>`: desenha qualquer modelo do card no formato pedido (Stories 1080×1920 ou feed
 * 1080×1350). A rota só chega aqui como `SharedRoute` (dentro do modelo): nunca `LatLng[]`.
 * A exportação em PNG (`toDataURL` → arquivo → menu do sistema) é da onda 2 (`useShareCard`), pelo `svgRef`.
 */
import type { ShareCardArt } from './card-art';
import type { CardSurfaceProps } from './card-frame';
import type { CardModel, ShareCardFormat } from './card-model';
import { BossCard, LevelCard } from './moment-cards';
import type { CardRegion } from './route-geometry';
import { RunCard, ZoneCard } from './run-cards';
import { WeekCard } from './week-card';

export type ShareCardProps = CardSurfaceProps & {
  model: CardModel;
  format: ShareCardFormat;
  /** Arte da E4 (mascote, chefão). Sem ela, marcadores simples. */
  art?: ShareCardArt;
  /** Regiões dos times no mapa do card (opcional; já suavizadas). */
  regions?: readonly CardRegion[];
};

export function ShareCard({ model, art, regions, ...surface }: ShareCardProps) {
  switch (model.kind) {
    case 'run':
      return <RunCard model={model} art={art} regions={regions} {...surface} />;
    case 'zone':
      return <ZoneCard model={model} art={art} regions={regions} {...surface} />;
    case 'level':
      return <LevelCard model={model} art={art} {...surface} />;
    case 'boss':
      return <BossCard model={model} art={art} {...surface} />;
    case 'week':
      return <WeekCard model={model} regions={regions} {...surface} />;
  }
}
