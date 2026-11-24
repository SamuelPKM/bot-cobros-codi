# Cóbrale

Cobra con CoDi a través de [pey](https://docs.pey.mx): push al celular del cliente, QR de respaldo y liga de pago. Funciona desde la app móvil, la web y WhatsApp. Cada negocio usa **su propia API key de pey**.

No es un producto oficial de pey ni de Banco de México.

## Monorepo

| Carpeta | Qué es |
|---|---|
| [backend/](backend/) | API en NestJS + TypeORM + PostgreSQL. Ver [backend/README.md](backend/README.md) |
| [front/](front/) | Una carpeta por aplicación de front: [front/web](front/web/) (Next.js) y, más adelante, front/mobile (Expo) |
| [docs/](docs/) | [Plan de la migración](docs/plan-nest-next.md) y documentos de entrega del hackatón |
| [deploy/aws/](deploy/aws/) | Guiones para instalar y operar la API y la web en AWS (ver [docs/deploy-aws.md](docs/deploy-aws.md)) |

## Arranque rápido

API (puerto 3000), con Postgres en Docker:

```bash
cd backend
npm install
npm run db:up
cp .env.example .env
npm run migration:run
npm run start:dev
```

Web (puerto 3001), en otra terminal:

```bash
cd front/web
npm install
cp .env.example .env.local
npm run dev
```

Deploy en AWS (una instancia EC2 con la API y la web en Docker, HTTPS automático, todo desde CloudShell) y primer cobro real de $0.01: [docs/deploy-aws.md](docs/deploy-aws.md).
