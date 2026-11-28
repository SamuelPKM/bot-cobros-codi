import { render, screen, userEvent } from '@testing-library/react-native';
import { ApiError } from '@/shared/api/api-client';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('entra con el usuario sin espacios', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Usuario'), ' ana ');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta 1');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).toHaveBeenCalledWith({ username: 'ana', password: 'secreta 1' });
  });

  it('no llama a la API si faltan datos y dice qué falta', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<LoginForm onSubmit={onSubmit} />);

    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe tu usuario')).toBeOnTheScreen();
    expect(screen.getByText('Escribe tu contraseña')).toBeOnTheScreen();
  });

  it('muestra el mensaje de la API y conserva el usuario', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new ApiError(401, 'Usuario o contraseña incorrectos'));
    const user = userEvent.setup();
    await render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Usuario'), 'ana');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos');
    expect(screen.getByLabelText('Usuario')).toHaveDisplayValue('ana');
  });

  it('un error inesperado no enseña detalles técnicos', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('SecureStore: keychain'));
    const user = userEvent.setup();
    await render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Usuario'), 'ana');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Algo salió mal/);
  });

  it('muestra el aviso de sesión terminada', async () => {
    await render(<LoginForm onSubmit={jest.fn()} notice="Tu sesión terminó. Entra de nuevo." />);
    expect(screen.getByText('Tu sesión terminó. Entra de nuevo.')).toBeOnTheScreen();
  });
});
