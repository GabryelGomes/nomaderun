import { View } from 'react-native';

import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { fonts } from '@/theme/tokens';

import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { ART, teamName } from '../neon/palette';
import { ArtFrame, ArtSvg, type ArtA11y, type ArtBox } from '../neon/render';
import { EMBLEM_BAND, EMBLEM_BOX, emblemNodes } from './mascot-art';

export type TeamEmblemProps = ArtA11y & {
  team: FactionId;
  /** Largura (e altura) em pontos. */
  size?: number;
  /** Sem a faixa com o nome. Padrão: compacto abaixo de 64 pt (a faixa fica ilegível em 32 pt). */
  compact?: boolean;
  color?: string;
  quality?: QualityProp;
};

/**
 * Emblema do time: moldura na forma do time + cabeça do mascote. No completo, o nome vai numa faixa
 * laranja, escrito com `Text` por cima do SVG (nunca `<text>` dentro do SVG: a fonte não é garantida).
 */
export function TeamEmblem({ team, size = 96, compact, color, quality, ...a11y }: TeamEmblemProps) {
  const c = color ?? ART.team[team];
  const isCompact = compact ?? size < 64;
  const box: ArtBox = { ...EMBLEM_BOX, width: size };
  const k = size / EMBLEM_BOX.vbW;
  const label = teamName(team).toUpperCase();
  return (
    <ArtFrame box={box} {...a11y}>
      <ArtSvg box={box} prims={expand(emblemNodes(team, c, isCompact), resolveQuality(quality, size))} />
      {isCompact ? null : (
        <View
          style={{
            position: 'absolute',
            left: EMBLEM_BAND.x * k,
            top: EMBLEM_BAND.y * k,
            width: EMBLEM_BAND.width * k,
            height: EMBLEM_BAND.height * k,
            justifyContent: 'center',
          }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            color={ART.ink}
            style={{
              fontFamily: fonts.display,
              fontSize: (label.length > 12 ? 11.5 : 13) * k,
              lineHeight: EMBLEM_BAND.height * k,
              letterSpacing: 1.2 * k,
              textAlign: 'center',
            }}>
            {label}
          </Text>
        </View>
      )}
    </ArtFrame>
  );
}
