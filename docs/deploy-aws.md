# Instalar Cóbrale en AWS (EC2 + Docker), con Postgres en Neon

Todo se hace desde **AWS CloudShell**, la terminal que trae la consola de AWS en el navegador: no instalas nada en tu computadora y no hace falta SSH.

| Recurso | Configuración |
| --- | --- |
| Servidor | Una instancia EC2 `t3.micro` con Amazon Linux 2023, región `us-east-1` (la misma de Neon) |
| App | Contenedor Docker construido en el servidor desde este repositorio |
| HTTPS | Caddy, con certificado automático y renovación sola |
| URL | `https://<ip>.sslip.io` (gratis, sin comprar dominio) o tu propio dominio |
| Base de datos | Postgres en Neon (`DATABASE_URL`), igual que en Render |
| Secretos | SSM Parameter Store, cifrados, bajo `/cobrale/...` |
| Acceso al servidor | Session Manager y Run Command de SSM. El firewall solo abre 80 y 443 |

## Costo

Depende de tu cuenta:

- **Cuenta creada antes del 15 de julio de 2025**, en sus primeros 12 meses: la `t3.micro`, los 16 GB de disco y la IP pública entran en la capa gratuita.
- **Cuenta nueva**: el plan gratuito da créditos que cubren varios meses de este servidor.
- **Sin capa gratuita**: unos 8 a 12 USD al mes entre la instancia, el disco y la IP pública. Revisa **Billing > Free Tier** en la consola.

Para no tener sorpresas, crea una alerta de presupuesto: **Billing > Budgets > Create budget > Zero spend budget**.

## Antes de empezar

