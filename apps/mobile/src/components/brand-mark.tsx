import React from 'react';
import { Platform } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import mark from '../../assets/brand-mark.json';

/** Shared vector geometry for the É monogram and generated launcher assets. */
export function BrandMark({ size = 32, color = mark.foreground }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 100 100" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={true}>
    {mark.polygons.map((points, index) => <Polygon key={index} points={points.map(point => point.join(',')).join(' ')} fill={color} />)}
  </Svg>;
}
