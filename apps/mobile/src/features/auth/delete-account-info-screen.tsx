/**
 * Página pública `/excluir-conta` (F8 C3, D-99; S3 de docs/melhoria/F8/04 §6): o Google Play exige um link web
 * onde a pessoa vê como pedir a exclusão da conta sem reinstalar o app. Estática: não lê sessão, não chama o
 * servidor e não mostra nenhum dado pessoal; fica fora dos guards de rota (abre logado, deslogado ou sem servidor).
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/button';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { space } from '@/theme/tokens';

import { FormScaffold } from './form-ui';
import { LEGAL_CONTACTS } from './legal-contacts';

export const DELETE_ACCOUNT_STEPS = [
  'Abra o NOMADE RUN e entre na sua conta.',
  'Toque em Você → Ajustes → Conta.',
  'Em "Excluir conta", toque em Excluir conta, digite sua senha e confirme.',
] as const;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Surface>
    <Text variant="bodyBold" accessibilityRole="header">
      {title}
    </Text>
    {children}
  </Surface>
);

export function DeleteAccountInfoScreen() {
  return (
    <FormScaffold testID="tela-excluir-conta" modal>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <Text variant="headline" accessibilityRole="header" testID="excluir-conta-titulo">
            Excluir sua conta
          </Text>
          <Text muted>Do NOMADE RUN, quando você quiser.</Text>
        </View>
        <IconButton
          testID="excluir-conta-fechar"
          icon="close"
          label="Fechar"
          tone="sunken"
          size={44}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>

      <Section title="Pelo app (na hora)">
        {DELETE_ACCOUNT_STEPS.map((step, i) => (
          <Text key={step} muted accessibilityLabel={`Passo ${i + 1}: ${step}`}>
            {`${i + 1}. ${step}`}
          </Text>
        ))}
      </Section>

      <Section title="Sem o app (por e-mail)">
        <Text muted>
          {`Escreva para o encarregado de dados, ${LEGAL_CONTACTS.dpoName}, no e-mail ${LEGAL_CONTACTS.dpoEmail}, a partir do e-mail da sua conta, com o assunto "Excluir minha conta". Respondemos em até 30 dias.`}
        </Text>
        <Text muted>Nunca pedimos sua senha por e-mail.</Text>
      </Section>

      <Section title="O que é apagado">
        <Text muted>
          Seu login, perfil, foto, corridas, pontos de GPS, contatos da Corrida Segura, notificações, aparelhos, XP,
          missões, baús, medalhas, recordes, feed e as estatísticas de uso.
        </Text>
      </Section>

      <Section title="O que fica">
        <Text muted>
          Só os totais de território que já somaram para o seu time, sem nenhuma ligação com você. A exclusão não pode
          ser desfeita.
        </Text>
      </Section>
    </FormScaffold>
  );
}
