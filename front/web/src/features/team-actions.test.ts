// Server Actions de Equipo: alta, edición e invitaciones (admin), y aceptar una invitación (público).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';
import { createServerMocks, formOf, redirectThrows } from '../../test/mocks/server-mocks';

const m = createServerMocks();
vi.mock('@/features/auth/services/authed-api.service', () => ({
  authedRequest: (...a: unknown[]) => m.authedRequest(...a),
}));
vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...a: unknown[]) => m.apiRequest(...a) }));
vi.mock('@/features/auth/services/session.service', () => ({
  startSession: (...a: unknown[]) => m.startSession(...a),
}));
vi.mock('next/cache', () => ({ refresh: () => m.refresh() }));
vi.mock('next/navigation', () => ({ redirect: redirectThrows }));

const { createSeller, updateMember } = await import('./team/actions/members.action');
const { createInvitation, revokeInvitation } = await import('./invitations/actions/invitations.action');
const { acceptInvitation } = await import('./invitations/actions/accept-invitation.action');

describe('createSeller', () => {
  beforeEach(() => m.reset());

  it('da de alta al vendedor y limpia el formulario', async () => {
    m.authedRequest.mockResolvedValue({ user: { id: 9 } });
    const state = await createSeller(
      {},
      formOf({ name: 'Leo', username: 'leo', password: 'segura-123', maxAmount: '' }),
    );
    expect(m.authedRequest).toHaveBeenCalledWith('/users', {
      method: 'POST',
      body: { name: 'Leo', username: 'leo', password: 'segura-123' },
    });
    expect(state).toEqual({ notice: 'Listo: Leo ya puede entrar con su usuario leo.' });
    expect(m.refresh).toHaveBeenCalled();
  });

  it('usuario ocupado: lo dice y conserva lo escrito (sin contraseña)', async () => {
    m.authedRequest.mockRejectedValue(new ApiError(409, 'Ese usuario ya existe'));
    const state = await createSeller(
      {},
      formOf({ name: 'Leo', username: 'leo', password: 'segura-123', maxAmount: '300' }),
    );
    expect(state).toEqual({
      formError: 'Ese usuario ya existe',
      values: { name: 'Leo', username: 'leo', maxAmount: '300' },
    });
  });
});

describe('updateMember', () => {
  beforeEach(() => m.reset());

  it('guarda los cambios de la persona', async () => {
    m.authedRequest.mockResolvedValue({ user: {} });
    const state = await updateMember(
      {},
      formOf({ userId: '5', name: 'Leo', role: 'admin', active: 'on', maxAmount: '', password: '' }),
    );
    expect(m.authedRequest).toHaveBeenCalledWith('/users/5', {
      method: 'PATCH',
      body: { name: 'Leo', role: 'admin', active: true, maxAmount: null },
    });
    expect(state.notice).toBe('Listo, guardado.');
  });

  it('el negocio no puede quedarse sin admin: lo explica la API', async () => {
    m.authedRequest.mockRejectedValue(
      new ApiError(409, 'El negocio necesita al menos un administrador activo'),
    );
    const state = await updateMember(
      {},
      formOf({ userId: '1', name: 'Ana', role: 'seller', active: 'on', maxAmount: '', password: '' }),
    );
    expect(state.formError).toBe('El negocio necesita al menos un administrador activo');
  });
});

describe('invitaciones', () => {
  beforeEach(() => m.reset());

  it('crea la liga con el rol elegido; la URL se ve solo esta vez', async () => {
    m.authedRequest.mockResolvedValue({
      token: 't0k3n',
      invitation: { id: 3, role: 'seller', expiresAt: '2026-12-08T18:00:00Z', url: 'https://cobrale.test/invitacion/t0k3n' },
    });
    const state = await createInvitation({}, formOf({ role: 'seller' }));
    expect(m.authedRequest).toHaveBeenCalledWith('/invitations', { method: 'POST', body: { role: 'seller' } });
    expect(state).toEqual({
      created: { url: 'https://cobrale.test/invitacion/t0k3n', role: 'seller', expiresAt: '2026-12-08T18:00:00Z' },
    });
    expect(m.refresh).toHaveBeenCalled();
  });

  it('un rol manipulado no se envía', async () => {
    expect((await createInvitation({}, formOf({ role: 'root' }))).formError).toBeDefined();
    expect(m.authedRequest).not.toHaveBeenCalled();
  });

  it('revoca una invitación', async () => {
    m.authedRequest.mockResolvedValue(null);
    await revokeInvitation(formOf({ invitationId: '3' }));
    expect(m.authedRequest).toHaveBeenCalledWith('/invitations/3', { method: 'DELETE' });
    expect(m.refresh).toHaveBeenCalled();
  });
});

describe('acceptInvitation', () => {
  beforeEach(() => m.reset());

  it('crea la cuenta, abre la sesión y entra al panel', async () => {
    m.apiRequest.mockResolvedValue({ accessToken: 'jwt-leo' });
    await expect(
      acceptInvitation('t0k3n', {}, formOf({ name: 'Leo', username: 'leo', password: 'segura-123' })),
    ).rejects.toThrow('NEXT_REDIRECT:/panel');
    expect(m.apiRequest).toHaveBeenCalledWith('/invitations/token/t0k3n/accept', {
      method: 'POST',
      body: { name: 'Leo', username: 'leo', password: 'segura-123' },
    });
    expect(m.startSession).toHaveBeenCalledWith('jwt-leo');
  });

  it('el token va escapado en la URL', async () => {
    m.apiRequest.mockResolvedValue({ accessToken: 'jwt' });
    await acceptInvitation('a/b?c', {}, formOf({ name: 'Leo', username: 'leo', password: 'segura-123' })).catch(
      () => undefined,
    );
    expect(m.apiRequest.mock.calls[0][0]).toBe('/invitations/token/a%2Fb%3Fc/accept');
  });

  it('invitación usada o vencida (410): lo explica', async () => {
    m.apiRequest.mockRejectedValue(new ApiError(410, 'Esta invitación ya se usó'));
    const state = await acceptInvitation(
      't0k3n',
      {},
      formOf({ name: 'Leo', username: 'leo', password: 'segura-123' }),
    );
    expect(state).toEqual({ formError: 'Esta invitación ya se usó', values: { name: 'Leo', username: 'leo' } });
  });
});
