/**
 * Carimbos do Atlas (F8 · ideia 5.8): 1 carimbo por bairro onde a pessoa pontuou pela 1ª vez, do mais novo para o
 * mais antigo. Colecionismo sem sorteio: cada carimbo vem de uma corrida real (`districtStamps`).
 */
import { View } from 'react-native';

import { SectionHeader } from '@/components/section-header';
import { Text } from '@/components/text';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';

import type { DistrictStamp } from './moments';

/** No "Você", os 6 mais novos (o resto conta no número). */
export const STAMPS_SHOWN = 6;

export function AtlasStamps({ stamps, testID = 'atlas-carimbos' }: { stamps: readonly DistrictStamp[]; testID?: string }) {
  if (stamps.length === 0) return null;
  const shown = [...stamps].reverse().slice(0, STAMPS_SHOWN);
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      <SectionHeader
        testID={`${testID}-titulo`}
        title="Carimbos do Atlas"
        action={
          <Text variant="bodyBold" color={neon.orangeText} tabular>
            {String(stamps.length)}
          </Text>
        }
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {shown.map((s, i) => (
          <View
            key={s.district}
            accessible
            accessibilityLabel={`Carimbo de ${s.name}`}
            style={{ transform: [{ rotate: i % 2 ? '2deg' : '-2deg' }], paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: neon.orange }}>
            <Text variant="caption" color={neon.orangeText} numberOfLines={1}>
              {s.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
