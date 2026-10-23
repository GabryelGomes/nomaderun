import { expand, recolorPrims, resolveQuality, type QualityProp } from '../neon/core';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { LOGO_BOX, LOGO_LABEL, logoNodes, type LogoVariant } from './logo-art';

export type LogoProps = ArtA11y & {
  /** `simbolo` (anel dos 4 times + rota em N), `logotipo` ("NOMADE RUN") ou `horizontal` (os dois). */
  variant?: LogoVariant;
  /** Largura em pontos (a altura segue o viewBox da variante). */
  size?: number;
  /** Uma cor só (carimbo, fundo claro, monocromático); sem ela, as cores da marca. */
  mono?: string;
  quality?: QualityProp;
  /** Esconde do leitor de tela (quando o nome do app já está escrito ao lado). */
  decorative?: boolean;
};

/**
 * Logo oficial do NOMADE RUN em SVG (paths, sem `<text>`): informativo por padrão ("NOMADE RUN", papel de
 * imagem). Para o ícone do app há PNGs prontos em `assets/art/` (o `app.json` é ligado pelo coordenador).
 */
export function Logo({ variant = 'simbolo', size = 96, mono, quality, decorative, accessibilityLabel, ...rest }: LogoProps) {
  const box: ArtBox = { ...LOGO_BOX[variant], width: size };
  // A altura do logotipo é pequena: a qualidade segue a altura desenhada, não a largura.
  const drawn = Math.min(size, (size * box.vbH) / box.vbW) * (variant === 'simbolo' ? 1 : 2);
  const prims = expand(logoNodes(variant, mono), resolveQuality(quality, drawn));
  return (
    <StaticArt
      box={box}
      prims={mono ? recolorPrims(prims, mono) : prims}
      {...rest}
      accessibilityLabel={decorative ? undefined : (accessibilityLabel ?? LOGO_LABEL)}
    />
  );
}
