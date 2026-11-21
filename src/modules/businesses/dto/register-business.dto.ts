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
import {
  API_KEY_MESSAGE,
  BUSINESS_NAME_MAX,
  BUSINESS_NAME_MESSAGE,
} from './business-validation.constants';

/** Registro público de un negocio: su nombre, su admin y SU API key de pey. */
export class RegisterBusinessDto {
  @IsString()
  @Length(1, BUSINESS_NAME_MAX, { message: BUSINESS_NAME_MESSAGE })
  @Matches(/\S/, { message: BUSINESS_NAME_MESSAGE })
  businessName!: string;

  @IsString()
  @Length(1, 80, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  adminName!: string;

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

  /** portal.mipey.mx > Desarrollador > Crear API Key. */
  @IsString()
  @Length(8, 300, { message: API_KEY_MESSAGE })
  @Matches(/^\S+$/, { message: API_KEY_MESSAGE })
  peyApiKey!: string;
}
