import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Env, validateEnv } from './config/env.validation';
import { typeOrmOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { ChargesModule } from './modules/charges/charges.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        typeOrmOptions({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
        }),
    }),
    AuthModule,
    UsersModule,
    ChargesModule,
    WebhooksModule,
    HealthModule,
  ],
})
export class AppModule {}
