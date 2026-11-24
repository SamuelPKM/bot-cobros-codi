import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Env } from '../../../config/env.validation';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { LoginResult } from '../../auth/interfaces/login-result.interface';
import { AuthService } from '../../auth/services/auth.service';
import type { User } from '../../users/entities/user.entity';
import { RegisterBusinessDto } from '../dto/register-business.dto';
import { UpdateBusinessDto } from '../dto/update-business.dto';
import type { PublicBusiness } from '../interfaces/business.interfaces';
import { toPublicBusiness } from '../mappers/business.mapper';
import { BusinessesService } from '../services/businesses.service';

@Controller('businesses')
export class BusinessesController {
  private readonly publicBaseUrl: string | undefined;

  constructor(
    private readonly businesses: BusinessesService,
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.publicBaseUrl = config.get('PUBLIC_BASE_URL', { infer: true });
  }

  /**
   * Registro público: el negocio, su admin y SU API key de pey (validada).
   * Responde con la sesión del admin y la URL de webhook que debe registrar en pey.
   * Limitado a 5 por minuto por IP.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post()
  @HttpCode(201)
  async register(
    @Body() dto: RegisterBusinessDto,
  ): Promise<LoginResult & { business: PublicBusiness }> {
    const { business, admin } = await this.businesses.register(dto);
    const session = await this.auth.issueSession(admin);
    return {
      ...session,
      business: toPublicBusiness(business, this.publicBaseUrl),
    };
  }

  @Roles('admin')
  @Get('me')
  async me(@CurrentUser() admin: User): Promise<{ business: PublicBusiness }> {
    const business = await this.businesses.getWithSecrets(admin.businessId);
    return { business: toPublicBusiness(business, this.publicBaseUrl) };
  }

  @Roles('admin')
  @Patch('me')
  async update(
    @CurrentUser() admin: User,
    @Body() dto: UpdateBusinessDto,
  ): Promise<{ business: PublicBusiness }> {
    const business = await this.businesses.update(admin.businessId, dto);
    return { business: toPublicBusiness(business, this.publicBaseUrl) };
  }
}
