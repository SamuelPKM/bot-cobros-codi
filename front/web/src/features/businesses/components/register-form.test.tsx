import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RegisterState } from '../actions/register.action';

const registerBusiness = vi.fn<(s: RegisterState, d: FormData) => Promise<RegisterState>>();
vi.mock('../actions/register.action', () => ({
  registerBusiness: (s: RegisterState, d: FormData) => registerBusiness(s, d),
}));

const { RegisterForm } = await import('./register-form');

describe('RegisterForm', () => {
  it('pide negocio, admin, usuario, contraseña y la API key de pey', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText('Nombre del negocio')).toHaveAttribute('maxlength', '30');
    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('API key de pey')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/portal\.mipey\.mx/)).toBeInTheDocument();
  });

  it('muestra el rechazo de la API sin borrar los datos del negocio', async () => {
    registerBusiness.mockResolvedValue({
      formError: 'La API key de pey no es válida',
      values: { businessName: 'Tacos Ana', adminName: 'Ana', username: 'ana' },
    });
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText('Nombre del negocio'), 'Tacos Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La API key de pey no es válida');
    expect(screen.getByLabelText('Nombre del negocio')).toHaveValue('Tacos Ana');
    expect(screen.getByLabelText('Usuario')).toHaveValue('ana');
  });
});
