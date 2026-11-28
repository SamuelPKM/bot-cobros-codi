import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatTime } from '@/shared/format/format';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { statusLabel } from '../policies/charge-view.policy';
import { ChargeStatusBadge } from './charge-status-badge';

interface ChargesListProps {
  charges: PublicCharge[];
  onOpen: (id: number) => void;
  /** El admin ve quién hizo cada cobro. */
  showSeller?: boolean;
}

export function ChargesList({ charges, onOpen, showSeller = false }: ChargesListProps) {
  if (charges.length === 0)
    return <Text style={[styles.empty, { color: palette.muted }]}>Todavía no hay cobros.</Text>;

  return (
    <View style={[styles.list, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {charges.map((charge, index) => {
        const details = [charge.concept, showSeller ? charge.seller.name : null, formatTime(charge.createdAt)]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={charge.id}
            accessibilityRole="button"
            accessibilityLabel={`${formatMoney(charge.amount)}, ${statusLabel(charge.status)}, ${details}`}
            onPress={() => onOpen(charge.id)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopColor: palette.border, borderTopWidth: 1 },
              pressed && { backgroundColor: palette.neutralSurface },
            ]}>
            <View style={styles.main}>
              <Text style={[styles.amount, { color: palette.text }]}>{formatMoney(charge.amount)}</Text>
              <Text style={[styles.details, { color: palette.muted }]} numberOfLines={1}>
                {details}
              </Text>
            </View>
            <ChargeStatusBadge status={charge.status} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  main: { flex: 1, gap: 2 },
  amount: { fontFamily: fonts.semibold, fontSize: 16, fontVariant: ['tabular-nums'] },
  details: { fontFamily: fonts.regular, fontSize: 14 },
  empty: { fontFamily: fonts.regular, fontSize: 14, paddingVertical: spacing.md },
});
