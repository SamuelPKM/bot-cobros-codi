# front/mobile — app de Cóbrale (Expo)

La app es para quien cobra en el negocio, sea vendedor o administrador. Usa Expo SDK 58, React Native y Expo Router. Habla solo con la API de Cóbrale (`backend/`), nunca con pey.

| Pantalla | Qué hace |
|---|---|
| Entrar | Usuario y contraseña del negocio. El token se guarda en el llavero del teléfono (`expo-secure-store`, solo este dispositivo). |
| Panel | Muestra lo cobrado hoy, lo pendiente y lo vencido, y los últimos cobros. El admin ve además quién hizo cada cobro y el desglose por persona. Se actualiza al jalar hacia abajo. |
| Nuevo cobro | Cobra con push al celular, QR o liga de pago. Un toque es un solo cobro: no se reintenta. |
| Cobro | Pasa a "✅ Pagado" en vivo: pregunta cada 4 s y en cuanto vuelves a la app. Tiene plan B (QR o liga del mismo cobro) y un botón para compartir la liga. |
| Aviso "Pago recibido" | Llega como push y, al tocarlo, abre ese cobro. |

Registrar el negocio, el equipo, las invitaciones, los ajustes y el CSV se hacen en la web (`front/web`).

## Requisitos

- Node **22.13 o más**, porque Expo SDK 58 lo exige; también sirve Node 24. Con nvm-windows puedes tener las dos versiones de Node lado a lado: `nvm install 24` y luego usa esa versión solo en esta carpeta.
- La API corriendo (ver `backend/`).
- En el teléfono, **Expo Go** actualizado (SDK 58).

## Arrancar

```bash
cd front/mobile
npm install
cp .env.example .env.local   # pon EXPO_PUBLIC_API_URL
npm start                    # escanea el QR con Expo Go
```

`EXPO_PUBLIC_API_URL`:

- Con la API en tu compu, usa su IP en la red local, por ejemplo `http://192.168.1.20:3000`, no `localhost`, porque el teléfono es otro equipo. El teléfono y la compu tienen que estar en la misma red, y el firewall de Windows debe dejar pasar el puerto 3000.
- En el emulador de Android, usa `http://10.0.2.2:3000`.
- Ya desplegada en AWS, usa la URL HTTPS de la API que muestra `deploy/aws/crear.sh`: `https://api.<ip>.sslip.io`, o `https://api.<tu dominio>` si usas uno propio. Fuera de la red local la app rechaza HTTP.

Es una variable `EXPO_PUBLIC_`, así que Expo la mete dentro de la app al compilar. **Nunca pongas ahí secretos.**

## Avisos push

La app ya está vinculada al proyecto de EAS `@zorodiaz/cobrale` (`extra.eas.projectId` en `app.json`), que es lo que necesita para pedir el token de avisos.

- **iPhone con Expo Go:** "Pago recibido" sí llega (probado). Hay que iniciar sesión en Expo Go y en `npx expo login` con la misma cuenta.
- **Android:** Expo Go ya no recibe avisos (desde SDK 53). Hace falta una *development build*: `npx eas-cli build --profile development --platform android` e instalarla.
- **Simuladores:** no reciben avisos.

Al entrar, la app pide permiso para los avisos y registra el token en `POST /push-tokens`. Al salir lo borra con `DELETE /push-tokens`. Sin permiso o sin token, la app funciona igual: el cobro cambia a "Pagado" porque se consulta cada 4 s.

La API manda el aviso cuando confirma el pago con pey, el mismo momento en que el panel cambia a Pagado.

## Pruebas (TDD)

```bash
npm test           # Jest + jest-expo + Testing Library
npm run typecheck
npm run lint
```

## Estructura

Va por dominio y luego por función, igual que la web:

```
src/
  app/                      rutas de Expo Router (solo pantallas, sin pruebas adentro)
  features/
    auth/                   sesión (contexto, llavero), formulario de Entrar
    charges/                cobros: API, reglas, cobro en vivo, lista, formulario, detalle, QR
    reports/                resumen de hoy
    notifications/          registro de avisos push y apertura del cobro
  shared/                   cliente de la API, formatos, config, UI
test/                       fixtures y prueba de navegación (fuera de src/app a propósito)
```
