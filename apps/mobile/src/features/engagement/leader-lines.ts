/**
 * O líder comenta o feito real (F8 · ideia 5.3): no resumo e no recap, 1 balão por tela com 1 frase ligada a um
 * fato que o servidor (ou a semana fechada) confirmou. Reconhecimento de competência, nunca cobrança:
 *
 * - catálogo de 30 falas por líder (10 tipos de feito × 3), no tom de cada time;
 * - no máximo 90 caracteres depois de trocar os números e nomes (`LEADER_LINE_MAX`);
 * - tudo passa pelo filtro de culpa (`GUILT_PATTERN`): uma fala que bater nele não aparece;
 * - sem comparação com outra pessoa (a comparação é só consigo: "passou dos seus 31");
 * - escolha determinística (semente = corrida ou semana + feito): a mesma tela mostra a mesma fala, sem sorteio.
 */
import { hasGuiltWords, shortZoneName } from '@/domain/reminders';
import type { FactionId } from '@/domain/types';

export const LEADER_LINE_MAX = 90;

export type LeaderFeatKind =
  | 'primeiro-trecho'
  | 'recorde'
  | 'conquista'
  | 'defesa'
  | 'bairro-novo'
  | 'fantasma'
  | 'trechos'
  | 'distancia'
  | 'semana'
  | 'semana-zonas';

export const LEADER_FEAT_KINDS: readonly LeaderFeatKind[] = ['primeiro-trecho', 'recorde', 'conquista', 'defesa', 'bairro-novo', 'fantasma', 'trechos', 'distancia', 'semana', 'semana-zonas'];

/** O feito e os números reais que a fala pode citar. */
export type LeaderFeat = {
  kind: LeaderFeatKind;
  /** Trechos, zonas, corridas (conforme o feito). */
  n?: number;
  /** Recorde anterior (só no `recorde`). */
  prev?: number;
  /** Nome da zona (conquista, defesa). */
  zone?: string;
  /** Nome do bairro (bairro novo). */
  district?: string;
  /** Distância já formatada ("12,2"). */
  km?: string;
};

type Lines = Record<LeaderFeatKind, readonly [string, string, string]>;

/**
 * Modelos: {n}, {prev}, {zona}, {bairro}, {km}. Íris (Neon Striders): ritmo e precisão. Téo (Volt Runners):
 * energia e distância. Nara (Night Owls): a cidade que acende no fim do dia. Bento (Urban Coyotes): a matilha.
 */
