import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/services/users.service';
import { IS_PUBLIC } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/**
 * Guard global: exige `Authorization: Bearer <jwt>` en todas las rutas salvo @Public().
 * Además del token, revisa que el usuario siga existiendo y activo, para que
 * desactivar a un vendedor corte su sesión de inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = BEARER.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Inicia sesión');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(match[1], {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Tu sesión expiró, vuelve a entrar');
    }

    const user = Number.isInteger(payload.sub)
      ? await this.users.findById(payload.sub)
      : null;
    if (!user || !user.active) throw new UnauthorizedException('Inicia sesión');
    request.user = user;
    return true;
  }
}
