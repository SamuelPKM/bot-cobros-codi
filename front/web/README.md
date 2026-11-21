# Cóbrale · web

Web en **Next.js 16** (App Router, TypeScript, Tailwind). Es la cara de la API de [`backend/`](../../backend/): no habla con pey ni con la base de datos.

## Arranque local

Necesita la API corriendo en `http://localhost:3000` (ver [backend/README.md](../../backend/README.md)).

```bash
cd front/web
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3001
```

En el backend, `FRONTEND_URL=http://localhost:3001` para que las ligas (invitaciones, regreso del pago) apunten aquí.

## Pruebas (TDD)

```bash
npm test             # Vitest + Testing Library, una vez
npm run test:watch   # mientras programas
npm run typecheck
npm run lint
npm run build
```

Las pruebas van junto al archivo que prueban (`*.test.ts(x)`). Los componentes `async` del servidor no se prueban con Vitest; su lógica vive en servicios que sí se prueban.

> Vitest 3 + Vite 6 y jsdom 25 a propósito: funcionan con Node 22.9. Las versiones más nuevas piden Node ≥ 22.12.

## Sesión

1. **Entrar** es una Server Action: valida el formulario, llama a `POST /auth/login` y guarda el JWT en la cookie `cobrale_session` (httpOnly, `SameSite=Lax`, `Secure` en producción) con la misma vigencia que el token.
2. Las páginas privadas leen a la persona con `getCurrentUser()` (llama a `GET /me`) **dentro de un `<Suspense>`**, como pide Cache Components. Sin sesión válida, a `/entrar`.
3. El JavaScript del navegador nunca ve el token: toda llamada a la API sale del servidor de Next (`shared/api/server-api.ts`, marcado `server-only`).

## Estructura

Como en el backend: primero por **dominio**, luego por **función**. `app/` solo tiene rutas delgadas.

```
src/
├─ app/                    # rutas: page.tsx, layout.tsx (delgadas; usan features/)
│  ├─ entrar/  registro/
│  └─ panel/               # layout con la barra; cobros/nuevo y cobros/[id]
├─ features/               # un dominio por carpeta
│  ├─ auth/
│  │  ├─ actions/          # Server Actions ('use server'): login, logout
│  │  ├─ components/       # LoginForm
│  │  ├─ services/         # server-only: cookie de sesión, authedRequest, usuario actual
│  │  ├─ policies/         # reglas puras: validar el formulario, vencimiento del token
│  │  └─ constants/  interfaces/  types/
│  ├─ businesses/          # registro del negocio con su API key, aviso del webhook
│  ├─ charges/             # nuevo cobro, lista, detalle con QR/liga, plan B y "Pagado" en vivo
│  │  ├─ actions/          # createCharge, showFallback
│  │  ├─ components/       # NewChargeForm, ChargesTable, ChargeDetail, ChargeStatusPoller…
│  │  ├─ services/         # server-only: listCharges, getCharge; QR a PNG
│  │  └─ policies/  interfaces/  types/
│  └─ reports/             # resumen de hoy
└─ shared/                 # solo lo que no pertenece a un dominio
   ├─ api/                 # cliente JSON de la API y su versión server-only
   ├─ config/              # variables del servidor
   ├─ format/              # pesos, celular y fecha de la Ciudad de México
   ├─ forms/               # FormState de las Server Actions
   ├─ interfaces/          # tipos que devuelve la API (PublicUser)
   └─ ui/                  # TextField, FormAlert y clases compartidas
```

### Reglas

- **`app/` no tiene lógica:** compone componentes de `features/`.
- **Todo acceso a la API pasa por `shared/api/server-api.ts`** desde el servidor (Server Components, Server Actions, Route Handlers).
- **Cada Server Action valida su entrada y se autoriza sola** (lee la sesión); no confía en lo que mande el navegador.
- **Leer la sesión siempre dentro de `<Suspense>`**, nunca en el nivel superior de un layout.
- **Los formularios con Server Action no usan radios ni campos controlados para lo que se envía:** React reinicia el formulario después de la acción; se usa `defaultValue`/`defaultChecked` con lo que regresó la acción.
- **"Pagado" en vivo:** el detalle de un cobro pendiente pide la página otra vez cada 4 s (`router.refresh()`); la API se entera por el webhook de pey o el barrido.
- **Los mensajes de error que ve la persona** vienen de la API (ya están en español) o de un texto genérico; nunca un error interno.
- **Accesibilidad:** cada campo con su `<label>`, errores con `aria-invalid` y `aria-describedby`, alertas con `role="alert"`.
