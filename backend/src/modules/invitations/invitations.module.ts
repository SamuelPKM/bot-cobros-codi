import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './controllers/invitations.controller';
import { Invitation } from './entities/invitation.entity';
import { InvitationsService } from './services/invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation]),
    UsersModule,
    BusinessesModule,
    AuthModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
