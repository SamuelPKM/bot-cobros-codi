import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BusinessesModule } from '../businesses/businesses.module';
import { ChargesModule } from '../charges/charges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SweeperScheduler } from './services/sweeper.scheduler';
import { SweeperService } from './services/sweeper.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BusinessesModule,
    ChargesModule,
    NotificationsModule,
  ],
  providers: [SweeperService, SweeperScheduler],
})
export class SweeperModule {}
