# Declaración de componentes previos y de terceros

> Borrador. Revisa las fechas y los nombres antes de entregar. Si el equipo cambia o se agregan librerías, actualízalo.

## Trabajo previo al Periodo de Construcción

El Periodo de Construcción empezó el 14 de noviembre de 2026. Antes de esa fecha, el 12 y 13 de noviembre (hora de la Ciudad de México), se escribió una primera versión del código, sin probarla contra el API real de pey:

| Fecha (CDMX) | Commit | Qué existía |
| --- | --- | --- |
| 12 nov 2026, 23:09 | `6e4697b` | Cliente del API de pey para push CoDi (`POST /codi/pn`) y consulta de transacciones; endpoint de webhook con verificación de firma; parser del comando `cobra <monto> a <teléfono> <concepto>` |
| 12 nov 2026, 23:20 | `85ec857` | Bot de WhatsApp: confirmación del comerciante, base de datos de cobros, aviso de pago, expiración, liga de pago como plan B y resumen del día |

El historial completo está en el repositorio, con fechas.

## Construido durante el Periodo de Construcción

Desde el 14 de noviembre de 2026:

- Cobro con QR CoDi (`POST /codi/qr`), con imagen generada en el servidor y confirmación del pago por webhook y por consulta al API.
- Liga de pago directa, sin necesitar el teléfono del cliente.
- Demo web pública con límites de uso, que usa el mismo asistente que WhatsApp.
- Envío de imágenes por WhatsApp.
- Web completa: página de inicio, cuentas de comerciante (registro, inicio de sesión), panel de cobros en vivo, exportación a CSV y ajustes.
- Registro de la CLABE de cada comerciante en pey, con cobros a su propia cuenta y modo prueba mientras Banxico la valida.
- Vinculación de WhatsApp a una cuenta con código.
- Base de datos en Postgres, preparada para varias instancias (sesiones, límites y barrido compartidos).
- Pruebas automáticas de todo lo anterior.
- [Agregar aquí lo que se haga después: primer cobro real, conexión con la app de Meta, prueba con un negocio, etc.]

## Componentes de terceros

| Componente | Uso | Licencia |
| --- | --- | --- |
| [API de pey](https://docs.pey.mx) | Cobros CoDi por push, QR y liga de pago; webhooks de pago | Términos y condiciones del API de pey |
| WhatsApp Cloud API (Meta) | Recibir y mandar mensajes del comerciante | Términos de Meta para WhatsApp Business |
| [Node.js](https://nodejs.org) 22 | Entorno de ejecución | MIT |
| [Express](https://expressjs.com) 5 | Servidor HTTP | MIT |
| [node-postgres (`pg`)](https://node-postgres.com) | Conexión a Postgres | MIT |
| [PGlite](https://pglite.dev) | Postgres dentro de Node para desarrollo y pruebas | Apache-2.0 |
| [Neon](https://neon.tech) | Postgres administrado (servicio) | Términos de Neon |
| [Render](https://render.com) | Hospedaje del servidor (servicio) | Términos de Render |
| [standardwebhooks](https://www.npmjs.com/package/standardwebhooks) | Verificar la firma de los webhooks de pey | MIT |
| [qrcode](https://www.npmjs.com/package/qrcode) | Dibujar la imagen del QR CoDi | MIT |

Las dependencias que estas librerías traen consigo están en `package-lock.json`.

No se usaron diseños, contenidos ni productos de terceros además de los listados. El proyecto no se ha presentado en otros concursos.

## Herramientas de inteligencia artificial

Parte del código y de la documentación se escribió con ayuda de un asistente de IA. Las reglas no exigen declararlo; se menciona por transparencia.
