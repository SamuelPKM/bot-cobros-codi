import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargesModule } from '../charges/charges.module';
import { ReportsModule } from '../reports/reports.module';
import { ChargeDraft } from './entities/charge-draft.entity';
import { ConversationService } from './services/conversation.service';

/** Motor de conversación compartido por WhatsApp y la demo pública. Sin endpoints propios. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChargeDraft]),
    ChargesModule,
    ReportsModule,
  ],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationsModule {}
