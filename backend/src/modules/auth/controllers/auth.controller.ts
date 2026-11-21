import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../users/entities/user.entity';
import type { PublicUser } from '../../users/interfaces/public-user.interface';
import { toPublicUser } from '../../users/mappers/user.mapper';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { LoginDto } from '../dto/login.dto';
import { LoginThrottlerGuard } from '../guards/login-throttler.guard';
import type { LoginResult } from '../interfaces/login-result.interface';
import { AuthService } from '../services/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: User): { user: PublicUser } {
    return { user: toPublicUser(user) };
  }
}
