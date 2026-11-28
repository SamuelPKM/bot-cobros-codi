import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { fonts, palette, radius, spacing } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', busy = false, disabled = false }: ButtonProps) {
  const primary = variant === 'primary';
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? [styles.shadow, { backgroundColor: pressed ? palette.primaryPressed : palette.primary }]
          : { borderColor: palette.borderInput, borderWidth: 1, backgroundColor: pressed ? palette.neutralSurface : palette.surface },
        inactive && { opacity: 0.6 },
      ]}>
      {busy ? (
        <ActivityIndicator color={primary ? palette.onPrimary : palette.text} />
      ) : (
        <Text style={[primary ? styles.primaryLabel : styles.secondaryLabel, { color: primary ? palette.onPrimary : palette.text }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  primaryLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  secondaryLabel: { fontFamily: fonts.medium, fontSize: 16 },
});
