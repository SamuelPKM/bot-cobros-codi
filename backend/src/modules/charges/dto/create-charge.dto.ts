import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { MAX_AMOUNT } from '../../pey/constants/pey.constants';

export class CreateChargeDto {
  /** Celular del cliente: exactamente 10 dígitos, sin +52 ni espacios. */
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El celular debe tener exactamente 10 dígitos',
  })
  phone!: string;

  /** En pesos. */
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto admite máximo 2 decimales' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  @Max(MAX_AMOUNT, { message: 'El monto máximo por cobro es de $1,000,000' })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'El concepto admite máximo 40 caracteres' })
  concept?: string;
}
