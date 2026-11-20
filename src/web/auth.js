// Cuentas de comerciante: contraseñas, sesiones y protección de formularios.
//
// - Contraseñas con scrypt (incluido en Node): nunca se guardan en claro.
// - La sesión es un token aleatorio en una cookie HttpOnly. En la base solo se
//   guarda su hash, así que un respaldo filtrado no permite entrar a nadie.
// - Cada sesión tiene un token CSRF que va oculto en los formularios, y además
//   se rechazan los POST cuyo Origin es otro sitio.

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'cobrale_sesion';
export const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, expected] = parts;
  const expectedBytes = Buffer.from(expected, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expectedBytes.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expectedBytes);
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Cookie mal formada: se ignora.
    }
  }
  return cookies;
}

function sessionCookie(value, { maxAgeSeconds, secure }) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/**
 * Middlewares de sesión.
 * @param secure true para mandar la cookie solo por HTTPS (producción).
 */
/**
 * @param forbiddenPage función (req) => HTML para quien no tiene permiso.
 */
export function createAuth({ store, secure = false, now = Date.now, forbiddenPage = () => 'Solo un administrador puede hacer esto.' }) {
  /** Abre una sesión para la persona y pone la cookie. */
  async function startSession(res, user) {
    const token = newToken();
    await store.createSession({
      tokenHash: hashToken(token),
      userId: user.id,
      csrfToken: newToken(),
      expiresAt: now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
    res.append('Set-Cookie', sessionCookie(token, { maxAgeSeconds: SESSION_DAYS * 24 * 60 * 60, secure }));
  }

  /** Cierra la sesión del navegador. Con clearCookie false solo la borra de la base (porque enseguida se abre otra). */
  async function endSession(req, res, { clearCookie = true } = {}) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) await store.deleteSession(hashToken(token));
    if (clearCookie) res.append('Set-Cookie', sessionCookie('', { maxAgeSeconds: 0, secure }));
  }

  /** Carga la sesión (si hay) en req.user (la persona), req.merchant (su negocio) y req.csrfToken. */
  async function loadSession(req, _res, next) {
    try {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      const session = token ? await store.getSession(hashToken(token)) : null;
      req.user = session?.user ?? null;
      req.merchant = session?.merchant ?? null;
      req.csrfToken = session?.csrfToken ?? null;
      next();
    } catch (error) {
      next(error);
    }
  }

  /** Solo deja pasar con sesión; si no, manda a iniciar sesión. */
  function requireUser(req, res, next) {
    if (req.user && req.merchant) return next();
    if (req.path.includes('/api/') || req.accepts(['html', 'json']) === 'json') {
      return res.status(401).json({ error: 'Inicia sesión.' });
    }
    return res.redirect(`/entrar?siguiente=${encodeURIComponent(req.originalUrl)}`);
  }

  /** Solo administradores del negocio. */
  function requireAdmin(req, res, next) {
    if (req.user?.role === 'admin') return next();
    if (req.path.includes('/api/')) return res.status(403).json({ error: 'Solo un administrador puede hacer esto.' });
    return res.status(403).type('html').send(forbiddenPage(req));
  }

  /** Rechaza POST de otro sitio: por Origin y, con sesión, por el token CSRF del formulario. */
  function checkForm(req, res, next) {
    const origin = req.get('origin');
    if (origin && origin !== 'null') {
      let host;
      try {
        host = new URL(origin).host;
      } catch {
        host = null;
      }
      if (host !== req.get('host')) return res.status(403).send('Origen no permitido.');
    }
    if (req.user) {
      const sent = String(req.body?._csrf ?? req.get('x-csrf-token') ?? '');
      const expected = String(req.csrfToken ?? '');
      const ok = sent.length === expected.length && sent.length > 0 && timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
      if (!ok) return res.status(403).send('El formulario venció. Recarga la página e intenta de nuevo.');
    }
    return next();
  }

  return { startSession, endSession, loadSession, requireUser, requireAdmin, checkForm };
}
