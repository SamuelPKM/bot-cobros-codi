import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { pesosToCents } from '../../../shared/money/money';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateSellerDto } from '../dto/create-seller.dto';
import { UpdateSellerDto } from '../dto/update-seller.dto';
import type { PublicUser } from '../interfaces/public-user.interface';
import { toPublicUser } from '../mappers/user.mapper';
import { UsersService } from '../services/users.service';

/** Administración de vendedores. Todo el controlador es solo para el admin. */
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<{ users: PublicUser[] }> {
    return {
      users: (await this.users.list({ role: 'seller' })).map(toPublicUser),
    };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateSellerDto): Promise<{ user: PublicUser }> {
    const user = await this.users.create({
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDto,
  ): Promise<{ user: PublicUser }> {
    const target = await this.users.findById(id);
    if (!target || target.role !== 'seller')
      throw new NotFoundException('No existe ese vendedor');
    const user = await this.users.update(id, {
      name: dto.name,
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
