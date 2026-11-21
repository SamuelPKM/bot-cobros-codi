/**
 * Celular a 10 dígitos a partir del número con que Meta identifica a quien
 * escribe (wa_id). Los celulares mexicanos llegan como 521 + 10 dígitos (formato
 * anterior a 2019) o 52 + 10. Otro país → null: las cuentas son solo de México.
 */
export function phoneFromWaId(waId: string): string | null {
  if (!/^\d+$/.test(waId)) return null;
  if (waId.length === 13 && waId.startsWith('521')) return waId.slice(3);
  if (waId.length === 12 && waId.startsWith('52')) return waId.slice(2);
  return null;
}
