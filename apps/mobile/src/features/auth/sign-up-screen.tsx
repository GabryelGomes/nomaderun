import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FadeUp, RevealText } from '@/components/motion';
import { Text } from '@/components/text';
import * as authRepo from '@/services/api/auth-repo';
import { MESSAGES } from '@/services/api/errors';
import { isUsernameAvailable } from '@/services/api/profile-repo';
import { space } from '@/theme/tokens';

import { CheckRow, ErrorNotice, FormScaffold, InfoNotice, InlineLink, StrengthMeter, TextField, TextLink } from './form-ui';
import { NeonBackdrop } from './neon-backdrop';
import { hasErrors, maskBirthdate, MIN_AGE, parseBirthdate, passwordStrength, validateSignUp, type SignUpErrors } from './validation';

/** Mensagem única do aceite (uma caixa grava os dois aceites; D-72). */
export const LEGAL_ERROR = 'Aceite os Termos e a Privacidade para continuar.';

/**
 * Cadastro enxuto (RF-001, D-72, wireframe `01`): 4 campos (e-mail, senha ≥ 8 com retorno, nome de usuário único,
 * nascimento 16+) e **uma** caixa "Aceito os Termos e a Privacidade", que grava os dois aceites (o trigger do
 * servidor continua recebendo `accepted_terms` e `accepted_privacy`). A cidade saiu: fica em "Editar perfil".
 */
export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const strength = passwordStrength(password);
  const senhaRef = useRef<TextInput>(null);
  const usuarioRef = useRef<TextInput>(null);
  const nascimentoRef = useRef<TextInput>(null);
  /** "Próximo" do teclado leva ao campo seguinte. */
  const next = { returnKeyType: 'next' as const, submitBehavior: 'submit' as const };
  const legalError = errors.acceptedTerms || errors.acceptedPrivacy ? LEGAL_ERROR : undefined;

  const submit = async () => {
    const form = { email, password, username, birthdate, acceptedTerms: accepted, acceptedPrivacy: accepted };
    const errs = validateSignUp(form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    setServerError(null);
    // O Auth esconde o motivo quando o trigger recusa; por isso o nome é conferido antes.
    const available = await isUsernameAvailable(username);
    if (available.ok && !available.data) {
      setBusy(false);
      setErrors((e) => ({ ...e, username: MESSAGES.usernameTaken }));
      return;
    }
    const res = await authRepo.signUp({
      email,
      password,
      username,
      birthdate: parseBirthdate(birthdate) ?? '',
      acceptedTerms: accepted,
      acceptedPrivacy: accepted,
      emailRedirectTo: Linking.createURL('/entrar'),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.detail === '23505' || /usuário/.test(res.error.message)) setErrors((e) => ({ ...e, username: res.error.message }));
      setServerError(res.error.message);
      return;
    }
    if (res.data.needsConfirmation) setConfirmSent(true);
    // Com sessão, o guarda de rotas leva direto à escolha do time.
  };

  if (confirmSent) {
    return (
      <FormScaffold testID="tela-cadastro-confirmar" background={<NeonBackdrop />}>
        <RevealText testID="cadastro-confirmar-titulo">Confira seu e-mail</RevealText>
        <FadeUp delay={200}>
          <InfoNotice testID="cadastro-confirmacao" title="Conta criada" body={`Abra o link que enviamos para ${email.trim()} e depois entre.`} />
        </FadeUp>
        <Button testID="cadastro-ir-entrar" label="Ir para Entrar" size="lg" wide onPress={() => router.replace('/entrar')} />
      </FormScaffold>
    );
  }

  return (
    <FormScaffold
      testID="tela-cadastro"
      background={<NeonBackdrop />}
      footer={<Button testID="cadastro-botao" label={busy ? 'Criando conta…' : 'Criar conta'} size="lg" wide disabled={busy} busy={busy} onPress={submit} />}>
      <View style={{ gap: space[2] }}>
        <RevealText testID="cadastro-titulo">Criar conta</RevealText>
        <FadeUp delay={150}>
          <Text muted>1 minuto e você escolhe seu time.</Text>
        </FadeUp>
      </View>

      <FadeUp delay={250} style={{ gap: space[4] }}>
        <ErrorNotice message={serverError} testID="cadastro-erro" />
        <TextField
          testID="cadastro-email"
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          {...next}
          onSubmitEditing={() => senhaRef.current?.focus()}
          error={errors.email}
        />
        <TextField
          testID="cadastro-senha"
          inputRef={senhaRef}
          {...next}
          onSubmitEditing={() => usuarioRef.current?.focus()}
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Pelo menos 8 caracteres"
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          help={password ? <StrengthMeter level={strength.level} label={strength.label} hint={strength.hint} /> : undefined}
        />
        <TextField
          testID="cadastro-usuario"
          inputRef={usuarioRef}
          {...next}
          onSubmitEditing={() => nascimentoRef.current?.focus()}
          label="Nome de usuário"
          value={username}
          onChangeText={setUsername}
          placeholder="ex.: maria_corre"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={20}
          error={errors.username}
          help="Aparece nos rankings."
        />
        <TextField
          testID="cadastro-nascimento"
          inputRef={nascimentoRef}
          returnKeyType="done"
          onSubmitEditing={submit}
          label="Data de nascimento"
          value={birthdate}
          onChangeText={(t) => setBirthdate(maskBirthdate(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          maxLength={10}
          error={errors.birthdate}
          help={`Para maiores de ${MIN_AGE} anos.`}
        />
      </FadeUp>

      <CheckRow testID="cadastro-aceite" label="Aceito os Termos de Uso e a Política de Privacidade" checked={accepted} onChange={setAccepted} error={legalError}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 }}>
          <Text>Aceito os</Text>
          <InlineLink testID="cadastro-abrir-termos" label="Termos" onPress={() => router.push('/termos')} />
          <Text>e a</Text>
          <InlineLink testID="cadastro-abrir-privacidade" label="Privacidade" onPress={() => router.push('/privacidade')} />
        </View>
      </CheckRow>

      <TextLink testID="cadastro-ja-tenho-conta" label="Já tenho conta" onPress={() => router.dismissTo('/entrar')} />
    </FormScaffold>
  );
}
