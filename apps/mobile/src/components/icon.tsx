import React from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', back: 'M19 12H5m6-6-6 6 6 6', plus: 'M12 5v14M5 12h14',
  search: 'm16.5 16.5 4 4', user: 'M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',
  phone: 'M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a13 13 0 0 1-7-7l2-2-2-5Z',
  calendar: 'M8 2v4M16 2v4M3 10h18M8 14h2M14 14h2M8 18h2', clock: 'M12 7v5l3 2',
  car: 'm4 9 2-5h12l2 5M4 17v3M20 17v3M7 13h1M16 13h1', image: 'm3 17 5-5 4 4 3-3 6 6', camera: 'M3 7h4l2-3h6l2 3h4v13H3Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z', check: 'm5 12 4 4L19 6', edit: 'm15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
  message: 'M21 11a9 9 0 0 1-9 9H3l2-4a9 9 0 1 1 16-5Z', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3', mail: 'm3 5 9 7 9-7', close: 'm6 6 12 12M6 18 18 6', logout: 'M9 3H3v18h6M9 12h12m-4-4 4 4-4 4',
  heart: 'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 8 8 15 8-7 12-11 8-15Z',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, color = '#1B1E1C' }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={true}>
    {name === 'search' && <Circle cx="10.5" cy="10.5" r="6.5" />}{name === 'user' && <Circle cx="12" cy="6" r="4" />}{name === 'clock' && <Circle cx="12" cy="12" r="9" />}
    {name === 'camera' && <Circle cx="12" cy="13" r="4" />}{name === 'calendar' && <Rect x="3" y="4" width="18" height="18" rx="3" />}{name === 'car' && <Rect x="2" y="9" width="20" height="8" rx="3" />}
    {name === 'image' && <><Rect x="3" y="3" width="18" height="18" rx="3" /><Circle cx="15.5" cy="8" r="1.5" /></>}{name === 'lock' && <Rect x="4" y="10" width="16" height="12" rx="3" />}{name === 'mail' && <Rect x="3" y="4" width="18" height="16" rx="3" />}
    <Path d={paths[name]} />
  </Svg>;
}
