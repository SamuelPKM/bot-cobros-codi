import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app es su propio proyecto dentro de front/ (no hay workspace en la raíz).
  cacheComponents: true,
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
