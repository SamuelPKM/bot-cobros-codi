# Cóbrale API

API de la app móvil de cobros con CoDi (vía [pey](https://docs.pey.mx)): admin y vendedores, cobro push con QR de respaldo, webhooks y notificaciones.
NestJS 11, TypeORM y PostgreSQL. Usa CoDi a través de pey; no es un producto oficial de pey ni de Banco de México.

## Arranque local

```bash
npm install
npm run db:up            # Postgres 16 en Docker (puerto 5433)
cp .env.example .env     # llena AUTH_SECRET y PEY_API_KEY
npm run migration:run
npm run start:dev
```

## Pruebas (TDD)

```bash
npm test                 # unitarias (junto a cada archivo, *.spec.ts)
npm run test:e2e         # e2e contra Postgres real (base cobrale_test), en test/
```

## Estructura

Primero se agrupa por **dominio** (`modules/<dominio>`) y, dentro de cada uno, por **función**.

```
src/
├─ main.ts                 # arranque: helmet, ValidationPipe, rawBody
├─ app.module.ts           # composición de módulos
├─ config/                 # validación de variables de entorno
├─ database/               # DataSource de TypeORM y migrations/
├─ shared/                 # primitivas sin dominio, reutilizables
│  ├─ money/               # pesos <-> centavos
│  └─ security/            # hash de contraseñas
└─ modules/
   ├─ auth/                # identidad y acceso
   │  ├─ controllers/      # POST /auth/login, GET /me
   │  ├─ services/         # AuthService (login y emisión del JWT)
   │  ├─ guards/           # JwtAuthGuard (global), RolesGuard (global), LoginThrottlerGuard
   │  ├─ decorators/       # @Public(), @Roles(), @CurrentUser()
   │  ├─ dto/              # validación de entrada
   │  └─ interfaces/       # JwtPayload, LoginResult, AuthenticatedRequest
   ├─ users/               # admin y vendedores
   │  ├─ controllers/      # /users (solo admin)
   │  ├─ services/         # UsersService: único dueño de las escrituras de usuarios
   │  ├─ entities/         # entidad TypeORM
   │  ├─ dto/              # CreateSellerDto, UpdateSellerDto y sus reglas
   │  ├─ interfaces/       # PublicUser y entradas del servicio
   │  ├─ mappers/          # entidad -> respuesta pública (sin hash)
   │  ├─ seeders/          # admin inicial desde el entorno
   │  └─ types/            # Role
   ├─ charges/             # cobros: una venta (Charge) con sus intentos de pago (push o QR)
   │  ├─ controllers/      # POST /charges, POST /charges/:id/qr, GET /charges, GET /charges/:id
   │  ├─ services/         # ChargesService: único dueño de cobros e intentos
   │  ├─ entities/         # Charge, PaymentAttempt
   │  ├─ policies/         # reglas puras: concepto para quien paga, motivo de error de pey
   │  ├─ dto/  mappers/  interfaces/  types/  constants/
   ├─ pey/                 # adaptador de la API de pey (CoDi)
   │  ├─ services/         # PeyClient: push, QR, consulta de transacciones
   │  ├─ interfaces/       # contratos de la API de pey
   │  ├─ errors/           # PeyError (isOutcomeUnknown = "no se sabe si se procesó")
   │  └─ constants/        # límites de pey y token PEY_FETCH
   └─ health/
      └─ controllers/      # GET /health (pública)
```

### Reglas
- **Controladores delgados:** validan con DTOs y delegan en servicios. La lógica de negocio vive en `services/`.
- **Cada escritura tiene un solo dueño:** `UsersService` es el único que escribe usuarios. Otros módulos lo usan a través de su servicio exportado, nunca de su repositorio.
- **Las entidades no salen a la API:** toda respuesta pasa por un mapper (`toPublicUser`).
- **Cerrado por defecto:** toda ruta exige `Authorization: Bearer <jwt>` salvo las marcadas con `@Public()`.
- **`shared/` es solo para lo que no pertenece a ningún dominio.** Si algo lo usa un solo módulo, va dentro de ese módulo.
- **Dinero en centavos enteros** en la base; la API habla en pesos.
- **Un POST a pey nunca se reintenta solo:** la API no tiene llave de idempotencia y reintentar un push puede cobrar dos veces. Un timeout o un error de red se tratan como "no se sabe".
- **El esquema solo cambia con migraciones** (`synchronize: false`).
- **Las pruebas unitarias van junto al archivo que prueban**; las e2e van en `test/`.
- Al agregar un dominio nuevo (cobros, webhooks, notificaciones…) se repite el patrón en `modules/<dominio>/` y solo se crean las carpetas que de verdad se usan.
