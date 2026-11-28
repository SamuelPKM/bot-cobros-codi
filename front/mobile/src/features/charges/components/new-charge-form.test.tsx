import { render, screen, userEvent } from '@testing-library/react-native';
import { ApiError } from '@/shared/api/api-client';
import { NewChargeForm } from './new-charge-form';

describe('NewChargeForm', () => {
  it('push por defecto: celular, monto y concepto', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<NewChargeForm onSubmit={onSubmit} />);

    expect(screen.getByRole('radio', { name: 'Push al celular' })).toBeChecked();
    await user.type(screen.getByLabelText('Celular del cliente'), '55 1234 5678');
    await user.type(screen.getByLabelText('Monto'), '0.01');
    await user.type(screen.getByLabelText('Concepto (opcional)'), 'prueba');
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).toHaveBeenCalledWith({
      method: 'push',
      phone: '5512345678',
      amount: 0.01,
      concept: 'prueba',
    });
  });

  it('con QR no pide celular', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<NewChargeForm onSubmit={onSubmit} />);

    await user.press(screen.getByRole('radio', { name: 'QR' }));
    expect(screen.queryByLabelText('Celular del cliente')).not.toBeOnTheScreen();
    await user.type(screen.getByLabelText('Monto'), '80');
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).toHaveBeenCalledWith({ method: 'qr', amount: 80 });
  });

  it('dice qué corregir sin llamar a la API', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<NewChargeForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Celular del cliente'), '123');
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('El celular debe tener 10 dígitos')).toBeOnTheScreen();
    expect(screen.getByText('Escribe el monto en pesos, con máximo 2 decimales')).toBeOnTheScreen();
  });

  it('muestra el error de la API y conserva lo escrito', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new ApiError(422, 'Tu tope por cobro es de $1.00'));
    const user = userEvent.setup();
    await render(<NewChargeForm onSubmit={onSubmit} />);

    await user.press(screen.getByRole('radio', { name: 'Liga de pago' }));
    await user.type(screen.getByLabelText('Monto'), '5');
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu tope por cobro es de $1.00');
    expect(screen.getByLabelText('Monto')).toHaveDisplayValue('5');
  });

  it('no manda dos cobros si se toca dos veces', async () => {
    let finish!: () => void;
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await render(<NewChargeForm onSubmit={onSubmit} />);

    await user.press(screen.getByRole('radio', { name: 'QR' }));
    await user.type(screen.getByLabelText('Monto'), '1');
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));
    await user.press(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish();
  });
});
