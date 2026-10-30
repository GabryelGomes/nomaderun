/**
 * T7.1.9 — modelo 5 (Recap semanal): km da semana, barras por dia, até 3 mini-rotas (já cortadas) e totais.
 * Sem rota: barras maiores e só números.
 */
import { G, Rect } from 'react-native-svg';

import { CARD_FORMATS, CardFrame, type CardSurfaceProps } from './card-frame';
import type { ShareCardFormat, WeekCardModel } from './card-model';
import { CardText, cardColors, CardChip, Hero, LightPool, MapPanel, teamColor, useCardIds } from './card-parts';
import { cardFonts } from './font-metrics';
import type { CardRegion } from './route-geometry';

type Props = CardSurfaceProps & { model: WeekCardModel; format: ShareCardFormat; regions?: readonly CardRegion[] };

export function WeekCard({ model, format, regions, ...surface }: Props) {
  const id = useCardIds();
  const { W } = CARD_FORMATS[format];
  const st = format === 'stories';
  const withRoutes = model.routes.length > 0;
  // T7.3.7: começa abaixo do logo da E4 (o símbolo vai até y ≈ 362 nos Stories).
  let y = st ? 470 : 222;
  const headY = y;
  y += st ? 228 : 170;
  const heroY = y;
  y += st ? 110 : 70;
  const chartY = y;
  const ch = st ? (withRoutes ? 170 : 420) : withRoutes ? 130 : 180;
  const max = Math.max(1, ...model.bars.map((b) => b.meters));
  const bw = st ? 44 : 38;
  const gap = (W - 144 - bw * 7) / 6;
  y += ch + (st ? 90 : 66);
  const tilesY = y;
  const tw = (W - 144 - 2 * 24) / 3;
  const th = st ? 310 : 250;
  // Menos de 3 mini-rotas: centralizadas.
  const tilesX = W / 2 - (model.routes.length * tw + Math.max(0, model.routes.length - 1) * 24) / 2;
  if (withRoutes) y += th + (st ? 100 : 70);
  else y += st ? 90 : 30;
  const totalsY = y;
  y += st ? 128 : 90;
  const chipY = y;
  const cols = [72, 72 + (W - 144) / 3, 72 + ((W - 144) * 2) / 3];
  return (
    <CardFrame format={format} faction={model.faction} isDemo={model.isDemo} username={model.username} statusTag={model.statusTag} a11yLabel={model.a11yLabel} bgId={id('bg')} bg={{ teamOpacity: 0.1, teamY: 0.55 }} {...surface}>
      <CardText x={72} y={headY} size={st ? 32 : 26} fill={cardColors.orangeText} ls={10}>
        MINHA SEMANA
      </CardText>
      <CardText x={W - 72} y={headY} size={st ? 28 : 24} fill={cardColors.ink2} ls={4} anchor="end">
        {model.rangeLabel}
      </CardText>
      <Hero id={id('hero')} x={72} y={heroY} value={model.km} unit="km" size={st ? 220 : 160} align="start" />
      {model.bars.map((b, i) => {
        const x = 72 + i * (bw + gap);
        const h = b.meters > 0 ? (b.meters / max) * ch : 8;
        return (
          <G key={i}>
            {b.meters > 0 ? (
              <G>
                <LightPool id={id(`bar${i}`)} cx={x + bw / 2} cy={chartY + ch - h / 2} rx={bw * 2.2} ry={h * 0.75 + 30} color={cardColors.orange} opacity={0.2} />
                <Rect x={x} y={chartY + ch - h} width={bw} height={h} rx={12} fill={cardColors.orange} />
                <Rect x={x + bw / 2 - 3} y={chartY + ch - h + 10} width={6} height={Math.max(0, h - 20)} rx={3} fill={cardColors.orangeCore} opacity={0.55} />
                <CardText x={x + bw / 2} y={chartY + ch - h - 18} font={cardFonts.display} size={st ? 30 : 24} anchor="middle">
                  {b.label}
                </CardText>
              </G>
            ) : (
              <Rect x={x} y={chartY + ch - 8} width={bw} height={8} rx={4} fill={cardColors.surface2} />
            )}
            <CardText x={x + bw / 2} y={chartY + ch + (st ? 46 : 36)} size={st ? 24 : 20} fill={b.meters > 0 ? cardColors.ink : cardColors.ink2} anchor="middle">
              {b.day}
            </CardText>
          </G>
        );
      })}
      {model.routes.map((r, i) => (
        <MapPanel
          key={i}
          id={id(`mini${i}`)}
          box={{ x: tilesX + i * (tw + 24), y: tilesY, w: tw, h: th, rx: 28 }}
          routes={[r]}
          regions={regions}
          pad={38}
          dotStep={26}
          fade={false}
          panelFill={cardColors.surface}
          border
          routeWidth={0.7}
        />
      ))}
      {model.totals.map((t, i) => (
        <G key={t.label}>
          <CardText x={cols[i]} y={totalsY} font={cardFonts.display} size={st ? 72 : 54} fill={i === 2 ? teamColor(model.faction) : cardColors.ink}>
            {t.value}
          </CardText>
          <CardText x={cols[i]} y={totalsY + (st ? 46 : 34)} size={st ? 22 : 18} fill={cardColors.ink2} ls={4}>
            {t.label}
          </CardText>
        </G>
      ))}
      {model.streakChip ? <CardChip cx={72} cy={chipY} label={model.streakChip} color={cardColors.orange} align="start" size={st ? 28 : 24} h={st ? 68 : 58} /> : null}
    </CardFrame>
  );
}
