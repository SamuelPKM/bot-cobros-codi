# Desplegar Cóbrale en DigitalOcean

Cóbrale corre en un droplet con Ubuntu 24.04. El script [`deploy/digitalocean/user-data.sh`](../deploy/digitalocean/user-data.sh) prepara todo al crear el droplet:

- instala Node.js 22, Caddy y git;
- configura HTTPS automático con Let's Encrypt;
- deja Cóbrale como servicio que arranca solo.

Los secretos se escriben después en el servidor, nunca en el script ni en el repositorio.

Costo: el droplet más chico cuesta unos $4 USD al mes. Las cuentas nuevas suelen recibir crédito de prueba; revisa las condiciones vigentes en digitalocean.com.

## 1. Crear el droplet

En el panel de DigitalOcean: **Create > Droplets**.

| Opción | Valor |
| --- | --- |
| Región | La más cercana a México, por ejemplo San Francisco o Nueva York |
| Imagen | Ubuntu 24.04 (LTS) x64 |
| Tamaño | Basic > Regular, 512 MB ($4) o 1 GB ($6) si quieres más holgura |
| Autenticación | Una llave SSH o una contraseña; para todo lo que sigue basta la consola web |
| Advanced options | **Add Initialization scripts (free)** y pega el contenido completo de `deploy/digitalocean/user-data.sh` |
| Nombre | `cobrale` |

Da clic en **Create Droplet** y espera de 3 a 5 minutos.

## 2. Revisar que terminó

Abre el droplet y entra a **Access > Launch Droplet Console**. Ahí escribe:

```bash
sudo tail -n 20 /var/log/cobrale-setup.log
```

Debe terminar con una línea así:

```
== Cóbrale: preparación terminada ... URL: https://164-90-12-34.sslip.io
```

Esa es la dirección pública de Cóbrale: la IP del droplet con guiones, más `.sslip.io`. Ese servicio gratuito hace que el nombre apunte a tu IP, para que Let's Encrypt pueda emitir el certificado HTTPS.

## 3. Dar acceso al repositorio (solo si es privado)

Si el log dice "No pude descargar el repositorio: parece privado", muestra una llave que empieza con `ssh-ed25519`. Agrégala en GitHub:

1. Repositorio > **Settings > Deploy keys > Add deploy key**.
2. Título `droplet cobrale`, pega la llave y deja **sin** marcar "Allow write access".

Luego, en la consola del droplet:

```bash
sudo cobrale-update
```

Para volver a ver la llave:

```bash
sudo cat /opt/cobrale/.ssh/id_ed25519.pub
```

## 4. Registrar el webhook en pey

En portal.pey.mx > **Desarrollador**, en el engrane de tu API key, crea el webhook con esta URL (con tu dirección del paso 2):

```
https://164-90-12-34.sslip.io/webhooks/pey
```

Copia el secreto que te muestra (empieza con `whsec_`). Solo se muestra una vez.

## 5. Configurar los secretos

En la consola del droplet:

```bash
sudo cobrale-config
```

Te pide la API key de pey, el secreto del webhook, el monto máximo de la demo y el nombre del negocio de demo. Lo que escribes no se ve en pantalla ni queda en el historial. Usa una API key nueva, no una que hayas compartido por chat.

Al terminar arranca el servicio y te dice si responde. Abre `https://<tu-dirección>/demo` y prueba `cobra 0.01 a <tu celular> prueba`.

## Operación

| Para | Comando |
| --- | --- |
| Actualizar a la última versión de `main` | `sudo cobrale-update` |
| Cambiar secretos o el monto de la demo | `sudo cobrale-config` |
| Ver los registros en vivo | `sudo journalctl -u cobrale -f` |
| Ver el estado | `sudo systemctl status cobrale` |
| Ver los registros de HTTPS | `sudo journalctl -u caddy -n 50` |

La base de datos está en `/var/lib/cobrale/cobros.db` y los secretos en `/etc/cobrale/env`. Para tener respaldos, activa **Backups** en el droplet (cuesta un 20% extra).

## Si algo falla

- **El log no aparece o se cortó:** la preparación sigue corriendo; espera un par de minutos. Si se detuvo con un error, mándame las últimas líneas del log.
- **El navegador marca error de certificado:** Caddy tarda unos segundos en obtenerlo. Revisa `sudo journalctl -u caddy -n 50`.
- **`cobrale-config` dice que Cóbrale no respondió:** revisa `sudo journalctl -u cobrale -n 50`; casi siempre es una variable mal escrita.
- **Quieres un dominio propio:** apúntalo a la IP del droplet con un registro A. Luego cambia el dominio en `/etc/caddy/Caddyfile` y en `/etc/cobrale/host`, y ejecuta `sudo systemctl restart caddy && sudo cobrale-config`.
