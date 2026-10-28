/**
 * T7.1.11, T7.2.8 e T7.3.4 (E4) — galeria do sistema de arte, só para desenvolvimento (revisão e capturas do QA).
 * Onda 2: logo, líderes, mascotes em corrida, partes para a E5 e a arte dentro do SVG do card (E8).
 * Onda 3 (T7.3.4): chama e gelo da sequência, ícone da aba Correr e 4 estados vazios novos.
 * Visível em `__DEV__` ou na web; num build de produção nativo, redireciona para o início.
 */
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';

import {
  Boss,
  BossSvgArt,
  BOSS_IDS,
  BOSS_NAMES,
  BOSS_STATES,
  Chest,
  CHEST_LAYERS,
  CHEST_RARITIES,
  CHEST_STATES,
  EMPTY_KINDS,
  EMPTY_LABELS,
  EmptyArt,
  LEADER_NAMES,
  LEADER_POSES,
  LeaderBust,
  Logo,
  LOGO_VARIANTS,
  LogoSvgArt,
  Mascot,
  MascotRunner,
  MascotSvgArt,
  MASCOT_NAMES,
  MASCOT_POSES,
  Medal,
  MEDAL_KINDS,
  MEDAL_LABELS,
  MODE_ICON_KINDS,
  MODE_ICON_LABELS,
  ModeIcon,
  RUN_TAB_VARIANTS,
  RunTabIcon,
  STREAK_LABELS,
  STREAK_STATES,
  StreakArt,
  TAB_BACKGROUND_KINDS,
  TAB_BACKGROUND_LABELS,
  TabBackground,
  TeamEmblem,
  TUTORIAL_LABELS,
  TUTORIAL_STEPS,
  TutorialArt,
  type QualityProp,
} from '@/components/art';
import { ChipRow } from '@/components/chip-row';
import { ScreenScroll } from '@/components/screen';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { neon } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';

const TEAMS: readonly FactionId[] = ['striders', 'volt', 'owls', 'coyotes'];
const POSE_LABELS = { parado: 'parado', vitoria: 'vitória', derrota: 'derrota', dormindo: 'dormindo' } as const;
const LOGO_LABELS = { simbolo: 'símbolo', logotipo: 'logotipo', horizontal: 'horizontal' } as const;
const LAYER_LABELS = { corpo: 'corpo', tampa: 'tampa', item: 'item' } as const;
type MedalView = '1' | '2' | '3' | 'bloqueada';

export default function ArtGalleryRoute() {
  if (!__DEV__ && process.env.EXPO_OS !== 'web') return <Redirect href="/" />;
  return <ArtGallery />;
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" color={neon.orange} style={{ textTransform: 'uppercase' }}>
        {title}
      </Text>
      {note ? <Text variant="small" muted>{note}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>
    </View>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space[1], padding: space[2], borderRadius: radius.md, backgroundColor: neon.surface, borderWidth: 1, borderColor: neon.line }}>
      {children}
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

