import type { Invitation } from '../entities/invitation.entity';
import type { PublicInvitation } from '../interfaces/invitation.interfaces';

/** Nunca incluye el token ni su hash. */
export function toPublicInvitation(invitation: Invitation): PublicInvitation {
  return {
    id: invitation.id,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}
