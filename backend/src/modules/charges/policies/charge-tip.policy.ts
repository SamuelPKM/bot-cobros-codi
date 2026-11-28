import { MAX_AMOUNT } from '../../pey/constants/pey.constants';

/**
 * Reglas de la propina. Los montos van en centavos; `totalCents` es lo que se
 * le cobra al cliente (cobro + propina).
 * Devuelve el mensaje para la persona, o null si todo está bien.
 */
export function tipViolation(
  totalCents: number,
  tipCents: number,
): string | null {
  if (tipCents > totalCents - tipCents)
    return 'La propina no puede ser mayor que el cobro';
  if (totalCents > MAX_AMOUNT * 100)
    return 'El total con propina no puede pasar de $1,000,000';
  return null;
}

/** Separa el total en el cobro sin propina y la propina. */
export function splitTotal(
  totalCents: number,
  tipCents: number,
): { subtotalCents: number; tipCents: number } {
  return { subtotalCents: totalCents - tipCents, tipCents };
}
