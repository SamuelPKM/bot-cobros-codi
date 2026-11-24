import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
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
import type { Business } from '../entities/business.entity';
import { toPublicBusiness } from '../mappers/business.mapper';
import { MAX_LOGO_BYTES } from '../policies/logo-image.policy';
import { BusinessLogoService } from '../services/business-logo.service';
import { BusinessesService } from '../services/businesses.service';

@Controller('businesses')
export class BusinessesController {
  private readonly publicBaseUrl: string | undefined;

  constructor(
    private readonly businesses: BusinessesService,
    private readonly auth: AuthService,
    private readonly logos: BusinessLogoService,
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
    return { ...session, business: this.toPublic(business) };
  }

  @Roles('admin')
  @Get('me')
  async me(@CurrentUser() admin: User): Promise<{ business: PublicBusiness }> {
    const business = await this.businesses.getWithSecrets(admin.businessId);
    return { business: this.toPublic(business) };
  }

  @Roles('admin')
  @Patch('me')
  async update(
    @CurrentUser() admin: User,
    @Body() dto: UpdateBusinessDto,
  ): Promise<{ business: PublicBusiness }> {
    const business = await this.businesses.update(admin.businessId, dto);
    return { business: this.toPublic(business) };
  }

  /**
   * Sube o cambia el logo (campo `logo`, PNG/JPG/WebP de máximo 1 MB). El
   * servicio revisa el contenido y el tope de 1 MB (con mensaje en español);
   * el límite de aquí, el doble, solo evita leer archivos enormes.
   */
  @Roles('admin')
  @Post('me/logo')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 2 * MAX_LOGO_BYTES, files: 1, fields: 0 },
    }),
  )
  async uploadLogo(
    @CurrentUser() admin: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ logoVersion: string }> {
    return {
      logoVersion: await this.logos.set(admin.businessId, file?.buffer),
    };
  }

  @Roles('admin')
  @Delete('me/logo')
  @HttpCode(204)
  async removeLogo(@CurrentUser() admin: User): Promise<void> {
    await this.logos.remove(admin.businessId);
  }

  /** El logo del negocio de quien pide (cualquier rol). 404 si no tiene. */
  @Get('me/logo')
  async logo(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const logo = await this.logos.get(user.businessId);
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(logo.body);
  }

  private toPublic(business: Business): PublicBusiness {
    return toPublicBusiness(business, this.publicBaseUrl, this.logos.enabled);
  }
}
