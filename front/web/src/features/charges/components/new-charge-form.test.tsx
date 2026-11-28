import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NewChargeState } from '../actions/create-charge.action';

const createCharge = vi.fn<(s: NewChargeState, d: FormData) => Promise<NewChargeState>>();
vi.mock('../actions/create-charge.action', () => ({
  createCharge: (s: NewChargeState, d: FormData) => createCharge(s, d),
}));

const { NewChargeForm } = await import('./new-charge-form');

describe('NewChargeForm', () => {
  it('por defecto cobra por push y pide el celular', () => {
    render(<NewChargeForm />);
    expect(screen.getByRole('radio', { name: /Push al celular/ })).toBeChecked();
    expect(screen.getByLabelText('Celular del cliente')).toHaveAttribute('inputmode', 'tel');
    expect(screen.getByLabelText('Monto (pesos)')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeEnabled();
  });

  it('con QR o liga ya no pide el celular', async () => {
    render(<NewChargeForm />);
    await userEvent.click(screen.getByRole('radio', { name: /QR/ }));
    expect(screen.queryByLabelText('Celular del cliente')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Liga de pago/ }));
    expect(screen.queryByLabelText('Celular del cliente')).not.toBeInTheDocument();
  });

  it('muestra los errores y conserva lo escrito', async () => {
    createCharge.mockResolvedValue({
      fieldErrors: { phone: 'El celular debe tener 10 dígitos' },
      formError: undefined,
      values: { method: 'push', phone: '123', amount: '150', concept: 'corte' },
    });
    render(<NewChargeForm />);
    await userEvent.type(screen.getByLabelText('Celular del cliente'), '123');
    await userEvent.type(screen.getByLabelText('Monto (pesos)'), '150');
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    expect(await screen.findByText('El celular debe tener 10 dígitos')).toBeInTheDocument();
    expect(screen.getByLabelText('Celular del cliente')).toHaveValue('123');
    expect(screen.getByLabelText('Monto (pesos)')).toHaveValue('150');
    expect(screen.getByLabelText(/Concepto/)).toHaveValue('corte');
  });

  it('propina: por defecto sin propina y el total en vivo', async () => {
    render(<NewChargeForm />);
    const group = screen.getByRole('radiogroup', { name: 'Propina' });
    expect(within(group).getByRole('radio', { name: 'Sin propina' })).toBeChecked();
    expect(screen.queryByLabelText('Propina (pesos)')).not.toBeInTheDocument();
    expect(screen.queryByText(/Total a cobrar/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Monto (pesos)'), '100');
    expect(screen.getByText('Total a cobrar: $100.00')).toBeInTheDocument();

    await userEvent.click(within(group).getByRole('radio', { name: '15%' }));
    expect(screen.getByText('Total a cobrar: $115.00')).toBeInTheDocument();
    expect(screen.getByText('Cobro $100.00 + propina $15.00')).toBeInTheDocument();
  });

  it('propina: con Otra aparece el campo en pesos', async () => {
    render(<NewChargeForm />);
    await userEvent.type(screen.getByLabelText('Monto (pesos)'), '100');
    await userEvent.click(screen.getByRole('radio', { name: 'Otra' }));
    await userEvent.type(screen.getByLabelText('Propina (pesos)'), '7.50');
    expect(screen.getByText('Total a cobrar: $107.50')).toBeInTheDocument();
  });

  it('propina: tras un error conserva la opción elegida', async () => {
    createCharge.mockResolvedValue({
      formError: 'Algo falló',
      values: { method: 'qr', amount: '100', tipOption: 'custom', tip: '5' },
    });
    render(<NewChargeForm />);
    await userEvent.type(screen.getByLabelText('Monto (pesos)'), '100');
    await userEvent.click(screen.getByRole('radio', { name: 'Otra' }));
    await userEvent.type(screen.getByLabelText('Propina (pesos)'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Otra' })).toBeChecked();
    expect(screen.getByLabelText('Propina (pesos)')).toHaveValue('5');
  });

  it('un error de la API aparece como alerta', async () => {
    createCharge.mockResolvedValue({ formError: 'Tu monto máximo por cobro es de $100.00', values: { method: 'qr', amount: '500' } });
    render(<NewChargeForm />);
    await userEvent.click(screen.getByRole('radio', { name: /QR/ }));
    await userEvent.type(screen.getByLabelText('Monto (pesos)'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu monto máximo');
    expect(screen.getByRole('radio', { name: /QR/ })).toBeChecked();
  });
});
