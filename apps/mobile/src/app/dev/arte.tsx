/**
 * T7.1.11 (E4) — galeria do sistema de arte, só para desenvolvimento (revisão e capturas do QA).
 * Visível em `__DEV__` ou na web; num build de produção nativo, redireciona para o início.
 */
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  Boss,
  BOSS_IDS,
  BOSS_NAMES,
  BOSS_STATES,
  Chest,
  CHEST_RARITIES,
  CHEST_STATES,
  EMPTY_KINDS,
  EMPTY_LABELS,
  EmptyArt,
  Mascot,
  MASCOT_NAMES,
  MASCOT_POSES,
  Medal,
  MEDAL_KINDS,
  MEDAL_LABELS,
  MODE_ICON_KINDS,
  MODE_ICON_LABELS,
  ModeIcon,
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
          ['vivo', 'Respirar e piscar'],
        ]}
        value={motion}
        onChange={setMotion}
      />

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

      <Section title="Estados vazios · 8">
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
