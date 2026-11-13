# Bot de cobros CoDi

Bot de WhatsApp que cobra con CoDi usando la API de [pey](https://docs.pey.mx).

Por ahora cubre la meta **"Primer cobro real"**:

- `POST /webhooks/pey`: recibe los webhooks de pey, verifica la firma (Standard Webhooks), descarta entregas repetidas y confirma el pago contra la API antes de marcarlo como pagado.
- `npm run push`: manda un cobro CoDi por notificación push (por defecto de $0.01).
- `npm run tx`: consulta el estado de una transacción.

Requiere Node.js 22 o superior.

## Configuración

```bash
npm install
```

```bash
cp .env.example .env
```

Llena `.env` con:

| Variable | De dónde sale |
| --- | --- |
| `PEY_API_KEY` | portal.mipey.mx > Desarrollador > "Crear API Key" |
| `PEY_WEBHOOK_SECRET` | Engrane de la API key > "Crear Webhook". Empieza con `whsec_` y se muestra una sola vez |

La API key necesita una cuenta de pago `codi` activa. Mientras Banxico activa la tuya (5 días hábiles), puedes ligar la cuenta de prueba que pey publica en su guía "Crear una API key": se activa de inmediato, pero **los pagos a esa cuenta no se devuelven**.

## Primer cobro real, paso a paso

pey no tiene sandbox: se prueba en producción con $0.01.

1. Levanta el servidor:

   ```bash
   npm start
   ```

2. Dale una URL pública HTTPS. En tu computadora, con un túnel:

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. En el portal de pey, registra el webhook con esa URL más la ruta: `https://<tu-dominio>/webhooks/pey`. Copia el secreto a `.env` y reinicia el servidor.

4. Manda el push a tu celular (10 dígitos, sin +52). El número debe estar registrado en CoDi en la app de tu banco:

   ```bash
   npm run push -- 5512345678
   ```

5. Aprueba el cobro en la app de tu banco (tienes 6 minutos). En la terminal del servidor debe aparecer:

   ```
   PAGADO  $0.01 MXN  Prueba bot de cobros  (01...)
   ```

Si no llega el webhook, consulta el estado directo en la API y revisa "Webhook Logs" en el portal:

```bash
npm run tx -- <transactionId>
```

Para cobrar otro monto o concepto:

```bash
npm run push -- 5512345678 150 "Corte de pelo"
```

## Pruebas

```bash
npm test
```

No tocan la API real: usan un pey simulado y firman los webhooks con la librería oficial.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `src/pey.js` | Cliente de la API de pey (`createPush`, `getTransaction`) y `PeyError` |
| `src/webhook.js` | App de Express con el endpoint del webhook |
| `src/store.js` | Almacén en un archivo JSON (`data/cobros.json`); se cambiará por una base de datos |
| `src/server.js` | Arranque del servidor |
| `scripts/push.js`, `scripts/tx.js` | Comandos de terminal |

## Decisiones

- **La firma se verifica sobre el cuerpo crudo**, nunca sobre el JSON re-serializado. Firma inválida o timestamp con más de 5 minutos: 401.
- **El webhook es el aviso; la API es la fuente de verdad.** Antes de marcar pagado se consulta `GET /transaction/{id}` y se compara el monto.
- **Si el procesamiento falla se responde 500** y el evento no se marca como procesado, para que un reintento de pey lo vuelva a intentar.
- **Un POST nunca se reintenta solo.** La API no tiene llave de idempotencia: reintentar un push puede mandar dos cobros al mismo celular.
- Los secretos viven solo en `.env`, que está en `.gitignore`.
