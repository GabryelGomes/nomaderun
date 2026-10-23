/**
 * T7.1.9 — modelos 3 (Nível novo) e 4 (Chefão derrotado). Não têm rota (o momento é a arte).
 * O mascote e o chefão entram por props (`art`); sem eles, marcadores simples no mesmo traço.
 */
import { Circle, G, Line, Rect } from 'react-native-svg';

import { factions } from '@/theme/tokens';

import { BossPlaceholder, MascotPlaceholder, renderArt, type ShareCardArt } from './card-art';
import { CARD_FORMATS, CardFrame, type CardSurfaceProps } from './card-frame';
import type { BossCardModel, LevelCardModel, ShareCardFormat } from './card-model';
import { CardText, cardColors, CardChip, Hero, LightPool, Rays, teamColor, useCardIds } from './card-parts';
import { cardFonts, fitFontSize, truncateToWidth } from './font-metrics';

type Props<M> = CardSurfaceProps & { model: M; format: ShareCardFormat; art?: ShareCardArt };

export function LevelCard({ model, format, art, ...surface }: Props<LevelCardModel>) {
  const id = useCardIds();
  const { W } = CARD_FORMATS[format];
  const st = format === 'stories';
  const cx = W / 2;
  const cy = st ? 790 : 480;
  const R = st ? 300 : 230;
  const ticks = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    const r0 = R - 50;
    const r1 = R - (i % 5 === 0 ? 78 : 62);
    return { i, x1: cx + Math.cos(a) * r0, y1: cy + Math.sin(a) * r0, x2: cx + Math.cos(a) * r1, y2: cy + Math.sin(a) * r1 };
  });
  const mascotR = st ? 62 : 50;
  const mascotBox = { cx: cx + R * 0.71, cy: cy + R * 0.71, size: mascotR * 2 };
  let y = cy + R + (st ? 165 : 120);
  const titleY = y;
  y += st ? 104 : 80;
  const headY = y;
  y += st ? 62 : 46;
  const barY = y;
  y += st ? 190 : 140;
  const totalsY = y;
  const bw = st ? 700 : 620;
  const cols = [W / 2 - 300, W / 2, W / 2 + 300];
  const headSize = fitFontSize(model.headline, cardFonts.display, st ? 84 : 66, W - 144, 44);
  return (
    <CardFrame format={format} faction={model.faction} isDemo={model.isDemo} username={model.username} statusTag={model.statusTag} a11yLabel={model.a11yLabel} bgId={id('bg')} bg={{ teamOpacity: 0.06, orangeOpacity: 0.3 }} {...surface}>
      <Rays id={id('rays')} cx={cx} cy={cy} r0={R * 0.5} r1={R * 2.3} n={36} color={cardColors.orange} opacity={0.2} />
      <LightPool id={id('pool')} cx={cx} cy={cy} rx={R * 1.5} ry={R * 1.5} color={cardColors.orange} opacity={0.18} />
      <Circle cx={cx} cy={cy} r={R} fill={cardColors.bg} stroke={cardColors.surface2} strokeWidth={30} />
      {(
        [
          [74, 0.06],
          [48, 0.14],
          [30, 1],
        ] as const
      ).map(([w, op]) => (
        <Circle key={w} cx={cx} cy={cy} r={R} fill="none" stroke={cardColors.orange} strokeWidth={w} strokeOpacity={op} />
      ))}
      <Circle cx={cx} cy={cy} r={R} fill="none" stroke={cardColors.orangeCore} strokeWidth={5} />
      {ticks.map((t) => (
        <Line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={cardColors.ink} strokeOpacity={t.i % 5 === 0 ? 0.4 : 0.14} strokeWidth={4} strokeLinecap="round" />
      ))}
      <CardText x={cx} y={cy - R * 0.4} size={st ? 32 : 26} fill={cardColors.ink2} ls={10} anchor="middle">
        NÍVEL
      </CardText>
      <CardText x={cx} y={cy + R * 0.4} font={cardFonts.display} size={st ? 310 : 240} anchor="middle">
        {String(model.level)}
      </CardText>
      {renderArt(art?.mascot, mascotBox, () => <MascotPlaceholder faction={model.faction} box={mascotBox} />)}
      <CardText x={cx} y={titleY} size={st ? 32 : 26} fill={cardColors.orangeText} ls={10} anchor="middle">
        NÍVEL NOVO
      </CardText>
      <CardText x={cx} y={headY} font={cardFonts.display} size={headSize} anchor="middle" ls={-1}>
        {model.headline}
      </CardText>
      <Rect x={cx - bw / 2} y={barY} width={bw} height={20} rx={10} fill={cardColors.surface2} />
      {model.progress > 0 ? <Rect x={cx - bw / 2} y={barY} width={Math.max(20, bw * model.progress)} height={20} rx={10} fill={cardColors.orange} /> : null}
      <CardText x={cx} y={barY + 62} font={cardFonts.medium} size={st ? 28 : 24} fill={cardColors.ink2} anchor="middle">
        {model.next}
      </CardText>
      {model.totals.map((t, i) => (
        <G key={t.label}>
          <CardText x={cols[i]} y={totalsY} font={cardFonts.display} size={st ? 72 : 56} fill={i === 1 ? teamColor(model.faction) : cardColors.ink} anchor="middle">
            {t.value}
          </CardText>
          <CardText x={cols[i]} y={totalsY + (st ? 48 : 38)} size={st ? 22 : 19} fill={cardColors.ink2} ls={4} anchor="middle">
            {t.label}
          </CardText>
        </G>
      ))}
    </CardFrame>
  );
}

