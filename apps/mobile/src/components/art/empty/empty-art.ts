/**
 * Estados vazios (13) — 4 portados de `docs/melhoria/F1/arte/fonte/itens.cjs`, 4 novos na onda 1 e 5 na onda 3
 * (sem liga, sem chefão na semana, feed vazio, volte amanhã e sem endereço; o "sem medalhas" foi redesenhado).
 * viewBox 240 × 160. Regra da tela (E6): 1 ilustração + 1 frase + 1 ação; o texto fica fora do SVG.
 * Quando faz sentido, o mascote do time da pessoa aparece (o vazio vira personalidade). Puro.
 */
import type { FactionId } from '@/domain/types';

import { glowFill, memoArt, mirror, neon, pivot, pt, spark, star, type ArtNode, type Shape } from '../neon/core';
import { ART } from '../neon/palette';
import { mascotNodes } from '../team/mascot-art';

export type EmptyKind =
  | 'sem-corridas'
  | 'sem-crew'
  | 'sem-conexao'
  | 'sem-notificacoes'
  | 'sem-zonas'
  | 'sem-medalhas'
  | 'sem-contatos'
  | 'sem-localizacao'
  | 'sem-liga'
  | 'sem-chefao'
  | 'feed-vazio'
  | 'volte-amanha'
  | 'sem-endereco';
export const EMPTY_KINDS: readonly EmptyKind[] = [
  'sem-corridas',
  'sem-crew',
  'sem-conexao',
  'sem-notificacoes',
  'sem-zonas',
  'sem-medalhas',
  'sem-contatos',
  'sem-localizacao',
  'sem-liga',
  'sem-chefao',
  'feed-vazio',
  'volte-amanha',
  'sem-endereco',
];
export const EMPTY_LABELS: Record<EmptyKind, string> = {
  'sem-corridas': 'Sem corridas',
  'sem-crew': 'Sem crew',
  'sem-conexao': 'Sem conexão',
  'sem-notificacoes': 'Sem notificações',
  'sem-zonas': 'Sem zonas',
  'sem-medalhas': 'Sem medalhas',
  'sem-contatos': 'Sem contatos de segurança',
  'sem-localizacao': 'Sem localização',
  'sem-liga': 'Sem liga',
  'sem-chefao': 'Sem chefão na semana',
  'feed-vazio': 'Feed vazio',
  'volte-amanha': 'Volte amanhã',
  'sem-endereco': 'Sem endereço protegido',
};
/** Estados que usam o mascote do time (a prop `team`). */
export const EMPTY_USES_TEAM: readonly EmptyKind[] = ['sem-notificacoes', 'sem-localizacao', 'volte-amanha'];
export const EMPTY_BOX = { vbW: 240, vbH: 160 } as const;

const dashedFloor = (y = 140): ArtNode => neon(`M40 ${y} L 200 ${y}`, ART.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' });

function semCorridas(a: string): ArtNode[] {
  const shoe = 'M38 120 L 44 100 Q 60 98 72 86 L 84 88 Q 100 104 134 108 Q 160 112 162 122 L 162 126 L 38 126 Z';
  return [
    neon('M168 122 Q 196 116 198 88 Q 200 62 216 54', ART.ink2, 2.2, { hot: 0, dash: '1 8', glow: 0.3 }),
    neon({ tag: 'circle', cx: 216, cy: 50, r: 10 }, a, 2, { hot: 0, opacity: 0.45 }),
    glowFill({ tag: 'circle', cx: 216, cy: 50, r: 4.5 }, a, { w: 1 }),
    neon(['M8 96 L 30 96', 'M14 108 L 34 108'], a, 2.2, { hot: 0, opacity: 0.6 }),
    neon(shoe, a, 3.4, { fill: true, tint: 0.1 }),
    neon(['M38 126 L 162 126', 'M50 134 L 158 134'], ART.ink, 2.2, { glow: 0.4, hot: 0, opacity: 0.8 }),
    neon(['M82 94 L 90 89', 'M89 100 L 97 94', 'M96 105 L 104 99'], ART.ink, 2.2, { glow: 0.3, hot: 0 }),
    neon('M46 112 Q 90 110 120 118 L 150 120', a, 2, { hot: 0, opacity: 0.7 }),
  ];
}

function semCrew(a: string): ArtNode[] {
  const person = (x: number, y: number, s: number): Shape[] => [
    { tag: 'circle', cx: x, cy: y, r: 13 * s },
    `M${x - 24 * s} ${y + 46 * s} Q ${x - 24 * s} ${y + 18 * s} ${x} ${y + 18 * s} Q ${x + 24 * s} ${y + 18 * s} ${x + 24 * s} ${y + 46 * s}`,
  ];
  return [
    neon(person(66, 60, 0.85), ART.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }),
    neon(person(174, 60, 0.85), ART.ink2, 2.4, { dash: '3 6', glow: 0.2, hot: 0 }),
    neon(person(120, 46, 1.1), a, 3.4, { fill: true, tint: 0.1 }),
    neon(['M66 52 L 66 68', 'M58 60 L 74 60', 'M174 52 L 174 68', 'M166 60 L 182 60'], a, 2.4, { hot: 0.4 }),
    neon('M40 132 Q 120 120 200 132', ART.ink2, 1.8, { glow: 0, hot: 0, dash: '2 7' }),
  ];
}

