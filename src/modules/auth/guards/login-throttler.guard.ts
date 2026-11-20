import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Límite de intentos de login por IP + usuario: frena la fuerza bruta contra
 * una cuenta sin bloquear a los demás vendedores que comparten la red del negocio.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    ip?: string;
    body?: { username?: unknown };
  }): Promise<string> {
    const username =
      typeof req.body?.username === 'string'
        ? req.body.username.trim().toLowerCase()
        : '';
    return Promise.resolve(`${req.ip ?? 'sin-ip'}:${username}`);
  }
}