export function BossCard({ model, format, art, ...surface }: Props<BossCardModel>) {
  const id = useCardIds();
  const { W } = CARD_FORMATS[format];
  const st = format === 'stories';
  const cx = W / 2;
  const cy = st ? 720 : 430;
  const R = st ? 200 : 150;
  const sw = st ? 470 : 400;
  const sh = st ? 104 : 88;
  const sy = cy + R * 1.12;
  let y = cy + R + (st ? 250 : 185);
  const titleY = y;
  y += st ? 100 : 80;
  const nameY = y;
  y += st ? 54 : 42;
  const cityY = y;
  y += st ? 250 : 196;
  const heroY = y;
  y += st ? 86 : 62;
  const chipY = y;
  const nameSize = fitFontSize(model.bossName, cardFonts.display, st ? 86 : 70, W - 144, 44);
  const bossBox = { cx, cy, size: R * 2 };
  const chipSize = st ? 28 : 24;
  return (
    <CardFrame format={format} faction={model.faction} isDemo={model.isDemo} username={model.username} statusTag={model.statusTag} a11yLabel={model.a11yLabel} bgId={id('bg')} bg={{ teamOpacity: 0.05, orangeOpacity: 0.3 }} {...surface}>
      <Rays id={id('rays')} cx={cx} cy={cy} r0={R * 0.8} r1={R * 3.6} n={32} color={cardColors.orange} opacity={0.14} />
      {renderArt(art?.boss, bossBox, () => <BossPlaceholder id={id('boss')} box={bossBox} />)}
      <G transform={`rotate(-6 ${cx} ${sy})`}>
        <Rect x={cx - sw / 2} y={sy - sh / 2} width={sw} height={sh} rx={16} fill={cardColors.bg} stroke={cardColors.ink} strokeWidth={5} />
        <CardText x={cx} y={sy + sh * 0.24} font={cardFonts.display} size={st ? 62 : 52} anchor="middle" ls={8}>
          DERROTADO
        </CardText>
      </G>
      <CardText x={cx} y={titleY} size={st ? 30 : 26} fill={cardColors.orangeText} ls={10} anchor="middle">
        CHEFÃO DA CIDADE
      </CardText>
      <CardText x={cx} y={nameY} font={cardFonts.display} size={nameSize} anchor="middle" ls={-1}>
        {model.bossName}
      </CardText>
      <CardText x={cx} y={cityY} font={cardFonts.medium} size={st ? 30 : 26} fill={cardColors.ink2} anchor="middle">
        {model.cityLine}
      </CardText>
      <CardText x={cx} y={heroY - (st ? 170 : 132)} size={24} fill={cardColors.ink2} ls={6} anchor="middle">
        MEU DANO
      </CardText>
      <Hero id={id('hero')} x={cx} y={heroY} value={model.damage} unit="km" size={st ? 160 : 124} />
      {model.crewChip ? (
        <CardChip cx={cx} cy={chipY} label={truncateToWidth(model.crewChip, cardFonts.bold, chipSize, W - 260)} color={teamColor(model.faction)} shape={factions[model.faction].shape} size={chipSize} h={st ? 68 : 58} />
      ) : null}
    </CardFrame>
  );
}
