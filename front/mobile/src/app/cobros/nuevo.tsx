import { useRouter } from 'expo-router';
import { useSession } from '@/features/auth/context/session-provider';
import { NewChargeForm } from '@/features/charges/components/new-charge-form';
import type { NewChargeInput } from '@/features/charges/policies/new-charge-form.policy';
import { createCharge } from '@/features/charges/services/charges.api';
import { Screen } from '@/shared/ui/screen';

export default function NuevoCobroScreen() {
  const router = useRouter();
  const { authedRequest } = useSession();

  async function submit(input: NewChargeInput) {
    const charge = await createCharge(authedRequest, input);
    // replace: "atrás" desde el cobro regresa al panel, no a un formulario ya enviado.
    router.replace(`/cobros/${charge.id}`);
  }

  return (
    <Screen>
      <NewChargeForm onSubmit={submit} />
    </Screen>
  );
}
