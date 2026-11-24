import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app es su propio proyecto dentro de front/ (no hay workspace en la raíz).
  cacheComponents: true,
  experimental: {
    // El logo del negocio (máx. 1 MB) llega por una Server Action; el resto del
    // formulario agrega unos bytes, así que el límite de 1 MB no alcanza.
    serverActions: { bodySizeLimit: "2mb" },
  },
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
