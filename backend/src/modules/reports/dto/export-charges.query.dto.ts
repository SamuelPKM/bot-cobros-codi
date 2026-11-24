import { IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_MESSAGE = 'La fecha debe tener la forma AAAA-MM-DD';

/** Rango de fechas (incluye ambos extremos). Por defecto, hoy. */
export class ExportChargesQueryDto {
  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE, { message: DATE_MESSAGE })
  to?: string;
}