function semConexao(a: string): ArtNode[] {
  const arc = (r: number) => `M${pt(120, 118, r, 225)} A ${r} ${r} 0 0 1 ${pt(120, 118, r, 315)}`;
  return [
    glowFill({ tag: 'circle', cx: 120, cy: 118, r: 6 }, a, { w: 1.2 }),
    neon(arc(26), a, 3.4),
    neon(arc(48), a, 3.4, { opacity: 0.55, dash: '22 10' }),
    neon(arc(70), ART.ink2, 2.6, { dash: '4 10', glow: 0.2, hot: 0 }),
    neon(['M178 34 L 194 50', 'M194 34 L 178 50'], ART.ink, 3),
    dashedFloor(),
  ];
}

function semNotificacoes(team: FactionId): ArtNode[] {
  // Mascote do time dormindo (os "Z" já vêm na pose).
  return [pivot(mascotNodes(team, 'dormindo', ART.team[team]), { scale: 0.66, tx: 54, ty: 8 })];
}

function semZonas(a: string): ArtNode[] {
  const region = 'M58 120 Q 46 92 76 76 Q 118 58 160 74 Q 194 90 182 120 Q 164 142 120 140 Q 74 142 58 120 Z';
  return [
    neon(region, ART.ink2, 2.2, { fill: ART.ink2, glow: 0, hot: 0, opacity: 0.08 }),
    neon(region, ART.ink2, 2.2, { dash: '4 8', glow: 0.2, hot: 0, opacity: 0.8 }),
    neon(['M84 100 Q 104 92 120 104', 'M128 92 Q 146 86 160 98'], ART.ink2, 1.6, { glow: 0, hot: 0, opacity: 0.35 }),
    neon('M106 124 Q 120 118 134 124', ART.ink2, 2.2, { hot: 0, glow: 0.3 }),
    neon('M120 122 L 120 48', ART.ink, 3),
    neon('M120 50 L 154 60 L 120 74 Z', a, 2.6, { fill: true, tint: 0.12, dash: '5 5', hot: 0.3 }),
    glowFill({ tag: 'circle', cx: 120, cy: 46, r: 3.4 }, ART.ink, { w: 1 }),
    neon(['M36 60 L 36 70', 'M31 65 L 41 65', 'M196 44 L 196 52', 'M192 48 L 200 48'], ART.ink, 2, { hot: 0.5, opacity: 0.8 }),
  ];
}

/**
 * Sem medalhas (redesenho da onda 3): o suporte de medalhas na parede, com 2 ganchos de vultos apagados e, no
 * gancho do meio, o **contorno tracejado** da primeira medalha (fita + roseta) com um "+" laranja.
 */
