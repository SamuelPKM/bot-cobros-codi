import { render, screen, userEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { aCharge } from '../../../../test/fixtures';
import { ApiError } from '@/shared/api/api-client';
import type { PublicAttempt } from '../interfaces/public-charge.interface';
import { ChargeDetail } from './charge-detail';

const attempt = (over: Partial<PublicAttempt>): PublicAttempt => ({
  id: 2,
  kind: 'push',
  status: 'pending',
  expiresAt: null,
  error: null,
  qrString: null,
  linkUrl: null,
  ...over,
});

describe('ChargeDetail', () => {
  it('pendiente: monto, estado y plan B', async () => {
    await render(<ChargeDetail charge={aCharge()} onFallback={jest.fn()} />);
    expect(screen.getByText('$150.00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Estado: Pendiente')).toBeOnTheScreen();
    expect(screen.getByText(/Esperando el pago/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mostrar QR' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Liga de pago' })).toBeOnTheScreen();
  });

  it('pagado: lo dice y ya no ofrece plan B', async () => {
    await render(
      <ChargeDetail
        charge={aCharge({ status: 'paid', paidVia: 'push', paidAt: '2026-12-01T18:07:00Z' })}
        onFallback={jest.fn()}
      />,
    );
    expect(screen.getByText('✅ Pagado')).toBeOnTheScreen();
    expect(screen.getByText('Push al celular · 01/12/2026, 12:07')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mostrar QR' })).not.toBeOnTheScreen();
  });

  it('pide el plan B del mismo cobro', async () => {
    const onFallback = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<ChargeDetail charge={aCharge()} onFallback={onFallback} />);
    await user.press(screen.getByRole('button', { name: 'Mostrar QR' }));
    expect(onFallback).toHaveBeenCalledWith('qr');
  });

  it('si el plan B falla lo explica', async () => {
    const onFallback = jest.fn().mockRejectedValue(new ApiError(409, 'El cobro ya no está pendiente'));
    const user = userEvent.setup();
    await render(<ChargeDetail charge={aCharge()} onFallback={onFallback} />);
    await user.press(screen.getByRole('button', { name: 'Liga de pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El cobro ya no está pendiente');
  });

  it('con QR vigente lo dibuja con su vencimiento', async () => {
    const charge = aCharge({
      attempts: [attempt({ kind: 'qr', qrString: 'codi-qr', expiresAt: '2026-12-01T18:20:00Z' })],
    });
    await render(<ChargeDetail charge={charge} onFallback={jest.fn()} />);
    expect(screen.getByLabelText('Código QR CoDi del cobro')).toBeOnTheScreen();
    expect(screen.getByText('Vence a las 12:20')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mostrar QR' })).not.toBeOnTheScreen();
  });

  it('con liga vigente la comparte', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const user = userEvent.setup();
    const charge = aCharge({
      attempts: [attempt({ kind: 'link', linkUrl: 'https://pay.pey.mx/l/abc' })],
    });
    await render(<ChargeDetail charge={charge} onFallback={jest.fn()} />);

    expect(screen.getByText('https://pay.pey.mx/l/abc')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Compartir liga' }));
    expect(share).toHaveBeenCalledWith({
      message: 'Paga $150.00 (corte) aquí: https://pay.pey.mx/l/abc',
    });
  });

  it('muestra por qué falló un intento', async () => {
    const charge = aCharge({
      attempts: [attempt({ status: 'failed', error: 'El celular no tiene CoDi activo' })],
    });
    await render(<ChargeDetail charge={charge} onFallback={jest.fn()} />);
    expect(screen.getByText(/El celular no tiene CoDi activo/)).toBeOnTheScreen();
  });
});
