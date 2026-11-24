import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MAX_AMOUNT } from '../../pey/constants/pey.constants';
import { CHARGE_METHODS, type ChargeMethod } from '../types/charge.types';

export class CreateChargeDto {
  /**
   * push (por defecto): cobro al celular del cliente.
   * qr: código que el cliente escanea. link: liga que se le reenvía.
   */
  @IsOptional()
  @IsIn(CHARGE_METHODS, { message: 'El método debe ser push, qr o link' })
  method?: ChargeMethod;

  /** Celular del cliente: exactamente 10 dígitos. Obligatorio solo para push. */
  @ValidateIf(
    (dto: CreateChargeDto) =>
      (dto.method ?? 'push') === 'push' || dto.phone !== undefined,
  )
  @IsString({ message: 'Escribe el celular del cliente' })
  @Matches(/^\d{10}$/, {
    message: 'El celular debe tener exactamente 10 dígitos',
  })
  phone?: string;

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
