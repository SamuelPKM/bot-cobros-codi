# Desplegar Cóbrale en Render con Postgres en Neon

Las dos partes son gratis:

- **Render** corre el servidor. El archivo [`render.yaml`](../render.yaml) es un *Blueprint* que crea el servicio con sus variables.
- **Neon** guarda los datos en Postgres. Así no se pierden en cada despliegue, y el servicio puede tener varias instancias.

| Recurso | Configuración |
| --- | --- |
| Servicio | Web Service `cobrale` en Render, plan Free, región Virginia |
| Base de datos | Postgres en Neon, región AWS us-east-1 (Virginia) |
| Node.js | Versión 22, fijada en `.node-version` |
| Despliegues | Automáticos con cada commit a `main` |

## Límites de los planes gratis

- **Render Free se apaga tras 15 minutos sin visitas** y tarda alrededor de un minuto en despertar. Se evita con un despertador externo (paso 5). Render da 750 horas al mes: alcanza si es el único servicio gratis activo de la cuenta.
- **Neon Free da 100 horas de cómputo al mes** y duerme la base tras 5 minutos sin consultas. Cóbrale solo consulta la base cuando hace falta: al vencer un cobro, cuando alguien usa la web o la demo, y una revisión cada 30 minutos. El despertador visita `/health`, que no toca la base, así que no la mantiene despierta.

## 1. Crear la base en Neon

1. Crea una cuenta en neon.tech y un proyecto nuevo (`cobrale`), en la región **AWS US East (N. Virginia)**, la misma de Render.
2. En el panel del proyecto, da clic en **Connect**.
3. **Desactiva "Connection pooling"** y copia la cadena de conexión. Empieza con `postgresql://` y su host **no** debe decir `-pooler`. Cóbrale usa candados de Postgres que no funcionan a través del pooler.

No hace falta crear tablas: Cóbrale las crea solo al arrancar.

## 2. Darle a Render acceso al repositorio

El repositorio `bot-cobros-codi` es privado y está en la cuenta de GitHub `SamuelPKM`.

1. En dashboard.render.com: **New > Blueprint**. No uses "Web Service": esa opción no lee `render.yaml`.
2. Si `bot-cobros-codi` no aparece, da clic en **Configure GitHub** e instala Render en la cuenta **SamuelPKM**, con acceso a `bot-cobros-codi`.

## 3. Aplicar el Blueprint

1. Elige `bot-cobros-codi`, rama `main`. En **Blueprint Path** debe decir `render.yaml`.
2. Llena las variables:
    - `PEY_API_KEY`: una API key nueva de portal.pey.mx.
    - `DATABASE_URL`: la cadena de Neon del paso 1.
    - `DEMO_ACCOUNT_EMAIL` y `DEMO_ACCOUNT_PASSWORD`: la cuenta con la que entrará el jurado a la web, por ejemplo `jurado@cobrale.mx` y una contraseña de al menos 10 caracteres. Van en las instrucciones de prueba.
    - `TRUSTED_EMAILS`: tu correo, si quieres cobrar sin el límite del modo prueba mientras Banxico valida tu CLABE.
    - `PEY_WEBHOOK_SECRET`: déjalo vacío por ahora; se llena en el paso 6.
    - `SECRETS_KEY` no la pide: Render la genera sola. Cifra las API keys de pey que conectan los negocios desde Ajustes. **No la cambies**: si cambia, cada negocio tendrá que volver a conectar su cuenta.
3. Da clic en **Apply**.

**Si ya habías creado el servicio** con una versión anterior del Blueprint, agrega esas variables a mano en el servicio > **Environment**. La más importante es `DATABASE_URL`. Para `SECRETS_KEY`, usa **Generate** en Render o pega un texto aleatorio de 32 caracteres o más (por ejemplo, la salida de `openssl rand -base64 48`), y guárdalo en un lugar seguro.

### Si creaste el servicio a mano, sin el Blueprint

En el servicio > **Settings**:

| Campo | Valor |
| --- | --- |
| Language | Node |
| Branch | `main` |
| Build Command | `npm ci --omit=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Variables | `PEY_API_KEY`, `DATABASE_URL`, `PEY_WEBHOOK_SECRET`, `DEMO_ENABLED=true`, `DEMO_MAX_AMOUNT=1`, `DEMO_MERCHANT_NAME=Negocio de prueba`, `TRUST_PROXY=true`, y opcionalmente `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD` y `TRUSTED_EMAILS` |

## 4. Revisar que funciona

En el servicio `cobrale` está tu URL, por ejemplo `https://cobrale.onrender.com`.

- `https://<tu-url>/health` responde `{"ok":true}`.
- `https://<tu-url>/` muestra la página de inicio, y `/demo` la demo.
- En **Logs** aparece `Base de datos: Postgres (DATABASE_URL)`. Si dice `PGlite`, falta `DATABASE_URL`: los datos se borrarían en cada despliegue.

## 5. Mantener despierto el servicio

En cron-job.org o UptimeRobot (gratis), crea una tarea que visite `https://<tu-url>/health` **cada 10 minutos**. UptimeRobot además te avisa por correo si el servicio se cae.

## 6. Conectar el webhook de pey

1. En portal.pey.mx > **Desarrollador**, en el engrane de tu API key, crea el webhook con la URL `https://<tu-url>/webhooks/pey`.
2. Copia el secreto (`whsec_...`); solo se muestra una vez.
3. En Render, servicio `cobrale` > **Environment**: pon el secreto en `PEY_WEBHOOK_SECRET` y da clic en **Save**. Render vuelve a desplegar solo.

El mismo webhook avisa cuando una CLABE de un comerciante queda activa (`bank.account.updated`).

## 7. Primer cobro real

1. Abre `https://<tu-url>/registro` y crea tu cuenta.
2. En el panel, crea un cobro **Al celular** de $0.01 a tu número, da clic en **Enviar cobro** y apruébalo en la app de tu banco.
3. El estado cambia a **Pagado** solo, sin recargar.

Si no llega, revisa **Logs** en Render y **Webhook Logs** en portal.pey.mx.

## Operación

| Para | Dónde |
| --- | --- |
| Desplegar una nueva versión | Push a `main`; Render despliega solo |
| Cambiar secretos o límites | Servicio > **Environment** |
| Ver los registros | Servicio > **Logs** |
| Ver o respaldar los datos | Neon > **Tables** o **SQL Editor**; Neon guarda historial para restaurar |
| Más instancias | Plan de pago de Render > **Scaling**. Cóbrale ya está listo: todo el estado vive en Postgres |
| Activar WhatsApp | Variables `WHATSAPP_*` (ver el README) |
