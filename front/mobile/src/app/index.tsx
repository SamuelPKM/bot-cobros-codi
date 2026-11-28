import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSession, useSignedInUser } from '@/features/auth/context/session-provider';
import { BusinessHeader } from '@/features/businesses/components/business-header';
import { getBusinessHeader, type BusinessHeaderData } from '@/features/businesses/services/business.api';
import { ChargesList } from '@/features/charges/components/charges-list';
import type { PublicCharge } from '@/features/charges/interfaces/public-charge.interface';
import { listCharges } from '@/features/charges/services/charges.api';
import { TodaySummary } from '@/features/reports/components/today-summary';
import type { DailySummary } from '@/features/reports/interfaces/daily-summary.interface';
import { getTodaySummary } from '@/features/reports/services/reports.api';
import { messageFor } from '@/shared/api/error-message';
import { Notice } from '@/shared/ui/notice';
import { Screen } from '@/shared/ui/screen';
import { fonts, palette, spacing } from '@/shared/ui/theme';

export default function PanelScreen() {
  const router = useRouter();
  const user = useSignedInUser();
  const { state, authedRequest, signOut, apiBaseUrl } = useSession();
  const token = state.status === 'signedIn' ? state.token : null;
  const [business, setBusiness] = useState<BusinessHeaderData | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [charges, setCharges] = useState<PublicCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextCharges, nextBusiness] = await Promise.all([
        getTodaySummary(authedRequest),
        listCharges(authedRequest),
        // El encabezado no es crítico: sin él se muestra lo demás.
        getBusinessHeader(authedRequest).catch(() => null),
      ]);
      setSummary(nextSummary);
      setCharges(nextCharges);
      if (nextBusiness) setBusiness(nextBusiness);
      setError(null);
    } catch (failure) {
      setError(messageFor(failure));
    }
  }, [authedRequest]);

  // Al volver de un cobro, la lista ya trae su estado nuevo.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logo =
    business?.logoVersion && token && apiBaseUrl
      ? {
          uri: `${apiBaseUrl}/businesses/me/logo?v=${encodeURIComponent(business.logoVersion)}`,
          headers: { Authorization: `Bearer ${token}` },
        }
      : null;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Salir" hitSlop={12} onPress={() => void signOut()}>
              <Text style={styles.signOut}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      <BusinessHeader
        businessName={business?.name ?? 'Tu negocio'}
        userName={user.name}
        role={user.role}
        logo={logo}
        onNewCharge={() => router.push('/cobros/nuevo')}
      />
      {error ? <Notice message={error} /> : null}
      {summary ? <TodaySummary summary={summary} /> : null}
      <Text accessibilityRole="header" style={styles.heading}>
        {user.role === 'admin' ? 'Últimos cobros' : 'Tus cobros'}
      </Text>
      {charges ? (
        <ChargesList
          charges={charges}
          showSeller={user.role === 'admin'}
          onOpen={(id) => router.push(`/cobros/${id}`)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  signOut: { fontFamily: fonts.medium, color: palette.primaryPressed, fontSize: 16 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, color: palette.text, marginTop: spacing.sm },
});
