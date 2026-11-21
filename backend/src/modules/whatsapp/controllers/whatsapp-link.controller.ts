import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { formatPhone } from '../../conversations/policies/conversation-texts';
import type { User } from '../../users/entities/user.entity';
import type {
  LinkCodeView,
  WhatsAppLinkView,
} from '../interfaces/whatsapp.interfaces';
import { WhatsAppAccountsService } from '../services/whatsapp-accounts.service';

/** Cualquier persona del equipo liga su propio WhatsApp (pantalla Ajustes de la web). */
@Controller('me/whatsapp')
export class WhatsAppLinkController {
  constructor(private readonly accounts: WhatsAppAccountsService) {}

  @Get()
  async status(@CurrentUser() user: User): Promise<WhatsAppLinkView> {
    const phone = await this.accounts.phoneOf(user.id);
    return phone
      ? { linked: true, phone: formatPhone(phone) }
      : { linked: false };
  }

  /** El código se muestra una sola vez; se manda por WhatsApp como "vincular 123456". */
  @Post('link-code')
  async linkCode(@CurrentUser() user: User): Promise<LinkCodeView> {
    const { code, expiresAt } = await this.accounts.createLinkCode(user.id);
    return {
      code,
      message: `vincular ${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Delete()
  @HttpCode(204)
  async unlink(@CurrentUser() user: User): Promise<void> {
    await this.accounts.unlink(user.id);
  }
}
