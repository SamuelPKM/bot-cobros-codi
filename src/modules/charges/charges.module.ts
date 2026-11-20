import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeyModule } from '../pey/pey.module';
import { ChargesController } from './controllers/charges.controller';
import { Charge } from './entities/charge.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { ChargePaymentsService } from './services/charge-payments.service';
import { ChargesService } from './services/charges.service';

@Module({
  imports: [TypeOrmModule.forFeature([Charge, PaymentAttempt]), PeyModule],
  controllers: [ChargesController],
  providers: [ChargesService, ChargePaymentsService],
  exports: [ChargesService, ChargePaymentsService],
})
export class ChargesModule {}
