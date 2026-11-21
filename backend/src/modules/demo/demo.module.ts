import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsersModule } from '../users/users.module';
import { DemoController } from './controllers/demo.controller';
import { DemoMessage } from './entities/demo-message.entity';
import { DemoSession } from './entities/demo-session.entity';
import { DemoService } from './services/demo.service';

/** Demo pública: API JSON de la conversación para la página /demo del frontend. */
@Module({
  imports: [
    TypeOrmModule.forFeature([DemoSession, DemoMessage]),
    ConversationsModule,
    BusinessesModule,
    UsersModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
