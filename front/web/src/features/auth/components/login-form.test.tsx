import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LoginState } from '../types/login-state.type';

const login = vi.fn<(state: LoginState, data: FormData) => Promise<LoginState>>();
vi.mock('../actions/login.action', () => ({ login: (s: LoginState, d: FormData) => login(s, d) }));

const { LoginForm } = await import('./login-form');

describe('LoginForm', () => {
  it('tiene usuario, contraseña y el botón para entrar', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('manda el formulario a la acción y muestra sus errores', async () => {
    login.mockResolvedValue({
      formError: 'Usuario o contraseña incorrectos',
      username: 'ana',
    });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Usuario'), 'ana');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos');
    const sent = login.mock.calls[0][1];
    expect(sent.get('username')).toBe('ana');
    expect(sent.get('password')).toBe('mala');
    expect(screen.getByLabelText('Usuario')).toHaveValue('ana');
  });

  it('marca el campo con error y lo describe', async () => {
    login.mockResolvedValue({ fieldErrors: { username: 'Escribe tu usuario' } });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const username = await screen.findByLabelText('Usuario');
    expect(await screen.findByText('Escribe tu usuario')).toBeInTheDocument();
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username).toHaveAccessibleDescription('Escribe tu usuario');
  });
});
