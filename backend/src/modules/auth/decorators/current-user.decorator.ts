import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity';

/** El usuario autenticado que dejó JwtAuthGuard en la petición. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<{ user: User }>().user,
);
