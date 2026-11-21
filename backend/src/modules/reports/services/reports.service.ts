import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { centsToPesos } from '../../../shared/money/money';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import {
  CSV_HEADERS,
  MAX_EXPORT_DAYS,
  REPORT_TIME_ZONE,
} from '../constants/reports.constants';
import type {
  ChargesExport,
  DailySummary,
  PersonSummary,
} from '../interfaces/report.interfaces';
import { toCsv } from '../policies/csv.policy';

interface StatusRow {
  seller_id: number;
  status: string;
  count: string;
  cents: string;
}

const DAY_MS = 86_400_000;

/**
 * Reportes de solo lectura sobre los cobros. Todo se limita al negocio de
 * quien pide; un vendedor solo ve lo suyo. Los días se cuentan en la hora de
 * la Ciudad de México.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  async today(user: User): Promise<DailySummary> {
    const date = todayInMexico();
    const rows = await this.dataSource.query<StatusRow[]>(
      `SELECT seller_id, status, count(*) AS count, coalesce(sum(amount_cents), 0) AS cents
         FROM charges
        WHERE business_id = $1
          AND ($2::int IS NULL OR seller_id = $2)
          AND (created_at AT TIME ZONE $3)::date = $4::date
        GROUP BY seller_id, status`,
      [user.businessId, sellerFilter(user), REPORT_TIME_ZONE, date],
    );

    const total = (status: string, field: 'count' | 'cents') =>
      rows
        .filter((r) => r.status === status)
        .reduce((sum, r) => sum + Number(r[field]), 0);

    return {
      date,
      paid: {
        count: total('paid', 'count'),
        amount: centsToPesos(total('paid', 'cents')),
      },
      pending: {
        count: total('pending', 'count'),
        amount: centsToPesos(total('pending', 'cents')),
      },
      expired: { count: total('expired', 'count') },
      byPerson:
        user.role === 'admin'
          ? await this.byPerson(user.businessId, rows)
          : null,
    };
  }

  async exportCharges(
    user: User,
    from?: string,
    to?: string,
  ): Promise<ChargesExport> {
    const range = exportRange(from, to);
    const rows = await this.dataSource.query<
      {
        id: number;
        fecha: string;
        vendedor: string;
        payer_phone: string | null;
        amount_cents: number;
        concept: string | null;
        status: string;
        paid_via: string | null;
        paid_at: string | null;
      }[]
    >(
      `SELECT c.id,
              to_char(c.created_at AT TIME ZONE $3, 'YYYY-MM-DD HH24:MI') AS fecha,
              u.name AS vendedor, c.payer_phone, c.amount_cents, c.concept, c.status, c.paid_via,
              to_char(c.paid_at AT TIME ZONE $3, 'YYYY-MM-DD HH24:MI') AS paid_at
         FROM charges c JOIN users u ON u.id = c.seller_id
        WHERE c.business_id = $1
          AND ($2::int IS NULL OR c.seller_id = $2)
          AND (c.created_at AT TIME ZONE $3)::date BETWEEN $4::date AND $5::date
        ORDER BY c.id`,
      [
        user.businessId,
        sellerFilter(user),
        REPORT_TIME_ZONE,
        range.from,
        range.to,
      ],
    );

    const csv = toCsv(
      CSV_HEADERS,
      rows.map((r) => [
        r.id,
        r.fecha,
        r.vendedor,
        r.payer_phone,
        centsToPesos(r.amount_cents).toFixed(2),
        r.concept,
        r.status,
        r.paid_via,
        r.paid_at,
      ]),
    );
    return { filename: `cobros-${range.from}_${range.to}.csv`, csv };
  }

  /** Cada persona activa del equipo (o inactiva con cobros hoy), la que más cobró primero. */
  private async byPerson(
    businessId: number,
    rows: StatusRow[],
  ): Promise<PersonSummary[]> {
    const team = await this.users.list({ businessId });
    return team
      .filter((u) => u.active || rows.some((r) => r.seller_id === u.id))
      .map((u) => {
        const mine = rows.filter((r) => r.seller_id === u.id);
        const of = (status: string, field: 'count' | 'cents') =>
          mine
            .filter((r) => r.status === status)
            .reduce((sum, r) => sum + Number(r[field]), 0);
        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          paidCount: of('paid', 'count'),
          paidAmount: centsToPesos(of('paid', 'cents')),
          pendingCount: of('pending', 'count'),
        };
      })
      .sort(
        (a, b) =>
          b.paidAmount - a.paidAmount || a.name.localeCompare(b.name, 'es'),
      );
  }
}

/** El vendedor solo ve lo suyo; el admin, todo el negocio (null = sin filtro). */
const sellerFilter = (user: User): number | null =>
  user.role === 'admin' ? null : user.id;

function todayInMexico(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date());
}

/** Valida el rango: fechas reales, `to` >= `from` y como máximo MAX_EXPORT_DAYS días. */
function exportRange(from?: string, to?: string): { from: string; to: string } {
  const start = from ?? to ?? todayInMexico();
  const end = to ?? from ?? todayInMexico();
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const isReal = (value: string, ms: number) =>
    !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(value);
  if (!isReal(start, startMs) || !isReal(end, endMs))
    throw new BadRequestException('Esa fecha no existe');
  if (endMs < startMs)
    throw new BadRequestException('La fecha final es anterior a la inicial');
  if ((endMs - startMs) / DAY_MS + 1 > MAX_EXPORT_DAYS)
    throw new BadRequestException(
      `El rango máximo es de ${MAX_EXPORT_DAYS} días`,
    );
  return { from: start, to: end };
}
