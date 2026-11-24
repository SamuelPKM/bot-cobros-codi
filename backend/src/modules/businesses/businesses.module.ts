import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../config/env.validation';
import { SecretBox } from '../../shared/security/secret-box';
import { AuthModule } from '../auth/auth.module';
import { PeyModule } from '../pey/pey.module';
import { UsersModule } from '../users/users.module';
import { BUSINESS_SECRET_BOX } from './constants/businesses.constants';
import { BusinessesController } from './controllers/businesses.controller';
import { Business } from './entities/business.entity';
import { BusinessLogoService } from './services/business-logo.service';
import { BusinessesService } from './services/businesses.service';
import {
  DisabledLogoStorage,
  LogoStorage,
  S3LogoStorage,
} from './storage/logo-storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),
    UsersModule,
    PeyModule,
    AuthModule,
  ],
  controllers: [BusinessesController],
  providers: [
    BusinessesService,
    BusinessLogoService,
    {
      provide: LogoStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const bucket = config.get('LOGO_BUCKET', { infer: true });
        return bucket
          ? new S3LogoStorage(bucket, config.get('AWS_REGION', { infer: true }))
          : new DisabledLogoStorage();
      },
    },
    {
      provide: BUSINESS_SECRET_BOX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretBox(config.get('ENCRYPTION_KEY', { infer: true })),
    },
  ],
  exports: [BusinessesService, BusinessLogoService],
})
export class BusinessesModule {}
