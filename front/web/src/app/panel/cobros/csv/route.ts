import type { NextRequest } from 'next/server';
import { parseCsvRange } from '@/features/reports/policies/csv-range.policy';
import { exportChargesCsv } from '@/features/reports/services/reports.service';
import { ApiError } from '@/shared/api/api-client';

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** Descarga el CSV de cobros con la sesión del panel (sin sesión, a Entrar). */
export async function GET(request: NextRequest): Promise<Response> {
  const range = parseCsvRange(request.nextUrl.searchParams);
  if (!range.ok) return text(range.error, 400);
  try {
    const csv = await exportChargesCsv(range.query);    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${range.filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return text(error.message, error.status);
    throw error;
  }
}
