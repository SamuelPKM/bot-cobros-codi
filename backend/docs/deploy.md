# Deploy y primer cobro real ($0.01)

Arquitectura: **Render** (API) + **Neon** (Postgres) + **pey** (CoDi).
No hay sandbox de pey: todo se prueba en producción con **$0.01**.

**Cada negocio usa su propia API key de pey.** La API no tiene credenciales de pey propias: un negocio se registra con `POST /businesses` dando SU API key, y sus cobros se hacen con ella. Así el dinero llega a la cuenta del titular de esas credenciales, como pide la regla 7.3(c) del hackatón, y nadie concentra pagos de terceros (regla 7.1).

> Los pasos marcados con 👤 los haces tú: crean cuentas o tocan dinero y credenciales.

## 1. 👤 Base de datos en Neon

1. Entra a [neon.tech](https://neon.tech) y crea un proyecto en la región **AWS US East 2 (Ohio)**.
2. En *Connection Details* elige la conexión **directa**: el host **no** debe llevar `-pooler`. Copia la cadena `postgresql://...?sslmode=require`.

   > No uses la conexión *pooled*: el barrido usa un advisory lock de sesión, y PgBouncer en modo transacción cambia de sesión entre consultas.

## 2. 👤 Repositorio en GitHub

Crea un repositorio **privado** vacío y pásale la URL a Claude para subir la rama `main`. Render despliega desde ahí.

## 3. 👤 Servicio en Render

1. En [dashboard.render.com](https://dashboard.render.com), ve a **New → Blueprint** y elige el repositorio. Render lee `render.yaml`.
2. Llena los secretos que pide:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena **directa** de Neon (paso 1) |
   | `PUBLIC_BASE_URL` | La URL del servicio, `https://<nombre>.onrender.com`, sin `/` al final |
   | `CORS_ORIGINS` | La URL de la demo de Expo web. Puede ir vacía hasta tenerla |

   `AUTH_SECRET` y `ENCRYPTION_KEY` los genera Render. **No cambies `ENCRYPTION_KEY` después**: con ella se cifran las API keys de los negocios, y si cambia ya no se pueden descifrar.

3. **Apply**. Al arrancar se corren las migraciones.
4. Comprueba que responde (cambia la URL por la tuya):

   ```bash
   curl https://cobrale-api.onrender.com/health
   ```

   Debe responder `{"status":"ok","database":"up"}`.

## 4. 👤 El negocio: cuenta y API key de pey

Esto lo hace **cada negocio** con su propia cuenta de pey. Para la demo del hackatón, el tuyo.

1. En [portal.mipey.mx](https://portal.mipey.mx) crea el perfil del negocio.
2. En **Finanzas**, da de alta la cuenta CoDi con la CLABE **del negocio**. Banxico tarda **hasta 5 días hábiles** en activarla.
   - Mientras tanto se puede usar la cuenta de pruebas que publica pey, que se activa de inmediato. **Lo que se paga ahí no se devuelve**: usa solo $0.01.
3. En **Desarrollador**, haz clic en **Crear API Key**, ligada a esa cuenta, y guárdala.

## 5. 👤 Registrar el negocio en la API

```bash
API=https://cobrale-api.onrender.com
```

```bash
curl -s $API/businesses -H 'content-type: application/json' -d '{"businessName":"Tacos Ana","adminName":"Ana López","username":"ana","password":"TU_CLAVE_8_O_MAS","peyApiKey":"TU_API_KEY_DE_PEY"}'
```

- La API valida la key con pey. Si pey no la reconoce, responde 400 y no crea nada.
- La respuesta trae el `accessToken` del admin y `business.webhookUrl`, la URL **de este negocio** para el paso 6.
- La API key queda cifrada; desde la API solo se ven sus últimos 4 caracteres.

## 6. 👤 Webhook del negocio en pey

1. En el portal de pey, ve a **Desarrollador**, abre el engrane de la API key del negocio y elige **Crear Webhook** con la `webhookUrl` del paso 5. Tiene la forma `https://cobrale-api.onrender.com/webhooks/pey/<slug>`.
2. Copia el secreto (`whsec_...`). **Se muestra una sola vez.**
3. Regístralo en la API como admin del negocio:

   ```bash
   ADMIN=$(curl -s $API/auth/login -H 'content-type: application/json' -d '{"username":"ana","password":"TU_CLAVE"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
   ```

   ```bash
   curl -s -X PATCH $API/businesses/me -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"peyWebhookSecret":"whsec_EL_SECRETO"}'
   ```

   Debe responder `"webhookConfigured": true`.

## 7. 👤 Primer cobro real de $0.01

Usa **tu propio celular**, registrado en CoDi en la app de tu banco. Las reglas piden datos ficticios o propios. El admin también puede cobrar; si quieres probar con un vendedor, dalo de alta primero:

```bash
curl -s $API/users -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"username":"vendedor1","name":"Vendedor Uno","password":"vendedor-123","maxAmount":1}'
```

Cobra $0.01 a tu celular:

```bash
curl -s $API/charges -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"phone":"TU_CELULAR_10_DIGITOS","amount":0.01,"concept":"Prueba"}'
```

Aprueba el cobro en la app de tu banco. Luego revisa el cobro: debe decir `"status":"paid"` y `"paidVia":"push"`.

```bash
curl -s $API/charges/1 -H "authorization: Bearer $ADMIN"
```

Plan B: si el push no llega, genera el QR y escanéalo con tu banco.

```bash
curl -s -X POST $API/charges/1/qr -H "authorization: Bearer $ADMIN"
```

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `/health` responde `database: down` | `DATABASE_URL` y `DATABASE_SSL=true`; que el host no lleve `-pooler` |
| `POST /businesses` responde 400 "API key… no es válida" | Copia la key otra vez desde portal.mipey.mx > Desarrollador |
| `POST /businesses` responde 502 | pey no respondió al validar; intenta de nuevo |
| El push queda `failed` con "la cuenta… no está activa" | La cuenta CoDi del negocio todavía no está activa en pey (paso 4) |
| Se pagó pero sigue `pending` | En el portal de pey, revisa **Webhook Logs**. Un 401 indica que el secreto no es el de esa API key; un 503, que falta registrar `peyWebhookSecret` (paso 6). De todos modos, el barrido lo concilia con pey cuando vence el intento (unos 6 minutos) |
| La primera petición tarda ~1 min | El plan free de Render se durmió. Para la evaluación usa el plan starter |
| La demo web da error de CORS | Agrega su origen exacto a `CORS_ORIGINS` (sin `/` al final) |
