/** Máximo de caracteres del concepto de un cobro CoDi. */
export const PAYER_CONCEPT_MAX = 40;

/**
 * Concepto que ve quien paga en la app de su banco. Lleva el nombre del
 * negocio al inicio porque el banco solo muestra al titular de la cuenta que
 * recibe, y quien paga debe saber a quién le paga.
 */
export function payerConcept(
  businessName: string,
  concept: string | null | undefined,
): string {
  const detail = concept?.trim();
  const full = detail ? `${businessName}: ${detail}` : businessName;
  return full.length > PAYER_CONCEPT_MAX
    ? full.slice(0, PAYER_CONCEPT_MAX).trimEnd()
    : full;
}
