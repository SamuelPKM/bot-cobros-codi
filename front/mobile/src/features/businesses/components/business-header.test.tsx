import { render, screen, userEvent } from '@testing-library/react-native';
import { BusinessHeader } from './business-header';

const now = new Date(Date.UTC(2026, 11, 1, 16, 0)); // 10:00 en CDMX

describe('BusinessHeader', () => {
  it('muestra saludo, negocio, rol e iniciales', async () => {
    await render(
      <BusinessHeader businessName="Tacos La Esquina" userName="Ana Prueba" role="admin" now={now} onNewCharge={jest.fn()} />,
    );
    expect(screen.getByText('Buenos días, Ana · Martes, 1 de diciembre')).toBeOnTheScreen();
    expect(screen.getByText('Tacos La Esquina')).toBeOnTheScreen();
    expect(screen.getByText('Administrador')).toBeOnTheScreen();
    expect(screen.getByText('TL', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('el vendedor ve su insignia', async () => {
    await render(
      <BusinessHeader businessName="Café" userName="Leo" role="seller" now={now} onNewCharge={jest.fn()} />,
    );
    expect(screen.getByText('Vendedor')).toBeOnTheScreen();
  });

  it('el botón abre un nuevo cobro', async () => {
    const onNewCharge = jest.fn();
    const user = userEvent.setup();
    await render(
      <BusinessHeader businessName="Café" userName="Leo" role="seller" now={now} onNewCharge={onNewCharge} />,
    );
    await user.press(screen.getByRole('button', { name: 'Nuevo cobro' }));
    expect(onNewCharge).toHaveBeenCalledTimes(1);
  });
});
