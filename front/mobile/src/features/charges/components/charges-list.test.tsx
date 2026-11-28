import { render, screen, userEvent } from '@testing-library/react-native';
import { aCharge } from '../../../../test/fixtures';
import { ChargesList } from './charges-list';

describe('ChargesList', () => {
  it('muestra monto, estado, concepto y hora; abre el cobro al tocarlo', async () => {
    const onOpen = jest.fn();
    const user = userEvent.setup();
    await render(
      <ChargesList
        charges={[aCharge(), aCharge({ id: 8, status: 'paid', amount: 0.01, concept: null })]}
        onOpen={onOpen}
      />,
    );

    const first = screen.getByRole('button', { name: /\$150\.00.*Pendiente/ });
    expect(first).toHaveTextContent(/corte/);
    expect(first).toHaveTextContent(/12:05/);
    expect(screen.getByRole('button', { name: /\$0\.01.*Pagado/ })).toBeOnTheScreen();

    await user.press(first);
    expect(onOpen).toHaveBeenCalledWith(7);
  });

  it('con propina la muestra en los detalles y en la etiqueta', async () => {
    await render(
      <ChargesList charges={[aCharge({ amount: 115, subtotal: 100, tip: 15 })]} onOpen={jest.fn()} />,
    );
    const row = screen.getByRole('button', { name: /\$115\.00.*propina \$15\.00/ });
    expect(row).toHaveTextContent(/propina \$15\.00/);
  });

  it('el admin ve quién cobró', async () => {
    await render(<ChargesList charges={[aCharge()]} onOpen={jest.fn()} showSeller />);
    expect(screen.getByText(/Ana Prueba/)).toBeOnTheScreen();
  });

  it('sin cobros lo dice', async () => {
    await render(<ChargesList charges={[]} onOpen={jest.fn()} />);
    expect(screen.getByText('Todavía no hay cobros.')).toBeOnTheScreen();
  });
});