function semMedalhas(a: string): ArtNode[] {
  const strap = 'M101 26 L 111 68 L 121 68 L 111 26 Z';
  const ghost = (cx: number): Shape[] => [{ tag: 'circle', cx, cy: 92, r: 17 }, `M${cx - 6} 26 L ${cx - 2} 75`, `M${cx + 6} 26 L ${cx + 2} 75`];
  return [
    // Trilho com 3 pinos.
    neon('M28 22 L 212 22', ART.ink, 2.8, { glow: 0.5, hot: 0.3 }),
    neon(['M28 16 L 28 28', 'M212 16 L 212 28'], ART.ink2, 2.4, { glow: 0.2, hot: 0, opacity: 0.8 }),
    glowFill([{ tag: 'circle', cx: 65, cy: 22, r: 3 }, { tag: 'circle', cx: 120, cy: 22, r: 3.4 }, { tag: 'circle', cx: 175, cy: 22, r: 3 }], ART.ink, { w: 0.8, glow: 0.8 }),
    // Os vultos das medalhas que ainda virão, bem apagados.
    neon([...ghost(65), ...ghost(175)], ART.ink2, 1.6, { glow: 0, hot: 0, dash: '2 5', opacity: 0.5 }),
    // A primeira: fita e roseta tracejadas no laranja, com o "+" no meio.
    neon([strap, mirror(strap, 120)], a, 2.2, { glow: 0.5, hot: 0, dash: '4 4', opacity: 0.9 }),
    neon(star(120, 102, 34, 30, 20), a, 2.8, { fill: true, tint: 0.07, dash: '5 4', glow: 0.7, hot: 0 }),
    neon({ tag: 'circle', cx: 120, cy: 102, r: 23 }, ART.ink2, 1.6, { glow: 0, hot: 0, dash: '2 5', opacity: 0.7 }),
    neon(['M120 92 L 120 112', 'M110 102 L 130 102'], a, 3.4, { glow: 1, hot: 0.5 }),
    spark(160, 58, 5, ART.ink),
    spark(84, 138, 4, a),
    dashedFloor(150),
  ];
}

/**
 * Sem liga: o pódio de 3 degraus vazio (a posição lê por pontos, não por número) e, acima do degrau do meio, a
 * estrela da liga entre 2 ramos de louro: "a sua vaga está esperando".
 */
function semLiga(a: string): ArtNode[] {
  const leaf = (x: number, y: number, dir: number): Shape => `M${x} ${y} q ${-7 * dir} -1 ${-9 * dir} -8 q ${7 * dir} 0 ${9 * dir} 8 Z`;
  const branch = 'M104 76 Q 86 62 92 36';
  return [
    neon(['M50 140 L 50 108 L 96 108', 'M96 140 L 96 84 L 144 84 L 144 140', 'M144 118 L 190 118 L 190 140'], ART.ink2, 2.4, { glow: 0.3, hot: 0 }),
    neon('M96 84 L 144 84', a, 3, { glow: 0.9, hot: 0.4, dash: '6 5' }),
    neon('M36 140 L 204 140', ART.ink, 2.6, { glow: 0.5, hot: 0.3 }),
    // Posições: 1, 2 e 3 pontos.
    glowFill(
      [
        { tag: 'circle', cx: 120, cy: 102, r: 3.4 },
        { tag: 'circle', cx: 67, cy: 124, r: 3 },
        { tag: 'circle', cx: 79, cy: 124, r: 3 },
        { tag: 'circle', cx: 155, cy: 130, r: 2.8 },
        { tag: 'circle', cx: 167, cy: 130, r: 2.8 },
        { tag: 'circle', cx: 179, cy: 130, r: 2.8 },
      ],
      ART.ink2,
      { w: 0.6, glow: 0.3 },
    ),
    // Louros e a estrela da liga.
    neon([branch, mirror(branch, 120)], ART.ink2, 2, { glow: 0.3, hot: 0, opacity: 0.85 }),
    neon([leaf(96, 68, 1), leaf(91, 54, 1), leaf(91, 41, 1), leaf(144, 68, -1), leaf(149, 54, -1), leaf(149, 41, -1)], ART.ink2, 1.6, { fill: true, tint: 0, glow: 0.2, hot: 0, opacity: 0.85 }),
    neon(star(120, 48, 20, 9, 5, -90), a, 2.8, { fill: true, tint: 0.12, dash: '5 4', glow: 0.9, hot: 0 }),
    spark(170, 28, 5, ART.ink),
    spark(70, 30, 4, a),
  ];
}

