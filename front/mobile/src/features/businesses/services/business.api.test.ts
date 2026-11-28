import { getBusinessHeader } from './business.api';

describe('getBusinessHeader', () => {
  it('pide el resumen de 7 días y devuelve nombre y versión del logo', async () => {
    const request = jest.fn().mockResolvedValue({ businessName: 'Tacos La Esquina', logoVersion: '123', otros: 1 });
    await expect(getBusinessHeader(request)).resolves.toEqual({ name: 'Tacos La Esquina', logoVersion: '123' });
    expect(request).toHaveBeenCalledWith('/reports/overview?days=7');
  });

  it('un negocio sin logo trae logoVersion nulo', async () => {
    const request = jest.fn().mockResolvedValue({ businessName: 'Café', logoVersion: null });
    await expect(getBusinessHeader(request)).resolves.toEqual({ name: 'Café', logoVersion: null });
  });
});
