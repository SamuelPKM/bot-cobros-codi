# Deploy y primer cobro real ($0.01)

Arquitectura: **Render** (API) + **Neon** (Postgres) + **pey** (CoDi).
No hay sandbox de pey: todo se prueba en producción con **$0.01**.

> Los pasos marcados con 👤 los haces tú: crean cuentas o tocan dinero y credenciales.

## 1. 👤 Base de datos en Neon

1. Entra a [neon.tech](https://neon.tech) y crea un proyecto en la región **AWS US East 2 (Ohio)**.
2. En *Connection Details* elige la conexión **directa**: el host **no** debe llevar `-pooler`. Copia la cadena `postgresql://...?sslmode=require`.

   > No uses la conexión *pooled*: el barrido usa un advisory lock de sesión, y PgBouncer en modo transacción cambia de sesión entre consultas.

## 2. 👤 Cuenta y API key de pey

1. En [portal.mipey.mx](https://portal.mipey.mx) crea tu perfil.
2. En **Finanzas**, da de alta la cuenta CoDi con tu CLABE. Banxico tarda **hasta 5 días hábiles** en activarla.
   - Mientras tanto puedes usar la cuenta de pruebas que publica pey, que se activa de inmediato. **Lo que se paga ahí no se devuelve**: usa solo $0.01.
3. En **Desarrollador**, haz clic en **Crear API Key**, ligada a esa cuenta, y guárdala: es `PEY_API_KEY`.

## 3. 👤 Repositorio en GitHub

Crea un repositorio **privado** vacío y pásale la URL a Claude para subir la rama `main`. Render despliega desde ahí.

## 4. 👤 Servicio en Render

1. En [dashboard.render.com](https://dashboard.render.com), ve a **New → Blueprint** y elige el repositorio. Render lee `render.yaml`.
2. Llena los secretos que pide:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena **directa** de Neon (paso 1) |
   | `PEY_API_KEY` | La del paso 2 |
   | `PEY_WEBHOOK_SECRET` | Déjala vacía por ahora (paso 5) |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | El admin que se crea al primer arranque (contraseña de 8+ caracteres) |
   | `BUSINESS_NAME` | El nombre que verá quien paga en su banco (máximo 30 caracteres) |
   | `CORS_ORIGINS` | La URL de la demo de Expo web. Puede ir vacía hasta tenerla |

3. **Apply**. Al arrancar se corren las migraciones y se crea el admin.
4. Comprueba que responde (cambia la URL por la tuya):

   ```bash
   curl https://cobrale-api.onrender.com/health
   ```

   Debe responder `{"status":"ok","database":"up"}`.

## 5. 👤 Webhook de pey

1. En el portal de pey, ve a **Desarrollador**, abre el engrane de tu API key y elige **Crear Webhook**, con esta URL:
   `https://cobrale-api.onrender.com/webhooks/pey`
2. Copia el secreto (`whsec_...`). **Se muestra una sola vez.**
3. En Render, ve a **Environment**, pon `PEY_WEBHOOK_SECRET` con ese valor y guarda. Render redespliega solo.

## 6. 👤 Primer cobro real de $0.01

Usa **tu propio celular**, registrado en CoDi en la app de tu banco. Las reglas piden datos ficticios o propios.

```bash
API=https://cobrale-api.onrender.com
```

Entra como admin y da de alta un vendedor:

```bash
ADMIN=$(curl -s $API/auth/login -H 'content-type: application/json' -d '{"username":"TU_ADMIN","password":"TU_CLAVE"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

```bash
curl -s $API/users -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"username":"vendedor1","name":"Vendedor Uno","password":"vendedor-123","maxAmount":1}'
```

Entra como el vendedor y cobra $0.01 a tu celular:

```bash
SELLER=$(curl -s $API/auth/login -H 'content-type: application/json' -d '{"username":"vendedor1","password":"vendedor-123"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

```bash
curl -s $API/charges -H "authorization: Bearer $SELLER" -H 'content-type: application/json' -d '{"phone":"TU_CELULAR_10_DIGITOS","amount":0.01,"concept":"Prueba"}'
```

Aprueba el cobro en la app de tu banco. Luego revisa el cobro: debe decir `"status":"paid"` y `"paidVia":"push"`.

```bash
curl -s $API/charges/1 -H "authorization: Bearer $SELLER"
```

Plan B: si el push no llega, genera el QR y escanéalo con tu banco.

```bash
curl -s -X POST $API/charges/1/qr -H "authorization: Bearer $SELLER"
```

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `/health` responde `database: down` | `DATABASE_URL` y `DATABASE_SSL=true`; que el host no lleve `-pooler` |
| El push queda `failed` con "la cuenta… no está activa" | La cuenta CoDi todavía no está activa en pey (paso 2) |
| Se pagó pero sigue `pending` | En el portal de pey, revisa **Webhook Logs**. Un 401 indica que el secreto es incorrecto; un 503, que falta `PEY_WEBHOOK_SECRET`. De todos modos, el barrido lo concilia con pey cuando vence el intento (unos 6 minutos) |
| La primera petición tarda ~1 min | El plan free de Render se durmió. Para la evaluación usa el plan starter |
| La demo web da error de CORS | Agrega su origen exacto a `CORS_ORIGINS` (sin `/` al final) |
