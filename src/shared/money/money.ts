// Dinero: se guarda en centavos enteros (sin errores de punto flotante);
// la API habla en pesos, como pey.

/** Pesos (máx. 2 decimales, ya validados por el DTO) a centavos enteros. */
export const pesosToCents = (pesos: number): number => Math.round(pesos * 100);

/** Centavos enteros a pesos. */
export const centsToPesos = (cents: number): number => cents / 100;
