import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { qrPath } from '../policies/qr-path.policy';

/** QR en negro sobre blanco aun en modo oscuro: los bancos lo leen mejor así. */
export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  const { size: modules, path } = useMemo(() => qrPath(value), [value]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Código QR CoDi del cobro">
      <Svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`}>
        <Rect width={modules} height={modules} fill="#ffffff" />
        <Path d={path} fill="#000000" />
      </Svg>
    </View>
  );
}
