import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const authedRequest = vi.fn();
vi.mock('@/features/auth/services/authed-api.service', () => ({
  authedRequest: (...a: unknown[]) => authedRequest(...a),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { createCharge } = await import('./create-charge.action');

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe('createCharge (Server Action)', () => {
  beforeEach(() => {
    authedRequest.mockReset();
  });

  it('crea el cobro y abre su detalle', async () => {
    authedRequest.mockResolvedValue({ charge: { id: 42 } });
    await expect(
      createCharge({}, form({ method: 'push', phone: '5512345678', amount: '150', concept: 'corte' })),
    ).rejects.toThrow('NEXT_REDIRECT:/panel/cobros/42');
    expect(authedRequest).toHaveBeenCalledWith('/charges', {
      method: 'POST',
      body: { method: 'push', phone: '5512345678', amount: 150, concept: 'corte' },
    });
  });

  it('manda la propina a la API junto con el cobro sin propina', async () => {
    authedRequest.mockResolvedValue({ charge: { id: 43 } });
    await expect(
      createCharge({}, form({ method: 'qr', amount: '100', tipOption: '15' })),
    ).rejects.toThrow('NEXT_REDIRECT:/panel/cobros/43');
    expect(authedRequest).toHaveBeenCalledWith('/charges', {
      method: 'POST',
      body: { method: 'qr', amount: 100, tip: 15 },
    });
  });

  it('con errores no cobra y conserva lo escrito', async () => {
    const state = await createCharge({}, form({ method: 'push', phone: '123', amount: '150' }));
    expect(state.fieldErrors).toEqual({ phone: 'El celular debe tener 10 dígitos' });
    expect(state.values).toEqual({ method: 'push', phone: '123', amount: '150', tipOption: '', tip: '', concept: '' });
    expect(authedRequest).not.toHaveBeenCalled();
  });

  it('las reglas de la API (tope, límite por hora, pey) se muestran tal cual', async () => {
    authedRequest.mockRejectedValue(new ApiError(422, 'Tu monto máximo por cobro es de $100.00'));
    const state = await createCharge({}, form({ method: 'qr', amount: '500' }));
    expect(state.formError).toBe('Tu monto máximo por cobro es de $100.00');
  });
});
