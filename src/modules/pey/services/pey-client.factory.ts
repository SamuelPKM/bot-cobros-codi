import type { PeyApi } from '../interfaces/pey-api.interface';
import { PeyClient } from './pey-client.service';

/**
 * Arma un cliente de pey con la API key de un negocio. Cada negocio cobra
 * con sus propias credenciales: el dinero llega a la cuenta del titular de
 * esas credenciales (regla 7.3(c) del hackatón).
 */
export class PeyClientFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly fetch: typeof globalThis.fetch,
  ) {}

  create(apiKey: string): PeyApi {
    return new PeyClient({ apiKey, baseUrl: this.baseUrl, fetch: this.fetch });
  }
}
