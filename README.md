# Bot de cobros CoDi

Bot de WhatsApp para que un negocio cobre con CoDi desde el chat, usando la API de [pey](https://docs.pey.mx).

El comerciante escribe:

```
cobra 150 a 5512345678 corte de pelo
```

El bot le pide confirmación, manda la solicitud de cobro al celular del cliente y avisa **"✅ Pagado"** en cuanto el banco confirma.

Requiere Node.js 22 o superior. No hay sandbox de pey: se prueba en producción con $0.01.

## Qué entiende el bot

| Mensaje del comerciante | Qué pasa |
| --- | --- |
| `cobra 150 a 5512345678 corte de pelo` | Guarda el cobro y pide confirmación. Todavía no cobra nada |
| `sí` | Manda el cobro CoDi (push) al cliente. Vence en 6 minutos |
| `no` | Cancela el cobro por confirmar |
| `liga` | Plan B: genera una liga de pago del último cobro que expiró, para reenviarla al cliente |
| `resumen` | Lo cobrado hoy, lo pendiente y lo expirado |
| `ayuda` | Lista de comandos |

Solo pueden cobrar los números listados en `MERCHANTS`.

## Configuración

```bash
npm install
```

```bash
cp .env.example .env
```

| Variable | De dónde sale |
| --- | --- |
| `PEY_API_KEY` | portal.mipey.mx > Desarrollador > "Crear API Key" |
| `PEY_WEBHOOK_SECRET` | Engrane de la API key > "Crear Webhook". Empieza con `whsec_` y se muestra una sola vez |
| `WHATSAPP_TOKEN` | Token de acceso de tu app en developers.facebook.com |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > Configuración de la API (el ID, no el número) |
| `WHATSAPP_APP_SECRET` | Configuración de la app > Básica > "Clave secreta de la app" |
| `WHATSAPP_VERIFY_TOKEN` | Lo inventas tú; se escribe igual al registrar el webhook en Meta |
| `MERCHANTS` | `teléfono=Nombre del negocio`, separados por `;` |
| `PUBLIC_BASE_URL` | URL pública HTTPS del servidor; solo hace falta para las ligas de pago |

Las variables de WhatsApp son opcionales en conjunto: sin ellas el servidor solo recibe los webhooks de pey, que es lo que necesita el primer cobro real.

La API key de pey necesita una cuenta de pago `codi` activa. Mientras Banxico activa la tuya (5 días hábiles), puedes ligar la cuenta de prueba que pey publica en su guía "Crear una API key": se activa de inmediato, pero **los pagos a esa cuenta no se devuelven**.

## Primer cobro real (sin WhatsApp)

1. Levanta el servidor:

   ```bash
   npm start
   ```

2. Dale una URL pública HTTPS. En tu computadora, con un túnel:

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. En el portal de pey registra el webhook `https://<tu-dominio>/webhooks/pey`, copia el secreto a `.env` y reinicia el servidor.

4. Manda el push a tu celular (el número debe estar registrado en CoDi en la app de tu banco):

   ```bash
   npm run push -- 5512345678
   ```

5. Aprueba el cobro en la app de tu banco. En la terminal del servidor debe aparecer `PAGADO  $0.01 MXN`.

Si no llega el webhook, consulta el estado en la API y revisa "Webhook Logs" en el portal:

```bash
npm run tx -- <transactionId>
```

## Conectar WhatsApp

1. Crea una app en developers.facebook.com, agrégale el producto WhatsApp y usa el número de prueba que te da Meta.
2. Llena las variables `WHATSAPP_*` y `MERCHANTS` en `.env` y reinicia el servidor.
3. En WhatsApp > Configuración, registra el webhook `https://<tu-dominio>/webhooks/whatsapp` con tu `WHATSAPP_VERIFY_TOKEN` y suscríbete al campo `messages`.
4. Desde un número listado en `MERCHANTS`, escríbele al número del bot: `cobra 0.01 a <tu celular> prueba`.

## Pruebas

```bash
npm test
```

No tocan las APIs reales: usan un pey y un WhatsApp simulados, y firman los webhooks igual que los originales.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `src/app.js` | Servidor: webhooks de pey y de WhatsApp, y páginas de regreso de la liga |
| `src/bot.js` | Lógica del bot: confirmación, envío, aviso de pago, expiración, liga y resumen |
| `src/command.js` | Parser de `cobra <monto> a <teléfono> <concepto>` y normalización de teléfonos |
| `src/messages.js` | Todos los textos que ve el comerciante |
| `src/db.js` | Base de datos de cobros (SQLite integrado en Node, archivo `data/cobros.db`) |
| `src/pey.js` | Cliente de la API de pey |
| `src/whatsapp.js` | Cliente de WhatsApp Cloud API y verificación de su firma |
| `src/config.js`, `src/server.js` | Variables de entorno y arranque |
| `scripts/push.js`, `scripts/tx.js` | Comandos de terminal |

## Decisiones

- **Nada se cobra sin un "sí" del comerciante.** La confirmación caduca a los 10 minutos.
- **Las firmas se verifican sobre el cuerpo crudo**, nunca sobre el JSON re-serializado: Standard Webhooks para pey y `X-Hub-Signature-256` para WhatsApp.
- **El webhook es el aviso; la API es la fuente de verdad.** Antes de marcar pagado se consulta `GET /transaction/{id}` (o `GET /payment-link/{id}`) y se compara el monto.
- **Cada cobro lleva su ID interno en `metadata.chargeId`.** Si la respuesta de pey se pierde por un timeout, el pago se liga al cobro de todos modos.
- **Un POST a pey nunca se reintenta solo.** La API no tiene llave de idempotencia: reintentar un push puede mandar dos cobros al mismo celular. El cobro queda en estado `unknown` y se le pide al comerciante que no lo repita.
- **Webhooks de pey: al menos una vez.** Si algo falla se responde 500 para que pey reintente; marcar pagado es idempotente.
- **Mensajes de WhatsApp: a lo mucho una vez.** Un mensaje repetido por Meta nunca se vuelve a ejecutar, porque repetir un "sí" duplicaría un cobro.
- **Antes de expirar un cobro se consulta la API**, por si el pago llegó y el webhook se perdió. Los avisos de "Pagado" que fallan se reintentan cada 30 segundos.
- **El concepto que ve quien paga incluye el nombre del negocio**, porque el banco solo muestra al titular de la cuenta receptora.
- Los secretos viven solo en `.env`, que está en `.gitignore`.

## Pendiente

- Cobro en persona con QR (`POST /codi/qr`).
- La versión de la Graph API (`WHATSAPP_API_VERSION`, por defecto `v23.0`) hay que confirmarla al crear la app en Meta.
