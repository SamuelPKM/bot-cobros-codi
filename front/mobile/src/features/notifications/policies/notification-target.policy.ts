/**
 * El cobro a abrir al tocar un aviso. La API manda
 * { type: 'charge.paid', chargeId } (paymentNotification en el backend).
 */
export function chargeIdFromNotification(data: unknown): number | null {
  const { type, chargeId } = (data ?? {}) as { type?: unknown; chargeId?: unknown };
  if (type !== 'charge.paid') return null;
  return typeof chargeId === 'number' && Number.isInteger(chargeId) && chargeId > 0 ? chargeId : null;
}
