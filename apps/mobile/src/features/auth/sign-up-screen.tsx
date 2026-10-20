import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import * as authRepo from '@/services/api/auth-repo';
import { MESSAGES } from '@/services/api/errors';
import { isUsernameAvailable } from '@/services/api/profile-repo';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CheckRow, ErrorNotice, FormScaffold, InfoNotice, StrengthMeter, TextField, TextLink } from './form-ui';
import { hasErrors, maskBirthdate, MIN_AGE, parseBirthdate, passwordStrength, validateSignUp, type SignUpErrors } from './validation';

/**
 * Cadastro (RF-001): e-mail, senha (≥ 8 com feedback), nome de usuário (3–20, único),
 * data de nascimento (16+) e dois aceites separados (termos e privacidade, RNF-013).
 */
export function SignUpScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [city, setCity] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const strength = passwordStrength(password);

  const submit = async () => {
    const form = { email, password, username, birthdate, city, acceptedTerms, acceptedPrivacy };
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
      city,
      acceptedTerms,
      acceptedPrivacy,
      emailRedirectTo: Linking.createURL('/entrar'),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.detail === '23505' || /usuário/.test(res.error.message)) setErrors((e) => ({ ...e, username: res.error.message }));
      setServerError(res.error.message);
      return;
    }
    if (res.data.needsConfirmation) setConfirmSent(true);
    // Com sessão, o guarda de rotas leva direto ao onboarding.
  };

  if (confirmSent) {
    return (
      <FormScaffold testID="tela-cadastro-confirmar">
        <Text variant="headline" accessibilityRole="header">
          Confira seu e-mail
        </Text>
        <InfoNotice
          testID="cadastro-confirmacao"
          title="Conta criada"
          body={`Enviamos um link de confirmação para ${email.trim()}. Abra o link neste celular e depois entre com sua senha.`}
        />
        <Button testID="cadastro-ir-entrar" label="Ir para Entrar" size="lg" wide onPress={() => router.replace('/entrar')} />
      </FormScaffold>
    );
  }

  return (
    <FormScaffold testID="tela-cadastro">
      <View style={{ gap: space[4] }}>
        <Text variant="headline" accessibilityRole="header">
          Criar conta
        </Text>
        <Text muted>Leva um minuto. Depois você escolhe seu time e já pode correr.</Text>
      </View>

      <View style={{ gap: space[4] }}>
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
          error={errors.email}
        />
        <TextField
          testID="cadastro-senha"
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Pelo menos 8 caracteres"
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          help={<StrengthMeter level={strength.level} label={strength.label} hint={strength.hint} />}
        />
        <TextField
          testID="cadastro-usuario"
          label="Nome de usuário"
          value={username}
          onChangeText={setUsername}
          placeholder="ex.: maria_corre"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={20}
          error={errors.username}
          help="De 3 a 20 caracteres: letras, números, ponto ou sublinhado. É assim que os outros corredores veem você."
        />
        <TextField
          testID="cadastro-nascimento"
          label="Data de nascimento"
          value={birthdate}
          onChangeText={(t) => setBirthdate(maskBirthdate(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          maxLength={10}
          error={errors.birthdate}
          help={`O NOMADE RUN é para maiores de ${MIN_AGE} anos.`}
        />
        <TextField
          testID="cadastro-cidade"
          label="Cidade natal (opcional)"
          value={city}
          onChangeText={setCity}
          placeholder="Ex.: Goiânia"
          autoComplete="off"
          maxLength={80}
          error={errors.city}
          help="Conta pontos para a sua cidade no placar entre cidades. Dá para mudar depois no perfil."
        />
      </View>

      <View style={{ gap: space[2] }}>
        <CheckRow testID="cadastro-aceite-termos" label="Li e aceito os Termos de Uso" checked={acceptedTerms} onChange={setAcceptedTerms} error={errors.acceptedTerms}>
          <Text>
            Li e aceito os{' '}
            <Text color={colors.accentText} variant="bodyBold" onPress={() => router.push('/termos')} accessibilityRole="link" testID="cadastro-abrir-termos">
              Termos de Uso
            </Text>
          </Text>
        </CheckRow>
        <CheckRow
          testID="cadastro-aceite-privacidade"
          label="Li e aceito a Política de Privacidade"
          checked={acceptedPrivacy}
          onChange={setAcceptedPrivacy}
          error={errors.acceptedPrivacy}>
          <Text>
            Li e aceito a{' '}
            <Text color={colors.accentText} variant="bodyBold" onPress={() => router.push('/privacidade')} accessibilityRole="link" testID="cadastro-abrir-privacidade">
              Política de Privacidade
            </Text>
          </Text>
        </CheckRow>
      </View>

      <View style={{ gap: space[3] }}>
        <Button testID="cadastro-botao" label={busy ? 'Criando conta…' : 'Criar conta'} size="lg" wide disabled={busy} onPress={submit} />
        <TextLink testID="cadastro-ja-tenho-conta" label="Já tenho conta" onPress={() => (router.canGoBack() ? router.back() : router.replace('/entrar'))} />
      </View>
    </FormScaffold>
  );
}
