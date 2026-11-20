import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import type { UsersService } from '../../users/services/users.service';
import type { User } from '../../users/entities/user.entity';

const SECRET = 'secreto-de-pruebas-de-al-menos-32-caracteres';

class PublicController {
  @Public()
  open() {}
  closed() {}
}

function contextFor(handler: keyof PublicController, authorization?: string) {
  const request: { headers: Record<string, string>; user?: User } = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    getHandler: () => PublicController.prototype[handler],
    getClass: () => PublicController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: '1h' },
  });
  const ana = { id: 7, username: 'ana', role: 'seller', active: true } as User;
  let users: { findById: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    users = { findById: jest.fn().mockResolvedValue(ana) };
    guard = new JwtAuthGuard(
      jwt,
      new Reflector(),
      users as unknown as UsersService,
    );
  });

  it('deja pasar las rutas marcadas con @Public() sin token', async () => {
    await expect(guard.canActivate(contextFor('open').context)).resolves.toBe(
      true,
    );
  });

  it('rechaza una ruta protegida sin token', async () => {
    await expect(
      guard.canActivate(contextFor('closed').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un header que no es Bearer', async () => {
    const token = await jwt.signAsync({ sub: 7, role: 'seller' });
    await expect(
      guard.canActivate(contextFor('closed', `Basic ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta un Bearer válido y deja al usuario en la petición', async () => {
    const token = await jwt.signAsync({ sub: 7, role: 'seller' });
    const { context, request } = contextFor('closed', `Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith(7);
    expect(request.user).toBe(ana);
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const other = new JwtService({ secret: `${SECRET}-otro` });
    const token = await other.signAsync({ sub: 7, role: 'admin' });
    await expect(
      guard.canActivate(contextFor('closed', `Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token vencido', async () => {
    const token = await jwt.signAsync(
      { sub: 7, role: 'seller' },
      { expiresIn: -10 },
    );
    await expect(
      guard.canActivate(contextFor('closed', `Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token "alg: none"', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 7, role: 'admin' }),
    ).toString('base64url');
    await expect(
      guard.canActivate(
        contextFor('closed', `Bearer ${header}.${body}.`).context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el token de un usuario desactivado o borrado', async () => {
    const token = await jwt.signAsync({ sub: 7, role: 'seller' });
    users.findById.mockResolvedValueOnce({ ...ana, active: false });
    await expect(
      guard.canActivate(contextFor('closed', `Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    users.findById.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(contextFor('closed', `Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
