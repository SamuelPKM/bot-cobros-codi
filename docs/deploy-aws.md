# Deploy en AWS y primer cobro real ($0.01)

Arquitectura: **AWS EC2** (la API y la web en Docker, detrás de Caddy) + **Neon** (Postgres) + **pey** (CoDi). No hay sandbox de pey: todo se prueba en producción con **$0.01**.

Todo se hace desde **AWS CloudShell**, la terminal que trae la consola de AWS en el navegador: no instalas nada en tu computadora y no hace falta SSH. El servidor está siempre encendido, así que el barrido de cobros vencidos nunca se detiene.

**Cada negocio usa su propia API key de pey.** El servidor no tiene credenciales de pey propias: un negocio se registra en la web con SU API key, y sus cobros se hacen con ella. Así el dinero llega a la cuenta del titular de esas credenciales (regla 7.3(c) del hackatón) y nadie concentra pagos de terceros (regla 7.1).

| Recurso | Configuración |
| --- | --- |
| Servidor | Una instancia EC2 con Amazon Linux 2023 en `us-east-2` (Ohio), la región de Neon. `t3.small` por defecto |
| API | `backend/` (NestJS) en un contenedor; corre las migraciones al arrancar |
| Web | `front/web` (Next.js) en otro contenedor; habla con la API por la red interna de Docker |
| HTTPS | Caddy, con certificados automáticos y renovación sola |
| URLs | Web en `https://<ip>.sslip.io` y API en `https://api.<ip>.sslip.io` (gratis, sin comprar dominio), o tu propio dominio |
| Base de datos | Postgres en Neon (`DATABASE_URL`) |
| Secretos | SSM Parameter Store, cifrados, bajo `/cobrale/...` |
| Acceso al servidor | Session Manager y Run Command de SSM. El firewall solo abre 80 y 443 |

## Qué instancia elegir

Construir la imagen de la web pide cerca de 1 GB de RAM.

- **`t3.small`** (2 GB, por defecto) construye sin problema.
- **`t3.micro`** (1 GB) también sirve: el servidor agrega 2 GB de memoria de intercambio y, en cada actualización, detiene la web mientras construye. La web queda unos minutos sin servicio en cada actualización; la API y los webhooks siguen atendiendo. Para usarla:

  ```bash
  INSTANCE_TYPE=t3.micro bash deploy/aws/crear.sh
  ```

## Costo

Depende de tu cuenta. Revisa **Billing > Free Tier** en la consola.

- **Cuenta creada antes del 15 de julio de 2025**, en sus primeros 12 meses: la capa gratuita cubre una `t3.micro`, el disco y la IP pública. Una `t3.small` cuesta unos 15 USD al mes.
- **Cuenta nueva**: el plan gratuito da créditos que cubren varios meses de cualquiera de las dos.
- **Sin capa gratuita**: unos 10 USD al mes con `t3.micro` o 20 USD con `t3.small`, contando el disco y la IP.

Para no tener sorpresas, crea una alerta: **Billing > Budgets > Create budget > Zero spend budget**.

## Antes de empezar

