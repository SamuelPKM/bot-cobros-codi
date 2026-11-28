import type { ApiRequest } from '@/shared/api/api-client';

export interface BusinessHeaderData {
  name: string;
  /** null si el negocio no tiene logo. */
  logoVersion: string | null;
}

/** Nombre y logo del negocio; el resumen de la API los trae para cualquier rol. */
export async function getBusinessHeader(request: ApiRequest): Promise<BusinessHeaderData> {
  const overview = await request<{ businessName: string; logoVersion: string | null }>('/reports/overview?days=7');
  return { name: overview.businessName, logoVersion: overview.logoVersion };
}
