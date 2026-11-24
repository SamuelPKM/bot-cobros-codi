import { IsIn, IsOptional } from 'class-validator';
import { ROLE_VALUES, type Role } from '../../users/types/role.type';

export class CreateInvitationDto {
  /** Rol con el que entra quien la acepte. Por defecto, vendedor. */
  @IsOptional()
  @IsIn(ROLE_VALUES, { message: 'El rol debe ser admin o seller' })
  role?: Role;
}