/**
 * Sem chefão na semana: o palco da Raid com o holofote aceso e só o **vulto tracejado** do chefão no violeta dos
 * vilões; lua e prédios apagados: a cidade está calma, o próximo chega na semana que vem.
 */
function semChefao(): ArtNode[] {
  const V = ART.villain;
  // Vulto de brutamontes: ombros largos, cabeça baixa e chifres de touro abertos para os lados.
  const crest = [
    'M78 128 L 80 102 Q 82 86 100 82 L 106 80 M134 80 L 140 82 Q 158 86 160 102 L 162 128',
    { tag: 'circle' as const, cx: 120, cy: 68, r: 15 },
    'M107 62 Q 90 60 82 38 Q 98 50 110 54',
    mirror('M107 62 Q 90 60 82 38 Q 98 50 110 54', 120),
  ];
  const city = 'M8 140 L 8 106 L 22 106 L 22 94 L 36 94 L 36 116 L 50 116 L 50 140';
  return [
    neon([city, mirror(city, 120)], ART.ink2, 2, { glow: 0.2, hot: 0, opacity: 0.55 }),
    // Holofote.
    neon('M112 8 L 70 132 L 170 132 L 128 8 Z', V, 1.6, { fill: V, glow: 0, hot: 0, opacity: 0.07 }),
    neon(['M112 8 L 72 128', 'M128 8 L 168 128'], ART.ink2, 1.6, { glow: 0.2, hot: 0, opacity: 0.5 }),
    neon({ tag: 'rect', x: 106, y: 2, width: 28, height: 9, rx: 3 }, ART.ink, 2.2, { fill: true, tint: 0, glow: 0.5, hot: 0 }),
    neon({ tag: 'ellipse', cx: 120, cy: 132, rx: 52, ry: 9 }, V, 2.4, { glow: 0.8, hot: 0, dash: '6 6' }),
    // O vulto: só o contorno, sem olhos.
    neon(crest, V, 2.6, { glow: 0.6, hot: 0, dash: '5 5', opacity: 0.85 }),
    neon(['M112 66 L 117 69', 'M128 66 L 123 69'], V, 2, { glow: 0.3, hot: 0, opacity: 0.5 }),
    // Lua e estrelas.
    neon('M204 16 A 14 14 0 1 0 214 42 A 11 11 0 1 1 204 16 Z', ART.ink, 2.2, { fill: true, tint: 0.06, glow: 0.6, hot: 0.3 }),
    spark(176, 24, 3.5, ART.ink, 1.6),
    spark(30, 40, 4, ART.ink, 1.6),
    glowFill([{ tag: 'circle', cx: 58, cy: 20, r: 1.6 }, { tag: 'circle', cx: 188, cy: 62, r: 1.4 }], ART.ink, { w: 0.5, glow: 0.6 }),
  ];
}

/**
 * Feed vazio: 2 posts "fantasma" (avatar e linhas tracejadas) e, no da frente, uma rota laranja tracejada com o
 * ponto de chegada: as corridas da crew vão aparecer aqui.
 */
function feedVazio(a: string): ArtNode[] {
  return [
    neon({ tag: 'rect', x: 62, y: 12, width: 128, height: 54, rx: 10 }, ART.ink2, 2, { glow: 0, hot: 0, dash: '4 6', opacity: 0.55 }),
    neon([{ tag: 'circle', cx: 82, cy: 32, r: 8 }, 'M98 28 L 140 28', 'M98 38 L 124 38'], ART.ink2, 1.8, { glow: 0, hot: 0, dash: '3 5', opacity: 0.5 }),
    neon({ tag: 'rect', x: 40, y: 50, width: 156, height: 88, rx: 12 }, ART.ink, 2.6, { fill: true, tint: 0.04, glow: 0.6, hot: 0.3 }),
    neon({ tag: 'circle', cx: 62, cy: 72, r: 10 }, ART.ink2, 2, { glow: 0.2, hot: 0, dash: '3 4' }),
    neon(['M82 68 L 136 68', 'M82 79 L 112 79'], ART.ink2, 2.4, { glow: 0, hot: 0, dash: '6 6', opacity: 0.75 }),
    neon('M56 124 Q 76 98 98 110 Q 120 122 140 104 Q 156 92 176 102', a, 2.8, { glow: 0.8, hot: 0.3, dash: '5 5' }),
    glowFill({ tag: 'circle', cx: 176, cy: 102, r: 4.5 }, a, { w: 1 }),
    neon({ tag: 'circle', cx: 176, cy: 102, r: 9 }, a, 1.6, { glow: 0.4, hot: 0, opacity: 0.5 }),
    spark(210, 44, 5, ART.ink),
    spark(24, 38, 4, a),
  ];
}

