import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Env } from './config/env.validation';
import { forwardedClientIp } from './shared/http/client-ip.policy';

/** Configuración común a producción y a las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Detrás de Caddy (AWS): la IP real viene en X-Forwarded-For (un salto).
  if (config.get('TRUST_PROXY', { infer: true })) {
    (app as NestExpressApplication).set('trust proxy', 1);
  }

  // La web (Next) llama desde su servidor: con el secreto compartido manda la
  // IP del visitante, para que los límites por IP no sean globales.
  const frontProxySecret = config.get('FRONT_PROXY_SECRET', { infer: true });
  if (frontProxySecret) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const ip = forwardedClientIp(req.headers, frontProxySecret);
      if (ip) {
        Object.defineProperty(req, 'ip', { value: ip });
        Object.defineProperty(req, 'ips', { value: [ip] });
      }
      next();
    });
  }

  // Solo los orígenes configurados (la demo de Expo web). La app nativa no usa CORS.
  const origins = config.get('CORS_ORIGINS', { infer: true });
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    });
  }

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
