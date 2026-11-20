import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MAX_AMOUNT_DECIMALS_MESSAGE,
  NAME_MESSAGE,
  PASSWORD_MAX,
  PASSWORD_MESSAGE,
  PASSWORD_MIN,
  POSITIVE_AMOUNT_MESSAGE,
} from './seller-validation.constants';

export class CreateSellerDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,30}$/, {
    message:
      'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
  })
  username!: string;

  @IsString()
  @Length(1, 80, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE })
  @MaxLength(PASSWORD_MAX, { message: PASSWORD_MESSAGE })
  password!: string;

  /** Tope por cobro en pesos. */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: MAX_AMOUNT_DECIMALS_MESSAGE },
  )
  @IsPositive({ message: POSITIVE_AMOUNT_MESSAGE })
  maxAmount?: number;
}
