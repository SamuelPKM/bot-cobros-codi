import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatMoney } from '@/shared/format/format';
import { Avatar } from '@/shared/ui/avatar';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';
import type { DailySummary } from '../interfaces/daily-summary.interface';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

type IconKind = 'check' | 'clock' | 'x';

function TileIcon({ kind, color }: { kind: IconKind; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'check' ? <Path d="M5 10.5l3 3 7-7" /> : null}
      {kind === 'clock' ? (
        <>
          <Circle cx={10} cy={10} r={6.5} />
          <Path d="M10 6.5V10l2.5 1.5" />
        </>
      ) : null}
      {kind === 'x' ? (
        <>
          <Circle cx={10} cy={10} r={6.5} />
          <Path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
        </>
      ) : null}
    </Svg>
  );
}

export function TodaySummary({ summary }: { summary: DailySummary }) {
  const tiles: { label: string; value: string; detail: string | null; icon: IconKind; bg: string; fg: string }[] = [
    {
      label: 'Cobrado hoy',
      value: formatMoney(summary.paid.amount),
      detail: plural(summary.paid.count, 'cobro', 'cobros'),
      icon: 'check',
      bg: palette.brandSoft,
      fg: palette.success,
    },
    {
      label: 'Pendiente',
      value: formatMoney(summary.pending.amount),
      detail: plural(summary.pending.count, 'cobro', 'cobros'),
      icon: 'clock',
      bg: palette.warningSurface,
      fg: palette.warning,
    },
    {
      label: 'Vencidos',
      value: String(summary.expired.count),
      detail: null,
      icon: 'x',
      bg: palette.neutralSurface,
      fg: palette.muted,
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>
        Hoy
      </Text>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View
            key={tile.label}
            accessible
            accessibilityLabel={`${tile.label}: ${tile.value}${tile.detail ? `, ${tile.detail}` : ''}`}
            style={styles.tile}>
            <View style={[styles.icon, { backgroundColor: tile.bg }]}>
              <TileIcon kind={tile.icon} color={tile.fg} />
            </View>
            <View style={styles.tileBody}>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={styles.tileValue} adjustsFontSizeToFit numberOfLines={1}>
                {tile.value}
              </Text>
              {tile.detail ? <Text style={styles.tileDetail}>{tile.detail}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {summary.byPerson?.length ? (
        <View style={styles.people}>
          {summary.byPerson.map((person, index) => (
            <View
              key={person.userId}
              style={[styles.person, index > 0 && { borderTopColor: palette.border, borderTopWidth: 1 }]}>
              <Avatar name={person.name} size={28} tone="neutral" />
              <View style={styles.personBody}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personDetail}>
                  {`${formatMoney(person.paidAmount)} · ${plural(person.paidCount, 'pagado', 'pagados')} · ${plural(person.pendingCount, 'pendiente', 'pendientes')}`}
                </Text>
              </View>
              {index === 0 ? (
                <View style={styles.top}>
                  <Text style={styles.topText}>Más cobró hoy</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { fontFamily: fonts.semibold, fontSize: 18, color: palette.text },
  tiles: { gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tileBody: { flex: 1 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 14, color: palette.muted },
  tileValue: { fontFamily: fonts.semibold, fontSize: 24, color: palette.text, fontVariant: ['tabular-nums'] },
  tileDetail: { fontFamily: fonts.regular, fontSize: 12, color: palette.subtle },
  people: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  personBody: { flex: 1, gap: 2 },
  personName: { fontFamily: fonts.medium, fontSize: 14, color: palette.text },
  personDetail: { fontFamily: fonts.regular, fontSize: 12, color: palette.muted, fontVariant: ['tabular-nums'] },
  top: { backgroundColor: palette.brandSoft, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  topText: { fontFamily: fonts.medium, fontSize: 11, color: palette.success },
});
