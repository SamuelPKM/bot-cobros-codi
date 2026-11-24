import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../users/entities/user.entity';
import { PushTokenDto } from '../dto/push-token.dto';
import { PushTokensService } from '../services/push-tokens.service';

/** La app registra su token de Expo al iniciar sesión y lo borra al cerrarla. */
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly tokens: PushTokensService) {}

  @Post()
  @HttpCode(204)
  async register(
    @CurrentUser() user: User,
    @Body() dto: PushTokenDto,
  ): Promise<void> {
    await this.tokens.register(user.id, dto.token);
  }

  @Delete()
  @HttpCode(204)
  async unregister(
    @CurrentUser() user: User,
    @Body() dto: PushTokenDto,
  ): Promise<void> {
    await this.tokens.unregister(user.id, dto.token);
  }
}