/**
 * Volte amanhã: o mascote do time dorme na beira da pista; a lua ainda está no alto e o sol de amanhã nasce no
 * fim da estrada (raios tracejados).
 */
function volteAmanha(a: string, team: FactionId): ArtNode[] {
  const rays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const deg = 192 + (i * 156) / 6;
    rays.push(`M${pt(178, 118, 36, deg)} L ${pt(178, 118, i % 2 ? 44 : 50, deg)}`);
  }
  return [
    // Sol nascendo e a estrada até ele.
    neon(rays, a, 2.2, { glow: 0.6, hot: 0, dash: '3 3', opacity: 0.9 }),
    neon(`M${pt(178, 118, 28, 180)} A 28 28 0 0 1 ${pt(178, 118, 28, 0)} Z`, a, 3, { fill: true, tint: 0.16, glow: 1, hot: 0.5 }),
    neon(['M171 118 L 142 158', 'M185 118 L 214 158'], ART.ink2, 2.2, { glow: 0.2, hot: 0, opacity: 0.8 }),
    neon('M178 124 L 178 156', ART.ink2, 1.8, { glow: 0, hot: 0, dash: '4 6', opacity: 0.7 }),
    neon('M10 118 L 230 118', ART.ink, 2.4, { glow: 0.5, hot: 0.3 }),
    // Lua e estrelas.
    neon('M112 20 A 14 14 0 1 0 122 46 A 11 11 0 1 1 112 20 Z', ART.ink, 2.2, { fill: true, tint: 0.06, glow: 0.6, hot: 0.3 }),
    spark(146, 30, 3.5, ART.ink, 1.6),
    spark(94, 60, 3, ART.ink, 1.4),
    glowFill([{ tag: 'circle', cx: 214, cy: 26, r: 1.6 }, { tag: 'circle', cx: 160, cy: 64, r: 1.3 }], ART.ink, { w: 0.5, glow: 0.6 }),
    // O mascote dormindo (os "Z" já vêm na pose), sentado na linha do horizonte.
    pivot(mascotNodes(team, 'dormindo', ART.team[team]), { scale: 0.42, tx: 6, ty: 26 }),
  ];
}

function semContatos(a: string): ArtNode[] {
  const shield = 'M120 26 L 162 40 Q 162 102 120 132 Q 78 102 78 40 Z';
  return [
    neon(shield, ART.ink, 3.4, { fill: true, tint: 0.06 }),
    neon([{ tag: 'circle', cx: 120, cy: 66, r: 11 }, 'M98 108 Q 98 84 120 84 Q 142 84 142 108'], ART.ink2, 2.4, { dash: '3 5', glow: 0.2, hot: 0 }),
    neon(['M182 42 L 182 62', 'M172 52 L 192 52'], a, 3, { hot: 0.5 }),
    neon(['M44 70 Q 34 84 44 98', mirror('M44 70 Q 34 84 44 98', 120)], ART.ink2, 2, { hot: 0, glow: 0.2, opacity: 0.5 }),
    dashedFloor(146),
  ];
}

function semLocalizacao(a: string, team?: FactionId): ArtNode[] {
  const pin = 'M120 118 Q 96 90 96 70 Q 96 46 120 46 Q 144 46 144 70 Q 144 90 120 118 Z';
  const out: ArtNode[] = [
    neon('M40 140 L 80 128 L 120 140 L 160 128 L 200 140', ART.ink2, 2, { glow: 0, hot: 0, dash: '3 6', opacity: 0.8 }),
    neon({ tag: 'ellipse', cx: 120, cy: 124, rx: 26, ry: 7 }, ART.ink2, 2, { dash: '3 5', glow: 0.2, hot: 0 }),
    neon(['M84 48 Q 74 66 84 84', mirror('M84 48 Q 74 66 84 84', 120), 'M70 38 Q 54 66 70 94', mirror('M70 38 Q 54 66 70 94', 120)], ART.ink2, 2.2, {
      dash: '3 6',
      glow: 0.2,
      hot: 0,
    }),
    neon(pin, a, 3.4, { fill: true, tint: 0.1 }),
    neon({ tag: 'circle', cx: 120, cy: 70, r: 9 }, ART.ink, 2.4, { fill: true, tint: 0, hot: 0.3 }),
  ];
  // O mascote do time espia o mapa no canto (opcional), por cima do mapa.
  if (team) out.push(pivot(mascotNodes(team, 'parado', ART.team[team]), { scale: 0.36, tx: 2, ty: 82 }));
  return out;
}

