# Plan: Cóbrale sobre NestJS + Next.js

Rama `feature/nest-next`. Se integra a `main` con un pull request.

## Por qué

- Una sola API (NestJS + TypeORM + Postgres) para todos los canales: la app Expo, la web (Next.js), WhatsApp y la demo pública.
- **Cada negocio cobra con su propia API key de pey** (`POST /businesses`), así:
  - el dinero llega a la cuenta del titular de esas credenciales (regla 7.3(c) del hackatón);
  - nadie concentra pagos de terceros (regla 7.1).

  La versión anterior registraba la CLABE de cada negocio bajo la API key del proyecto.

## Estructura

```
backend/    API NestJS (antes cobrale-api, con su historial)
frontend/   Web en Next.js (App Router, TypeScript)
docs/       Plan y documentos de entrega del hackatón
render.yaml Blueprint de Render (la API con rootDir: backend)
```

El código de Express (`src/`, `test/`, `scripts/`) se retiró en esta rama y sigue en `main` y en el historial.

## Fases (TDD en cada una)

| Fase | Qué | Estado |
|---|---|---|
| F0 | Monorepo: `backend/` con el historial de cobrale-api; se retira Express | ✅ |
| F1 | Backend: liga de pago, invitaciones con liga de un solo uso, cambio de rol (sin dejar el negocio sin admin), resumen del día por persona y CSV | ✅ |
| F2 | Backend: motor de conversación (cobra, sí/no, qr, liga, resumen, ayuda) ✅, WhatsApp (webhook de Meta, vincular número, QR como imagen, "✅ Pagado") ✅ y demo pública con límites ⏳ | ⏳ |
| F3 | `frontend/` Next.js: inicio, registro con API key, entrar, panel de cobros, nuevo cobro (push, QR, liga), equipo, ajustes (negocio, API key, webhook, WhatsApp), invitación, demo, páginas de regreso de la liga | ⏳ |
| F4 | Deploy (Render + Neon + frontend), documentos de entrega al día y pull request | ⏳ |

## Regla: nada de front en Nest

`backend/` solo expone **API JSON y webhooks** (pey y Meta). Toda pantalla vive en `frontend/` (Next.js): el panel, la demo pública, la aceptación de invitaciones y las páginas de regreso de la liga de pago (`/pago/gracias` y `/pago/cancelado`). Nest no sirve HTML, CSS, assets ni vistas; cuando necesita una URL de pantalla (por ejemplo, el regreso de la liga o el enlace de una invitación), arma la del frontend con `FRONTEND_URL`.

## Lo que cambia frente a la web anterior

- **Registro:** se pide la **API key de pey** del negocio (validada) en lugar de la CLABE.
- **Ya no hay modo prueba que cobre a la cuenta del proyecto.** La demo pública cobra con la API key de un negocio de demostración del propio equipo.
- **Sesión:** la web usa la misma API con Bearer JWT. El token vive en una cookie httpOnly del frontend, nunca en JavaScript del navegador.
