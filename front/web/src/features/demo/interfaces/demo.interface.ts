/** GET /demo de la API. */
export interface DemoInfo {
  businessName: string;
  /** Tope por cobro, en pesos. */
  maxAmount: number;
  chargesPerHour: number;
}

/** Un mensaje como lo da la API (/demo/messages). */
export interface ApiDemoMessage {
  id: number;
  sender: 'visitor' | 'bot';
  text: string;
  qrString?: string;
  url?: string;
  createdAt: string;
}

/** Un mensaje como lo recibe el navegador: el QR ya viene dibujado. */
export interface ChatMessage {
  id: number;
  sender: 'visitor' | 'bot';
  text: string;
  qrImage?: string;
  url?: string;
}

export type DemoResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; status: number; error: string };
