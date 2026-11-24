import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { pesosToCents } from '../../../shared/money/money';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../users/entities/user.entity';
import { CreateChargeDto } from '../dto/create-charge.dto';
import { ListChargesQueryDto } from '../dto/list-charges.query.dto';
import type {
  PublicCharge,
  PublicLink,
  PublicQr,
} from '../interfaces/public-charge.interface';
import {
  toPublicCharge,
  toPublicLink,
  toPublicQr,
} from '../mappers/charge.mapper';
import { ChargesService } from '../services/charges.service';

@Controller('charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  /**
   * Cualquiera del equipo cobra (admin o vendedor). Con `method` push (por
   * defecto) manda el cobro al celular; con qr o link devuelve el QR o la liga.
   */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateChargeDto,
  ): Promise<{ charge: PublicCharge; qr?: PublicQr; link?: PublicLink }> {
    const { charge, attempt } = await this.charges.createCharge(user, {
      method: dto.method ?? 'push',
      payerPhone: dto.phone ?? null,
      amountCents: pesosToCents(dto.amount),
      concept: dto.concept?.trim() || null,
    });
    return {
      charge: toPublicCharge(charge),
      ...(attempt?.kind === 'qr' ? { qr: toPublicQr(attempt) } : {}),
      ...(attempt?.kind === 'link' ? { link: toPublicLink(attempt) } : {}),
    };
  }

  /** Plan B: QR del mismo cobro para que el cliente lo escanee. */
  @Post(':id/qr')
  @HttpCode(201)
  async showQr(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ charge: PublicCharge; qr: PublicQr }> {
    const { charge, attempt } = await this.charges.showQr(user, id);
    return { charge: toPublicCharge(charge), qr: toPublicQr(attempt) };
  }

  /** Plan B: liga de pago del mismo cobro para reenviarla por cualquier medio. */
  @Post(':id/link')
  @HttpCode(201)
  async showLink(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ charge: PublicCharge; link: PublicLink }> {
    const { charge, attempt } = await this.charges.showLink(user, id);
    return { charge: toPublicCharge(charge), link: toPublicLink(attempt) };
  }

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query() query: ListChargesQueryDto,
  ): Promise<{ charges: PublicCharge[] }> {
    const charges = await this.charges.list(user, query);
    return { charges: charges.map(toPublicCharge) };
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ charge: PublicCharge }> {
    return { charge: toPublicCharge(await this.charges.findVisible(user, id)) };
  }
}
