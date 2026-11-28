import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useSession } from '@/features/auth/context/session-provider';
import { ChargeDetail } from '@/features/charges/components/charge-detail';
import { useLiveCharge } from '@/features/charges/hooks/use-live-charge';
import { addFallback } from '@/features/charges/services/charges.api';
import { Notice } from '@/shared/ui/notice';
import { Screen } from '@/shared/ui/screen';

export default function CobroScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = /^\d+$/.test(rawId ?? '') ? Number(rawId) : 0;
  const { authedRequest } = useSession();
  const { charge, error, notFound, replace } = useLiveCharge(authedRequest, id);

  if (!id || notFound)
    return (
      <Screen>
        <Notice message="No encontramos ese cobro." />
      </Screen>
    );

  return (
    <Screen>
      {error ? <Notice message={error} tone="info" /> : null}
      {charge ? (
        <ChargeDetail
          charge={charge}
          onFallback={async (kind) => replace(await addFallback(authedRequest, charge.id, kind))}
        />
      ) : (
        <ActivityIndicator accessibilityLabel="Cargando el cobro" />
      )}
    </Screen>
  );
}
