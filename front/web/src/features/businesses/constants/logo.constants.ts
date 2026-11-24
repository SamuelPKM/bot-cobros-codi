/** Lo mismo que acepta la API: PNG, JPG o WebP de máximo 1 MB. */
export const MAX_LOGO_BYTES = 1024 * 1024;
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

/** URL del logo del negocio de la sesión. La versión cambia con cada logo nuevo. */
export const logoUrl = (version: string) => `/panel/logo?v=${encodeURIComponent(version)}`;
