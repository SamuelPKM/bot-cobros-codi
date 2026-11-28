import { aCharge } from '../../../../test/fixtures';
import { addFallback, createCharge, getCharge, listCharges } from './charges.api';

describe('charges.api', () => {
  it('listCharges pide los últimos cobros', async () => {
    const request = jest.fn().mockResolvedValue({ charges: [aCharge()] });
    await expect(listCharges(request)).resolves.toEqual([aCharge()]);
    expect(request).toHaveBeenCalledWith('/charges?limit=30');
  });

  it('getCharge pide uno', async () => {
    const request = jest.fn().mockResolvedValue({ charge: aCharge({ id: 9 }) });
    await expect(getCharge(request, 9)).resolves.toMatchObject({ id: 9 });
    expect(request).toHaveBeenCalledWith('/charges/9');
  });

  it('createCharge manda el cobro', async () => {
    const request = jest.fn().mockResolvedValue({ charge: aCharge() });
    const input = { method: 'push' as const, phone: '5512345678', amount: 1 };
    await expect(createCharge(request, input)).resolves.toEqual(aCharge());
    expect(request).toHaveBeenCalledWith('/charges', { method: 'POST', body: input });
  });

  it('addFallback pide QR o liga del mismo cobro', async () => {
    const request = jest.fn().mockResolvedValue({ charge: aCharge(), qr: {} });
    await expect(addFallback(request, 7, 'qr')).resolves.toEqual(aCharge());
    expect(request).toHaveBeenCalledWith('/charges/7/qr', { method: 'POST' });
  });
});
