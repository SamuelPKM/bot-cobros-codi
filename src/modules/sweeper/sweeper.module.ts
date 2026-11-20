import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChargesModule } from '../charges/charges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeyModule } from '../pey/pey.module';
import { SweeperScheduler } from './services/sweeper.scheduler';
import { SweeperService } from './services/sweeper.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ChargesModule,
    PeyModule,
    NotificationsModule,
  ],
  providers: [SweeperService, SweeperScheduler],
})
export class SweeperModule {}
