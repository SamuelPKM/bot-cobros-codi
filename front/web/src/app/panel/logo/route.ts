import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError, type BinaryResponse } from '@/shared/api/api-client';

/**
 * El logo del negocio de la sesión. El navegador nunca habla con la API: esta
 * ruta lo pide con la sesión y lo devuelve. Con ?v= (la versión del logo) se
 * guarda en caché para siempre, porque un logo nuevo trae otra versión.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const logo = await authedRequest<BinaryResponse>('/businesses/me/logo', {
      responseType: 'binary',
    });
    const versioned = new URL(request.url).searchParams.has('v');
    return new Response(logo.body, {
      headers: {
        'content-type': logo.contentType,
        'cache-control': versioned ? 'private, max-age=31536000, immutable' : 'private, no-cache',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return new Response('Sin logo', { status: 404 });
    throw error;
  }
}
