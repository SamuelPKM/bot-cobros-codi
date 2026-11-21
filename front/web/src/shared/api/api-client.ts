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
  /** Headers solo de esta llamada (p. ej. X-Demo-Session). */
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  /** Headers fijos en cada llamada (IP del visitante y secreto del proxy). */
  headers?: Record<string, string>;
}

const UNREACHABLE =
  'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';

/** Cliente JSON de la API de Nest. Solo se usa del lado del servidor (ver server-api.ts). */
export function createApiClient({ baseUrl, fetch, headers: fixed = {} }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers = new Headers({ ...fixed, ...options.headers, accept: 'application/json' });
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.token) headers.set('authorization', `Bearer ${options.token}`);

    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(503, UNREACHABLE);
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
