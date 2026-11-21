// Variables para las pruebas e2e: Postgres de docker-compose, base cobrale_test.
process.env.DATABASE_URL ??=
  'postgres://cobrale:cobrale@localhost:5433/cobrale_test';
process.env.DATABASE_SSL = 'false';
process.env.AUTH_SECRET ??= 'secreto-de-pruebas-de-al-menos-32-caracteres';
// 32 bytes de prueba en base64 (cifran las API keys de los negocios).
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString('base64');
process.env.PUBLIC_BASE_URL ??= 'https://cobrale-api.test';
// La web (Next.js): Nest arma ahí las ligas a pantallas (invitaciones, regreso de la liga de pago).
process.env.FRONTEND_URL ??= 'https://cobrale.test';
// Secreto de webhook que los negocios de prueba registran (seedBusiness).
process.env.TEST_WEBHOOK_SECRET ??= 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
// Las pruebas corren el barrido a mano (sweeper.sweep()), no con el intervalo.
process.env.SWEEPER_ENABLED = 'false';
// Como en Render: detrás de un proxy, y la demo de Expo web en localhost:8081.
process.env.TRUST_PROXY = 'true';
process.env.CORS_ORIGINS = 'http://localhost:8081';
