import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from '../constants/charges.constants';
import { CHARGE_STATUSES, type ChargeStatus } from '../types/charge.types';

export class ListChargesQueryDto {
  /** Solo para el admin; a un vendedor siempre se le muestran los suyos. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;

  @IsOptional()
  @IsIn(CHARGE_STATUSES)
  status?: ChargeStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}
