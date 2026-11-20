# Cóbrale

Cobra con CoDi escribiendo un mensaje. Usa CoDi a través de la API de [pey](https://docs.pey.mx); no es un producto oficial de pey ni de Banco de México.

Un negocio cobra de tres formas, desde WhatsApp o desde la web:

| Forma | Desde WhatsApp | Qué pasa |
| --- | --- | --- |
| Al celular (push CoDi) | `cobra 150 a 5512345678 corte de pelo` | Al cliente le llega la solicitud de pago en la app de su banco. Vence en 6 minutos |
| QR CoDi | `qr 150 corte de pelo` | El comerciante muestra el QR y el cliente lo escanea. Vence en 15 minutos |
| Liga de pago | `liga 150 corte de pelo` | Una liga para mandar por cualquier medio. Acepta CoDi y tarjeta |

En cuanto el banco confirma, Cóbrale avisa "✅ Pagado" con la clave de rastreo de Banxico.

Requiere Node.js 22.5 o más nuevo. No hay sandbox de pey: se prueba en producción con $0.01.

## Lo que incluye

- **Web** (`/`): página de inicio, registro e inicio de sesión de comerciantes, y un panel con:
  - los cobros de hoy, y el formulario para crear uno nuevo de cualquiera de las tres formas;
  - estados que se actualizan solos, el detalle de cada cobro (con el QR o la liga) y exportación a CSV;
  - ajustes: tu nombre y tu WhatsApp; nombre del negocio y CLABE (administradores);
  - equipo: invitar vendedores con una liga, cambiar roles y desactivar.
- **Equipos para pymes**: cada negocio tiene **administradores** y **vendedores**, y todos cobran. El administrador cobra como cualquiera y además ve los cobros y totales de todo el negocio y de cada persona, invita al equipo y registra la CLABE. El vendedor cobra desde la web y su propio WhatsApp y ve solo sus cobros. El aviso de "Pagado" le llega a quien hizo el cobro. Siempre queda al menos un administrador activo.
- **Bot de WhatsApp**: los mismos cobros desde el chat, más `sí`/`no` para confirmar, `liga` para un push que expiró, `resumen` y `ayuda`. Cada persona liga su número mandando `vincular <código>`, con el código que le da la web; sus cobros quedan a su nombre.
- **Demo pública** (`/demo`): el chat del bot en una página que cualquiera abre sin invitación, como piden las reglas del hackatón.
- **Dinero a la cuenta de cada comerciante**: cada uno registra su CLABE. Mientras Banxico la valida (hasta 5 días hábiles), queda en **modo prueba**: cobros de hasta `DEMO_MAX_AMOUNT` que llegan a la cuenta del proyecto.

## Arquitectura en corto

Tres canales (web, WhatsApp y demo) sobre un mismo núcleo de cobros, y Postgres como única fuente de estado. Cualquier instancia del servidor atiende cualquier petición, así que se puede correr más de una. Detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Desarrollo local

```bash
npm install
```

```bash
cp .env.example .env
```

Llena `PEY_API_KEY` en `.env` y arranca:

```bash
npm run dev
```

Sin `DATABASE_URL`, Cóbrale usa PGlite (Postgres dentro de Node) y guarda en `data/pglite`, así que no hay que instalar nada. Abre http://localhost:3000.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `PEY_API_KEY` | API key de pey (portal.pey.mx > Desarrollador). Obligatoria |
| `PEY_WEBHOOK_SECRET` | Secreto del webhook de pey (`whsec_...`). Sin él, el webhook responde 503 |
| `DATABASE_URL` | Postgres (por ejemplo Neon). Sin ella se usa PGlite en `DATABASE_DIR` |
| `PUBLIC_BASE_URL` | URL pública HTTPS. En Render se toma sola de `RENDER_EXTERNAL_URL`. Hace falta para las ligas |
| `TRUST_PROXY` | `true` detrás de un proxy (casi cualquier hosting), para que los límites por IP vean la IP real |
| `DEMO_ENABLED` | `true` activa la demo pública en `/demo` |
| `DEMO_MAX_AMOUNT` | Monto máximo por cobro en modo prueba (demo y cuentas sin CLABE activa). Por defecto `1` |
| `DEMO_MERCHANT_NAME` | Nombre del negocio en la demo. Por defecto `Negocio de prueba` |
| `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD` | Cuenta de la web para el jurado, siempre en modo prueba. Se crea al arrancar |
| `TRUSTED_EMAILS` | Correos, separados por coma, que cobran sin límite aunque no tengan CLABE (por ejemplo, la cuenta del equipo) |
| `REGISTRATION_OPEN` | `false` cierra el registro de cuentas nuevas |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp Cloud API. Opcionales en conjunto |
| `WHATSAPP_DISPLAY_NUMBER` | Número del bot, para mostrarlo en la web al ligar un WhatsApp |

## Despliegue

En Render, con Postgres en Neon: [docs/deploy-render.md](docs/deploy-render.md).

## Conectar WhatsApp

1. Crea una app en developers.facebook.com, agrégale el producto WhatsApp y usa el número de prueba de Meta.
2. Pon las variables `WHATSAPP_*` en el servidor.
3. En WhatsApp > Configuración, registra el webhook `https://<tu-dominio>/webhooks/whatsapp` con tu `WHATSAPP_VERIFY_TOKEN` y suscríbete al campo `messages`.
4. En la web, entra a **Ajustes > Ligar mi WhatsApp** y manda `vincular <código>` al número del bot. Cada persona del equipo hace lo mismo con su número.

El número de prueba de Meta solo puede escribirle a los números que agregues como destinatarios en la app. Por eso el jurado prueba en la web y en la demo.

## Pruebas

```bash
npm test
```

Corren sobre PGlite, con pey y WhatsApp simulados, y firman los webhooks igual que los originales. Para correrlas contra un Postgres real, el mismo camino que producción:

```bash
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/cobrale_test npm run test:postgres
```

Esa base se vacía en cada prueba: usa una base propia para pruebas.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `src/charges.js` | Núcleo de cobros: push, QR, liga, modo prueba, CLABE, avisos y barrido |
| `src/bot.js` | Canal de chat (WhatsApp y demo) sobre el núcleo |
| `src/web/` | Web: rutas, vistas, sesiones (`auth.js`), estilos y JavaScript del panel |
| `src/app.js` | Servidor: webhooks de pey y de WhatsApp, demo y web |
| `src/demo.js`, `src/demo-page.html` | Demo pública |
| `src/db/` | Conexión (Postgres o PGlite), migraciones y todas las consultas (`store.js`) |
| `src/sweeper.js` | Agenda el barrido solo cuando hace falta |
| `src/pey.js`, `src/whatsapp.js` | Clientes de la API de pey y de WhatsApp Cloud API |
| `src/command.js`, `src/clabe.js`, `src/messages.js` | Comandos del chat, validación de CLABE y textos |
| `src/config.js`, `src/server.js` | Variables de entorno y arranque |
| `scripts/` | `push.js` y `tx.js` (terminal) y `check.js` (`npm run build`) |

## Decisiones

- **Nada sale al celular de un cliente sin confirmación**, en el chat y en la web. La confirmación caduca a los 10 minutos.
- **El webhook es el aviso; la API es la fuente de verdad.** Antes de marcar pagado se consulta la transacción o la liga en pey y se compara el monto.
- **Las firmas se verifican sobre el cuerpo crudo**: Standard Webhooks para pey y `X-Hub-Signature-256` para WhatsApp.
- **Un POST a pey nunca se reintenta solo**: la API no tiene llave de idempotencia y repetir un push mandaría dos cobros. Cada cobro lleva su ID interno en `metadata.chargeId`, para ligar el pago aunque se pierda la respuesta.
- **Webhooks de pey: al menos una vez. Mensajes de WhatsApp: a lo mucho una vez**, porque repetir un "sí" duplicaría un cobro.
- **Todo QR lleva expiración** (un QR sin expiración acepta varios pagos). Un pago de más se registra para aclararlo, sin avisar dos veces.
- **Modo prueba** para la demo y para cuentas sin CLABE propia activa: monto máximo, cobros por hora y push por hora a un mismo teléfono, para que nadie use el servicio para molestar a terceros.
- **Seguridad de la web**: contraseñas con scrypt; sesiones con token aleatorio en cookie HttpOnly, guardado como hash; token CSRF y revisión de Origin en cada formulario; política de contenido sin scripts en línea; límites de intentos de inicio de sesión.
- Los secretos viven en variables de entorno, nunca en el repositorio.
