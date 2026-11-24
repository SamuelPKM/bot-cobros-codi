# Descripción del proyecto

> Borrador, máximo 500 palabras. Agrega métricas y testimonios cuando se pruebe con un negocio real.

**Cóbrale: cobra con CoDi escribiendo un mensaje.**

## El problema

Quien vive de su oficio (una barbería, una fonda, un plomero) cobra en efectivo o con transferencias que revisa a mano; las terminales cobran comisión y renta. CoDi resuelve el pago (sin comisión, instantáneo, desde el banco), pero cobrar con CoDi todavía no es tan fácil como mandar un mensaje.

## Qué hace

Cóbrale es un asistente de chat con una web sencilla detrás. El comerciante escribe como le escribiría a alguien:

> cobra 150 a 5512345678 corte de pelo

El asistente le muestra el cobro, pide un "sí" y manda la solicitud de pago CoDi al celular del cliente. Cuando el cliente la aprueba en la app de su banco, el comerciante recibe "✅ Pagado", con la clave de rastreo.

Sin el teléfono del cliente, escribe `qr 150 corte` y recibe un QR para el mostrador, o `liga 150 corte` y recibe una liga de pago para mandarla por donde quiera. Si el push no le llega al cliente, `liga` le da la liga de ese mismo cobro. Con `resumen` ve lo cobrado en el día y lo pendiente.

También cobra desde la web: push, QR o liga, con la página del cobro que cambia sola a "Pagado", el resumen del día y la descarga de cobros en CSV.

Está pensado para pymes donde el dueño también vende: el administrador cobra, ve todo el negocio y los totales por persona, invita a su equipo con una liga y pone un tope por cobro a cada vendedor. Cada vendedor cobra desde la web o su propio WhatsApp y ve solo sus cobros.

**Cada negocio usa su propia API key de pey**, guardada cifrada: el dinero llega directo a su cuenta y nadie más lo concentra.

## Cómo usa el API de pey

- **Push CoDi** (`POST /codi/pn`) para cobrar al celular del cliente.
- **QR CoDi** (`POST /codi/qr`) para cobrar en persona; el QR se dibuja con el `qrString` tal cual.
- **Ligas de pago** (`POST /payment-link/create`) como alternativa sin teléfono, con CoDi o tarjeta.
- **Webhooks firmados** (Standard Webhooks), una URL por negocio, para avisar del pago al momento.
- **Consulta de transacciones y ligas** (`GET /transaction/{id}`, `GET /transaction/codi/qr/{id}`, `GET /payment-link/{id}`) para confirmar cada pago y su monto antes de avisar, y para conciliar si un webhook no llega.

Como el API no tiene llave de idempotencia, un cobro nunca se reintenta solo: si se corta la conexión, el asistente avisa antes que arriesgarse a cobrar dos veces.

## Por qué importa

El comerciante no instala nada: usa el chat de todos los días, o una web. Quien paga ve el nombre del negocio y el concepto en su banco, y el dinero llega al momento y sin comisión. [Agregar métricas de la prueba con un negocio real.]

## Demo

La demo pública usa el mismo asistente, en una página web, con cobros reales de hasta $1.00: [URL]/demo.
