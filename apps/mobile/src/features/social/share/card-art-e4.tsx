/**
 * T7.2.5 — arte da E4 dentro do card. Os componentes `Mascot`/`Boss` desenham num `<Svg>` próprio dentro de
 * uma `View`, o que não cabe dentro do `<Svg>` do card (e o `toDataURL` só pega o que está no SVG). Aqui a
 * mesma arte (os nós de `mascotNodes`/`bossNodes`, vetor puro, sem `<Image>`) vira um `<G>` posicionado na
 * caixa que o card reserva (`ArtBox`).
 */
import { useId } from 'react';
import { Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { BOSS_BOX, BOSS_NAMES, bossNodes, type BossId } from '@/components/art/boss/boss-art';
import { expand } from '@/components/art/neon/core';
import { ART, PRISM_STOPS } from '@/components/art/neon/palette';
import { Prims } from '@/components/art/neon/render';
import { MASCOT_BOX, mascotNodes, type MascotPose } from '@/components/art/team/mascot-art';
import type { FactionId } from '@/domain/types';

import type { ArtBox, ShareCardArt } from '../card';

type Box = { vbW: number; vbH: number };

/** Gradiente "prisma" com id próprio (vários cards na mesma tela não colidem). */
function Prism({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        {PRISM_STOPS.map(([o, c]) => (
          <Stop key={o} offset={o} stopColor={c} />
        ))}
      </LinearGradient>
    </Defs>
  );
}

/** Encaixa o viewBox da arte no quadrado `box` (centro + lado), mantendo a proporção. */
export function fitArt(art: Box, box: ArtBox): { x: number; y: number; k: number } {
  const k = box.size / Math.max(art.vbW, art.vbH);
  return { x: box.cx - (art.vbW * k) / 2, y: box.cy - (art.vbH * k) / 2, k };
}

function MascotArt({ team, pose, box }: { team: FactionId; pose: MascotPose; box: ArtBox }) {
  const id = `mascote${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { x, y, k } = fitArt(MASCOT_BOX, box);
  return (
    <G transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(4)})`}>
      <Prism id={id} />
      <Prims prims={expand(mascotNodes(team, pose, ART.team[team]), 'completo', id)} />
    </G>
  );
}

function BossArt({ boss, box }: { boss: BossId; box: ArtBox }) {
  const id = `chefao${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { x, y, k } = fitArt(BOSS_BOX, box);
  return (
    <G transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(4)})`}>
      <Prism id={id} />
      <Prims prims={expand(bossNodes(boss, 'derrotado', 2, ART.villain), 'completo', id)} />
    </G>
  );
}

/** Nome do chefão (como vem do servidor) → id da arte da E4. */
export function bossIdOf(name: string | null | undefined): BossId | null {
  if (!name) return null;
  // "Mormaço de Outubro" (nome da temporada) → "Mormaço".
  const n = name.trim().toLowerCase();
  const hit = (Object.entries(BOSS_NAMES) as [BossId, string][]).find(([, label]) => n === label.toLowerCase() || n.startsWith(`${label.toLowerCase()} `));
  return hit ? hit[0] : null;
}

/** Arte do card: mascote em pose de vitória e, quando conhecido, o chefão derrotado. */
export function cardArtFor(faction: FactionId, bossName?: string | null): ShareCardArt {
  const boss = bossIdOf(bossName);
  return {
    mascot: (box: ArtBox) => <MascotArt team={faction} pose="vitoria" box={box} />,
    boss: boss ? (box: ArtBox) => <BossArt boss={boss} box={box} /> : undefined,
  };
}
