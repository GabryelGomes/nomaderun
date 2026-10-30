/**
 * Contrato `{ cx, cy, size }` da E8 (card de compartilhar): mascote, corredor, líder, chefão e logo
 * desenháveis **dentro de um SVG maior**, como `<G>`. Uso no card:
 *
 * ```tsx
 * <ShareCard art={{ mascot: mascotSlot('owls', 'vitoria'), boss: bossSlot('mormaco', 'derrotado') }} />
 * // ou, direto num <Svg>: <MascotSvgArt team="owls" pose="vitoria" box={{ cx: 540, cy: 900, size: 320 }} />
 * ```
 *
 * A arte é a mesma dos componentes (mesma geometria, mesma expansão em camadas), sem `View`, sem `<Image>` e
 * sem gradiente (nenhuma destas famílias usa o "prisma"), então sai igual no `toDataURL`.
 */
import type { ReactNode } from 'react';

import type { FactionId } from '@/domain/types';

import { BOSS_BOX, bossBodyNodes, bossNodes, type BossDamage, type BossId, type BossState } from './boss/boss-art';
import { LEADER_BOX, leaderNodes, type LeaderPose } from './leader/leader-art';
import { LOGO_BOX, logoNodes, type LogoVariant } from './logo/logo-art';
import { type QualityProp } from './neon/core';
import { InSvgArt, type SvgArtBox } from './neon/in-svg';
import { ART } from './neon/palette';
import { MASCOT_BOX, mascotNodes, type MascotPose } from './team/mascot-art';
import { RUNNER_BOX, runnerNodes } from './team/runner-art';

type Common = { box: SvgArtBox; color?: string; quality?: QualityProp; opacity?: number };

export function MascotSvgArt({ team, pose = 'parado', box, color, quality, opacity }: Common & { team: FactionId; pose?: MascotPose }) {
  return <InSvgArt nodes={mascotNodes(team, pose, color ?? ART.team[team])} vb={MASCOT_BOX} box={box} quality={quality} opacity={opacity} />;
}

export function RunnerSvgArt({ team, box, color, quality, opacity }: Common & { team: FactionId }) {
  return <InSvgArt nodes={runnerNodes(team, color ?? ART.team[team])} vb={RUNNER_BOX} box={box} quality={quality} opacity={opacity} />;
}

export function LeaderSvgArt({ team, pose = 'parado', box, color, quality, opacity }: Common & { team: FactionId; pose?: LeaderPose }) {
  return <InSvgArt nodes={leaderNodes(team, pose, color ?? ART.team[team])} vb={LEADER_BOX} box={box} quality={quality} opacity={opacity} />;
}

/** `silhouette` desenha só o corpo numa cor só (o clarão branco do golpe), sem chão nem impacto. */
export function BossSvgArt({
  id,
  state = 'parado',
  dano = 0,
  box,
  color,
  quality,
  opacity,
  silhouette,
}: Common & { id: BossId; state?: BossState; dano?: BossDamage; silhouette?: string }) {
  return <InSvgArt nodes={(silhouette ? bossBodyNodes : bossNodes)(id, state, dano, color ?? ART.villain)} vb={BOSS_BOX} box={box} quality={quality} opacity={opacity} silhouette={silhouette} />;
}

/** No logotipo e no horizontal, `box.size` é a largura (o lado maior do viewBox). */
export function LogoSvgArt({ variant = 'simbolo', box, mono, quality, opacity }: Omit<Common, 'color'> & { variant?: LogoVariant; mono?: string }) {
  return <InSvgArt nodes={logoNodes(variant, mono)} vb={LOGO_BOX[variant]} box={box} quality={quality} opacity={opacity} silhouette={mono} />;
}

/** Função que desenha na caixa: o formato `CardArtSlot` da E8 (`(box) => ReactNode`). */
export type SvgArtSlot = (box: SvgArtBox) => ReactNode;

export function mascotSlot(team: FactionId, pose: MascotPose = 'vitoria', opts: { color?: string; quality?: QualityProp } = {}): SvgArtSlot {
  const slot = (box: SvgArtBox) => <MascotSvgArt team={team} pose={pose} box={box} {...opts} />;
  return slot;
}

export function bossSlot(id: BossId, state: BossState = 'derrotado', dano: BossDamage = 0, opts: { color?: string; quality?: QualityProp } = {}): SvgArtSlot {
  const slot = (box: SvgArtBox) => <BossSvgArt id={id} state={state} dano={dano} box={box} {...opts} />;
  return slot;
}
