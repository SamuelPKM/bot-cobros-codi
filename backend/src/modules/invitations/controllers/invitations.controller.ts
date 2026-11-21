import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { LoginResult } from '../../auth/interfaces/login-result.interface';
import { AuthService } from '../../auth/services/auth.service';
import type { User } from '../../users/entities/user.entity';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import type {
  CreatedInvitation,
  InvitationPreview,
  PublicInvitation,
} from '../interfaces/invitation.interfaces';
import { toPublicInvitation } from '../mappers/invitation.mapper';
import { InvitationsService } from '../services/invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly auth: AuthService,
  ) {}

  /** El admin genera una liga de un solo uso. El token solo se ve en esta respuesta. */
  @Roles('admin')
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() admin: User,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreatedInvitation> {
    return this.invitations.create(admin, dto.role);
  }

  @Roles('admin')
  @Get()
  async list(
    @CurrentUser() admin: User,
  ): Promise<{ invitations: PublicInvitation[] }> {
    const pending = await this.invitations.listPending(admin.businessId);
    return { invitations: pending.map(toPublicInvitation) };
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @CurrentUser() admin: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.invitations.revoke(admin.businessId, id);
  }

  /** Público: la pantalla del frontend muestra a qué negocio invitan. */
  @Public()
  @Get('token/:token')
  async preview(
    @Param('token') token: string,
  ): Promise<{ invitation: InvitationPreview }> {
    return { invitation: await this.invitations.preview(token) };
  }

  /** Público, 5 por minuto por IP: crea la cuenta y abre sesión. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('token/:token/accept')
  @HttpCode(201)
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<LoginResult> {
    const user = await this.invitations.accept(token, dto);
    return this.auth.issueSession(user);
  }
}