export const LEADER_LINES: Record<FactionId, Lines> = {
  striders: {
    'primeiro-trecho': ['Primeiro trecho pintado. É assim que começa: um passo no lugar certo.', 'Seu primeiro trecho já tem a nossa cor. Agora é achar o seu ritmo.', 'Um trecho, no tempo certo. A cidade começou a ficar azul.'],
    recorde: ['{n} trechos numa corrida só. Seu melhor até hoje, com ritmo de sobra.', 'Recorde seu: {n} trechos. Precisão também é saber ir mais longe.', 'Você passou dos seus {prev}. Foram {n} trechos, passo a passo.'],
    conquista: ['{zona} é nossa. Ritmo certo, zona certa.', 'Zona conquistada: {zona}. Foi no passo, sem pressa.', '{zona} ficou azul. Bonito de ver no mapa.'],
    defesa: ['{zona} segurada. Constância vale mais que pressa.', 'Defesa limpa em {zona}. É assim que se segura a rua.', 'Você voltou em {zona} na hora certa. Precisão pura.'],
    'bairro-novo': ['{bairro} entrou no seu Atlas. Rua nova, ritmo de sempre.', 'Carimbo novo: {bairro}. Conhecer a rua é metade do ritmo.', 'Primeira vez em {bairro}. Agora você sabe o caminho.'],
    fantasma: ['Você venceu o seu fantasma. O ritmo de hoje superou o de antes.', 'Fantasma para trás. Ritmo medido, ritmo vencido.', 'Passou o seu próprio tempo. Isso é precisão.'],
    trechos: ['{n} trechos pintados. Cada um no seu tempo.', '{n} trechos com a nossa cor. Ritmo constante rende.', 'Mais {n} trechos azuis. Passo certo, cidade azul.'],
    distancia: ['{km} km bem medidos. Amanhã o corpo agradece um descanso.', '{km} km no seu ritmo. É assim que se constrói fôlego.', '{km} km. Distância boa é a que você controla.'],
    semana: ['{n} corridas na semana. Ritmo de quem sabe o que faz.', 'Semana fechada com {n} corridas. Constância é o nosso forte.', '{n} corridas e descanso no meio. Semana bem medida.'],
    'semana-zonas': ['{n} zonas na semana. O mapa tem a sua marca.', 'Semana com {n} zonas azuis. Ritmo que vira território.', '{n} zonas em uma semana. Precisão que aparece no mapa.'],
  },
  volt: {
    'primeiro-trecho': ['Primeiro trecho! A bateria acabou de ligar.', 'Seu primeiro trecho é verde. Agora é carregar.', 'Um trecho pintado. É a primeira faísca, e ela pega.'],
    recorde: ['{n} trechos! Seu recorde subiu, e a carga também.', 'Passou dos seus {prev}: {n} trechos. Isso é energia.', 'Recorde seu com {n} trechos. A lebre não parou.'],
    conquista: ['{zona} agora é verde. Carga total!', 'Zona conquistada: {zona}. Liga, carrega e vai.', '{zona} é dos Volt. Que corrida!'],
    defesa: ['{zona} segurou firme. Energia não falta.', 'Você recarregou {zona}. Ninguém apaga essa luz.', 'Defesa em {zona}! Bateria cheia de novo.'],
    'bairro-novo': ['{bairro} no seu Atlas! Mais rua, mais carga.', 'Carimbo novo: {bairro}. A lebre gosta de chão novo.', 'Primeira corrida em {bairro}. Território novo, energia nova.'],
    fantasma: ['Fantasma vencido! Você está mais rápido que você.', 'Passou o seu fantasma. Faísca pura.', 'Você bateu o seu próprio tempo. Carga extra!'],
    trechos: ['{n} trechos verdes. Cada metro recarrega.', 'Mais {n} trechos! A cidade está acendendo verde.', '{n} trechos pintados. Bora, que tem mais chão.'],
    distancia: ['{km} km! Agora recarrega com um bom descanso.', '{km} km de pura resistência. Bonito.', '{km} km no pé. A lebre está orgulhosa.'],
    semana: ['{n} corridas na semana. Bateria bem carregada.', 'Semana com {n} corridas. Liga, carrega, não para!', '{n} corridas, com descanso no meio. Carga certa.'],
    'semana-zonas': ['{n} zonas na semana! O mapa ficou mais verde.', 'Semana com {n} zonas. Energia que vira território.', '{n} zonas verdes em sete dias. Que semana!'],
  },
  owls: {
    'primeiro-trecho': ['Primeiro trecho pintado. Uma luz nova acendeu na cidade.', 'Seu primeiro trecho já brilha vermelho.', 'Um trecho seu no mapa. A cidade já sabe que você chegou.'],
    recorde: ['{n} trechos numa corrida. Nunca acendeu tanta rua sua.', 'Recorde seu: {n} trechos. Que brilho.', 'Você passou dos seus {prev}. {n} trechos acesos.'],
    conquista: ['{zona} acendeu vermelho. Bonita de ver.', 'Zona conquistada: {zona}. A cidade mudou de cor.', '{zona} é das Owls agora. Que luz.'],
    defesa: ['{zona} continua acesa. Obrigada por voltar lá.', 'Você manteve a luz de {zona}. Assim se cuida da rua.', 'Defesa em {zona}. A cor ficou onde estava.'],
    'bairro-novo': ['{bairro} entrou no seu Atlas. Mais uma rua com luz.', 'Carimbo novo: {bairro}. A cidade cresceu para você.', 'Primeira vez em {bairro}. Que caminho bonito.'],
    fantasma: ['Você passou o seu fantasma. Corrida que brilha.', 'Fantasma para trás. Você está correndo mais leve.', 'Seu tempo de hoje passou o de antes. Bonito.'],
    trechos: ['{n} trechos acesos. A rua lembra de você.', 'Mais {n} trechos vermelhos no mapa.', '{n} trechos pintados. A cidade ficou mais sua.'],
    distancia: ['{km} km pela cidade. Agora, descanso merecido.', '{km} km vendo as luzes. Que corrida.', '{km} km. A rua estava bonita hoje, né?'],
    semana: ['{n} corridas na semana. A cidade sentiu sua luz.', 'Semana com {n} corridas. Que brilho constante.', '{n} corridas e descanso entre elas. Semana bonita.'],
    'semana-zonas': ['{n} zonas acesas na semana. O mapa está mais vermelho.', 'Semana com {n} zonas suas. A cidade acendeu.', '{n} zonas em sete dias. Que semana luminosa.'],
  },
  coyotes: {
    'primeiro-trecho': ['Primeiro trecho! Bem-vindo de verdade à matilha.', 'Seu primeiro trecho é amarelo. A matilha viu.', 'Um trecho pintado. Agora você deixou rastro com a gente.'],
    recorde: ['{n} trechos! Seu recorde, e a matilha toda comemora.', 'Passou dos seus {prev}: {n} trechos. Que corrida.', 'Recorde seu com {n} trechos. Bora contar pra crew!'],
    conquista: ['{zona} é da matilha. Juntos é mais longe.', 'Zona conquistada: {zona}. Ninguém fica para trás.', '{zona} ficou amarela. A matilha agradece.'],
    defesa: ['Você segurou {zona} pela matilha. Valeu!', '{zona} continua nossa. Matilha unida.', 'Defesa em {zona}. É isso que a gente faz junto.'],
    'bairro-novo': ['{bairro} no seu Atlas. A matilha conhece mais uma rua.', 'Carimbo novo: {bairro}. Faro bom para rua nova.', 'Primeira vez em {bairro}. Bora levar a crew lá?'],
    fantasma: ['Você passou o seu fantasma. A matilha viu!', 'Fantasma para trás. Seu tempo melhorou.', 'Bateu o seu próprio tempo. Bonito de ver.'],
    trechos: ['{n} trechos amarelos. Cada um ajuda a matilha.', 'Mais {n} trechos para a matilha. Valeu!', '{n} trechos pintados. Juntos a gente cobre a cidade.'],
    distancia: ['{km} km! Agora descansa, que a matilha segura.', '{km} km no pé. A matilha está junto.', '{km} km bem corridos. Ninguém fica para trás.'],
    semana: ['{n} corridas na semana. A matilha sentiu.', 'Semana com {n} corridas. Ninguém fica para trás.', '{n} corridas, com descanso no meio. Semana de matilha.'],
    'semana-zonas': ['{n} zonas na semana. A matilha cobriu chão.', 'Semana com {n} zonas amarelas. Valeu, matilha!', '{n} zonas em sete dias. Juntos é mais longe.'],
  },
};

