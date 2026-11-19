# Desplegar Cóbrale en Render (plan gratis)

El archivo [`render.yaml`](../render.yaml) es un *Blueprint*: Render lo lee y crea en un solo paso el servicio web con sus variables de entorno.

| Recurso | Configuración |
| --- | --- |
| Servicio | Web Service `cobrale`, plan Free, región Virginia |
| Node.js | Versión 22, fijada en `.node-version` |
| Despliegues | Automáticos con cada commit a `main` |
| Salud | Render revisa `/health` |

## Lo que implica el plan gratis

- **Se apaga tras 15 minutos sin visitas** y tarda alrededor de un minuto en despertar. Se evita con un despertador externo (paso 4).
- **La base de datos se borra en cada despliegue o reinicio**, porque el plan gratis no admite discos. Se pierden las conversaciones de la demo, el historial del resumen y los cobros que estuvieran pendientes en ese momento. Los pagos ya hechos no se pierden: siguen en pey.
- **Render da 750 horas gratis al mes** por cuenta. Un servicio encendido todo el mes usa unas 744, así que alcanza solo si es el único servicio gratis activo de la cuenta.

Para que la demo quede estable al final, no despliegues nada después de congelar cambios (12 de diciembre).

## 1. Darle a Render acceso al repositorio

El repositorio `bot-cobros-codi` es privado y está en la cuenta de GitHub `SamuelPKM`.

1. En dashboard.render.com: **New > Blueprint**. Ojo: no "Web Service", porque esa opción no lee `render.yaml`.
2. Si `bot-cobros-codi` no aparece, da clic en **Configure GitHub** (o **Connect account**).
3. En GitHub, con la sesión de `SamuelPKM`, instala Render en la cuenta **SamuelPKM**. Elige **Only select repositories**, marca `bot-cobros-codi` y da clic en **Install**.

## 2. Aplicar el Blueprint

1. Elige `bot-cobros-codi`, rama `main`. En **Blueprint Path** debe decir `render.yaml`.
2. En **Blueprint Name** escribe `cobrale`. Render muestra que va a crear el servicio `cobrale` en plan Free.
3. Llena las variables:
    - `PEY_API_KEY`: una API key nueva de portal.pey.mx, no una que hayas compartido por chat.
    - `PEY_WEBHOOK_SECRET`: déjalo vacío por ahora; se llena en el paso 5.
4. Da clic en **Apply**. El primer despliegue tarda unos minutos.

### Si creaste el servicio a mano, sin el Blueprint

En el servicio > **Settings**:

| Campo | Valor |
| --- | --- |
| Language | Node |
| Branch | `main` |
| Build Command | `npm ci --omit=dev && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/health` |
| Variables | `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `DATABASE_FILE=data/cobros.db`, `DEMO_ENABLED=true`, `DEMO_MAX_AMOUNT=1`, `DEMO_MERCHANT_NAME=Negocio de prueba`, `TRUST_PROXY=true` |

`npm run build` no compila nada: revisa que la versión de Node sea la correcta y que el código cargue. Si dice que la versión de Node es vieja, revisa que el repo tenga el archivo `.node-version`.

## 3. Revisar que funciona

En el servicio `cobrale` está tu URL, por ejemplo `https://cobrale.onrender.com`. Si el nombre ya está ocupado, Render le agrega un sufijo.

- `https://<tu-url>/health` debe responder `{"ok":true}`.
- `https://<tu-url>/demo` debe mostrar la demo.

En **Logs** debe aparecer `Webhook de pey: sin configurar`. Es lo esperado hasta el paso 5.

## 4. Mantenerlo despierto

Con cualquiera de estos servicios gratuitos, crea un monitor o tarea que visite `https://<tu-url>/health` **cada 10 minutos**:

- **cron-job.org**: **Create cronjob**, pon la URL y en el horario elige "Every 10 minutes".
- **UptimeRobot**: **Add New Monitor** de tipo HTTP(s), con un intervalo de 10 minutos. Además te avisa por correo si el servicio se cae.

## 5. Conectar el webhook de pey

1. En portal.pey.mx > **Desarrollador**, en el engrane de tu API key, crea el webhook con la URL `https://<tu-url>/webhooks/pey`.
2. Copia el secreto, que empieza con `whsec_`. Solo se muestra una vez.
3. En Render, servicio `cobrale` > **Environment**: pon el secreto en `PEY_WEBHOOK_SECRET` y da clic en **Save**. Render vuelve a desplegar solo.

En **Logs** debe aparecer ahora `Webhook de pey: POST /webhooks/pey`.

## 6. Primer cobro real

Abre `https://<tu-url>/demo`, escribe `cobra 0.01 a <tu celular> prueba`, responde `sí` y aprueba el pago en la app de tu banco. El aviso "✅ Pagado" aparece en la demo.

Si no llega, revisa **Logs** en Render y **Webhook Logs** en portal.pey.mx.

## Operación

| Para | Dónde |
| --- | --- |
| Desplegar una nueva versión | Haz push a `main`; Render despliega solo (y la base empieza de cero) |
| Cambiar secretos o el monto de la demo | Servicio > **Environment** (también reinicia y borra la base) |
| Ver los registros | Servicio > **Logs** |
| Activar WhatsApp | En **Environment**, agrega `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` y `MERCHANTS` (ver el README) |
| Pasar a un plan de pago con disco | Instance Type Starter, agrega un disco en `/var/data` y cambia `DATABASE_FILE=/var/data/cobros.db` |
