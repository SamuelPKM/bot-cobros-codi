import { NextResponse, type NextRequest } from 'next/server';
import { demoMessages, sendDemoMessage } from '@/features/demo/services/demo-proxy.service';
import { demoResponse } from '@/features/demo/services/demo-response';

const afterOf = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** Mensajes nuevos de la sesión (el chat pregunta cada 3 s). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return demoResponse(await demoMessages(afterOf(request.nextUrl.searchParams.get('after'))));
}

/** Manda un mensaje: { text, after }. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { text?: unknown; after?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text : '';
  return demoResponse(await sendDemoMessage(text, afterOf(body?.after)));
}