1. **La base en Neon**:
   - En [neon.tech](https://neon.tech), crea un proyecto en la región **AWS US East 2 (Ohio)**.
   - En *Connection Details* elige la conexión **directa**: el host **no** debe llevar `-pooler`. Copia la cadena `postgresql://...?sslmode=require`.
   - No uses la conexión *pooled*: el barrido usa un advisory lock de sesión, y PgBouncer en modo transacción cambia de sesión entre consultas.
2. **Un token de GitHub de solo lectura**, para que el servidor baje el código del repositorio privado:
   - En GitHub: **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
   - **Repository access**: *Only select repositories* > `bot-cobros-codi`.
   - **Permissions**: *Contents* > *Read-only*. Nada más.
   - **Expiration**: después del 31 de enero de 2027, para que la demo siga viva hasta entonces.

Los dos se escriben solo en CloudShell, que no los muestra en pantalla. No los pegues en ningún chat ni en el repositorio.

## 1. Abrir CloudShell y bajar el repositorio

1. Entra a la consola de AWS y, arriba a la derecha, elige la región **Ohio (us-east-2)**.
2. Abre **CloudShell** (el ícono `>_` de la barra de arriba).
3. Baja el código. Cuando pida usuario escribe tu usuario de GitHub, y como contraseña pega el token (no se ve al pegarlo):

   ```bash
   git clone https://github.com/SamuelPKM/bot-cobros-codi.git
   ```

   ```bash
   cd bot-cobros-codi
   ```

## 2. Crear el servidor

```bash
bash deploy/aws/crear.sh
```

El guion pide, sin mostrarlos, la `DATABASE_URL` de Neon (rechaza una con `-pooler`) y el token de GitHub.

Después:

1. Genera y guarda cifradas las llaves de la API:
   - `AUTH_SECRET`, que firma las sesiones;
   - `ENCRYPTION_KEY`, que cifra las API keys de pey de los negocios;
   - `FRONT_PROXY_SECRET`, que comparten la web y la API.
2. Crea la IP elástica, el rol, el firewall y la instancia.
3. Espera a que la API y la web respondan: de 5 a 10 minutos la primera vez, porque construye las dos imágenes.

Al final muestra las URLs, por ejemplo `https://3-91-20-115.sslip.io` (web) y `https://api.3-91-20-115.sslip.io` (API).

**Con tu propio dominio**: crea antes dos registros A que apunten a la IP elástica (el guion la muestra), uno para el dominio y otro para `api.` + el dominio. Luego:

```bash
DOMAIN=cobrale.tudominio.mx bash deploy/aws/crear.sh
```

## 3. Cuenta y API key de pey del negocio

Esto lo hace **cada negocio** con su propia cuenta de pey. Para la demo del hackatón, el negocio del equipo.

1. En [portal.mipey.mx](https://portal.mipey.mx) crea el perfil del negocio.
2. En **Finanzas**, da de alta la cuenta CoDi con la CLABE **del negocio**. Banxico tarda **hasta 5 días hábiles** en activarla.
   - Mientras tanto se puede usar la cuenta de pruebas que publica pey, que se activa de inmediato. **Lo que se paga ahí no se devuelve**: usa solo $0.01.
3. En **Desarrollador**, haz clic en **Crear API Key**, ligada a esa cuenta, y guárdala.

## 4. Registrar el negocio y su webhook (en la web)

1. Abre la web y ve a **Registra tu negocio**. Pide nombre del negocio, tu nombre, usuario, contraseña y la API key. La API la valida con pey; si pey no la reconoce, no se crea nada.
2. Entras al panel con un aviso: **Falta registrar el webhook de pey**. Ve a **Ajustes**:
   1. Copia la **URL del webhook**. Tiene la forma `https://api.<...>/webhooks/pey/<código>`.
   2. En el portal de pey, en **Desarrollador**, abre el engrane de la API key y elige **Crear Webhook** con esa URL.
   3. Copia el secreto (`whsec_...`; **se muestra una sola vez**) y pégalo en **Ajustes → Secreto del webhook**. Debe decir "✅ Registrado".

## 5. Primer cobro real de $0.01

Usa **tu propio celular**, registrado en CoDi en la app de tu banco (las reglas piden datos ficticios o propios).

1. **Nuevo cobro** → Push al celular, tu celular, `0.01`, concepto "Prueba" → **Cobrar**.
2. Aprueba el cobro en la app de tu banco. La página del cobro cambia sola a **✅ Pagado**.
3. Plan B: si el push no llega, en el mismo cobro usa **Mostrar QR** y escanéalo con tu banco.

## 6. Demo pública y cuenta para el jurado

1. Busca el id del negocio del paso 4: es el `businessId` que da `GET /me` de la API, o el número en la tabla `businesses` de Neon.
2. Guárdalo; la API se reinicia sola:

   ```bash
   bash deploy/aws/variable.sh api DEMO_BUSINESS_ID --visible
   ```

   `/demo` en la web ya funciona, con un tope de `DEMO_MAX_AMOUNT` ($1) por cobro.
3. Cuenta para el jurado: en **Equipo**, da de alta a una persona con un tope de $1.00 (o invítala). Si le das rol de administrador podrá probar Equipo y Ajustes, pero también cambiar el nombre, la API key o el secreto del negocio: revísalos antes de la evaluación.

## 7. WhatsApp (opcional)

1. En [developers.facebook.com](https://developers.facebook.com), crea la app de WhatsApp Business y copia el *token*, el *Phone number ID* y el *App secret*.
2. Inventa un *verify token*. Guarda las cuatro variables, una por una (se piden sin mostrarlas):

   ```bash
   bash deploy/aws/variable.sh api WHATSAPP_TOKEN
   ```

   Repite con `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN`. Son las cuatro o ninguna.
3. En Meta, registra el webhook `https://api.<...>/webhooks/whatsapp` con ese verify token y suscríbete al campo `messages`.
4. En la web, **Ajustes → WhatsApp → Obtener código**, y manda `vincular 123456` al número de la app.

## Operación

| Para | Comando en CloudShell |
| --- | --- |
| Subir los cambios de `main` (API y web) | `bash deploy/aws/actualizar.sh` |
| Desplegar otra rama | `BRANCH=otra-rama bash deploy/aws/actualizar.sh` (queda como la rama de los siguientes despliegues) |
| Cambiar una variable secreta | `bash deploy/aws/variable.sh api NOMBRE` |
| Cambiar una variable visible | `bash deploy/aws/variable.sh api DEMO_MAX_AMOUNT --visible` |
| Quitar una variable | `bash deploy/aws/variable.sh api CORS_ORIGINS --borrar` |
| Renovar el token de GitHub | `bash deploy/aws/variable.sh GITHUB_TOKEN` |
| Ver estado, memoria y registros | `bash deploy/aws/registros.sh` |
| Entrar al servidor | Consola de EC2 > instancia `cobrale` > **Connect** > **Session Manager** |
| Borrar todo (no toca Neon) | `bash deploy/aws/borrar.sh` |

Las variables de la API van en `/cobrale/api/<NOMBRE>` y las de la web en `/cobrale/web/<NOMBRE>`. También se pueden ver en la consola: **Systems Manager > Parameter Store**. Si cambias una ahí, aplícala con `variable.sh` o con `actualizar.sh`.

`variable.sh` no deja cambiar `ENCRYPTION_KEY`: con otra llave, las API keys de pey guardadas ya no se podrían descifrar. Tampoco deja cambiar `FRONT_PROXY_SECRET`, que debe ser igual en la API y en la web.

CloudShell conserva tu carpeta entre sesiones, pero se borra si no lo abres en 120 días. Si ya no está, vuelve a hacer el `git clone` del paso 1; los guiones solo necesitan la cuenta de AWS.

Si la instancia se reinicia, el servicio `cobrale` de systemd vuelve a levantar la API, la web y Caddy solos.

## Cómo está armado

- `backend/Dockerfile` y `front/web/Dockerfile`: imágenes de Node 22 que corren como usuario sin privilegios. La API corre las migraciones pendientes antes de arrancar.
- `deploy/aws/crear.sh` crea los recursos. El arranque de la instancia (`servidor/primer-arranque.sh`) instala Docker, agrega 2 GB de intercambio, baja el código y deja el servicio de systemd.
- `deploy/aws/servidor/desplegar.sh`, en el servidor:
  1. Baja la rama de `/cobrale/infra/BRANCH`.
  2. Escribe `/opt/cobrale/api.env` y `web.env` desde SSM, legibles solo por root.
  3. Construye las dos imágenes, reemplaza la API y luego la web, y espera a que cada una quede sana.
  4. Recrea Caddy solo si cambió su configuración, para no volver a pedir certificados.
  5. Si la web no se puede construir, deja corriendo la versión anterior.
- `deploy/aws/servidor/Caddyfile`: un dominio para la web y otro para la API.
- `deploy/aws/actualizar.sh`, `variable.sh`, `registros.sh` y `borrar.sh`: hablan con la instancia por SSM Run Command.

El rol de la instancia solo puede leer `/cobrale/*` y ser administrado por SSM. El token de GitHub se usa en cada descarga y no se guarda en el servidor.

## Si algo no funciona

| Lo que ves | Qué hacer |
| --- | --- |
| `crear.sh` termina sin que las URLs respondan | `bash deploy/aws/registros.sh`: la sección "primer arranque" muestra en qué paso falló |
| "No se pudo bajar el código" | El token de GitHub no tiene acceso de lectura al repositorio o venció: `bash deploy/aws/variable.sh GITHUB_TOKEN` y luego `bash deploy/aws/actualizar.sh` |
| La API no queda sana, o `/health` responde `database: down` | Los registros muestran el error. Lo más común es una `DATABASE_URL` mal copiada o con `-pooler`: `bash deploy/aws/variable.sh api DATABASE_URL` |
| El navegador avisa que el certificado no es válido | Caddy todavía lo está pidiendo; espera un par de minutos. Con tu dominio, revisa que los dos registros A apunten a la IP elástica |
| El registro dice que la API key no es válida | Cópiala otra vez desde portal.mipey.mx > Desarrollador |
| El push queda fallido con "la cuenta… no está activa" | La cuenta CoDi del negocio todavía no está activa en pey (paso 3) |
| Se pagó pero sigue pendiente | En el portal de pey, revisa **Webhook Logs**. Un 401: el secreto no es el de esa API key. Un 503: falta el secreto en Ajustes. De todos modos el barrido lo concilia con pey al vencer el intento (unos 6 minutos) |
| La liga de pago dice que falta `FRONTEND_URL` | Revisa `/cobrale/api/FRONTEND_URL` en Parameter Store: debe ser la URL `https://` de la web |
| `actualizar.sh` falla al construir con `t3.micro` | Falta memoria. Cambia la instancia a `t3.small` (consola de EC2 > instancia detenida > **Change instance type**) y vuelve a correr `actualizar.sh` |
| "no hay una instancia cobrale encendida" | Revisa en la consola de EC2 que esté *Running* y en `us-east-2`, o pasa `REGION=...` |
