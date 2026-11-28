import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { fonts, palette } from './theme';

/** La marca de Cóbrale: igual que el logo de la web. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const gradientId = `logo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#10b981" />
          <Stop offset="1" stopColor="#047857" />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <Path
        d="M42.6 21.4 A15 15 0 1 0 42.6 42.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth={7.5}
        strokeLinecap="round"
      />
      <Circle cx={43.5} cy={32} r={5} fill="#bef264" />
    </Svg>
  );
}

export function Logo({ size = 36, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Cóbrale" style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <LogoMark size={size} />
      </View>
      <Text
        style={[styles.text, { fontSize: Math.round(size * 0.62), color: tone === 'light' ? '#ffffff' : palette.text }]}>
        Cóbrale
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontFamily: fonts.semibold },
});
