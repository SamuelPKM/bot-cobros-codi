# Descripción del proyecto

> Borrador, máximo 500 palabras. Falta el nombre: no puede incluir "pey" ni "CoDi" de forma que parezca oficial ("usa CoDi" sí, "CoDi Pagos" no). Agrega métricas y testimonios cuando se pruebe con un negocio real.

**[NOMBRE DEL PROYECTO]: cobra con CoDi escribiendo un mensaje.**

## El problema

Quien vive de su oficio (una barbería, una fonda, un plomero, una tienda de barrio) cobra casi siempre en efectivo o con transferencias que tiene que revisar a mano. Las terminales cobran comisión y renta, y las apps de cobro piden instalar algo más y aprender a usarlo. CoDi resuelve el pago (sin comisión, instantáneo y desde la app del banco), pero cobrar con CoDi todavía no es tan fácil como mandar un mensaje.

## Qué hace

[NOMBRE DEL PROYECTO] es un asistente de chat. El comerciante escribe como le escribiría a alguien:

> cobra 150 a 5512345678 corte de pelo

El asistente le muestra el cobro, pide un "sí" y manda la solicitud de pago CoDi al celular del cliente. Cuando el cliente aprueba el pago en la app de su banco, el comerciante recibe "✅ Pagado", con la clave de rastreo de Banxico.

Si el comerciante no tiene el teléfono del cliente, escribe `qr 150 corte` y recibe un código QR para que el cliente lo escanee en el mostrador, o `liga 150 corte` y recibe una liga de pago para mandarla por donde quiera. Si un cobro al celular expira, el asistente ofrece la liga como plan B. Con `resumen` ve lo que cobró en el día y lo que sigue pendiente.

## Cómo usa el API de pey

- **Push CoDi** (`POST /codi/pn`) para cobrar al celular del cliente.
- **QR CoDi** (`POST /codi/qr`) para cobrar en persona.
- **Ligas de pago** (`POST /payment-link/create`) como alternativa sin teléfono, con CoDi o tarjeta.
- **Webhooks firmados** (`codi.pn.payment_received`, `codi.qr.payment_received`, `payment_link.status_updated`), verificados con Standard Webhooks, para avisar del pago en el momento.
- **Consulta de transacciones** (`GET /transaction/{id}` y `GET /transaction/codi/qr/{id}`) para confirmar cada pago contra el API antes de avisar, y para no dar por expirado un cobro que sí se pagó.

Cada cobro lleva su identificador en `metadata`, así un pago se liga a su cobro aunque se pierda una respuesta de red. Como el API no tiene llave de idempotencia, el asistente nunca reintenta un cobro por su cuenta: prefiere avisar al comerciante antes que mandarle dos cobros a su cliente.

## Por qué importa

El comerciante no instala nada ni aprende una app: usa el chat que ya usa todo el día. Quien paga ve el nombre del negocio y el concepto en su banco, y el dinero llega al momento y sin comisión. [Agregar métricas de la prueba con un negocio real.]

## Demo

La demo pública usa el mismo asistente, en una página web, con cobros reales de hasta $1.00: [URL DE LA DEMO]
