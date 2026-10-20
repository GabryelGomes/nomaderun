import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
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

  return (
    <FormScaffold testID="tela-contatos-seguranca" modal>
      <Text muted>
        Até {MAX_SAFETY_CONTACTS} pessoas. Elas recebem sua localização quando você toca em SOS, liga a Escolta ou fica parado por mais de 10 minutos sem responder.
      </Text>

      <Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title">Seus contatos</Text>
          <Text testID="contatos-contagem" variant="small" tabular muted>
            {contacts.length} de {MAX_SAFETY_CONTACTS}
          </Text>
        </View>
        {loaded && contacts.length === 0 ? <Text muted>Nenhum contato ainda.</Text> : null}
        {contacts.map((c, i) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Pressable
              testID={`contato-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${c.name}, ${c.phone}`}
              onPress={() => open(c)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
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
          </View>
        ))}
      </Surface>

      {editing ? (
        <View style={{ gap: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Text variant="title">{editing === 'new' ? 'Novo contato' : 'Editar contato'}</Text>
          <TextField testID="contato-nome" label="Nome" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
          <TextField testID="contato-telefone" label="Celular com DDD" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+55 62 99999-0000" maxLength={20} />
          <Button testID="contato-salvar" label={busy ? 'Salvando…' : 'Salvar'} size="lg" wide disabled={busy} onPress={() => void save()} />
          <Button testID="contato-cancelar" label="Cancelar" kind="ghost" wide onPress={() => setEditing(null)} />
        </View>
      ) : (
        <Button
          testID="contatos-adicionar"
          label={full ? 'Limite de 5 contatos atingido' : 'Adicionar contato'}
          icon="shield"
          kind="secondary"
          wide
          disabled={full}
          onPress={() => open('new')}
        />
      )}
      <ErrorNotice message={error} testID="contatos-erro" />
    </FormScaffold>
  );
}
