import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginForm } from '@/features/auth/components/login-form';
import { useSession } from '@/features/auth/context/session-provider';
import { Logo } from '@/shared/ui/logo';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';

export default function EntrarScreen() {
  const { state, signIn } = useSession();
  const notice = state.status === 'signedOut' ? state.notice : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Logo size={40} />
          <View style={styles.card}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Qué gusto verte
              </Text>
              <Text style={styles.subtitle}>Entra con el usuario que te dio tu negocio.</Text>
            </View>
            <LoginForm onSubmit={signIn} notice={notice} />
          </View>
          <Text style={styles.footer}>¿Aún no tienes cuenta? Registra tu negocio en la web.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  card: {
    alignSelf: 'stretch',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: { gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 24, color: palette.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: palette.muted },
  footer: { fontFamily: fonts.regular, fontSize: 14, color: palette.muted, textAlign: 'center' },
});
