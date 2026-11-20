import {
  IsBoolean,
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

/** Todos los campos son opcionales; solo cambia lo que viene. */
export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  @Length(1, 80, { message: NAME_MESSAGE })
  @Matches(/\S/, { message: NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** null quita el tope. */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: MAX_AMOUNT_DECIMALS_MESSAGE },
  )
  @IsPositive({ message: POSITIVE_AMOUNT_MESSAGE })
  maxAmount?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE })
  @MaxLength(PASSWORD_MAX, { message: PASSWORD_MESSAGE })
  password?: string;
}
