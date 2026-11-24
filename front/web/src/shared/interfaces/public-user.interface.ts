export type Role = 'admin' | 'seller';

/** Una persona del equipo, como la devuelve la API. */
export interface PublicUser {
  id: number;
  businessId: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  /** Tope por cobro en pesos; null = sin tope propio. */
  maxAmount: number | null;
}
