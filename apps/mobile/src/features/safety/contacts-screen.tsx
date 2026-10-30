import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type TextInput, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button, IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { FadeUp, Pressable, RevealText, staggerDelay } from '@/components/motion';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, FormScaffold, TextField } from '@/features/auth/form-ui';
import { addContact, listContacts, MAX_SAFETY_CONTACTS, removeContact, updateContact, type SafetyContact } from '@/services/safety/contacts-repo';
import { useGame } from '@/store/game-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Contatos da Corrida Segura (RF-024): até 5, usados pelo SOS, Escolta e alerta de parada. */
export function SafetyContactsScreen() {
  const { colors } = useTheme();
  const contacts = useGame((s) => s.safetyContacts);
  const setContacts = useGame((s) => s.setSafetyContacts);
  const [editing, setEditing] = useState<SafetyContact | 'new' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const phoneRef = useRef<TextInput>(null);

  const reload = useCallback(async () => {
    const res = await listContacts();
    if (res.ok) {
      setContacts(res.data);
      setError(null);
    } else setError(res.error.message);
    setLoaded(true);
  }, [setContacts]);

  useEffect(() => {
    let alive = true;
    void listContacts().then((res) => {
      if (!alive) return;
      if (res.ok) setContacts(res.data);
      else setError(res.error.message);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [setContacts]);

  const open = (c: SafetyContact | 'new') => {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setPhone(c === 'new' ? '' : c.phone);
    setError(null);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const res = editing === 'new' ? await addContact(name, phone) : await updateContact(editing.id, name, phone);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setEditing(null);
    await reload();
  };

  const remove = async (c: SafetyContact) => {
    setBusy(true);
    const res = await removeContact(c.id);
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    if (editing && editing !== 'new' && editing.id === c.id) setEditing(null);
    await reload();
  };

  const full = contacts.length >= MAX_SAFETY_CONTACTS;

  const editor = editing ? (
    <FadeUp testID="contato-editor" style={{ gap: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <Text variant="title">{editing === 'new' ? 'Novo contato' : 'Editar contato'}</Text>
      <TextField
        testID="contato-nome" onSurface
        label="Nome"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={80}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextField
        testID="contato-telefone" onSurface
        inputRef={phoneRef}
        label="Celular com DDD"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+55 62 99999-0000"
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Button testID="contato-salvar" label={busy ? 'Salvando…' : 'Salvar'} size="lg" wide disabled={busy} onPress={() => void save()} />
      <Button testID="contato-cancelar" label="Cancelar" kind="ghost" wide onPress={() => setEditing(null)} />
    </FadeUp>
  ) : null;

  return (
    <FormScaffold
      testID="tela-contatos-seguranca"
      nativeHeader
      footer={
        editing ? undefined : (
          <Button
            testID="contatos-adicionar"
            label={full ? 'Limite de 5 contatos atingido' : 'Adicionar contato'}
            icon="shield"
            kind="secondary"
            size="lg"
            wide
            disabled={full}
            onPress={() => open('new')}
          />
        )
      }>
      <Text muted>Eles recebem sua localização no SOS, ao vivo e se você parar por 10 min.</Text>

      {/* O formulário fica logo abaixo da explicação: com o teclado aberto, ele continua à vista. */}
      {editor}

      <FadeUp delay={100}>
        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
            <RevealText variant="title" header delay={100} style={{ flex: 1 }}>
              Seus contatos
            </RevealText>
            <Text testID="contatos-contagem" variant="small" tabular muted>
              {contacts.length} de {MAX_SAFETY_CONTACTS}
            </Text>
          </View>
          {!loaded ? (
            <View testID="contatos-carregando" accessible accessibilityLabel="Carregando contatos" style={{ paddingVertical: space[4] }}>
              <ActivityIndicator color={colors.action} />
            </View>
          ) : null}
          {loaded && contacts.length === 0 ? (
            <EmptyState testID="contatos-vazio" compact art={<EmptyArt kind="sem-contatos" size={160} />} title="Ninguém ainda" body="Adicione alguém de confiança para o SOS." />
          ) : null}
          {contacts.map((c, i) => (
            <FadeUp key={c.id} delay={staggerDelay(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Pressable
                testID={`contato-${i}`}
                accessibilityLabel={`Editar ${c.name}, ${c.phone}`}
                hitSlop={0}
                onPress={() => open(c)}
                containerStyle={{ flex: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="shield" size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="small" muted tabular>
                    {c.phone}
                  </Text>
                </View>
              </Pressable>
              <IconButton testID={`contato-${i}-remover`} icon="close" label={`Remover ${c.name}`} tone="sunken" size={44} onPress={() => void remove(c)} />
            </FadeUp>
          ))}
        </Surface>
      </FadeUp>

      <ErrorNotice message={error} testID="contatos-erro" />
      {error && !editing ? <Button testID="contatos-tentar" label="Tentar de novo" kind="secondary" wide onPress={() => void reload()} /> : null}
    </FormScaffold>
  );
}
