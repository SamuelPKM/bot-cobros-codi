/** Error de la API de Cóbrale, con un mensaje que se le puede mostrar a la persona. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer token de la sesión. */
  token?: string;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  /** En el celular la red puede colgarse; por defecto 20 s. */
  timeoutMs?: number;
}

export type ApiRequest = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

const UNREACHABLE =
  'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
const TOO_SLOW = 'El servidor tardó demasiado en responder.';
const TOO_SLOW_WRITE = `${TOO_SLOW} Pudo haberse hecho: Revisa tus cobros antes de intentar de nuevo.`;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Cliente JSON de la API de Nest. Nunca reintenta: un POST /charges repetido
 * podría mandar dos cobros al cliente.
 */
export function createApiClient({
  baseUrl,
  fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions): { request: ApiRequest } {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) throw new ApiError(504, method === 'GET' ? TOO_SLOW : TOO_SLOW_WRITE);
      throw new ApiError(503, UNREACHABLE);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return null as T;
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, messageOf(data));
    return data as T;
  }

  return { request };
}

/** Nest responde { message: string | string[] }. */
function messageOf(data: unknown): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string' && message) return message;
  return 'Algo salió mal. Intenta de nuevo en un momento.';
}
