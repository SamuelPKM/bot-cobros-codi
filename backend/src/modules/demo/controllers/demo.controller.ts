import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Ip,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { DemoMessageDto } from '../dto/demo-message.dto';
import type { DemoInfo, DemoMessageView } from '../interfaces/demo.interfaces';
import { DemoService } from '../services/demo.service';

/**
 * Demo pública (la pantalla vive en frontend/). Sin cuenta: la sesión viaja en
 * el header X-Demo-Session. 404 si la demo está apagada (sin DEMO_BUSINESS_ID).
 */
@Public()
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  info(): Promise<DemoInfo> {
    return this.demo.info();
  }

  @Post('sessions')
  @Header('Cache-Control', 'no-store')
  createSession(
    @Ip() ip: string,
  ): Promise<{ sessionId: string; messages: DemoMessageView[] }> {
    return this.demo.createSession(ip);
  }

  @Get('messages')
  @Header('Cache-Control', 'no-store')
  async messages(
    @Headers('x-demo-session') session: string | undefined,
    @Query('after') after?: string,
  ): Promise<{ messages: DemoMessageView[] }> {
    const n = Number(after);
    return {
      messages: await this.demo.messages(
        session,
        Number.isInteger(n) && n > 0 ? n : 0,
      ),
    };
  }

  @Post('messages')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async send(
    @Headers('x-demo-session') session: string | undefined,
    @Body() dto: DemoMessageDto,
  ): Promise<{ messages: DemoMessageView[] }> {
    return {
      messages: await this.demo.send(session, dto.text, dto.after),
    };
  }
}
