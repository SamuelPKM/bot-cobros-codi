import { StyleSheet, Text, View } from 'react-native';
import { fonts, palette, radius, spacing } from './theme';

/** Mensaje en caja: error (alerta) o aviso informativo. */
export function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' | 'success' }) {
  const colors = {
    error: { bg: palette.dangerSurface, border: palette.dangerBorder, fg: palette.dangerText },
    info: { bg: palette.warningSurface, border: palette.warningBorder, fg: palette.pendingText },
    success: { bg: palette.successSurface, border: palette.successBorder, fg: palette.primaryDark },
  }[tone];
  return (
    <View
      accessible
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.md },
  text: { fontFamily: fonts.medium, fontSize: 14 },
});
