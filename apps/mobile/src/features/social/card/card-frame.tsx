/**
 * T7.1.9 — moldura comum dos cards: fundo, logo, pílula do time, @ (opcional), selo de status, rodapé com o
 * slogan e o selo "DADOS DE DEMONSTRAÇÃO" quando o dado é de demonstração.
 * T7.3.7: o logo é o oficial da E4 (`LogoSvgArt` horizontal: símbolo + logotipo em traço, sem `<text>`), com
 * o @ alinhado sob o logotipo e a pílula do time centrada na altura do símbolo.
 * Stories (1080×1920): o essencial fica entre y = 250 e y = 1670 (topo e rodapé livres para o Instagram).
 */
import type { ReactNode, Ref } from 'react';
import { Platform } from 'react-native';
import Svg from 'react-native-svg';

import { LogoSvgArt } from '@/components/art';
import type { FactionId } from '@/domain/types';

import type { ShareCardFormat } from './card-model';
import { CARD_FORMATS } from './card-sizes';
import { Background, CardText, cardColors, DemoStamp, StatusTag, TeamPill } from './card-parts';
import { cardFonts, truncateToWidth } from './font-metrics';

export { CARD_FORMATS };

/** O card é uma imagem só para o leitor de tela. Na web, `accessible` vazaria para o DOM: lá bastam role e aria-label. */
export const A11Y_GROUP = Platform.OS === 'web' ? undefined : true;

/** Área segura dos Stories (a barra do Instagram cobre o topo e o rodapé). */
export const STORIES_SAFE = { top: 250, bottom: 1670 } as const;

/** Linha de base do selo de demonstração nos Stories: abaixo da pílula do time (e do selo de status, se houver). */
export function storiesDemoStampY(statusTag: string | null): number {
  const top = CARD_FORMATS.stories.top;
  return statusTag ? top + 122 : top + 70;
}

/** Viewbox do logo horizontal da E4 (640 × 200): o símbolo ocupa x 8–180 e y 14–186; o logotipo começa em x 196. */
const LOGO_VB = { w: 640, symbolX: 8, symbolY: [14, 186] as const, wordX: 196 };

/**
 * Onde o logo entra em cada formato: largura (`size`) e o topo da caixa. Nos Stories, o símbolo começa em
 * y ≈ 249 (fora da barra do Instagram) e termina em y ≈ 362.
 */
export const CARD_LOGO: Record<ShareCardFormat, { size: number; top: number }> = {
  stories: { size: 420, top: 240 },
  feed: { size: 380, top: 56 },
};

/** Caixa do logo (contrato `{ cx, cy, size }` da E4), o centro do símbolo e onde vai o @. */
export function cardLogoLayout(format: ShareCardFormat) {
  const { size, top } = CARD_LOGO[format];
  const k = size / LOGO_VB.w;
  const left = 72 - LOGO_VB.symbolX * k; // o símbolo encosta na margem de 72
  const symbolMid = top + ((LOGO_VB.symbolY[0] + LOGO_VB.symbolY[1]) / 2) * k;
  return {
    box: { cx: left + size / 2, cy: top + (size * 200) / 640 / 2, size },
    symbolMid,
    userX: left + LOGO_VB.wordX * k + 4,
    userY: top + LOGO_VB.symbolY[1] * k - 6,
  };
}

export const CARD_SLOGAN_STORIES ='CORRA A SUA CIDADE. CADA RUA CONTA.';
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
  const logo = cardLogoLayout(format);
  return (
    <Svg ref={svgRef} width={displayW} height={(displayW * H) / W} viewBox={`0 0 ${W} ${H}`} testID={testID} accessible={A11Y_GROUP} accessibilityRole="image" accessibilityLabel={a11yLabel}>
      <Background id={bgId} W={W} H={H} faction={faction} {...bg} />
      {children}
      <LogoSvgArt variant="horizontal" box={logo.box} quality="completo" />
      <TeamPill faction={faction} right={W - 72} cy={logo.symbolMid} scale={stories ? 1 : 0.9} />
      {username ? (
        <CardText x={logo.userX} y={logo.userY} size={26} fill={cardColors.ink2} font={cardFonts.medium}>
          {truncateToWidth(username, cardFonts.medium, 26, 360)}
        </CardText>
      ) : null}
      {statusTag ? <StatusTag right={W - 72} cy={top + 62} label={statusTag} /> : null}
      {stories ? (
        <>
          <CardText x={W / 2} y={1780} size={24} fill={cardColors.ink2} ls={5} anchor="middle">
            {CARD_SLOGAN_STORIES}
          </CardText>
          {/* T7.2.5: o selo fica dentro da área segura do Instagram (y de 250 a 1670), sob a pílula do time. */}
          {isDemo ? <DemoStamp x={W - 72} y={storiesDemoStampY(statusTag)} anchor="end" size={20} /> : null}
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
