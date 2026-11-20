import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  hashPassword,
  verifyPassword,
} from '../../../shared/security/password';
import { toPublicUser } from '../../users/mappers/user.mapper';
import { UsersService } from '../../users/services/users.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { LoginResult } from '../interfaces/login-result.interface';

const BAD_LOGIN = 'Usuario o contraseña incorrectos';

@Injectable()
export class AuthService {
  /** Hash de una contraseña que nadie conoce: iguala el tiempo de respuesta con usuarios inexistentes. */
  private readonly dummyHash = hashPassword('usuario-inexistente');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.users.findForLogin(username);
    const ok = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !ok) throw new UnauthorizedException(BAD_LOGIN);
    if (!user.active)
      throw new ForbiddenException(
        'Tu cuenta está desactivada. Habla con el administrador',
      );

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      tokenType: 'Bearer',
      accessToken: await this.jwt.signAsync(payload),
      user: toPublicUser(user),
    };
  }
}
