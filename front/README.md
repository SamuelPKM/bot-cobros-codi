# front/

Una carpeta por aplicación de front. Cada una es un proyecto **independiente**: tiene su propio `package.json`, sus dependencias, sus pruebas y su deploy. No comparten código entre sí; lo que necesitan de los datos lo piden a la API de [`backend/`](../backend/).

| Carpeta | Qué es | Estado |
|---|---|---|
| [web/](web/) | Web en Next.js 16: inicio, registro del negocio, entrar, panel, equipo e invitaciones, ajustes, demo pública y páginas de regreso de la liga de pago | En construcción |
| `mobile/` | App en Expo para vendedores y admins (cobrar y recibir el aviso de pago) | Pendiente |

## Reglas

- **Ninguna app habla con pey.** Solo con la API de Cóbrale; las API keys de pey viven cifradas en el backend.
- **El navegador no ve el token.** En `web/`, la sesión es una cookie httpOnly y todas las llamadas a la API salen del servidor de Next.
- **Nest no sirve pantallas.** Cualquier pantalla nueva va en una de estas apps (Nest arma las URL con `FRONTEND_URL`).
- **Una app nueva** = una carpeta nueva aquí, con su README y el mismo orden por dominio y función.
