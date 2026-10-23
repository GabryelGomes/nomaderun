import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { MEDAL_BOX, MEDAL_LABELS, medalNodes, type MedalKind, type MedalTier } from './medal-art';

export type MedalProps = ArtA11y & {
  kind: MedalKind;
  /** 1, 2 ou 3 estrelas (o nível por estrelas e brilho, sem dourado). */
  tier?: MedalTier;
  /** Bloqueada: roseta tracejada, ícone em silhueta e cadeado (para a estante do perfil). */
  locked?: boolean;
  size?: number;
  color?: string;
  quality?: QualityProp;
  decorative?: boolean;
};

export function medalLabel(kind: MedalKind, tier: MedalTier, locked: boolean): string {
  return `Medalha ${MEDAL_LABELS[kind]}, ${locked ? 'bloqueada' : `nível ${tier} de 3`}`;
}

/** Medalha (12 tipos × 3 níveis + bloqueada). Informativa por padrão. Largura em pontos; altura = 1,25 × largura. */
export function Medal({ kind, tier = 1, locked = false, size = 72, color, quality, decorative, accessibilityLabel, ...rest }: MedalProps) {
  const box: ArtBox = { ...MEDAL_BOX, width: size };
  return (
    <StaticArt
      box={box}
      prims={expand(medalNodes(kind, tier, locked, color), resolveQuality(quality, size))}
      {...rest}
      accessibilityLabel={decorative ? undefined : (accessibilityLabel ?? medalLabel(kind, tier, locked))}
    />
  );
}
