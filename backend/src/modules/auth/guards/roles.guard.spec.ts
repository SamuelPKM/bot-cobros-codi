import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';
import type { User } from '../../users/entities/user.entity';

class Controller {
  @Roles('admin')
  adminOnly() {}
  anyone() {}
}

function contextFor(handler: keyof Controller, user?: Partial<User>) {
  return {
    getHandler: () => Controller.prototype[handler],
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deja pasar rutas sin @Roles()', () => {
    expect(guard.canActivate(contextFor('anyone', { role: 'seller' }))).toBe(
      true,
    );
  });

  it('deja pasar al rol requerido', () => {
    expect(guard.canActivate(contextFor('adminOnly', { role: 'admin' }))).toBe(
      true,
    );
  });

  it('responde 403 a otro rol o sin usuario', () => {
    expect(() =>
      guard.canActivate(contextFor('adminOnly', { role: 'seller' })),
    ).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('adminOnly'))).toThrow(
      ForbiddenException,
    );
  });
});
