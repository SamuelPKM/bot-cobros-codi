import { NextResponse } from 'next/server';
import type { DemoResult } from '../interfaces/demo.interface';

/** Respuesta JSON de los Route Handlers de la demo; nunca se guarda en caché. */
export function demoResponse(result: DemoResult): NextResponse {
  const init = { headers: { 'cache-control': 'no-store' } };
  return result.ok
    ? NextResponse.json({ messages: result.messages }, init)
    : NextResponse.json({ error: result.error }, { ...init, status: result.status });
}
