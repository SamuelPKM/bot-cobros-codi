import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CreateInvitationState } from '../actions/invitations.action';

const createInvitation = vi.fn<(s: CreateInvitationState, d: FormData) => Promise<CreateInvitationState>>();
vi.mock('../actions/invitations.action', () => ({
  createInvitation: (s: CreateInvitationState, d: FormData) => createInvitation(s, d),
}));

const { InviteForm } = await import('./invite-form');

describe('InviteForm', () => {
  it('crea la invitación con el rol elegido y muestra la liga para copiarla', async () => {
    createInvitation.mockResolvedValue({
      created: { url: 'https://cobrale.test/invitacion/t0k3n', role: 'admin', expiresAt: '2026-12-08T18:00:00Z' },
    });
    render(<InviteForm />);
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

    expect(createInvitation.mock.calls[0][1].get('role')).toBe('admin');
    expect(await screen.findByText('https://cobrale.test/invitacion/t0k3n')).toBeInTheDocument();
    expect(screen.getByText(/solo se muestra esta vez/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar liga' })).toBeInTheDocument();
  });
});
