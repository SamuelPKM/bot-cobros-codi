# Arquitectura de Cóbrale

Cóbrale tiene tres canales (web, WhatsApp y la demo pública) sobre un mismo núcleo de cobros. Todo el estado vive en Postgres, así que cualquier instancia del servidor atiende cualquier petición.

```
  Comerciante                    Cliente que paga
  ├─ Web (/panel) ─┐                    │
  ├─ WhatsApp ─────┼─► núcleo de cobros ─► API de pey ─► CoDi / Banxico
  └─ Demo (/demo) ─┘     (charges.js)        │
                              │              │ webhooks firmados
                              ▼              ▼
                           Postgres ◄── /webhooks/pey
```

## Capas

| Capa | Archivos | Responsabilidad |
| --- | --- | --- |
| Canales | `src/web/`, `src/bot.js`, `src/demo.js` | Entender lo que pide la persona y responderle. No contienen reglas de cobro |
| Núcleo | `src/charges.js` | Push, QR, liga, confirmación, modo prueba, CLABE, avisos de pago y barrido |
| Integraciones | `src/pey.js`, `src/whatsapp.js`, `src/outbox.js` | APIs externas y a dónde va cada aviso |
| Datos | `src/db/` | Conexión, migraciones y todas las consultas (`store.js`). Ningún otro archivo escribe SQL |

Un cobro creado desde WhatsApp aparece en la web del mismo comerciante, y al revés: los dos canales comparten su `owner_key`.

## Qué la hace escalable

**El servidor no guarda estado propio.** Sesiones, límites de uso, eventos de webhook, mensajes de la demo y cobros viven en Postgres. Se pueden correr varias instancias detrás de un balanceador sin sesiones fijas. Se probó con dos instancias sobre la misma base: una sesión abierta en una sirve en la otra.

**Operaciones atómicas en la base.** Las cosas que no pueden pasar dos veces se resuelven con una sola sentencia SQL, no con memoria del proceso:

| Qué se evita | Cómo |
| --- | --- |
| Dos "sí" que mandan dos cobros | `UPDATE … WHERE status = 'awaiting_confirmation'`: solo una instancia gana |
| Procesar dos veces un webhook | `webhook-id` como llave primaria de `events` |
| Ejecutar dos veces un mensaje de WhatsApp | `INSERT … ON CONFLICT DO NOTHING` sobre el id del mensaje |
| Avisar dos veces un pago | `markPaid` solo cambia un cobro que no estaba pagado |
| Rebasar un límite repartiendo peticiones entre instancias | Contadores por ventana en `rate_limits` (`INSERT … ON CONFLICT DO UPDATE`) |

**El barrido corre en una sola instancia a la vez.** Expira cobros vencidos, reintenta avisos y revisa CLABEs en validación. Toma un candado de Postgres (`pg_try_advisory_lock`) y, si otra instancia lo tiene, no hace nada.

**Las migraciones son seguras al arrancar varias instancias.** Se aplican dentro de una transacción con candado (`pg_advisory_xact_lock`), y la tabla `schema_migrations` recuerda cuáles ya corrieron.

**La base puede dormir.** El barrido no corre cada 30 segundos para siempre: después de cada pasada calcula cuándo vence el próximo cobro y se agenda para entonces (`src/sweeper.js`). El panel deja de preguntar cuando no hay cobros en espera. Así una base serverless como Neon se suspende cuando no hay actividad y no gasta su cupo.

**Índices para las consultas frecuentes**: cobros por dueño y fecha, cobros por vencer, avisos pendientes y push por teléfono.

## Dinero a la cuenta de cada comerciante

Cada comerciante registra su CLABE desde la web (`POST /bank-account` de pey). La CLABE se valida antes con el dígito verificador de Banxico.

Mientras Banxico la activa, el comerciante está en **modo prueba**: cobros de hasta `DEMO_MAX_AMOUNT`, que llegan a la cuenta ligada a la API key. Cuando la cuenta queda `ACTIVE`, sus push y QR se crean con su `bankAccountId` y el dinero le llega directo. pey no acepta `bankAccountId` en las ligas de pago: esas siempre liquidan a la cuenta de la API key.

pey avisa por webhook cuando una cuenta queda activa, pero no cuando Banxico la rechaza. Por eso el barrido revisa cada hora las cuentas en validación.

## Desarrollo y pruebas

Sin `DATABASE_URL`, Cóbrale usa PGlite: un Postgres real compilado a WebAssembly que corre dentro de Node. El SQL es el mismo en desarrollo, pruebas y producción, sin instalar nada.

Las pruebas corren sobre PGlite (`npm test`) y también contra un Postgres real (`npm run test:postgres`), que es el mismo camino que producción.

## Siguientes pasos si crece

- **Cola de trabajos** para procesar webhooks y avisos fuera de la petición HTTP (por ejemplo con `pg-boss` sobre el mismo Postgres), si el volumen lo pide.
- **Plan de pago de Render** para tener varias instancias siempre encendidas.
- **WhatsApp con número verificado** de Meta, para escribirle a cualquier comerciante, no solo a destinatarios de prueba.
