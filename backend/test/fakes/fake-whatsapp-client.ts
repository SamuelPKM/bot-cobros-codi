/** WhatsApp Cloud API simulado: guarda lo que se mandó a cada número. */
export class FakeWhatsAppClient {
  readonly sent: { to: string; text: string; png?: Buffer }[] = [];
  private failing = false;

  failNext(): void {
    this.failing = true;
  }

  reset(): void {
    this.sent.length = 0;
    this.failing = false;
  }

  /** Textos (o pies de foto) que recibió un número, en orden. */
  textsTo(to: string): string[] {
    return this.sent.filter((m) => m.to === to).map((m) => m.text);
  }

  sendText(to: string, body: string): Promise<void> {
    if (this.failOnce()) return Promise.reject(new Error('WhatsApp caído'));
    this.sent.push({ to, text: body });
    return Promise.resolve();
  }

  sendImage(to: string, png: Buffer, caption?: string): Promise<void> {
    if (this.failOnce()) return Promise.reject(new Error('WhatsApp caído'));
    this.sent.push({ to, text: caption ?? '', png });
    return Promise.resolve();
  }

  private failOnce(): boolean {
    if (!this.failing) return false;
    this.failing = false;
    return true;
  }
}
