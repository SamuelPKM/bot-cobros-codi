import { NextResponse } from 'next/server';
import { startDemo } from '@/features/demo/services/demo-proxy.service';
import { demoResponse } from '@/features/demo/services/demo-response';

/** Abre una sesión de la demo (la cookie httpOnly la guarda el servidor). */
export async function POST(): Promise<NextResponse> {
  return demoResponse(await startDemo());
}
