import { centsToPesos } from '../../../shared/money/money';
import type { User } from '../entities/user.entity';
import type { PublicUser } from '../interfaces/public-user.interface';

/** Única salida de un User hacia la API: nunca expone el hash de la contraseña. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    businessId: user.businessId,
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    maxAmount:
      user.maxAmountCents === null ? null : centsToPesos(user.maxAmountCents),
  };
}
