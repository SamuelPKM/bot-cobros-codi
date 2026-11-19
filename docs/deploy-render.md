# Desplegar Cóbrale en Render

El archivo [`render.yaml`](../render.yaml) es un *Blueprint*: Render lo lee y crea en un solo paso el servicio web, el disco persistente y las variables de entorno.

| Recurso | Configuración |
| --- | --- |
| Servicio | Web Service `cobrale`, plan Starter (siempre encendido), región Virginia |
| Disco | 1 GB en `/var/data`, para la base de datos SQLite |
| Node.js | Versión 22, fijada en `.node-version` |
| Despliegues | Automáticos con cada commit a `main` |
| Salud | Render revisa `/health` |

Costo: unos $7 USD al mes del plan Starter más $0.25 del disco. Confírmalo en render.com/pricing. El plan gratis no sirve: se apaga sin tráfico y no admite discos, así que se perderían los cobros.

## 1. Conectar GitHub con Render

1. Crea tu cuenta en render.com y agrega un método de pago.
2. En **Account Settings > Git**, conecta GitHub y dale acceso al repositorio `bot-cobros-codi`.

## 2. Aplicar el Blueprint

1. En el panel: **New > Blueprint**.
2. Elige el repositorio `bot-cobros-codi` y la rama `main`. Render encuentra `render.yaml` y muestra lo que va a crear.
3. Te pide dos valores:
    - `PEY_API_KEY`: una API key nueva de portal.pey.mx (no una que hayas compartido por chat).
    - `PEY_WEBHOOK_SECRET`: déjalo vacío por ahora; se llena en el paso 4.
4. Da clic en **Apply**. El primer despliegue tarda unos minutos.

## 3. Revisar que funciona

En el servicio `cobrale` está tu URL, por ejemplo `https://cobrale.onrender.com`. Si el nombre ya está ocupado, Render le agrega un sufijo.

- `https://<tu-url>/health` debe responder `{"ok":true}`.
- `https://<tu-url>/demo` debe mostrar la demo.

En **Logs** debe aparecer `Webhook de pey: sin configurar`: es lo esperado hasta el siguiente paso.

## 4. Conectar el webhook de pey

1. En portal.pey.mx > **Desarrollador**, en el engrane de tu API key, crea el webhook con la URL `https://<tu-url>/webhooks/pey`.
2. Copia el secreto (empieza con `whsec_`). Solo se muestra una vez.
3. En Render, en el servicio `cobrale` > **Environment**, pon el secreto en `PEY_WEBHOOK_SECRET` y guarda. Render vuelve a desplegar solo.

En **Logs** debe aparecer ahora `Webhook de pey: POST /webhooks/pey`.

## 5. Primer cobro real

Abre `https://<tu-url>/demo`, escribe `cobra 0.01 a <tu celular> prueba`, responde `sí` y aprueba el pago en la app de tu banco. El aviso "✅ Pagado" aparece en la demo.

Si no llega, revisa **Logs** en Render y **Webhook Logs** en portal.pey.mx.

## Operación

| Para | Dónde |
| --- | --- |
| Desplegar una nueva versión | Haz push a `main`; Render despliega solo |
| Cambiar secretos o el monto de la demo | Servicio > **Environment** |
| Ver los registros | Servicio > **Logs** |
| Activar WhatsApp | En **Environment**, agrega `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` y `MERCHANTS` (ver el README) |
| Usar un dominio propio | Servicio > **Settings > Custom Domains**; luego pon `PUBLIC_BASE_URL` con ese dominio |

Con un disco conectado, Render detiene el servicio unos segundos en cada despliegue, porque el disco solo puede estar montado en una instancia a la vez. Evita desplegar mientras alguien está pagando, sobre todo entre el cierre de entregas y los resultados.

Para respaldos, Render toma instantáneas diarias del disco; se restauran desde **Disks** en el servicio.
