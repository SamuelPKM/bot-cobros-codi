import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';

/** Lectura de cobros para cortes y exportaciones. No escribe nada. */
@Module({
  imports: [UsersModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