function ArtGallery() {
  const [quality, setQuality] = useState<QualityProp>('auto');
  const [team, setTeam] = useState<FactionId>('striders');
  const [motion, setMotion] = useState<'parado' | 'vivo'>('parado');
  const [medal, setMedal] = useState<MedalView>('3');
  const animated = motion === 'vivo';

  return (
    <ScreenScroll testID="dev-arte">
      <View style={{ gap: space[1] }}>
        <Text variant="headline">Galeria de arte</Text>
        <Text variant="small" muted>
          Só em desenvolvimento. Neon em camadas, sem filtro de desfoque.
        </Text>
      </View>

      <ChipRow
        testID="dev-arte-qualidade"
        accessibilityLabel="Qualidade do traço"
        chipLabel={(l) => `Qualidade: ${l}`}
        options={[
          ['auto', 'Auto'],
          ['completo', 'Completo'],
          ['leve', 'Leve'],
          ['plano', 'Plano'],
        ]}
        value={quality}
        onChange={setQuality}
      />
      <ChipRow
        testID="dev-arte-time"
        accessibilityLabel="Time"
        chipLabel={(l) => `Time: ${l}`}
        options={TEAMS.map((t) => [t, factions[t].name] as const)}
        value={team}
        onChange={setTeam}
      />
      <ChipRow
        testID="dev-arte-movimento"
        accessibilityLabel="Animação do parado"
        chipLabel={(l) => `Animação: ${l}`}
        options={[
          ['parado', 'Estático'],
          ['vivo', 'Vivo (respirar, piscar, falar, correr)'],
        ]}
        value={motion}
        onChange={setMotion}
      />

      <Section title="Logo oficial" note="Símbolo, logotipo e horizontal (paths, sem texto no SVG). Ícones em PNG em assets/art.">
        {LOGO_VARIANTS.map((v) => (
          <Cell key={v} label={LOGO_LABELS[v]}>
            <Logo variant={v} size={v === 'simbolo' ? 120 : 260} quality={quality} testID={`dev-arte-logo-${v}`} />
          </Cell>
        ))}
        <Cell label="monocromático">
          <Logo size={72} mono={neon.ink} decorative />
        </Cell>
        <Cell label="48 e 24 pt">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Logo size={48} quality={quality} decorative />
            <Logo size={24} quality={quality} decorative />
          </View>
        </Cell>
      </Section>

      <Section title="Líderes · parado e falando" note="Com a animação ligada, o parado respira e pisca; o falando abre a boca e acena.">
        {TEAMS.flatMap((t) =>
          LEADER_POSES.map((pose) => (
            <Cell key={`${t}-${pose}`} label={`${LEADER_NAMES[t]} · ${pose}`}>
              <LeaderBust team={t} pose={pose} size={140} quality={quality} animated={animated} />
            </Cell>
          )),
        )}
      </Section>

      <Section title="Mascotes em corrida · escolha de time" note="Com os 4 juntos, use a qualidade leve; com a animação, o corpo quica e o rastro desliza.">
        {TEAMS.map((t) => (
          <Cell key={t} label={MASCOT_NAMES[t]}>
            <MascotRunner team={t} size={170} quality={quality === 'auto' ? 'leve' : quality} animated={animated} />
          </Cell>
        ))}
        <Cell label={`herói · ${MASCOT_NAMES[team]}`}>
          <MascotRunner team={team} size={300} quality={quality} animated={animated} />
        </Cell>
      </Section>

      <Section title="Mascotes · 4 poses" note={`${MASCOT_NAMES[team]} (${factions[team].name}). Troque o time acima.`}>
        {MASCOT_POSES.map((pose) => (
          <Cell key={pose} label={POSE_LABELS[pose]}>
            <Mascot team={team} pose={pose} size={120} quality={quality} animated={animated} />
          </Cell>
        ))}
      </Section>

      <Section title="Mascotes · os 4 times">
        {TEAMS.map((t) => (
          <Cell key={t} label={MASCOT_NAMES[t]}>
            <Mascot team={t} size={120} quality={quality} animated={animated} />
          </Cell>
        ))}
        {[56, 40, 28].map((s) => (
          <Cell key={s} label={`${s} pt`}>
            <Mascot team={team} size={s} quality={quality} />
          </Cell>
        ))}
      </Section>

      <Section title="Emblemas" note="Completo (nome por Text, fora do SVG) e compacto; abaixo de 64 pt fica compacto.">
        {TEAMS.map((t) => (
          <Cell key={t} label={factions[t].name}>
            <TeamEmblem team={t} size={120} quality={quality} />
          </Cell>
        ))}
        {TEAMS.map((t) => (
          <Cell key={`c-${t}`} label="compacto">
            <TeamEmblem team={t} size={72} compact quality={quality} />
          </Cell>
        ))}
        {[56, 40, 32].map((s) => (
          <Cell key={s} label={`${s} pt`}>
            <TeamEmblem team={team} size={s} quality={quality} />
          </Cell>
        ))}
      </Section>

      {BOSS_IDS.map((id) => (
        <Section key={id} title={`Chefão · ${BOSS_NAMES[id]}`} note="Parado, golpe, furioso e derrotado; depois dano 1 e 2.">
          {BOSS_STATES.map((st) => (
            <Cell key={st} label={st}>
              <Boss id={id} state={st} size={120} quality={quality} animated={animated && st === 'parado'} decorative />
            </Cell>
          ))}
          {([1, 2] as const).map((d) => (
            <Cell key={`d${d}`} label={`dano ${d}`}>
              <Boss id={id} dano={d} size={120} quality={quality} decorative />
            </Cell>
          ))}
        </Section>
      ))}

      <Section title="Baús · 3 raridades × 3 estados">
        {CHEST_RARITIES.flatMap((r) =>
          CHEST_STATES.map((st) => (
            <Cell key={`${r}-${st}`} label={`${r} · ${st}`}>
              <Chest rarity={r} state={st} size={100} quality={quality} decorative />
            </Cell>
          )),
        )}
      </Section>

      <Section title="Partes para a E5" note="Baú em camadas (layer) e a silhueta do chefão para o clarão do golpe.">
        {CHEST_LAYERS.map((l) => (
          <Cell key={l} label={`baú · ${LAYER_LABELS[l]}`}>
            <Chest rarity="lendario" layer={l} size={100} quality={quality} />
          </Cell>
        ))}
        <Cell label="chefão · silhueta">
          <Boss id="paredao" state="golpe" silhouette size={110} quality={quality} />
        </Cell>
      </Section>

      <Section title="Dentro do SVG do card (E8)" note="Contrato { cx, cy, size }: a arte vira um G dentro do SVG maior, sem Image.">
        <Cell label="card 1080 × 1920 (reduzido)">
          <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={162} height={288} viewBox="0 0 1080 1920">
              <MascotSvgArt team={team} pose="vitoria" box={{ cx: 540, cy: 620, size: 600 }} />
              <BossSvgArt id="mormaco" state="derrotado" box={{ cx: 540, cy: 1240, size: 520 }} />
              <LogoSvgArt variant="horizontal" box={{ cx: 540, cy: 1720, size: 640 }} />
            </Svg>
          </View>
        </Cell>
      </Section>

      <ChipRow
        testID="dev-arte-medalha"
        accessibilityLabel="Nível das medalhas"
        chipLabel={(l) => `Medalhas: ${l}`}
        options={[
          ['1', '1 estrela'],
          ['2', '2 estrelas'],
          ['3', '3 estrelas'],
          ['bloqueada', 'Bloqueada'],
        ]}
        value={medal}
        onChange={setMedal}
      />
      <Section title="Medalhas · 12" note="Nível por estrelas e brilho, sem dourado (o amarelo é dos Coyotes).">
        {MEDAL_KINDS.map((k) => (
          <Cell key={k} label={MEDAL_LABELS[k]}>
            <Medal kind={k} tier={medal === 'bloqueada' ? 1 : (Number(medal) as 1 | 2 | 3)} locked={medal === 'bloqueada'} size={72} quality={quality} decorative />
          </Cell>
        ))}
      </Section>

      <Section title="Ícones dos modos · 44 e 28 pt">
        {MODE_ICON_KINDS.map((k) => (
          <Cell key={k} label={MODE_ICON_LABELS[k]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ModeIcon kind={k} size={44} quality={quality} />
              <ModeIcon kind={k} size={28} quality={quality} />
            </View>
          </Cell>
        ))}
      </Section>

      <Section title="Sequência · chama e gelo" note="Acesa (semana garantida), fraca (falta 1 atividade) e gelo (congelamento usado). Com a animação, a chama tremula e o gelo cintila.">
        {STREAK_STATES.map((st) => (
          <Cell key={st} label={STREAK_LABELS[st]}>
            <StreakArt state={st} size={96} quality={quality} animated={animated} testID={`dev-arte-sequencia-${st}`} />
          </Cell>
        ))}
        <Cell label="camadas: chama + gelo">
          <View style={{ width: 96, height: 112 }}>
            <StreakArt state="gelo" layer="chama" size={96} quality={quality} style={{ position: 'absolute' }} />
            <StreakArt state="gelo" layer="gelo" size={96} quality={quality} animated={animated} style={{ position: 'absolute' }} />
          </View>
        </Cell>
        {[56, 32].map((s) => (
          <Cell key={s} label={`${s} pt`}>
            <View style={{ flexDirection: 'row', gap: space[1] }}>
              {STREAK_STATES.map((st) => (
                <StreakArt key={st} state={st} size={s} quality={quality} />
              ))}
            </View>
          </Cell>
        ))}
      </Section>

      <Section title="Ícone da aba Correr" note="Sempre laranja (PNG com renderingMode original no nativo): contorno quando não selecionada, cheio quando selecionada.">
        {RUN_TAB_VARIANTS.map((v) => (
          <Cell key={v} label={v === 'padrao' ? 'padrão' : 'selecionado'}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <RunTabIcon variant={v} size={28} />
              <RunTabIcon variant={v} size={56} />
            </View>
          </Cell>
        ))}
      </Section>

      <Section title={`Estados vazios · ${EMPTY_KINDS.length}`}>
        {EMPTY_KINDS.map((k) => (
          <Cell key={k} label={EMPTY_LABELS[k]}>
            <EmptyArt kind={k} team={team} size={160} quality={quality} />
          </Cell>
        ))}
      </Section>

      <Section title="Cartões do tutorial">
        {TUTORIAL_STEPS.map((s) => (
          <Cell key={s} label={TUTORIAL_LABELS[s]}>
            <TutorialArt step={s} team={team} size={200} quality={quality} />
          </Cell>
        ))}
      </Section>

      <Section title="Fundos das abas" note="Na opacidade real (até 6%): devem quase sumir atrás do texto.">
        {TAB_BACKGROUND_KINDS.map((k) => (
          <Cell key={k} label={TAB_BACKGROUND_LABELS[k]}>
            <View style={{ width: 120, height: 240, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: neon.bg }}>
              <TabBackground kind={k} team={team} />
              <Text variant="caption" style={{ padding: space[2] }}>
                Texto por cima
              </Text>
            </View>
          </Cell>
        ))}
      </Section>
    </ScreenScroll>
  );
}
