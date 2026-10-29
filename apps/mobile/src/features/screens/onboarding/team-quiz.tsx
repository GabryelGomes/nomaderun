import { useState } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/art';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp, PressableScale } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { quizResult, TEAM_QUIZ } from './quiz';

export type TeamQuizProps = {
  /** "Ver os {time}": fecha o quiz e leva o carrossel até o time sugerido (a escolha continua com a pessoa). */
  onPick: (team: FactionId) => void;
  onClose: () => void;
  testID?: string;
};

/** "Não sei escolher": 3 perguntas, 1 toque cada, e uma sugestão honesta ("A escolha é sua"). */
export function TeamQuiz({ onPick, onClose, testID = 'onboarding-quiz' }: TeamQuizProps) {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<FactionId[]>([]);
  const index = answers.length;
  const question = TEAM_QUIZ[index];
  const result = question ? null : quizResult(answers);

  if (!question && result) {
    const team = factions[result];
    return (
      <FadeUp testID={`${testID}-resultado`} style={{ gap: space[4], alignItems: 'center' }}>
        <Mascot team={result} pose="vitoria" size={120} />
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Sugerimos os {team.name}
        </Text>
        <Text muted style={{ textAlign: 'center' }}>
          A escolha é sua.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: space[2] }}>
          <Button testID={`${testID}-ver`} label={`Ver os ${team.name}`} size="lg" wide onPress={() => onPick(result)} />
          <Button testID={`${testID}-refazer`} label="Refazer quiz" kind="ghost" wide onPress={() => setAnswers([])} />
        </View>
      </FadeUp>
    );
  }

  return (
    <View testID={testID} style={{ gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <Text variant="label" muted style={{ textTransform: 'uppercase' }} accessibilityLabel={`Pergunta ${index + 1} de ${TEAM_QUIZ.length}`}>
          {index + 1} de {TEAM_QUIZ.length}
        </Text>
        <Button testID={`${testID}-fechar`} label="Fechar" kind="ghost" onPress={onClose} />
      </View>
      <FadeUp key={question.id} distance={16} style={{ gap: space[3] }}>
        <Text variant="headline" accessibilityRole="header">
          {question.title}
        </Text>
        {question.options.map((o) => (
          <PressableScale
            key={o.team}
            testID={`${testID}-${question.id}-${o.team}`}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            onPress={() => setAnswers((a) => [...a, o.team])}
            hitSlop={0}
            style={{
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.lineControl,
              backgroundColor: colors.surface,
            }}>
            {/* Sem a cor nem a forma do time: a resposta é sobre o jeito de correr, não sobre o time. */}
            <Icon name={o.icon} size={22} color={colors.textSecondary} />
            <Text style={{ flex: 1 }}>{o.label}</Text>
          </PressableScale>
        ))}
      </FadeUp>
    </View>
  );
}