1. **La base en Neon**: proyecto en AWS us-east-1 y la cadena de conexión **directa** (sin `-pooler`). Ver los pasos en [deploy-render.md](deploy-render.md#1-crear-la-base-en-neon).
2. **Tu API key de pey** (portal.pey.mx > Desarrollador). Si alguna vez la pegaste en un chat, revócala y crea otra.
3. **Un token de GitHub de solo lectura**, para que el servidor baje el código del repositorio privado:
   - En GitHub: **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
   - **Repository access**: *Only select repositories* > `bot-cobros-codi`.
   - **Permissions**: *Contents* > *Read-only*. Nada más.
   - **Expiration**: después del 31 de enero de 2027, para que la demo siga viva hasta entonces.

Los tres se escriben solo en CloudShell, que no los muestra en pantalla. No los pegues en ningún chat ni en el repositorio.

## 1. Abrir CloudShell y bajar el repositorio

1. Entra a la consola de AWS, arriba a la derecha elige la región **N. Virginia (us-east-1)**.
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

El guion pide, sin mostrarlos:

| Pregunta | Qué poner |
| --- | --- |
| API key de pey | La de portal.pey.mx |
| DATABASE_URL de Neon | La conexión directa. El guion rechaza una con `-pooler` |
| Token de GitHub | El de solo lectura |
| Secreto del webhook de pey | Enter por ahora: se pone en el paso 3 |
| Cuenta del jurado | Correo y contraseña (10 caracteres o más) con los que entrará el jurado. Opcional |
| Correos de confianza | Opcional; los que cobran sin el límite del modo prueba |

Luego crea la IP elástica, el rol, el firewall y la instancia, y espera a que la app responda (unos 5 minutos la primera vez). Al final muestra la URL, por ejemplo `https://3-91-20-115.sslip.io`.

**Con tu propio dominio**: crea antes un registro A que apunte a la IP elástica (el guion la muestra) y córrelo así:

```bash
DOMAIN=cobrale.tudominio.mx bash deploy/aws/crear.sh
```

## 3. Conectar el webhook de pey

1. En portal.pey.mx > **Desarrollador**, en el engrane de tu API key, crea el webhook con la URL `https://<tu-url>/webhooks/pey`.
2. Copia el secreto (`whsec_...`; solo se muestra una vez) y guárdalo:

   ```bash
   bash deploy/aws/variable.sh PEY_WEBHOOK_SECRET
   ```

   El guion lo pide sin mostrarlo, lo guarda cifrado y reinicia la app.

## 4. Revisar que funciona

- `https://<tu-url>/health` responde `{"ok":true}`.
- `https://<tu-url>/` muestra la página de inicio y `/demo` la demo.
- Los registros dicen `Base de datos: Postgres (DATABASE_URL)`:

  ```bash
  bash deploy/aws/registros.sh
  ```

- Crea tu cuenta en `/registro` y haz un cobro de $0.01 a tu celular: la página cambia sola a **Pagado**.

## Operación

| Para | Comando en CloudShell |
| --- | --- |
| Subir los cambios de `main` | `bash deploy/aws/actualizar.sh` |
| Desplegar otra rama | `BRANCH=otra-rama bash deploy/aws/actualizar.sh` (queda como la rama de los siguientes despliegues) |
| Cambiar una variable secreta | `bash deploy/aws/variable.sh NOMBRE` |
| Cambiar una variable visible | `bash deploy/aws/variable.sh DEMO_MAX_AMOUNT --visible` |
| Quitar una variable | `bash deploy/aws/variable.sh TRUSTED_EMAILS --borrar` |
| Renovar el token de GitHub | `bash deploy/aws/variable.sh GITHUB_TOKEN` |
| Ver estado y registros | `bash deploy/aws/registros.sh` |
| Entrar al servidor | Consola de EC2 > instancia `cobrale` > **Connect** > **Session Manager** |
| Borrar todo (no toca Neon) | `bash deploy/aws/borrar.sh` |

CloudShell conserva tu carpeta entre sesiones, pero se borra si no lo abres en 120 días. Si ya no está, vuelve a hacer el `git clone` del paso 1; los guiones solo necesitan la cuenta de AWS.

Si la instancia se reinicia, el servicio `cobrale` de systemd vuelve a levantar la app y Caddy solo.

## Cómo está armado

- `Dockerfile`: imagen de Node 22. Corre `npm run build` al construirse y la app como usuario sin privilegios.
- `deploy/aws/crear.sh`: crea los recursos. El arranque de la instancia (`servidor/primer-arranque.sh`) instala Docker, agrega 1 GB de memoria de intercambio, baja el código y deja el servicio de systemd.
- `deploy/aws/servidor/desplegar.sh`, en el servidor:
  1. Baja la rama de `/cobrale/infra/BRANCH`.
  2. Escribe `/opt/cobrale/app.env` desde `/cobrale/app/*`, legible solo por root.
  3. Construye la imagen y reemplaza el contenedor de la app.
  4. Recrea Caddy solo si cambió su configuración, para no volver a pedir certificados.
- `deploy/aws/actualizar.sh`, `variable.sh`, `registros.sh` y `borrar.sh`: hablan con la instancia por SSM Run Command.

Cada variable de la app es un parámetro `/cobrale/app/<NOMBRE>`. También se pueden ver y cambiar en la consola: **Systems Manager > Parameter Store**. Después de cambiar uno ahí, aplica el cambio con `bash deploy/aws/variable.sh` o con `actualizar.sh`.

El rol de la instancia solo puede leer `/cobrale/*` y ser administrado por SSM. El token de GitHub se usa en cada descarga y no se guarda en el servidor.

## Si algo no funciona

| Lo que ves | Qué hacer |
| --- | --- |
| `crear.sh` termina sin que la URL responda | `bash deploy/aws/registros.sh`: la sección "primer arranque" muestra en qué paso falló |
| "No se pudo bajar el código" | El token de GitHub no tiene acceso de lectura al repositorio o venció: `bash deploy/aws/variable.sh GITHUB_TOKEN` y luego `bash deploy/aws/actualizar.sh` |
| Los registros dicen `PGlite` | Falta `DATABASE_URL`: `bash deploy/aws/variable.sh DATABASE_URL` |
| El navegador avisa que el certificado no es válido | Caddy todavía lo está pidiendo; espera un par de minutos. Con tu dominio, revisa que el registro A apunte a la IP elástica |
| El webhook de pey responde 503 | Falta `PEY_WEBHOOK_SECRET` (paso 3) |
| "no hay una instancia cobrale encendida" | Revisa en la consola de EC2 que esté *Running* y en la región `us-east-1` (o pasa `REGION=...`) |
| `actualizar.sh` falla al construir | Los registros muestran el error de `npm ci` o de `npm run build`; el contenedor anterior sigue funcionando |

Si dejas Render, borra su servicio para no tener dos servidores barriendo los mismos cobros contra la misma base. Funcionaría igual, porque el barrido usa un candado de Postgres, pero cada uno despertaría a Neon. Además, pey manda el webhook a una sola URL.
