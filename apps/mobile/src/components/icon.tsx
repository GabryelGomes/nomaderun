import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** One name per concept: SF Symbol on iOS, Material Symbol on Android and web. */
const ICONS = {
  map: { ios: 'map.fill', android: 'map', web: 'map' },
  arena: { ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' },
  activities: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  club: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  profile: { ios: 'person.crop.circle.fill', android: 'person', web: 'person' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  shield: { ios: 'shield.lefthalf.filled', android: 'shield', web: 'shield' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  fog: { ios: 'cloud.fog.fill', android: 'visibility', web: 'visibility' },
  ghost: { ios: 'figure.run.circle', android: 'directions_run', web: 'directions_run' },
  chest: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  raid: { ios: 'bolt.shield.fill', android: 'bolt', web: 'bolt' },
  brush: { ios: 'scribble.variable', android: 'brush', web: 'brush' },
  flag: { ios: 'flag.fill', android: 'flag', web: 'flag' },
  territory: { ios: 'hexagon.fill', android: 'hexagon', web: 'hexagon' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  location: { ios: 'location.fill', android: 'my_location', web: 'my_location' },
  layers: { ios: 'square.3.layers.3d', android: 'layers', web: 'layers' },
  sos: { ios: 'sos', android: 'sos', web: 'sos' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  route: { ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  fire: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  city: { ios: 'building.2.fill', android: 'location_city', web: 'location_city' },
  back: { ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  diamond: { ios: 'diamond.fill', android: 'diamond', web: 'diamond' },
  speaker: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
  mute: { ios: 'speaker.slash.fill', android: 'volume_off', web: 'volume_off' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}

/** The same names, for NativeTabs triggers. */
export const tabIcon = (name: IconName) => ({ sf: ICONS[name].ios, md: ICONS[name].android });
