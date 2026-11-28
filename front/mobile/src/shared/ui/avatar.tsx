import { useId, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fonts, palette } from './theme';

/** "Tacos La Esquina" → "TL": primera letra o dígito de hasta dos palabras. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'brand' | 'neutral';
  /** Imagen (p. ej. el logo del negocio); si falla se muestran las iniciales. */
  source?: { uri: string; headers?: Record<string, string> } | null;
}

export function Avatar({ name, size = 40, tone = 'brand', source }: AvatarProps) {
  const gradientId = `avatar-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = source && failedUri !== source.uri;
  const round = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        round,
        tone === 'neutral' && { backgroundColor: palette.neutralSurface, borderWidth: 1, borderColor: palette.border },
      ]}>
      {showImage ? (
        <Image testID="avatar-image" source={source} style={round} onError={() => setFailedUri(source.uri)} />
      ) : (
        <>
          {tone === 'brand' ? (
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={palette.brandBright} />
                  <Stop offset="1" stopColor={palette.primaryPressed} />
                </LinearGradient>
              </Defs>
              <Rect width={size} height={size} fill={`url(#${gradientId})`} />
            </Svg>
          ) : null}
          <Text
            style={[
              styles.text,
              { fontSize: Math.round(size * 0.38), color: tone === 'brand' ? '#ffffff' : palette.textSoft },
            ]}>
            {initials(name)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontFamily: fonts.semibold },
});
