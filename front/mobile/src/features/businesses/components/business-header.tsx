import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from '@/shared/interfaces/public-user.interface';
import { Avatar } from '@/shared/ui/avatar';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';
import { headerGreeting } from '../policies/greeting.policy';

interface BusinessHeaderProps {
  businessName: string;
  userName: string;
  role: Role;
  logo?: { uri: string; headers?: Record<string, string> } | null;
  /** Se inyecta para poder probar el saludo. */
  now?: Date;
  onNewCharge: () => void;
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', seller: 'Vendedor' };

export function BusinessHeader({ businessName, userName, role, logo, now = new Date(), onNewCharge }: BusinessHeaderProps) {
  return (
    <View style={styles.block}>
      <View style={styles.top}>
        <Avatar name={businessName} size={64} tone="brand" source={logo} />
        <View style={styles.info}>
          <Text style={styles.greeting}>{headerGreeting(userName, now)}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {businessName}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{ROLE_LABEL[role]}</Text>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo cobro"
        onPress={onNewCharge}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
        <Text style={styles.buttonText}>+ Nuevo cobro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: palette.brandDark, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 4 },
  greeting: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(209, 250, 229, 0.8)' },
  name: { fontFamily: fonts.semibold, fontSize: 24, color: '#ffffff' },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, color: palette.accent },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.primaryDark },
});
