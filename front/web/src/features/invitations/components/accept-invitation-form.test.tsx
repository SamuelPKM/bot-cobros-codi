import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AcceptState } from '../actions/accept-invitation.action';

const acceptInvitation = vi.fn<(t: string, s: AcceptState, d: FormData) => Promise<AcceptState>>();
vi.mock('../actions/accept-invitation.action', () => ({
  acceptInvitation: (t: string, s: AcceptState, d: FormData) => acceptInvitation(t, s, d),
}));

const { AcceptInvitationForm } = await import('./accept-invitation-form');

describe('AcceptInvitationForm', () => {
  it('manda los datos con el token de la invitación', async () => {
    acceptInvitation.mockResolvedValue({ formError: 'Esta invitación ya se usó', values: { name: 'Leo', username: 'leo' } });
    render(<AcceptInvitationForm token="t0k3n" />);
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Leo');
    await userEvent.type(screen.getByLabelText('Usuario'), 'leo');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'segura-123');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme al equipo' }));

    expect(acceptInvitation.mock.calls[0][0]).toBe('t0k3n');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta invitación ya se usó');
    expect(screen.getByLabelText('Usuario')).toHaveValue('leo');
  });
});
