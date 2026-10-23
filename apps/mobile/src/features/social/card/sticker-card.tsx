/**
 * T7.1.9 — adesivo transparente (1080×1080, paridade com o "Stats Sticker" do Strava): rota + km + números,
 * sem fundo, para colar sobre a própria foto nos Stories. Texto com sombra leve para ler em foto clara.
 * Sem rota: só os números. Leva o selo "DADOS DE DEMONSTRAÇÃO" quando for o caso.
 */
import Svg, { G } from 'react-native-svg';

import { A11Y_GROUP, type CardSurfaceProps } from './card-frame';
import type { RunCardModel } from './card-model';
import { CardText, cardColors, DEMO_STAMP, MapPanel, useCardIds } from './card-parts';
import { cardFonts, type CardFont } from './font-metrics';

export const STICKER_SIZE = 1080;

function Shaded({ x, y, text, font, size, fill, ls }: { x: number; y: number; text: string; font: CardFont; size: number; fill: string; ls?: number }) {
  return (
    <G>
      <CardText x={x} y={y + 4} font={font} size={size} fill={cardColors.shadow} opacity={0.35} anchor="middle" ls={ls}>
        {text}
      </CardText>
      <CardText x={x} y={y} font={font} size={size} fill={fill} anchor="middle" ls={ls}>
        {text}
      </CardText>
    </G>
  );
}

export function ShareSticker({ model, width, svgRef, testID }: CardSurfaceProps & { model: RunCardModel }) {
  const id = useCardIds();
  const W = STICKER_SIZE;
  const displayW = width ?? W;
  const top = model.route ? 0 : -420;
  const line = [model.time, `${model.pace} /km`, model.points ? `${model.points} pontos` : ''].filter(Boolean).join(' · ');
  return (
    <Svg ref={svgRef} width={displayW} height={displayW} viewBox={`0 0 ${W} ${W}`} testID={testID} accessible={A11Y_GROUP} accessibilityRole="image" accessibilityLabel={`Adesivo. ${model.a11yLabel}`}>
      {model.route ? <MapPanel id={id('map')} box={{ x: 140, y: 40, w: 800, h: 560 }} routes={[model.route]} dots={false} fade={false} pad={30} /> : null}
      <Shaded x={W / 2} y={top + 800} text={`${model.km} km`} font={cardFonts.display} size={170} fill={cardColors.orange} ls={-3} />
      <Shaded x={W / 2} y={top + 900} text={line} font={cardFonts.display} size={50} fill={cardColors.white} />
      <Shaded x={W / 2} y={top + 1000} text="NOMADE RUN" font={cardFonts.display} size={40} fill={cardColors.white} ls={6} />
      {model.isDemo ? <Shaded x={W / 2} y={top + 1050} text={DEMO_STAMP} font={cardFonts.bold} size={22} fill={cardColors.white} ls={4} /> : null}
    </Svg>
  );
}
