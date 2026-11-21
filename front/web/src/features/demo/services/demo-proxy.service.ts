import 'server-only';
import { cookies } from 'next/headers';
import { qrDataUrl } from '@/features/charges/services/qr-image.service';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import { isProduction } from '@/shared/config/server-env';
import { UNEXPECTED_ERROR } from '@/shared/forms/form-state.type';
import type { ApiDemoMessage, ChatMessage, DemoResult } from '../interfaces/demo.interface';

/** Cookie httpOnly con el id de la sesión de la demo (la API la vence a las 24 h). */
const DEMO_COOKIE = 'cobrale_demo';
const MAX_TEXT = 300;
const NO_SESSION = 'La sesión de la demo venció. Empezamos una nueva.';

/** Abre una sesión de demo en la API (con sus límites por IP) y la recuerda en la cookie. */
export async function startDemo(): Promise<DemoResult> {
  try {
    const { sessionId, messages } = await apiRequest<{ sessionId: string; messages: ApiDemoMessage[] }>(
      '/demo/sessions',
      { method: 'POST' },
    );
    (await cookies()).set(DEMO_COOKIE, sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });
    return { ok: true, messages: await toChat(messages) };
  } catch (error) {
    return failure(error);
  }
}

/** Mensajes nuevos (id mayor a `after`), incluido el "✅ Pagado". */
export function demoMessages(after: number): Promise<DemoResult> {
  return withSession((headers) =>
    apiRequest<{ messages: ApiDemoMessage[] }>(`/demo/messages?after=${after}`, { headers }),
  );
}

export async function sendDemoMessage(text: string, after: number): Promise<DemoResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, status: 400, error: 'Escribe un mensaje.' };
  if (trimmed.length > MAX_TEXT)
    return { ok: false, status: 400, error: `El mensaje puede tener hasta ${MAX_TEXT} caracteres.` };
  return withSession((headers) =>
    apiRequest<{ messages: ApiDemoMessage[] }>('/demo/messages', {
      method: 'POST',
      body: { text: trimmed, after },
      headers,
    }),
  );
}

async function withSession(
  call: (headers: Record<string, string>) => Promise<{ messages: ApiDemoMessage[] }>,
): Promise<DemoResult> {
  const store = await cookies();
  const session = store.get(DEMO_COOKIE)?.value;
  if (!session) return { ok: false, status: 401, error: NO_SESSION };
  try {
    const { messages } = await call({ 'x-demo-session': session });
    return { ok: true, messages: await toChat(messages) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      store.delete(DEMO_COOKIE);
      return { ok: false, status: 401, error: NO_SESSION };
    }
    return failure(error);
  }
}

function failure(error: unknown): DemoResult {
  return error instanceof ApiError
    ? { ok: false, status: error.status, error: error.message }
    : { ok: false, status: 500, error: UNEXPECTED_ERROR };
}

/** El navegador recibe el QR ya dibujado (PNG) y nunca el contenido crudo. */
function toChat(messages: ApiDemoMessage[]): Promise<ChatMessage[]> {
  return Promise.all(
    messages.map(async ({ id, sender, text, qrString, url }) => ({
      id,
      sender,
      text,
      ...(qrString ? { qrImage: await qrDataUrl(qrString) } : {}),
      ...(url ? { url } : {}),
    })),
  );
}
