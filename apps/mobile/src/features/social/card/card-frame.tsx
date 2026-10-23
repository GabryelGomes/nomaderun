/**
 * T7.1.9 — moldura comum dos cards: fundo, logo, pílula do time, @ (opcional), selo de status, rodapé com o
 * slogan e o selo "DADOS DE DEMONSTRAÇÃO" quando o dado é de demonstração.
 * Stories (1080×1920): o essencial fica entre y = 250 e y = 1670 (topo e rodapé livres para o Instagram).
 */
import type { ReactNode, Ref } from 'react';
import { Platform } from 'react-native';
import Svg from 'react-native-svg';

import type { FactionId } from '@/domain/types';

import type { ShareCardFormat } from './card-model';
import { Background, CardText, cardColors, DemoStamp, StatusTag, TeamPill, Wordmark } from './card-parts';
import { cardFonts, truncateToWidth } from './font-metrics';

export const CARD_FORMATS: Record<ShareCardFormat, { W: number; H: number; top: number }> = {
  stories: { W: 1080, H: 1920, top: 300 },
  feed: { W: 1080, H: 1350, top: 116 },
};

/** O card é uma imagem só para o leitor de tela. Na web, `accessible` vazaria para o DOM: lá bastam role e aria-label. */
export const A11Y_GROUP = Platform.OS === 'web' ? undefined : true;

export const CARD_SLOGAN_STORIES = 'CORRA A SUA CIDADE. CADA RUA CONTA.';
export const CARD_SLOGAN_FEED = 'CORRA A SUA CIDADE.';

export type CardSurfaceProps = {
  /** Largura de exibição (dp). A altura segue a proporção do formato. Padrão: o tamanho real em pixels. */
  width?: number;
  /** `ref` do `<Svg>`, para o `toDataURL` da onda 2. */
  svgRef?: Ref<Svg>;
  testID?: string;
};

type FrameProps = CardSurfaceProps & {
  format: ShareCardFormat;
  faction: FactionId;
  isDemo: boolean;
  username: string | null;
  statusTag: string | null;
  a11yLabel: string;
  bgId: string;
  bg?: { teamOpacity?: number; teamY?: number; teamR?: number; orangeOpacity?: number };
  children: ReactNode;
};

export function CardFrame({ format, faction, isDemo, username, statusTag, a11yLabel, bgId, bg, children, width, svgRef, testID }: FrameProps) {
  const { W, H, top } = CARD_FORMATS[format];
  const stories = format === 'stories';
  const displayW = width ?? W;
  return (
    <Svg ref={svgRef} width={displayW} height={(displayW * H) / W} viewBox={`0 0 ${W} ${H}`} testID={testID} accessible={A11Y_GROUP} accessibilityRole="image" accessibilityLabel={a11yLabel}>
      <Background id={bgId} W={W} H={H} faction={faction} {...bg} />
      {children}
      <Wordmark x={72} y={top} size={stories ? 44 : 40} />
      <TeamPill faction={faction} right={W - 72} cy={top - 15} scale={stories ? 1 : 0.9} />
      {username ? (
        <CardText x={72} y={top + 50} size={26} fill={cardColors.ink2} font={cardFonts.medium}>
          {truncateToWidth(username, cardFonts.medium, 26, 420)}
        </CardText>
      ) : null}
      {statusTag ? <StatusTag right={W - 72} cy={top + 62} label={statusTag} /> : null}
      {stories ? (
        <>
          <CardText x={W / 2} y={1780} size={24} fill={cardColors.ink2} ls={5} anchor="middle">
            {CARD_SLOGAN_STORIES}
          </CardText>
          {isDemo ? <DemoStamp x={W / 2} y={1830} /> : null}
        </>
      ) : (
        <>
          <CardText x={72} y={H - 50} size={22} fill={cardColors.ink2} ls={5}>
            {CARD_SLOGAN_FEED}
          </CardText>
          {isDemo ? <DemoStamp x={W - 72} y={H - 50} anchor="end" size={20} /> : null}
        </>
      )}
    </Svg>
  );
}
