# Cóbrale API

API de la app móvil de cobros con CoDi (vía [pey](https://docs.pey.mx)) para negocios: cada negocio se registra con **su propia API key de pey**, tiene admin y vendedores, cobra por push con QR de respaldo y recibe avisos de pago.
NestJS 11, TypeORM y PostgreSQL. Usa CoDi a través de pey; no es un producto oficial de pey ni de Banco de México.

## Arranque local

```bash
npm install
npm run db:up            # Postgres 16 en Docker (puerto 5433)
cp .env.example .env     # llena AUTH_SECRET y ENCRYPTION_KEY
npm run migration:run
npm run start:dev
```

Después registra un negocio con `POST /businesses` (ver [docs/deploy.md](docs/deploy.md), paso 5).

## Deploy

Render (API) + Neon (Postgres), con el blueprint `render.yaml`. Paso a paso y primer cobro real de $0.01: [docs/deploy.md](docs/deploy.md).

## Pruebas (TDD)

```bash
npm test                 # unitarias (junto a cada archivo, *.spec.ts)
npm run test:e2e         # e2e contra Postgres real (base cobrale_test), en test/
```

## Negocios y credenciales de pey

La API **no tiene credenciales de pey propias**. Cada negocio registra la suya:

| Ruta | Quién | Qué hace |
|---|---|---|
| `POST /businesses` | público (5 por minuto por IP) | Crea el negocio y su admin; valida la API key con pey antes de guardar nada; abre sesión y devuelve la URL del webhook del negocio |
| `GET /businesses/me` | admin | Nombre, últimos 4 de la API key, si ya tiene webhook y su URL |
| `PATCH /businesses/me` | admin | Cambia el nombre, la API key (validada otra vez) o registra el secreto `whsec_` del webhook |
| `POST /webhooks/pey/:slug` | pey (firma) | Webhook de ESE negocio, verificado con SU secreto |

### Cobros

| Ruta | Qué hace |
|---|---|
| `POST /charges` | `{ method?, phone?, amount, concept? }`. `push` (por defecto, pide `phone`) manda el cobro al celular; `qr` devuelve el QR; `link` devuelve la liga de pago (CoDi o tarjeta) |
| `POST /charges/:id/qr` · `POST /charges/:id/link` | Plan B del mismo cobro; si ya hay uno vigente devuelve el mismo |
| `GET /charges` · `GET /charges/:id` | Lista y detalle (el vendedor ve los suyos, el admin los del negocio) |

La liga regresa al cliente a `FRONTEND_URL/pago/gracias` o `/pago/cancelado` (pantallas del frontend; pey exige https). Vence en 24 h; el webhook `payment_link.status_updated` y el barrido la confirman con pey. Solo cuenta la base: la propina no.

### Equipo e invitaciones

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /users` | admin | Todo el equipo (admins y vendedores) |
| `POST /users` | admin | Alta directa de un vendedor |
| `PATCH /users/:id` | admin | Nombre, rol, tope, contraseña o desactivar; nunca deja el negocio sin admin activo (409) |
| `POST /invitations` | admin | Liga de un solo uso (7 días) hacia `FRONTEND_URL/invitacion/<token>`; el token solo se ve aquí |
| `GET /invitations` · `DELETE /invitations/:id` | admin | Invitaciones vigentes (sin token) y revocar |
| `GET /invitations/token/:token` | público | A qué negocio y con qué rol invitan (404 si no existe, 410 si ya se usó, venció o se revocó) |
| `POST /invitations/token/:token/accept` | público (5/min por IP) | Crea la cuenta con el rol de la invitación y abre sesión; sirve una sola vez |

- Los cobros, avisos y el barrido usan la API key **del negocio del cobro**. El dinero llega a la cuenta del titular de esas credenciales (regla 7.3(c) del hackatón) y nadie concentra pagos de terceros (regla 7.1).
- La API key y el secreto del webhook se guardan **cifrados** (AES-256-GCM con `ENCRYPTION_KEY`) y nunca salen en una respuesta.
- Todo está separado por negocio: un admin solo ve y administra a su equipo y sus cobros, y un webhook solo puede marcar pagados cobros de su propio negocio.

## Estructura

Primero se agrupa por **dominio** (`modules/<dominio>`) y, dentro de cada uno, por **función**.

```
src/
├─ main.ts                 # arranque: helmet, CORS, trust proxy, ValidationPipe, rawBody
├─ app.module.ts           # composición de módulos
├─ config/                 # validación de variables de entorno
├─ database/               # DataSource de TypeORM y migrations/
├─ shared/                 # primitivas sin dominio, reutilizables
│  ├─ money/               # pesos <-> centavos
│  └─ security/            # hash de contraseñas y SecretBox (cifrado de credenciales)
└─ modules/
   ├─ auth/                # identidad y acceso
   │  ├─ controllers/      # POST /auth/login, GET /me
   │  ├─ services/         # AuthService (login y emisión del JWT)
   │  ├─ guards/           # JwtAuthGuard (global), RolesGuard (global), LoginThrottlerGuard
   │  ├─ decorators/       # @Public(), @Roles(), @CurrentUser()
   │  ├─ dto/              # validación de entrada
   │  └─ interfaces/       # JwtPayload, LoginResult, AuthenticatedRequest
   ├─ businesses/          # negocios y sus credenciales de pey
   │  ├─ controllers/      # POST /businesses, GET/PATCH /businesses/me
   │  ├─ services/         # BusinessesService: registro, credenciales cifradas, cliente de pey del negocio
   │  ├─ entities/         # Business
   │  ├─ dto/  mappers/  interfaces/  constants/
   ├─ users/               # admin y vendedores de cada negocio
   │  ├─ controllers/      # /users (solo admin, solo su negocio)
   │  ├─ services/         # UsersService: único dueño de las escrituras de usuarios
   │  ├─ entities/         # entidad TypeORM
   │  ├─ dto/              # CreateSellerDto, UpdateSellerDto y sus reglas
   │  ├─ interfaces/       # PublicUser y entradas del servicio
   │  ├─ mappers/          # entidad -> respuesta pública (sin hash)
   │  └─ types/            # Role
   ├─ charges/             # cobros: una venta (Charge) con sus intentos de pago (push o QR)
   │  ├─ controllers/      # POST /charges, POST /charges/:id/qr, GET /charges, GET /charges/:id
   │  ├─ services/         # ChargesService (cobrar), ChargePaymentsService (registrar pagos), ChargeLifecycleService (vencer y avisos)
   │  ├─ entities/         # Charge, PaymentAttempt
   │  ├─ policies/         # reglas puras: concepto para quien paga, motivo de error de pey
   │  ├─ dto/  mappers/  interfaces/  types/  constants/
   ├─ webhooks/            # POST /webhooks/pey/:slug (pública, autenticada por la firma del negocio)
   │  ├─ controllers/      # responde 200, 401 (firma), 404 (negocio), 503 (sin secreto) o 500 (pey reintenta)
   │  ├─ services/         # verificador Standard Webhooks e idempotencia por negocio y webhook-id
   │  ├─ entities/         # WebhookEvent
   │  └─ constants/  interfaces/
   ├─ notifications/       # Expo Push: "Pago recibido" a quien cobró y a los admins de su negocio
   │  ├─ controllers/      # POST/DELETE /push-tokens (registrar o quitar el dispositivo)
   │  ├─ services/         # ExpoPushClient, PushTokensService, PaymentNotifier
   │  ├─ policies/         # texto de la notificación
   │  └─ entities/  dto/  interfaces/  constants/
   ├─ sweeper/             # barrido cada 30 s con advisory lock de Postgres
   │  └─ services/         # concilia intentos vencidos con pey (key del negocio), vence cobros, reintenta avisos
   ├─ pey/                 # adaptador de la API de pey (CoDi), sin credenciales propias
   │  ├─ services/         # PeyClient y PeyClientFactory (un cliente por API key)
   │  ├─ interfaces/       # contratos de la API de pey y PeyApi
   │  ├─ errors/           # PeyError (isOutcomeUnknown = "no se sabe si se procesó")
   │  └─ constants/        # límites de pey y token PEY_FETCH
   └─ health/
      └─ controllers/      # GET /health (pública)
```

### Reglas
- **Controladores delgados:** validan con DTOs y delegan en servicios. La lógica de negocio vive en `services/`.
- **Cada escritura tiene un solo dueño:** `UsersService` escribe usuarios, `BusinessesService` negocios y credenciales, `ChargesService`/`ChargePaymentsService` cobros. Otros módulos los usan a través de su servicio exportado, nunca de su repositorio.
- **Las entidades no salen a la API:** toda respuesta pasa por un mapper (`toPublicUser`, `toPublicBusiness`, `toPublicCharge`).
- **Cerrado por defecto:** toda ruta exige `Authorization: Bearer <jwt>` salvo las marcadas con `@Public()`.
- **Todo dentro del negocio:** cada consulta y escritura se limita al `businessId` de quien llama.
- **Credenciales cifradas:** las API keys y secretos de webhook solo se descifran en `BusinessesService` para llamar a pey.
- **`shared/` es solo para lo que no pertenece a ningún dominio.** Si algo lo usa un solo módulo, va dentro de ese módulo.
- **Dinero en centavos enteros** en la base; la API habla en pesos.
- **El webhook es el aviso; la API de pey es la fuente de verdad:** antes de marcar pagado se consulta la transacción y se compara el monto. La firma se verifica sobre el cuerpo crudo.
- **Un POST a pey nunca se reintenta solo:** la API no tiene llave de idempotencia y reintentar un push puede cobrar dos veces. Un timeout o un error de red se tratan como "no se sabe".
- **El esquema solo cambia con migraciones** (`synchronize: false`).
- **Las pruebas unitarias van junto al archivo que prueban**; las e2e van en `test/`.
- Al agregar un dominio nuevo se repite el patrón en `modules/<dominio>/` y solo se crean las carpetas que de verdad se usan.
