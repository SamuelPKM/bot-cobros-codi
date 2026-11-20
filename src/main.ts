import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Env } from './config/env.validation';

/** Configuración común a producción y a las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  // Headers de seguridad (nosniff, HSTS, frameguard…) y sin X-Powered-By.
  app.use(helmet());
  // Datos de entrada: solo los campos declarados en cada DTO; un campo extra es 400.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}

async function bootstrap(): Promise<void> {
  // rawBody: la firma del webhook de pey se verifica sobre los bytes exactos que llegaron.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

if (require.main === module) void bootstrap();