/** Hash simples e estável (FNV-1a) para escolher a fala sem sorteio. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const int = (v: number | undefined) => String(Math.max(0, Math.round(v ?? 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Troca os marcadores pelos dados do feito. Falta um dado que a fala cita → `null` (não inventar). */
export function fillLeaderLine(template: string, feat: LeaderFeat): string | null {
  const needs = (tag: string) => template.includes(`{${tag}}`);
  if (needs('n') && !(feat.n !== undefined && feat.n > 0)) return null;
  if (needs('prev') && !(feat.prev !== undefined && feat.prev > 0)) return null;
  if (needs('zona') && !feat.zone?.trim()) return null;
  if (needs('bairro') && !feat.district?.trim()) return null;
  if (needs('km') && !feat.km) return null;
  return template
    .replace('{n}', int(feat.n))
    .replace('{prev}', int(feat.prev))
    .replace('{zona}', shortZoneName(feat.zone ?? ''))
    .replace('{bairro}', shortZoneName(feat.district ?? ''))
    .replace('{km}', feat.km ?? '');
}

/**
 * A fala do líder para um feito real, ou `null` (nada a comentar, dado faltando, fala longa demais ou que bateria
 * no filtro de culpa). A semente fixa a escolha entre as 3 falas do feito.
 */
export function leaderLine(team: FactionId, feat: LeaderFeat | null, seed: string): string | null {
  if (!feat) return null;
  const options = LEADER_LINES[team]?.[feat.kind];
  if (!options) return null;
  const start = hash(`${seed}:${feat.kind}`) % options.length;
  for (let i = 0; i < options.length; i++) {
    const text = fillLeaderLine(options[(start + i) % options.length], feat);
    if (text && text.length <= LEADER_LINE_MAX && !hasGuiltWords(text)) return text;
  }
  return null;
}
