import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { pesosToCents } from '../../../shared/money/money';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateSellerDto } from '../dto/create-seller.dto';
import { UpdateSellerDto } from '../dto/update-seller.dto';
import type { User } from '../entities/user.entity';
import type { PublicUser } from '../interfaces/public-user.interface';
import { toPublicUser } from '../mappers/user.mapper';
import { UsersService } from '../services/users.service';

/** El equipo del negocio del admin. Todo el controlador es solo para el admin. */
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Todo el equipo (admins y vendedores), en orden de alta. */
  @Get()
  async list(@CurrentUser() admin: User): Promise<{ users: PublicUser[] }> {
    const team = await this.users.list({ businessId: admin.businessId });
    return { users: team.map(toPublicUser) };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() admin: User,
    @Body() dto: CreateSellerDto,
  ): Promise<{ user: PublicUser }> {
    const user = await this.users.create({
      businessId: admin.businessId,
      username: dto.username,
      name: dto.name,
      role: 'seller',
      password: dto.password,
      maxAmountCents:
        dto.maxAmount === undefined ? null : pesosToCents(dto.maxAmount),
    });
    return { user: toPublicUser(user) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() admin: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDto,
  ): Promise<{ user: PublicUser }> {
    // Alguien de otro negocio responde 404, igual que alguien inexistente.
    const user = await this.users.updateInBusiness(admin.businessId, id, {
      name: dto.name,
      role: dto.role,
      active: dto.active,
      password: dto.password,
      maxAmountCents:
        dto.maxAmount === undefined
          ? undefined
          : dto.maxAmount === null
            ? null
            : pesosToCents(dto.maxAmount),
    });
    return { user: toPublicUser(user) };
  }
}
