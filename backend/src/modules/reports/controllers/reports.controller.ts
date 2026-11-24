import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../users/entities/user.entity';
import { ExportChargesQueryDto } from '../dto/export-charges.query.dto';
import type { DailySummary } from '../interfaces/report.interfaces';
import { ReportsService } from '../services/reports.service';

/** Reportes para el admin (todo el negocio) y el vendedor (lo suyo). Solo datos, sin pantallas. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Corte de hoy (hora de la Ciudad de México). */
  @Get('today')
  today(@CurrentUser() user: User): Promise<DailySummary> {
    return this.reports.today(user);
  }

  /** Cobros en CSV, para Excel o la contabilidad. */
  @Get('charges.csv')
  async exportCharges(
    @CurrentUser() user: User,
    @Query() query: ExportChargesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, csv } = await this.reports.exportCharges(
      user,
      query.from,
      query.to,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }
}
