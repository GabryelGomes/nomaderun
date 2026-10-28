/**
 * T7.1.9 / T7.3.7 — arte do card: mascote do time e chefão derrotado, **da E4**, desenhados dentro do SVG do
 * card (`mascotSlot`/`bossSlot`, contrato `{ cx, cy, size }`). Até a onda 2 havia marcadores próprios (selo do
 * time, sol partido); agora a arte padrão é a oficial e o `art` por props só serve para trocar (testes, temas).
 * A arte precisa ser **vetor**: `<Image>` dentro do SVG sai em branco no `toDataURL`.
 */
import type { ReactNode } from 'react';

import { bossSlot, mascotSlot } from '@/components/art';
import { BOSS_NAMES, type BossId } from '@/components/art/boss/boss-art';
import type { MascotPose } from '@/components/art/team/mascot-art';
import type { FactionId } from '@/domain/types';

/** Onde a arte deve caber: centro e tamanho (lado do quadrado) em unidades do card. */
export type ArtBox = { cx: number; cy: number; size: number };

/** Arte pronta (`ReactNode` de elementos SVG) ou função que desenha dentro da caixa (`SvgArtSlot` da E4). */
export type CardArtSlot = ReactNode | ((box: ArtBox) => ReactNode);

export type ShareCardArt = {
  /** Mascote do time (nível novo, conquista sem rota e versão sem rota). */
  mascot?: CardArtSlot;
  /** Ilustração do chefão derrotado. */
  boss?: CardArtSlot;
};

/** Desenha o slot na caixa; sem slot, a arte padrão (`fallback`). */
export function renderArt(slot: CardArtSlot | undefined, box: ArtBox, fallback: (box: ArtBox) => ReactNode): ReactNode {
  if (typeof slot === 'function') return slot(box);
  if (slot !== undefined && slot !== null && slot !== false) return slot;
  return fallback(box);
}

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Nome do chefão (como vem do servidor) → id da arte da E4. Aceita o nome com a temporada ("Mormaço de
 * Outubro") e sem acento. Nome desconhecido → `null` (o card não inventa um chefão errado).
 */
export function bossIdOf(name: string | null | undefined): BossId | null {
  if (!name) return null;
  const n = ` ${plain(name)} `;
  const hit = (Object.entries(BOSS_NAMES) as [BossId, string][]).find(([id, label]) => n.startsWith(` ${plain(label)} `) || n.startsWith(` ${plain(id)} `));
  return hit ? hit[0] : null;
}

/** Mascote padrão do card: o do time, em pose de vitória (arte da E4). */
export function defaultMascot(faction: FactionId, pose: MascotPose = 'vitoria'): (box: ArtBox) => ReactNode {
  return mascotSlot(faction, pose);
}

/**
 * Chefão padrão: a arte da E4 no estado "derrotado", com as rachaduras todas. Nome desconhecido: o mascote
 * do time comemorando (melhor do que um chefão que não é o da cidade).
 */
export function defaultBoss(name: string | null | undefined, faction: FactionId): (box: ArtBox) => ReactNode {
  const id = bossIdOf(name);
  return id ? bossSlot(id, 'derrotado', 2) : mascotSlot(faction, 'vitoria');
}

/** Arte do card para a tela de compartilhar (o mesmo que o padrão; útil para passar adiante). */
export function cardArtFor(faction: FactionId, bossName?: string | null): ShareCardArt {
  return { mascot: defaultMascot(faction), boss: defaultBoss(bossName, faction) };
}
