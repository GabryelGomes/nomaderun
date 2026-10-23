/**
 * T7.1.9 — modelos 1 (Corrida) e 2 (Conquista de zona), em Stories e feed, com e sem rota.
 * Hierarquia: rota (ou arte "sem rota") → número herói → conquistas → time.
 */
import { Circle, G, Path } from 'react-native-svg';

import { factions } from '@/theme/tokens';

import { renderArt, MascotPlaceholder, type ShareCardArt } from './card-art';
import { CARD_FORMATS, CardFrame, type CardSurfaceProps } from './card-frame';
import type { RunCardModel, ShareCardFormat, ZoneCardModel } from './card-model';
import { CardText, cardColors, CardChip, Divider, Hero, LightPool, MapPanel, NoRouteArt, Rays, Stat, teamColor, TeamGlyph, useCardIds } from './card-parts';
import { cardFonts, fitFontSize, measureText } from './font-metrics';
import type { CardRegion } from './route-geometry';

type Props<M> = CardSurfaceProps & { model: M; format: ShareCardFormat; art?: ShareCardArt; regions?: readonly CardRegion[] };

/** O mapa some sob o cabeçalho (logo e time) e antes dos números, em cada formato. */
const MAP_FADE: Record<ShareCardFormat, readonly [number, number][]> = {
  stories: [
    [0, 0],
    [0.2, 0.12],
    [0.32, 1],
    [0.84, 1],
    [1, 0],
  ],
  feed: [
    [0, 0],
    [0.1, 0.1],
    [0.24, 1],
    [0.84, 1],
    [1, 0],
  ],
};

export function RunCard({ model, format, art, regions, ...surface }: Props<RunCardModel>) {
  const id = useCardIds();
  const { W } = CARD_FORMATS[format];
  const st = format === 'stories';
  const yLabel = st ? 1215 : 850;
  const ys = st ? 1500 : 1088;
  const vs = st ? 64 : 54;
  const cols = model.points ? [W / 2 - 330, W / 2, W / 2 + 330] : [W / 2 - 200, W / 2 + 200];
  const dateSize = fitFontSize(model.dateLabel, cardFonts.bold, st ? 28 : 24, W - 160, 18, 0.21);
  const noRouteBox = st ? { x: 0, y: 330, w: W, h: 820 } : { x: 0, y: 150, w: W, h: 620 };
  const mascotBox = { cx: W / 2, cy: noRouteBox.y + noRouteBox.h / 2 - 18, size: 124 };
  return (
    <CardFrame format={format} faction={model.faction} isDemo={model.isDemo} username={model.username} statusTag={model.statusTag} a11yLabel={model.a11yLabel} bgId={id('bg')} {...surface}>
      {model.route ? (
        <MapPanel
          id={id('map')}
          box={st ? { x: 0, y: 0, w: W, h: 1200 } : { x: 0, y: 0, w: W, h: 820 }}
          fitBox={st ? { x: 60, y: 370, w: W - 120, h: 760 } : { x: 60, y: 160, w: W - 120, h: 600 }}
          routes={[model.route]}
          regions={regions}
          pad={40}
          fadeStops={MAP_FADE[format]}
        />
      ) : (
        <NoRouteArt id={id('nr')} box={noRouteBox} faction={model.faction} mascot={renderArt(art?.mascot, mascotBox, () => <MascotPlaceholder faction={model.faction} box={mascotBox} />)} />
      )}
      <CardText x={W / 2} y={yLabel} size={dateSize} fill={cardColors.orangeText} ls={dateSize * 0.21} anchor="middle">
        {model.dateLabel}
      </CardText>
      <Hero id={id('hero')} x={W / 2} y={st ? 1420 : 1030} value={model.km} unit="km" size={st ? 230 : 190} />
      <Stat x={cols[0]} y={ys} label="TEMPO" value={model.time} size={vs} />
      <Stat x={cols[1]} y={ys} label="RITMO" value={model.pace} unit="/km" size={vs} />
      {model.points ? <Stat x={cols[2]} y={ys} label="PONTOS" value={model.points} size={vs} fill={cardColors.orange} /> : null}
      {(model.points ? [-165, 165] : [0]).map((dx) => (
        <Divider key={dx} x={W / 2 + dx} y1={ys - 24} y2={ys + vs + 12} />
      ))}
      {model.zonesChip ? <CardChip cx={W / 2} cy={st ? 1655 : 1232} label={model.zonesChip} color={teamColor(model.faction)} shape={factions[model.faction].shape} size={st ? 30 : 26} h={st ? 72 : 62} /> : null}
    </CardFrame>
  );
}

