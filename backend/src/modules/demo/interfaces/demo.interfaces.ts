import type { DemoSender } from '../types/demo.types';

/** Lo que la página de la demo muestra antes de empezar. */
export interface DemoInfo {
  businessName: string;
  /** Tope por cobro, en pesos. */
  maxAmount: number;
  chargesPerHour: number;
}

export interface DemoMessageView {
  id: number;
  sender: DemoSender;
  text: string;
  /** Contenido del QR CoDi, tal cual lo da pey; la web lo dibuja. */
  qrString?: string;
  url?: string;
  createdAt: string;
}
