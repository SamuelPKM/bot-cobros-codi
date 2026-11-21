import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import type { MemberState } from '../actions/members.action';

const updateMember = vi.fn<(s: MemberState, d: FormData) => Promise<MemberState>>();
vi.mock('../actions/members.action', () => ({
  updateMember: (s: MemberState, d: FormData) => updateMember(s, d),
}));

const { MemberEditForm } = await import('./member-edit-form');

const leo: PublicUser = {
  id: 5,
  businessId: 1,
  username: 'leo',
  name: 'Leo',
  role: 'seller',
  active: true,
  maxAmount: 300,
};

describe('MemberEditForm', () => {
  it('llega con los datos actuales de la persona', () => {
    render(<MemberEditForm member={leo} />);
    expect(screen.getByLabelText('Nombre')).toHaveValue('Leo');
    expect(screen.getByLabelText('Rol')).toHaveValue('seller');
    expect(screen.getByLabelText('Puede cobrar (activa)')).toBeChecked();
    expect(screen.getByLabelText(/Tope por cobro/)).toHaveValue('300');
    expect(screen.getByLabelText(/Contraseña nueva/)).toHaveValue('');
  });

  it('envía los cambios y confirma', async () => {
    updateMember.mockResolvedValue({ notice: 'Listo, guardado.' });
    render(<MemberEditForm member={leo} />);
    await userEvent.click(screen.getByLabelText('Puede cobrar (activa)'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar a Leo' }));

    const sent = updateMember.mock.calls[0][1];
    expect(sent.get('userId')).toBe('5');
    expect(sent.get('active')).toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent('Listo, guardado.');
  });
});
