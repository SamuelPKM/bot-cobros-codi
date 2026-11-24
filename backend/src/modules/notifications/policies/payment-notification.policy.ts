import { centsToPesos } from '../../../shared/money/money';

const pesos = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Texto de la notificación "Pago recibido": monto, vendedor y concepto. */
export function paymentNotification(input: {
  chargeId: number;
  amountCents: number;
  sellerName: string;
  concept: string | null;
}): {
  title: string;
  body: string;
  data: { chargeId: number; type: 'charge.paid' };
} {
  const parts = [
    `$${pesos.format(centsToPesos(input.amountCents))}`,
    input.sellerName,
  ];
  if (input.concept) parts.push(input.concept);
  return {
    title: 'Pago recibido',
    body: parts.join(' · '),
    data: { chargeId: input.chargeId, type: 'charge.paid' },
  };
}
