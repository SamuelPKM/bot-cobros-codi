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
// La web (Next) manda la IP del visitante firmada con este secreto.
process.env.FRONT_PROXY_SECRET = 'secreto-del-proxy-de-la-web-de-pruebas';
// WhatsApp configurado (el cliente de Meta se reemplaza por uno simulado).
process.env.WHATSAPP_TOKEN = 'token-meta-pruebas';
process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
process.env.WHATSAPP_APP_SECRET = 'secreto-de-la-app-de-meta';
process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-verificacion';
// Demo pública: el primer negocio que crea cada prueba (id 1 tras reiniciar la base).
process.env.DEMO_BUSINESS_ID = '1';
process.env.DEMO_MAX_AMOUNT = '1';
process.env.DEMO_CHARGES_PER_HOUR = '5';