export function ZoneCard({ model, format, art, regions, ...surface }: Props<ZoneCardModel>) {
  const id = useCardIds();
  const { W } = CARD_FORMATS[format];
  const st = format === 'stories';
  const to = teamColor(model.to);
  const cy = st ? 740 : 440;
  const R = st ? 210 : 160;
  let y = st ? 1160 : 770;
  const titleY = y;
  y += st ? 138 : 108;
  const nameY = y;
  const nameSize = fitFontSize(model.zoneName, cardFonts.display, st ? 128 : 104, W - 144, 56);
  y += st ? 96 : 76;
  const flowY = y;
  y += st ? 178 : 140;
  const heroY = y;
  y += st ? 92 : 70;
  const statsY = y;
  // "de → para": time anterior (ou zona neutra) → meu time
  const fs = st ? 30 : 27;
  const fromName = model.from ? factions[model.from].name : 'Zona neutra';
  const toName = factions[model.to].name;
  const flowW = 38 + measureText(fromName, cardFonts.bold, fs) + 24 + 100 + 38 + measureText(toName, cardFonts.bold, fs);
  const fx = W / 2 - flowW / 2;
  const ax = fx + 38 + measureText(fromName, cardFonts.bold, fs) + 24;
  const tx = ax + 100;
  const artBox = { cx: W / 2, cy, size: R * 0.9 };
  return (
    <CardFrame format={format} faction={model.faction} isDemo={model.isDemo} username={model.username} statusTag={model.statusTag} a11yLabel={model.a11yLabel} bgId={id('bg')} bg={{ teamOpacity: 0.2, teamY: 0.7, teamR: 0.5 }} {...surface}>
      {model.route ? (
        <MapPanel
          id={id('map')}
          box={st ? { x: 0, y: 0, w: W, h: 1150 } : { x: 0, y: 0, w: W, h: 760 }}
          fitBox={st ? { x: 60, y: 360, w: W - 120, h: 700 } : { x: 60, y: 160, w: W - 120, h: 540 }}
          routes={[model.route]}
          regions={regions}
          highlight={model.to}
          pad={40}
          fadeStops={MAP_FADE[format]}
        />
      ) : (
        <G>
          <Rays id={id('rays')} cx={W / 2} cy={cy} r0={R * 0.6} r1={R * 3} n={30} color={to} opacity={0.2} />
          <LightPool id={id('pool')} cx={W / 2} cy={cy} rx={R * 1.8} ry={R * 1.8} color={to} opacity={0.22} />
          <Circle cx={W / 2} cy={cy} r={R + 30} fill="none" stroke={to} strokeOpacity={0.18} strokeWidth={34} />
          <Circle cx={W / 2} cy={cy} r={R} fill={cardColors.bg} stroke={to} strokeWidth={10} />
          {renderArt(art?.mascot, artBox, () => <TeamGlyph shape={factions[model.to].shape} cx={W / 2} cy={cy} r={R * 0.45} fill={to} />)}
        </G>
      )}
      <CardText x={W / 2} y={titleY} size={st ? 32 : 28} fill={cardColors.orangeText} ls={10} anchor="middle">
        ZONA CONQUISTADA
      </CardText>
      <LightPool id={id('npool')} cx={W / 2} cy={nameY - 45} rx={520} ry={130} color={to} opacity={0.22} />
      <CardText x={W / 2} y={nameY} font={cardFonts.display} size={nameSize} anchor="middle" ls={-2}>
        {model.zoneName}
      </CardText>
      {model.from ? <TeamGlyph shape={factions[model.from].shape} cx={fx + 14} cy={flowY - 10} r={12} fill={teamColor(model.from)} /> : <Circle cx={fx + 14} cy={flowY - 10} r={11} fill="none" stroke={cardColors.ink2} strokeWidth={3} />}
      <CardText x={fx + 38} y={flowY} size={fs} fill={cardColors.ink2}>
        {fromName}
      </CardText>
      <Path d={`M${ax} ${flowY - 10}h70m-18 -14l18 14l-18 14`} fill="none" stroke={cardColors.orange} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <TeamGlyph shape={factions[model.to].shape} cx={tx + 14} cy={flowY - 10} r={12} fill={to} />
      <CardText x={tx + 38} y={flowY} size={fs}>
        {toName}
      </CardText>
      <Hero id={id('hero')} x={W / 2} y={heroY} value={model.points} unit="pontos" size={st ? 150 : 118} />
      <CardText x={W / 2} y={statsY} font={cardFonts.displayMedium} size={st ? 38 : 32} fill={cardColors.ink2} anchor="middle">
        {model.statsLine}
      </CardText>
    </CardFrame>
  );
}
