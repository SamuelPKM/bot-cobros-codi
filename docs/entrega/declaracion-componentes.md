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

- Cobro con QR CoDi (`POST /codi/qr`), con imagen generada en el servidor, y liga de pago directa, sin necesitar el teléfono del cliente.
- Confirmación de cada pago por webhook y por consulta al API, con un barrido que concilia los que no llegan.
- Una primera web y la demo sobre Express, con la CLABE de cada comerciante registrada bajo la API key del proyecto. **Se reemplazó** (ver abajo) porque las reglas 7.1 y 7.3(c) piden que el dinero llegue al titular de las credenciales.
- API nueva en NestJS + TypeORM + PostgreSQL que reemplaza a la de Express: autenticación con JWT, roles, límites de uso y migraciones.
- Registro de cada negocio con **su propia API key de pey** (verificada con pey y guardada cifrada) y una URL de webhook por negocio, para que el dinero llegue directo a cada titular.
- Equipos: administradores y vendedores por negocio, invitaciones con liga de un solo uso, tope por cobro y totales por persona.
- Resumen del día y exportación de cobros a CSV.
- Motor de conversación compartido por WhatsApp y la demo; vinculación de WhatsApp con código, QR como imagen y aviso de pago.
- Demo web pública con límites de uso y una sesión aislada por visitante.
- Web nueva en Next.js: registro, entrar, panel, nuevo cobro con plan B y pago en vivo, equipo, ajustes, invitaciones, demo y páginas de regreso del pago.
- App móvil en Expo: entrar, panel del día, nuevo cobro con plan B, pago en vivo y aviso push que abre el cobro.
- Pruebas automáticas de todo lo anterior (unitarias y de extremo a extremo contra Postgres).
- Instalación en AWS: servidor EC2 con la API y la web en Docker detrás de Caddy, base de datos en Amazon RDS (Postgres), configuración cifrada en SSM Parameter Store y guiones para crear, actualizar y borrar todo.
- Identidad visual: logo de Cóbrale (dibujado en SVG por el equipo), pantallas de entrada y registro con ilustración de un cobro CoDi, y estilo de botones y campos.
- Aviso de privacidad (`/privacidad`).
- La demo pública dejó de mandar cobros push: como no pide cuenta, cualquiera podría mandar una solicitud de pago al celular de otra persona (regla 7, cobros no solicitados). En la demo se cobra con QR y liga; el push se prueba con la cuenta de prueba del panel.
- [Agregar aquí lo que se haga después: primer cobro real, conexión con la app de Meta, prueba con un negocio, etc.]

## Componentes de terceros

| Componente | Uso | Licencia |
| --- | --- | --- |
| [API de pey](https://docs.pey.mx) | Cobros CoDi por push, QR y liga de pago; webhooks de pago | Términos y condiciones del API de pey |
| WhatsApp Cloud API (Meta) | Recibir y mandar mensajes del comerciante | Términos de Meta para WhatsApp Business |
| [Node.js](https://nodejs.org) 22 | Entorno de ejecución | MIT |
| [NestJS](https://nestjs.com) 11 (sobre Express) | Framework de la API | MIT |
| [TypeORM](https://typeorm.io) | Acceso a Postgres y migraciones | MIT |
| [node-postgres (`pg`)](https://node-postgres.com) | Conexión a Postgres | MIT |
| [class-validator](https://github.com/typestack/class-validator) y class-transformer | Validación de los datos de entrada | MIT |
| [helmet](https://helmetjs.github.io) | Headers de seguridad HTTP | MIT |
| [Next.js](https://nextjs.org) 16 y [React](https://react.dev) 19 | Web | MIT |
| [Tailwind CSS](https://tailwindcss.com) 4 | Estilos de la web | MIT |
| [Expo](https://expo.dev) SDK 58, [React Native](https://reactnative.dev) y Expo Router | App móvil | MIT |
| expo-secure-store, expo-notifications y [react-native-svg](https://github.com/software-mansion/react-native-svg) | Sesión en el llavero del teléfono, avisos de pago y dibujo del QR en la app | MIT |
| [standardwebhooks](https://www.npmjs.com/package/standardwebhooks) | Verificar la firma de los webhooks de pey | MIT |
| [qrcode](https://www.npmjs.com/package/qrcode) | Dibujar la imagen del QR CoDi | MIT |
| [Jest](https://jestjs.io), [Vitest](https://vitest.dev) y [Testing Library](https://testing-library.com) | Pruebas automáticas | MIT |
| [PostgreSQL](https://www.postgresql.org) | Base de datos (16 en Docker para desarrollo; la versión de Amazon RDS en producción) | PostgreSQL License |
| [Amazon Web Services](https://aws.amazon.com) (EC2, RDS, SSM Parameter Store) | Hospedaje de la API y la web, base de datos administrada y resguardo cifrado de la configuración (servicio) | Términos de AWS |
| [Certificados de Amazon RDS](https://truststore.pki.rds.amazonaws.com) | Verificar el certificado TLS de la base de datos | Términos de AWS |
| [Geist](https://vercel.com/font) (vía `next/font`) | Tipografía de la web | SIL Open Font License 1.1 |
| [Docker](https://www.docker.com) | Contenedores de la API, la web y el proxy | Apache-2.0 |
| [Caddy](https://caddyserver.com) | Proxy con HTTPS automático (Let's Encrypt) | Apache-2.0 |

Las dependencias que estas librerías traen consigo están en `backend/package-lock.json`, `front/web/package-lock.json` y `front/mobile/package-lock.json`.

No se usaron diseños, imágenes, contenidos ni productos de terceros además de los listados: el logo y las ilustraciones están hechos en código por el equipo, sin fotos ni imágenes de bancos de imágenes. El proyecto no se ha presentado en otros concursos.

## Herramientas de inteligencia artificial

Parte del código, del diseño (logo e ilustraciones) y de la documentación se hizo con ayuda de un asistente de IA. Las reglas no exigen declararlo; se menciona por transparencia.
