import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NAME_MESSAGE,
  PASSWORD_MAX,
  PASSWORD_MESSAGE,
  PASSWORD_MIN,
} from '../../users/dto/seller-validation.constants';

/** La persona invitada elige su nombre, usuario y contraseña. El rol lo pone la invitación. */
export class AcceptInvitationDto {
  @IsString()
  @Length(1, 80, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,30}$/, {
    message:
      'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
  })
  username!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE })
  @MaxLength(PASSWORD_MAX, { message: PASSWORD_MESSAGE })
  password!: string;
}
