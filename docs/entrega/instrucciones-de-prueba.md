# Instrucciones para probar el proyecto

> Borrador. Antes de entregar, cambia `[URL DE LA DEMO]` por la dirección real y revisa que sigan siendo menos de 1000 palabras.

[NOMBRE DEL PROYECTO] es un asistente de chat para que un negocio cobre con CoDi escribiendo un mensaje, como lo haría por WhatsApp. Se prueba en la demo web pública, sin cuenta ni invitación.

**Demo pública:** [URL DE LA DEMO]

## Antes de empezar

- Los cobros son **reales**: usan el ambiente productivo de pey. El dinero llega a la cuenta del proyecto y no se devuelve, así que prueba con **$0.01**. La demo no acepta más de $1.00 por cobro.
- Para el cobro por celular necesitas un número con CoDi activo en la app de tu banco.
- Para el QR necesitas una app bancaria que escanee códigos CoDi. Si solo tienes un dispositivo, abre la demo en una computadora y escanea con tu celular.

En la demo tú eres el comerciante, "Negocio de prueba". Tu cliente puedes ser tú mismo.

## Prueba 1: cobro al celular (push CoDi)

1. Abre la demo. El asistente te saluda y te explica qué puedes hacer.
2. Escribe `cobra 0.01 a <tu celular de 10 dígitos> prueba` y envíalo. El asistente te muestra el cobro y pide confirmación; todavía no envía nada.
3. Responde `sí`. Te llega una notificación de cobro CoDi a la app de tu banco, con el concepto "Negocio de prueba: prueba". Tienes 6 minutos para aprobarla.
4. Aprueba el pago en tu banco. En unos segundos aparece en la demo: **"✅ Pagado: $0.01 al … por "prueba""**, con la clave de rastreo de Banxico.

Si respondes `no` en el paso 3, el cobro se cancela y no se envía nada. Si dejas pasar los 6 minutos, el asistente avisa que el cobro expiró y ofrece una liga de pago: responde `liga`.

## Prueba 2: cobro con QR

1. Escribe `qr 0.01 prueba`.
2. El asistente te muestra un código QR CoDi, vigente por 15 minutos.
3. Escanéalo con la app de tu banco y paga.
4. Aparece **"✅ Pagado: $0.01 con QR por "prueba""** en la conversación.

## Prueba 3: liga de pago

1. Escribe `liga 0.01 prueba`.
2. El asistente te da una liga de pago de pey. Es lo que el comerciante reenvía a su cliente por cualquier medio, sin necesitar su teléfono.
3. Abre la liga y paga con CoDi o con tarjeta.
4. Aparece **"✅ Pagado"** en la conversación.

## Prueba 4: resumen del día

Escribe `resumen`. El asistente muestra cuánto se cobró hoy, qué cobros siguen pendientes y cuántos expiraron.

## Qué más puedes probar

| Escribe | Qué pasa |
| --- | --- |
| `ayuda` | La lista de comandos |
| `cobra 0.01 a 12345 prueba` | Explica que el teléfono debe tener 10 dígitos |
| `cobra 5 a <tu celular> prueba` | Explica el monto máximo de la demo |
| `cobra 0.01 al +52 1 55 1234 5678 prueba` | Entiende teléfonos con lada, espacios y el prefijo de WhatsApp |
| `sí` dos veces seguidas | El segundo no manda otro cobro |

Tu conversación se guarda en ese navegador: si recargas la página, sigue ahí.

## Cómo funciona por dentro

- **Push CoDi:** `POST /codi/pn` con el teléfono del cliente y 6 minutos de vigencia.
- **QR CoDi:** `POST /codi/qr` con 15 minutos de vigencia. El servidor dibuja el QR con el `qrString` tal cual lo entrega pey.
- **Liga de pago:** `POST /payment-link/create`.
- **Confirmación del pago:** pey avisa por webhook (`codi.pn.payment_received`, `codi.qr.payment_received` o `payment_link.status_updated`). El servidor verifica la firma con Standard Webhooks y confirma el pago contra la API (`GET /transaction/{id}` o `GET /payment-link/{id}`) antes de avisar.
- **Si el webhook no llega:** al vencer un cobro, el servidor consulta la API antes de marcarlo como expirado.

Cada cobro lleva su identificador interno en `metadata`, para ligar el pago aunque se pierda una respuesta. La demo usa el mismo asistente que atiende a los comerciantes por WhatsApp; solo cambia el canal.

## Límites de la demo

Para que nadie la use para molestar a terceros, la demo limita el monto a $1.00 por cobro, 10 cobros por hora por visitante y 3 cobros por hora a un mismo celular.

## Si algo no funciona

- **No te llega la notificación:** revisa que tu número tenga CoDi activo en tu banco. Puedes probar con el QR o la liga, que no lo necesitan.
- **El aviso de pago tarda:** puede tardar unos segundos en llegar. Si pasa el tiempo de vigencia, el servidor lo confirma con la API.
- **Llegaste a un límite:** espera una hora o abre la demo en otro navegador.

Repositorio: [ENLACE AL REPOSITORIO, opcional]
