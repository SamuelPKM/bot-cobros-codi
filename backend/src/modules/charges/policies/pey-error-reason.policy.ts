import type { PeyError } from '../../pey/errors/pey.error';

/** Explica al vendedor, en sus palabras, por qué no salió un cobro. */
export function peyErrorReason(error: PeyError): string {
  if (error.isOutcomeUnknown)
    return 'No supimos si el banco recibió el cobro. No lo repitas: si el cliente lo paga, aquí se verá. Si no le llegó, muéstrale el QR.';

  switch (error.type) {
    case 'INVALID_STATE':
      return 'La cuenta bancaria que recibe los pagos todavía no está activa en CoDi.';
    case 'INVALID_AMOUNT':
      return 'El banco no aceptó ese monto.';
    case 'INVALID_PARAMETER':
    case 'INCOMPLETE_PARAMETERS':
    case 'BAD_REQUEST':
    case 'INVALID_REQUEST':
      return 'El banco no aceptó los datos del cobro. Revisa el teléfono y el monto.';
    case 'SERVICE_UNAVAILABLE':
    case 'FLAGS_UNAVAILABLE':
      return 'El servicio de cobros está en mantenimiento. Intenta de nuevo en unos minutos.';
    default:
      return 'Intenta de nuevo en unos minutos.';
  }
}
