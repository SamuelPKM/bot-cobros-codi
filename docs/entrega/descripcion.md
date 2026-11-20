# Descripción del proyecto

> Borrador, máximo 500 palabras. Agrega métricas y testimonios cuando se pruebe con un negocio real.

**Cóbrale: cobra con CoDi escribiendo un mensaje.**

## El problema

Quien vive de su oficio (una barbería, una fonda, un plomero) cobra casi siempre en efectivo o con transferencias que revisa a mano. Las terminales cobran comisión y renta, y las apps de cobro piden instalar algo más. CoDi resuelve el pago (sin comisión, instantáneo, desde el banco), pero cobrar con CoDi todavía no es tan fácil como mandar un mensaje.

## Qué hace

Cóbrale es un asistente de chat con una web sencilla detrás. El comerciante escribe como le escribiría a alguien:

> cobra 150 a 5512345678 corte de pelo

El asistente le muestra el cobro, pide un "sí" y manda la solicitud de pago CoDi al celular del cliente. Cuando el cliente aprueba el pago en la app de su banco, el comerciante recibe "✅ Pagado", con la clave de rastreo de Banxico.

Sin el teléfono del cliente, escribe `qr 150 corte` y recibe un QR para el mostrador, o `liga 150 corte` y recibe una liga de pago para mandarla por donde quiera. Si un cobro al celular expira, el asistente ofrece la liga como plan B. Con `resumen` ve lo que cobró en el día y lo que sigue pendiente.

También cobra desde la web: un panel que se actualiza solo, con el QR o la liga de cada cobro y exportación a CSV. Ahí registra su CLABE para que los pagos le lleguen directo.

Está pensado para pymes donde el dueño también vende: el administrador cobra y además ve lo de todo el negocio y los totales de cada persona. Sus vendedores cobran desde su propio WhatsApp y ven solo sus cobros.

## Cómo usa el API de pey

- **Push CoDi** (`POST /codi/pn`) para cobrar al celular del cliente.
- **QR CoDi** (`POST /codi/qr`) para cobrar en persona.
- **Ligas de pago** (`POST /payment-link/create`) como alternativa sin teléfono, con CoDi o tarjeta.
- **Cuentas bancarias** (`POST /bank-account`) para que cada comerciante reciba en su propia CLABE: sus push y QR se crean con su `bankAccountId`.
- **Webhooks firmados** (`codi.pn.payment_received`, `codi.qr.payment_received`, `payment_link.status_updated`, `bank.account.updated`), verificados con Standard Webhooks, para avisar del pago en el momento.
- **Consulta de transacciones** (`GET /transaction/{id}`, `GET /transaction/codi/qr/{id}`) para confirmar cada pago antes de avisar.

Cada cobro lleva su identificador en `metadata`, así un pago se liga a su cobro aunque se pierda una respuesta. Como el API no tiene llave de idempotencia, el asistente nunca reintenta un cobro solo: prefiere avisar antes que cobrar dos veces.

## Por qué importa

El comerciante no instala nada ni aprende una app: usa el chat que ya usa todo el día. Quien paga ve el nombre del negocio y el concepto en su banco, y el dinero llega al momento y sin comisión. [Agregar métricas de la prueba con un negocio real.]

## Demo

La demo pública usa el mismo asistente, en una página web, con cobros reales de hasta $1.00: [URL]/demo. El panel se prueba con la cuenta de prueba de las instrucciones.
