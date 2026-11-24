# Imagen de la API (NestJS) para la instalación en AWS (docs/deploy-aws.md).
# Toda la configuración llega por variables de entorno.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000
# Autoridades de certificación de Amazon RDS: con DATABASE_SSL=true la conexión
# verifica el certificado, y el de RDS no viene en el almacén de Node. A Neon
# no le afecta (se suman a las de siempre).
RUN node -e "fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(t=>require('fs').writeFileSync('/etc/ssl/certs/rds-global-bundle.pem',t))"
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Corre las migraciones pendientes y arranca.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && exec node dist/main"]
