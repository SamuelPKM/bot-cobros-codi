import { StyleSheet, Text, View } from 'react-native';
import { fonts, palette, radius } from '@/shared/ui/theme';
import { statusLabel } from '../policies/charge-view.policy';
import type { ChargeStatus } from '../types/charge.types';

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  const colors =
    status === 'paid'
      ? { bg: palette.brandSofter, fg: palette.brandText }
      : status === 'pending'
        ? { bg: palette.pendingSurface, fg: palette.pendingText }
        : { bg: palette.border, fg: palette.textSoft };
  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${statusLabel(status)}`}
      style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  text: { fontFamily: fonts.medium, fontSize: 12 },
});
