import type { FactionId } from '@/domain/types';

import { expand, resolveQuality, type QualityProp } from '../neon/core';
import { ART, teamShape } from '../neon/palette';
import { StaticArt, type ArtA11y, type ArtBox } from '../neon/render';
import { TUTORIAL_BOX, tutorialNodes, type TutorialStep } from './tutorial-art';

export type TutorialArtProps = ArtA11y & {
  step: TutorialStep;
  /** Time da pessoa (cor e forma da zona). */
  team?: FactionId;
  /** Time rival no "defenda" (padrão: um time diferente). */
  rival?: FactionId;
  /** Largura em pontos (altura = 3/4). */
  size?: number;
  /** Troca a cor do time. */
  color?: string;
  quality?: QualityProp;
};

/** Cartão do tutorial (corra, pinte, defenda). Decorativo por padrão: o texto do cartão explica. */
export function TutorialArt({ step, team = 'striders', rival, size = 240, color, quality, ...a11y }: TutorialArtProps) {
  const box: ArtBox = { ...TUTORIAL_BOX, width: size };
  const other = rival ?? (team === 'coyotes' ? 'owls' : 'coyotes');
  return <StaticArt box={box} prims={expand(tutorialNodes(step, color ?? ART.team[team], ART.team[other], teamShape(team)), resolveQuality(quality, size))} {...a11y} />;
}
