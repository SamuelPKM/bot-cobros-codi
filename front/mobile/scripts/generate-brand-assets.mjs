// Genera el ícono y la pantalla de carga de Cóbrale a partir del logo SVG.
// Requiere @resvg/resvg-js instalado aparte (no está en package.json):
//   mkdir brand-tools && cd brand-tools && npm init -y && npm i @resvg/resvg-js
//   NODE_PATH=<ruta>/brand-tools/node_modules node scripts/generate-brand-assets.mjs
// Con ESM NODE_PATH no aplica; por eso se resuelve con createRequire usando
// la variable BRAND_TOOLS (ruta a la carpeta brand-tools) si existe.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.BRAND_TOOLS
  ? join(resolve(process.env.BRAND_TOOLS), 'package.json')
  : import.meta.url;
const { Resvg } = createRequire(base)('@resvg/resvg-js');

const out = resolve(here, '../assets/images');
mkdirSync(out, { recursive: true });

const DEFS =
  '<defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>';
const C = (stroke) =>
  `<path d="M42.6 21.4 A15 15 0 1 0 42.6 42.6" fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round"/>`;
const DOT = (fill) => `<circle cx="43.5" cy="32" r="5" fill="${fill}"/>`;

// El dibujo (C + punto) mide ~ 30 de ancho en un lienzo de 64; se escala
// alrededor del centro (32,32) para ocupar `frac` del lienzo.
const DRAW_SPAN = 38; // ancho/alto aproximado del dibujo incluyendo trazo
const scaled = (inner, frac) => {
  const s = (64 * frac) / DRAW_SPAN;
  return `<g transform="translate(32 32) scale(${s}) translate(-32 -32)">${inner}</g>`;
};
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${DEFS}${body}</svg>`;
const FULL = '<rect width="64" height="64" fill="url(#g)"/>';
const LOGO = '<rect width="64" height="64" rx="16" fill="url(#g)"/>' + C('#fff') + DOT('#bef264');

const render = (name, size, body) => {
  const png = new Resvg(svg(body), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(out, name), png);
  console.log(`${name} ${size}x${size}`);
};

render('icon.png', 1024, FULL + scaled(C('#fff') + DOT('#bef264'), 0.6));
render('android-icon-background.png', 1024, FULL);
render('android-icon-foreground.png', 1024, scaled(C('#fff') + DOT('#bef264'), 0.5));
render('android-icon-monochrome.png', 1024, scaled(C('#fff') + DOT('#fff'), 0.5));
render('splash-icon.png', 512, LOGO);
render('favicon.png', 48, LOGO);
