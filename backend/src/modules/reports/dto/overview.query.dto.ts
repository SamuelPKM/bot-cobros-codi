import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { OVERVIEW_DAYS } from '../constants/reports.constants';

/** Largo del periodo del resumen. Por defecto, 7 días. */
export class OverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([...OVERVIEW_DAYS], {
    message: `days debe ser ${OVERVIEW_DAYS.join(', ')}`,
  })
  days?: (typeof OVERVIEW_DAYS)[number];
}
