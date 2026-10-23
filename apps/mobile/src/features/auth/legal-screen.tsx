import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton } from '@/components/button';
import { Surface } from '@/components/surface';
import { FadeUp, RevealText, Stagger } from '@/components/motion';
import { Text } from '@/components/text';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/services/api/auth-repo';
import { space } from '@/theme/tokens';

import { FormScaffold } from './form-ui';
import { MIN_AGE } from './validation';

type Section = { title: string; body: string[] };

const TERMS: Section[] = [
  {
    title: '1. O que é o NOMADE RUN',
    body: [
      'Um aplicativo de corrida que registra seus treinos pelo GPS e transforma os quilômetros em disputa de território entre quatro times. É um projeto acadêmico (TCC) em fase de MVP.',
    ],
  },
  {
    title: '2. Quem pode usar',
    body: [
      `É preciso ter pelo menos ${MIN_AGE} anos e informar dados verdadeiros no cadastro. A conta é pessoal e intransferível; você é responsável por manter sua senha em segredo.`,
    ],
  },
  {
    title: '3. Segurança em primeiro lugar',
    body: [
      'Corra em locais seguros, respeite as leis de trânsito e nunca use o aplicativo de forma que coloque você ou outras pessoas em risco. Zonas e pontos nunca valem mais que a sua segurança.',
    ],
  },
  {
    title: '4. Jogo limpo',
    body: [
      'É proibido simular percursos, usar veículos, GPS falso ou qualquer meio de fraude. O servidor confere todas as corridas; trechos suspeitos são invalidados e contas podem passar por revisão, ter a pontuação suspensa ou ser inativadas.',
      'Nomes de usuário ofensivos ou que se passem por outra pessoa podem ser alterados ou removidos pela moderação.',
    ],
  },
  {
    title: '5. Seus dados',
    body: ['O tratamento dos seus dados pessoais segue a Política de Privacidade, que faz parte destes termos.'],
  },
  {
    title: '6. Disponibilidade e mudanças',
    body: [
      'Por ser um MVP, o serviço pode ficar fora do ar, perder dados de demonstração ou mudar regras de pontuação. Avisaremos no aplicativo sobre mudanças relevantes nestes termos.',
      'Você pode encerrar sua conta a qualquer momento em Perfil > Conta e privacidade.',
    ],
  },
];

const PRIVACY: Section[] = [
  {
    title: '1. Quais dados coletamos',
    body: [
      'Cadastro: e-mail, nome de usuário, data de nascimento e seus aceites. Perfil: cidade, unidade de medida e preferências de notificação.',
      'Corridas: pontos de GPS (posição, horário, precisão, velocidade e altitude), passos do sensor de movimento e o resultado calculado. Aparelho: um identificador e uma chave usada só para assinar os envios.',
    ],
  },
  {
    title: '2. Para que usamos a localização',
    body: [
      'Só durante uma corrida iniciada por você: para medir distância e ritmo, saber em que zona da cidade você está, calcular os pontos do seu time e conferir se o percurso foi feito a pé (antifraude).',
      'Ninguém vê sua posição ao vivo, a não ser os contatos que você escolher na Corrida Segura. O início e o fim das corridas perto de casa ficam escondidos dos outros corredores.',
    ],
  },
  {
    title: '3. Notificações',
    body: [
      'Pedimos permissão separadamente e só para avisos do jogo (invasões, conquistas, missões e moderação). Você escolhe quais receber no perfil e pode desligar a qualquer momento.',
    ],
  },
  {
    title: '4. Base legal e compartilhamento',
    body: [
      'Tratamos os dados para executar o serviço que você contratou e com o seu consentimento, conforme a LGPD (Lei 13.709/2018). Não vendemos seus dados. Outros corredores veem apenas seu nome de usuário, time, cidade, nível e as zonas que você conquistou.',
      'Os dados ficam em servidores do provedor de nuvem do projeto (Supabase), com acesso restrito por usuário e comunicação criptografada.',
    ],
  },
  {
    title: '5. Seus direitos',
    body: [
      'Você pode ver e corrigir seus dados no perfil, exportar tudo em um arquivo JSON e excluir sua conta em Perfil > Conta e privacidade. Pedidos de exportação e exclusão são atendidos em até 30 dias; a exclusão pelo aplicativo é imediata para os dados pessoais.',
    ],
  },
  {
    title: '6. Por quanto tempo guardamos',
    body: [
      'Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados pessoais e corridas; ficam só totais anônimos de território que não identificam você.',
    ],
  },
];

export function LegalScreen({ kind }: { kind: 'termos' | 'privacidade' }) {
  const terms = kind === 'termos';
  const sections = terms ? TERMS : PRIVACY;
  return (
    <FormScaffold testID={terms ? 'tela-termos' : 'tela-privacidade'} modal>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <RevealText testID="legal-titulo">{terms ? 'Termos de Uso' : 'Política de Privacidade'}</RevealText>
          <FadeUp delay={150}>
            <Text variant="small" muted>
              Versão {terms ? TERMS_VERSION : PRIVACY_VERSION}
            </Text>
          </FadeUp>
        </View>
        <IconButton testID="legal-fechar" icon="close" label="Fechar" tone="sunken" size={44} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <Stagger delay={200} gap={space[6]}>
        {sections.map((s) => (
          <Surface key={s.title}>
            <Text variant="bodyBold" accessibilityRole="header">
              {s.title}
            </Text>
            {s.body.map((p) => (
              <Text key={p} muted>
                {p}
              </Text>
            ))}
          </Surface>
        ))}
      </Stagger>
    </FormScaffold>
  );
}
