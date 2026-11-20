// Variables para las pruebas e2e: Postgres de docker-compose, base cobrale_test.
process.env.DATABASE_URL ??=
  'postgres://cobrale:cobrale@localhost:5433/cobrale_test';
process.env.DATABASE_SSL = 'false';
process.env.AUTH_SECRET ??= 'secreto-de-pruebas-de-al-menos-32-caracteres';
process.env.PEY_API_KEY ??= 'pey_test_key';
process.env.PEY_WEBHOOK_SECRET ??= 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
process.env.ADMIN_USERNAME ??= 'admin-inicial';
process.env.ADMIN_PASSWORD ??= 'admin-inicial-123';
// Las pruebas corren el barrido a mano (sweeper.sweep()), no con el intervalo.
process.env.SWEEPER_ENABLED = 'false';
