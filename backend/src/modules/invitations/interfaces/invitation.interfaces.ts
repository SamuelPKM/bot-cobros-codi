import type { Role } from '../../users/types/role.type';

/** Una invitación vigente, como la ve el admin (sin el token). */
export interface PublicInvitation {
  id: number;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

/** Recién creada: la única vez que se ve la liga. */
export interface CreatedInvitation {
  token: string;
  invitation: { id: number; role: Role; expiresAt: string; url: string };
}

/** Lo que ve la persona invitada antes de aceptar. */
export interface InvitationPreview {
  businessName: string;
  role: Role;
  expiresAt: string;
}
