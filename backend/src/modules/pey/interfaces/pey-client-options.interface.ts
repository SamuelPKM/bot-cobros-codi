export interface PeyClientOptions {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
}
