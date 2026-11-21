# Deploy y primer cobro real ($0.01)

Arquitectura: **Render** (la API `cobrale-api` y la web `cobrale-web`) + **Neon** (Postgres) + **pey** (CoDi).
No hay sandbox de pey: todo se prueba en producción con **$0.01**.

**Cada negocio usa su propia API key de pey.** La API no tiene credenciales de pey propias: un negocio se registra en la web dando SU API key, y sus cobros se hacen con ella. Así el dinero llega a la cuenta del titular de esas credenciales (regla 7.3(c) del hackatón) y nadie concentra pagos de terceros (regla 7.1).

> Los pasos marcados con 👤 los haces tú: crean cuentas o tocan dinero y credenciales.

## 1. 👤 Base de datos en Neon

1. Entra a [neon.tech](https://neon.tech) y crea un proyecto en la región **AWS US East 2 (Ohio)**.
2. En *Connection Details* elige la conexión **directa**: el host **no** debe llevar `-pooler`. Copia la cadena `postgresql://...?sslmode=require`.

   > No uses la conexión *pooled*: el barrido usa un advisory lock de sesión, y PgBouncer en modo transacción cambia de sesión entre consultas.

## 2. Código en `main`

Render despliega la rama `main` de `SamuelPKM/bot-cobros-codi`. Integra el PR de `feature/nest-next` antes del paso 3.

> Para probar antes de integrar, en Render cambia la rama de los dos servicios a `feature/nest-next`.

## 3. 👤 Servicios en Render

1. En [dashboard.render.com](https://dashboard.render.com), ve a **New → Blueprint** y elige el repositorio. Render lee `render.yaml` y propone dos servicios (`cobrale-api` y `cobrale-web`) y un grupo de variables (`cobrale-compartido`).
2. Llena los valores que pide. Las URL de cada servicio aparecen en Render en cuanto se crean; si aún no las sabes, pon las que propone (`https://cobrale-api.onrender.com`, `https://cobrale-web.onrender.com`) y corrígelas después en **Environment**.

   | Servicio | Variable | Valor |
   |---|---|---|
   | `cobrale-api` | `DATABASE_URL` | La cadena **directa** de Neon (paso 1) |
   | `cobrale-api` | `PUBLIC_BASE_URL` | URL de la API, sin `/` al final |
   | `cobrale-api` | `FRONTEND_URL` | URL de la web, sin `/` al final |
   | `cobrale-api` | `CORS_ORIGINS` | Vacía (la web llama desde su servidor). Solo para la demo de Expo web |
   | `cobrale-api` | `WHATSAPP_*` | Vacías hasta conectar Meta (paso 8) |
   | `cobrale-api` | `DEMO_BUSINESS_ID` | Vacía por ahora (paso 7) |
   | `cobrale-web` | `API_URL` | URL de la API, sin `/` al final |

   Render genera `AUTH_SECRET`, `ENCRYPTION_KEY` y `FRONT_PROXY_SECRET`. **No cambies `ENCRYPTION_KEY` después**: con ella se cifran las API keys de los negocios.

3. **Apply**. La API corre las migraciones al arrancar.
4. Comprueba la API (cambia la URL por la tuya):

   ```bash
   curl https://cobrale-api.onrender.com/health
   ```

   Debe responder `{"status":"ok","database":"up"}`. La web debe abrir en su URL.

## 4. 👤 Cuenta y API key de pey del negocio

Esto lo hace **cada negocio** con su propia cuenta de pey. Para la demo del hackatón, el negocio del equipo.

1. En [portal.mipey.mx](https://portal.mipey.mx) crea el perfil del negocio.
2. En **Finanzas**, da de alta la cuenta CoDi con la CLABE **del negocio**. Banxico tarda **hasta 5 días hábiles** en activarla.
   - Mientras tanto se puede usar la cuenta de pruebas que publica pey, que se activa de inmediato. **Lo que se paga ahí no se devuelve**: usa solo $0.01.
3. En **Desarrollador**, haz clic en **Crear API Key**, ligada a esa cuenta, y guárdala.

## 5. 👤 Registrar el negocio y su webhook (en la web)

1. Abre la web → **Registra tu negocio**: nombre, tu nombre, usuario, contraseña y la API key. La API la valida con pey; si pey no la reconoce, no se crea nada.
2. Entras al panel con un aviso: **Falta registrar el webhook de pey**. Ve a **Ajustes**:
   1. Copia la **URL del webhook** (tiene la forma `https://cobrale-api.onrender.com/webhooks/pey/<slug>`).
   2. En el portal de pey, en **Desarrollador**, abre el engrane de la API key y elige **Crear Webhook** con esa URL.
   3. Copia el secreto (`whsec_...`; **se muestra una sola vez**) y pégalo en **Ajustes → Secreto del webhook**. Debe decir "✅ Registrado".

## 6. 👤 Primer cobro real de $0.01

Usa **tu propio celular**, registrado en CoDi en la app de tu banco (las reglas piden datos ficticios o propios).

1. **Nuevo cobro** → Push al celular, tu celular, `0.01`, concepto "Prueba" → **Cobrar**.
2. Aprueba el cobro en la app de tu banco. La página del cobro cambia sola a **✅ Pagado**.
3. Plan B: si el push no llega, en el mismo cobro usa **Mostrar QR** y escanéalo con tu banco.

## 7. 👤 Demo pública y cuenta para el jurado

1. Con el negocio del paso 5 funcionando, busca su id: es el `businessId` que da `GET /me` (o el número en la base de Neon, tabla `businesses`).
2. En Render, `cobrale-api` → **Environment**: `DEMO_BUSINESS_ID` = ese id. Guarda; la API se reinicia. `/demo` en la web ya funciona, con tope de `DEMO_MAX_AMOUNT` ($1) por cobro.
3. Cuenta para el jurado: en **Equipo**, da de alta a una persona con un tope de $1.00 (o invítala). Si le das rol de administrador podrá probar Equipo y Ajustes, pero también cambiar el nombre, la API key o el secreto del negocio: revísalos antes de la evaluación.

## 8. 👤 WhatsApp (opcional)

1. En [developers.facebook.com](https://developers.facebook.com), crea la app de WhatsApp Business y copia el *token*, el *Phone number ID* y el *App secret*.
2. Inventa un *verify token*. En Render pon las cuatro variables `WHATSAPP_*`.
3. En Meta, registra el webhook `https://cobrale-api.onrender.com/webhooks/whatsapp` con ese verify token y suscríbete al campo `messages`.
4. En la web, **Ajustes → WhatsApp → Obtener código**, y manda `vincular 123456` al número de la app.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `/health` responde `database: down` | `DATABASE_URL` y `DATABASE_SSL=true`; que el host no lleve `-pooler` |
| La web dice "No pudimos conectar con el servidor" | `API_URL` de la web: la URL pública de la API, con `https://` y sin `/` al final |
| Las ligas de invitación o el regreso del pago apuntan a otro lado | `FRONTEND_URL` de la API |
| El registro dice que la API key no es válida | Cópiala otra vez desde portal.mipey.mx > Desarrollador |
| El push queda fallido con "la cuenta… no está activa" | La cuenta CoDi del negocio todavía no está activa en pey (paso 4) |
| Se pagó pero sigue pendiente | En el portal de pey, revisa **Webhook Logs**. Un 401: el secreto no es el de esa API key; un 503: falta el secreto en Ajustes. De todos modos el barrido lo concilia con pey al vencer el intento (unos 6 minutos) |
| Muchos visitantes de la demo reciben "Demasiadas sesiones" | Que `cobrale-api` y `cobrale-web` usen el grupo `cobrale-compartido` (mismo `FRONT_PROXY_SECRET`) |
| La primera petición tarda ~1 min | El plan free de Render se durmió. Para la evaluación usa el plan starter en los dos servicios |
