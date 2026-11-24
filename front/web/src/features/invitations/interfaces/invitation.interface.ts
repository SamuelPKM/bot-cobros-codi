import type { Role } from '@/shared/interfaces/public-user.interface';

/** Invitación vigente, como la ve el admin (sin el token). */
export interface PublicInvitation {
  id: number;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

/** POST /invitations: la única vez que se ve la liga. */
export interface CreatedInvitation {
  token: string;
  invitation: { id: number; role: Role; expiresAt: string; url: string };
}

/** GET /invitations/token/:token (público): lo que ve la persona invitada. */
export interface InvitationPreview {
  businessName: string;
  role: Role;
  expiresAt: string;
}
