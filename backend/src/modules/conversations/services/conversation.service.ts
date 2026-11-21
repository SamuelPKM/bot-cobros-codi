import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PUSH_EXPIRATION_SECONDS,
  QR_EXPIRATION_SECONDS,
} from '../../charges/constants/charges.constants';
import type { Charge } from '../../charges/entities/charge.entity';
import type { PaymentAttempt } from '../../charges/entities/payment-attempt.entity';
import { ChargesService } from '../../charges/services/charges.service';
import { ReportsService } from '../../reports/services/reports.service';
import type { User } from '../../users/entities/user.entity';
import {
  DRAFT_TTL_MINUTES,
  LAST_CHARGE_WINDOW_HOURS,
} from '../constants/conversations.constants';
import { ChargeDraft } from '../entities/charge-draft.entity';
import type { ConversationReply } from '../interfaces/conversation.interfaces';
import { parseMessage, type Command } from '../policies/command.parser';
import { texts } from '../policies/conversation-texts';

/**
 * Motor de conversación, igual para WhatsApp y la demo: traduce cada mensaje
 * de una persona del equipo a una operación de cobros o reportes y responde.
 * No conoce canales; las reglas de cobro viven en ChargesService.
 */
@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(ChargeDraft)
    private readonly drafts: Repository<ChargeDraft>,
    private readonly charges: ChargesService,
    private readonly reports: ReportsService,
  ) {}

  /** @param text null cuando llega algo que no es texto (foto, audio…). */
  async handle(user: User, text: string | null): Promise<ConversationReply[]> {
    if (text === null) return [{ text: texts.onlyText() }];
    try {
      return await this.run(user, parseMessage(text));
    } catch (error) {
      // Reglas de cobro (tope, límite por hora, pey…): se le explican a la persona.
      if (error instanceof HttpException) return [{ text: messageOf(error) }];
      throw error;
    }
  }

  private async run(
    user: User,
    command: Command,
  ): Promise<ConversationReply[]> {
    switch (command.type) {
      case 'help':
        return [{ text: texts.help() }];
      case 'unknown':
        return [{ text: texts.notUnderstood() }];
      case 'invalid':
        return [{ text: command.error }];
      case 'link-account':
        return [{ text: texts.alreadyLinked() }];
      case 'charge':
        await this.drafts.upsert(
          {
            userId: user.id,
            payerPhone: command.payerPhone,
            amountCents: command.amountCents,
            concept: command.concept,
            createdAt: new Date(),
          },
          ['userId'],
        );
        return [{ text: texts.confirmPrompt(command) }];
      case 'confirm':
        return this.confirm(user);
      case 'cancel': {
        const draft = await this.claimDraft(user.id);
        return [
          { text: draft ? texts.cancelled(draft) : texts.nothingToConfirm() },
        ];
      }
      case 'qr':
      case 'link': {
        const { charge, attempt } = await this.charges.createCharge(user, {
          method: command.type,
          payerPhone: null,
          amountCents: command.amountCents,
          concept: command.concept,
        });
        return [shown(charge, attempt!)];
      }
      case 'link-last': {
        const last = await this.charges.findLatestPending(
          user,
          LAST_CHARGE_WINDOW_HOURS,
        );
        if (!last) return [{ text: texts.noPendingCharge() }];
        const { charge, attempt } = await this.charges.showLink(user, last.id);
        return [shown(charge, attempt)];
      }
      case 'summary':
        return [{ text: texts.summary(await this.reports.today(user)) }];
    }
  }

  /** "sí": toma el borrador (y lo borra) en una sola sentencia, así nunca se cobra dos veces. */
  private async confirm(user: User): Promise<ConversationReply[]> {
    const draft = await this.claimDraft(user.id);
    if (!draft) return [{ text: texts.nothingToConfirm() }];
    if (Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MINUTES * 60_000) {
      return [{ text: texts.confirmationExpired() }];
    }

    const charge = await this.charges.createPushCharge(user, {
      method: 'push',
      payerPhone: draft.payerPhone,
      amountCents: draft.amountCents,
      concept: draft.concept,
    });
    const push = charge.attempts?.find((a) => a.kind === 'push');
    if (push?.status === 'failed')
      return [{ text: texts.sendFailed(charge, push.error ?? '') }];
    if (push?.status === 'unknown')
      return [{ text: texts.sendUnknown(charge) }];
    return [{ text: texts.sent(charge, PUSH_EXPIRATION_SECONDS / 60) }];
  }

  private async claimDraft(userId: number): Promise<ChargeDraft | null> {
    const rows = await this.drafts.manager.query<
      {
        payer_phone: string;
        amount_cents: number;
        concept: string | null;
        created_at: Date;
      }[][]
    >(
      `DELETE FROM charge_drafts WHERE user_id = $1 RETURNING payer_phone, amount_cents, concept, created_at`,
      [userId],
    );
    // DELETE ... RETURNING devuelve [filas, cantidad].
    const row = rows[0]?.[0];
    if (!row) return null;
    return Object.assign(new ChargeDraft(), {
      userId,
      payerPhone: row.payer_phone,
      amountCents: row.amount_cents,
      concept: row.concept,
      createdAt: new Date(row.created_at),
    });
  }
}

/** El QR o la liga recién creados, listos para el canal. */
function shown(charge: Charge, attempt: PaymentAttempt): ConversationReply {
  if (attempt.kind === 'qr') {
    return {
      text: texts.qrCaption(charge, QR_EXPIRATION_SECONDS / 60),
      qrString: attempt.qrString!,
    };
  }
  return { text: texts.link(charge, attempt.linkUrl!), url: attempt.linkUrl! };
}

function messageOf(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: string | string[] }).message;
  return Array.isArray(message)
    ? message.join('. ')
    : (message ?? error.message);
}
