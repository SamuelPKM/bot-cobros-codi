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
import { Roles } from '../../auth/decorators/roles.decorator';
import type { User } from '../../users/entities/user.entity';
import { CreateChargeDto } from '../dto/create-charge.dto';
import { ListChargesQueryDto } from '../dto/list-charges.query.dto';
import type {
  PublicCharge,
  PublicQr,
} from '../interfaces/public-charge.interface';
import { toPublicCharge, toPublicQr } from '../mappers/charge.mapper';
import { ChargesService } from '../services/charges.service';

@Controller('charges')
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  /** El vendedor cobra: crea el cobro y manda el push CoDi. */
  @Roles('seller')
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() seller: User,
    @Body() dto: CreateChargeDto,
  ): Promise<{ charge: PublicCharge }> {
    const charge = await this.charges.createPushCharge(seller, {
      payerPhone: dto.phone,
      amountCents: pesosToCents(dto.amount),
      concept: dto.concept?.trim() || null,
    });
    return { charge: toPublicCharge(charge) };
  }

  /** Plan B: QR del mismo cobro para que el cliente lo escanee. */
  @Roles('seller')
  @Post(':id/qr')
  @HttpCode(201)
  async showQr(
    @CurrentUser() seller: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ charge: PublicCharge; qr: PublicQr }> {
    const { charge, attempt } = await this.charges.showQr(seller, id);
    return { charge: toPublicCharge(charge), qr: toPublicQr(attempt) };
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
