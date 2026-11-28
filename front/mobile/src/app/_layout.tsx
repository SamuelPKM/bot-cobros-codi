import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from '@expo-google-fonts/geist';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SessionProvider, useSession } from '@/features/auth/context/session-provider';
import { forgetPushToken, usePushNotifications } from '@/features/notifications/hooks/use-push-notifications';
import { createAppApi } from '@/shared/api/app-api';
import { fonts, palette, spacing } from '@/shared/ui/theme';

const navigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primaryPressed,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
  },
};

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const api = useMemo(() => createAppApi(), []);
  const onSignOut = useMemo(() => (api.ok ? forgetPushToken(api.request) : undefined), [api]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      {!fontsReady && !fontError ? (
        <Loading />
      ) : api.ok ? (
        <SessionProvider api={api} onSignOut={onSignOut}>
          <RootNavigator />
        </SessionProvider>
      ) : (
        <Centered>
          <Text style={styles.error}>{api.error}</Text>
        </Centered>
      )}
    </ThemeProvider>
  );
}

function Loading() {
  return (
    <Centered>
      <ActivityIndicator accessibilityLabel="Cargando" color={palette.primary} />
    </Centered>
  );
}

function RootNavigator() {
  const { state, authedRequest } = useSession();
  usePushNotifications(authedRequest, state.status === 'signedIn' ? state.user.id : null);

  if (state.status === 'loading') return <Loading />;

  const signedIn = state.status === 'signedIn';
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: palette.primaryPressed,
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { fontFamily: fonts.semibold, color: palette.text },
        contentStyle: { backgroundColor: palette.background },
      }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: 'Cóbrale' }} />
        <Stack.Screen name="cobros/nuevo" options={{ title: 'Nuevo cobro', presentation: 'modal' }} />
        <Stack.Screen name="cobros/[id]" options={{ title: 'Cobro' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  error: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center', color: palette.danger },
});