/**
 * Sem endereço protegido (zonas de privacidade, pedido da E6a): a casa no meio de um **raio tracejado** laranja;
 * as ruas do mapa param na borda do raio (dentro dele, nada aparece para os outros). A porta tem cadeado.
 */
function semEndereco(a: string): ArtNode[] {
  return [
    // Ruas apagadas, cortadas na borda do raio (centro 120,84; raio 58).
    neon(['M0 44 L 64 66', 'M176 70 L 240 88', 'M18 160 L 74 120', 'M164 122 L 206 160', 'M128 0 L 124 26'], ART.ink2, 2, { glow: 0, hot: 0, opacity: 0.4 }),
    neon({ tag: 'circle', cx: 120, cy: 84, r: 58 }, a, 2, { fill: a, glow: 0, hot: 0, opacity: 0.06 }),
    neon({ tag: 'circle', cx: 120, cy: 84, r: 58 }, a, 2.6, { glow: 0.8, hot: 0, dash: '7 6' }),
    // A casa.
    neon('M90 114 L 90 82 L 120 58 L 150 82 L 150 114 Z', ART.ink, 3.2, { fill: true, tint: 0.06 }),
    neon('M84 86 L 120 56 L 156 86', ART.ink, 3.2, { glow: 0.8, hot: 0.4 }),
    neon('M138 66 L 138 54 L 146 54 L 146 72', ART.ink2, 2.2, { glow: 0.3, hot: 0 }),
    neon({ tag: 'rect', x: 111, y: 92, width: 18, height: 22, rx: 3 }, a, 2.4, { fill: true, tint: 0.14 }),
    glowFill('M120 100 m -2.6 0 a 2.6 2.6 0 1 0 5.2 0 a 2.6 2.6 0 1 0 -5.2 0 M118.8 101.5 L 118 107 L 122 107 L 121.2 101.5 Z', ART.ink, { w: 0.5, glow: 0.6 }),
    neon({ tag: 'rect', x: 96, y: 88, width: 10, height: 10, rx: 1.5 }, ART.ink2, 1.8, { glow: 0.2, hot: 0 }),
    neon('M70 114 L 170 114', ART.ink2, 1.8, { glow: 0, hot: 0, dash: '2 6', opacity: 0.7 }),
    spark(186, 30, 5, ART.ink),
    spark(48, 132, 4, a),
  ];
}

const cache = new Map<string, ArtNode[]>();

/** `color` é o acento (padrão laranja); `team` escolhe o mascote nos estados que o usam. */
export function emptyNodes(kind: EmptyKind, color: string = ART.orange, team?: FactionId): ArtNode[] {
  return memoArt(cache, `${kind}|${color}|${team ?? ''}`, () => {
    switch (kind) {
      case 'sem-corridas':
        return semCorridas(color);
      case 'sem-crew':
        return semCrew(color);
      case 'sem-conexao':
        return semConexao(color);
      case 'sem-notificacoes':
        return semNotificacoes(team ?? 'owls');
      case 'sem-zonas':
        return semZonas(color);
      case 'sem-medalhas':
        return semMedalhas(color);
      case 'sem-contatos':
        return semContatos(color);
      case 'sem-localizacao':
        return semLocalizacao(color, team);
      case 'sem-liga':
        return semLiga(color);
      case 'sem-chefao':
        return semChefao();
      case 'feed-vazio':
        return feedVazio(color);
      case 'volte-amanha':
        return volteAmanha(color, team ?? 'owls');
      case 'sem-endereco':
        return semEndereco(color);
    }
  });
}
