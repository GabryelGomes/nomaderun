import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button, IconButton } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { FadeUp, RevealText, staggerDelay } from '@/components/motion';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import type { MapCircle } from '@/components/territory-map.types';
import type { LatLng } from '@/domain/types';
import { DEMO_CENTER } from '@/demo/demo-data';
import { ErrorNotice, FormScaffold, TextField } from '@/features/auth/form-ui';
import {
  addPrivacyZone,
  DEFAULT_PRIVACY_RADIUS,
  listPrivacyZones,
  MAX_PRIVACY_ZONES,
  removePrivacyZone,
  type PrivacyZone,
} from '@/services/api/privacy-zones-repo';
import { accessMessage, requestLocationAccess } from '@/services/location/permissions';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const fmt = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/** Zonas de privacidade (RN-010): até 3 endereços cujo trecho do percurso não aparece para outras pessoas. */
export function PrivacyZonesScreen() {
  const { colors } = useTheme();
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const res = await listPrivacyZones();
    if (res.ok) {
      setZones(res.data);
      setError(null);
    } else setError(res.error.message);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void listPrivacyZones().then((res) => {
      if (!alive) return;
      if (res.ok) setZones(res.data);
      else setError(res.error.message);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const center = useMemo(() => (zones[0] ? { lat: zones[0].lat, lng: zones[0].lng } : DEMO_CENTER), [zones]);
  const circles = useMemo<MapCircle[]>(
    () => [
      ...zones.map((z) => ({ id: z.id, center: { lat: z.lat, lng: z.lng }, radius: z.radiusM })),
      ...(adding && point ? [{ id: 'nova', center: point, radius: DEFAULT_PRIVACY_RADIUS }] : []),
    ],
    [zones, adding, point],
  );

  const full = zones.length >= MAX_PRIVACY_ZONES;

  /** Mesmo mapa nos dois modos; ao adicionar, fica dentro do formulário (toque escolhe o ponto). */
  const map = (
    <Surface padded={false} style={{ overflow: 'hidden', height: 240 }}>
      <View testID="zonas-privacidade-mapa" style={{ flex: 1 }} accessibilityLabel={adding ? 'Mapa. Toque para escolher o ponto do endereço.' : 'Mapa com suas zonas de privacidade.'}>
        <TerritoryMap zones={[]} center={center} span={1500} circles={circles} focus={focus} onMapPress={adding ? setPoint : undefined} />
      </View>
    </Surface>
  );

  const open = () => {
    setAdding(true);
    setLabel('');
    setPoint(null);
    setError(null);
  };

  const pickMyPosition = async () => {
    setLocating(true);
    setError(null);
    const access = await requestLocationAccess();
    if (access.status !== 'granted') {
      setLocating(false);
      setError(accessMessage(access) ?? 'Não foi possível acessar sua localização.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPoint(p);
      setFocus(p);
    } catch {
      setError('Não foi possível obter sua posição agora. Toque no mapa para escolher o ponto.');
    }
    setLocating(false);
  };

  const save = async () => {
    if (!point) {
      setError('Escolha um ponto no mapa ou use sua posição atual.');
      return;
    }
    setBusy(true);
    const res = await addPrivacyZone({ label, lat: point.lat, lng: point.lng });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setAdding(false);
    setPoint(null);
    await reload();
  };

  const remove = async (z: PrivacyZone) => {
    setBusy(true);
    const res = await removePrivacyZone(z.id);
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    await reload();
  };

  return (
    <FormScaffold
      testID="tela-zonas-privacidade"
      nativeHeader
      footer={
        adding ? undefined : (
          <Button
            testID="zonas-privacidade-adicionar"
            label={full ? `Limite de ${MAX_PRIVACY_ZONES} endereços atingido` : 'Adicionar endereço'}
            icon="shield"
            kind="secondary"
            size="lg"
            wide
            disabled={full}
            onPress={open}
          />
        )
      }>
      <Text muted>A {DEFAULT_PRIVACY_RADIUS} m deles, sua rota vale pontos, mas ninguém vê.</Text>

      {/* Ao adicionar, o mapa e o formulário vêm primeiro: o ponto é escolhido tocando no mapa. */}
      {adding ? (
        <FadeUp testID="zona-privacidade-editor" style={{ gap: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Text variant="title">Novo endereço</Text>
          {map}
          <TextField testID="zona-privacidade-nome" onSurface label="Nome (opcional)" value={label} onChangeText={setLabel} placeholder="Casa" autoCapitalize="sentences" maxLength={40} returnKeyType="done" />
          <Text testID="zona-privacidade-ponto" muted>
            {point ? `Ponto escolhido: ${fmt(point)}. Raio de ${DEFAULT_PRIVACY_RADIUS} m.` : 'Toque no mapa para escolher o ponto ou use sua posição atual.'}
          </Text>
          <Button
            testID="zona-privacidade-posicao"
            label={locating ? 'Buscando sua posição…' : 'Usar minha posição atual'}
            icon="location"
            kind="secondary"
            wide
            disabled={locating}
            onPress={() => void pickMyPosition()}
          />
          <Button testID="zona-privacidade-salvar" label={busy ? 'Salvando…' : 'Salvar'} size="lg" wide disabled={busy || !point} onPress={() => void save()} />
          <Button testID="zona-privacidade-cancelar" label="Cancelar" kind="ghost" wide onPress={() => setAdding(false)} />
        </FadeUp>
      ) : null}

      <FadeUp delay={100}>
        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
            <RevealText variant="title" header delay={100} style={{ flex: 1 }}>
              Seus endereços
            </RevealText>
            <Text testID="zonas-privacidade-contagem" variant="small" tabular muted>
              {zones.length} de {MAX_PRIVACY_ZONES}
            </Text>
          </View>
          {!loaded ? (
            <View testID="zonas-privacidade-carregando" accessible accessibilityLabel="Carregando endereços" style={{ paddingVertical: space[4] }}>
              <ActivityIndicator color={colors.action} />
            </View>
          ) : null}
          {loaded && zones.length === 0 ? (
            <EmptyState testID="zonas-privacidade-vazio" compact art={<EmptyArt kind="sem-endereco" size={160} />} title="Nenhum endereço" body="Adicione sua casa para escondê-la do mapa." />
          ) : null}
          {zones.map((z, i) => {
            const name = z.label ?? `Endereço ${i + 1}`;
            return (
              <FadeUp key={z.id} delay={staggerDelay(i)} testID={`zona-privacidade-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="shield" size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text variant="small" muted tabular>
                    Raio de {z.radiusM} m · {fmt(z)}
                  </Text>
                </View>
                <IconButton testID={`zona-privacidade-${i}-remover`} icon="close" label={`Remover ${name}`} tone="sunken" size={44} onPress={() => (busy ? undefined : void remove(z))} />
              </FadeUp>
            );
          })}
        </Surface>
      </FadeUp>

      {adding ? null : <FadeUp delay={200}>{map}</FadeUp>}

      <ErrorNotice message={error} testID="zonas-privacidade-erro" />
      {error && !adding ? <Button testID="zonas-privacidade-tentar" label="Tentar de novo" kind="secondary" wide onPress={() => void reload()} /> : null}
    </FormScaffold>
  );
}
