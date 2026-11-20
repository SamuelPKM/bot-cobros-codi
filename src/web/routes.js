// Rutas de la web: inicio, cuentas, panel de cobros y equipo.
//
// Cada negocio tiene administradores y vendedores. Todos cobran. El vendedor
// ve solo sus cobros; el administrador ve los de todo el negocio y además
// administra el equipo, el nombre del negocio y la CLABE.
//
//   GET  /                         página de inicio
//   GET  /registro, POST /registro crear cuenta
//   GET  /entrar,   POST /entrar   iniciar sesión
//   POST /salir                    cerrar sesión
//   GET  /panel                    cobros de hoy, nuevo cobro y últimos cobros
//   POST /panel/cobros             crear un cobro (push queda por confirmar; QR y liga, listos)
//   GET  /panel/cobros/:id         detalle: confirmar, QR, liga o estado
//   POST /panel/cobros/:id/confirmar | cancelar | liga
//   GET  /panel/cobros.csv         todos los cobros
//   GET  /panel/api/cobros[/:id]   estados para actualizar el panel en vivo
//   GET  /panel/ajustes            tus datos y tu WhatsApp; negocio y CLABE (solo administrador)
//   GET  /panel/equipo             personas del negocio, invitar, roles (solo administrador)
//   GET  /invitacion/:token        la persona invitada elige su contraseña

import { randomInt } from 'node:crypto';
import express from 'express';
import { normalizePhone, parseAmount } from '../command.js';
import { money } from '../messages.js';
import { toCents } from '../pey.js';
import { createAuth, hashPassword, hashToken, MIN_PASSWORD_LENGTH, newToken, verifyPassword } from './auth.js';
import {
  authPage,
  chargePage,
  formatDateTime,
  invitePage,
  KIND,
  landingPage,
  messagePage,
  panelPage,
  plain,
  settingsPage,
  STATUS,
  statusChip,
  teamPage,
} from './views.js';

const ASSETS = new URL('./assets/', import.meta.url).pathname;
const MINUTE = 60 * 1000;
const LINK_CODE_MS = 15 * MINUTE;
const INVITE_MS = 7 * 24 * 60 * MINUTE;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validName = (name) => name.length > 0 && name.length <= 60;

const FLASH = {
  bienvenida: 'Tu cuenta está lista. Crea tu primer cobro.',
  enviado: 'Listo, le llegó la solicitud de pago a tu cliente. Esta página se actualiza sola.',
  cancelado: 'Cancelado: no se envió nada.',
  negocio: 'Guardamos el nombre del negocio.',
  perfil: 'Guardamos tu nombre.',
  rol: 'Cambiamos el rol.',
  desactivado: 'Desactivamos a esa persona. Ya no puede entrar ni cobrar; sus cobros se conservan.',
  reactivado: 'Reactivamos a esa persona. Si no tenía contraseña, genera una nueva liga de invitación.',
  unido: 'Ya eres parte del equipo. Crea tu primer cobro.',
  clabe: 'Registramos tu CLABE. Banxico la valida en hasta 5 días hábiles.',
  desligado: 'Tu WhatsApp ya no está ligado a esta cuenta.',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

/** Solo se vuelve a rutas del panel: evita redirecciones a otros sitios. */
const safeNext = (value) => (typeof value === 'string' && /^\/panel(\/|$|\?)/.test(value) ? value : '/panel');

/** Celda CSV con comillas, y sin fórmulas (un concepto "=..." se volvería fórmula en Excel). */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param limits los del modo prueba, para mostrarlos.
 * @param trustedEmails correos que no quedan en modo prueba aunque no tengan CLABE propia
 *   (por ejemplo, la cuenta del equipo mientras Banxico valida la suya).
 * @param whatsappNumber número del bot de WhatsApp, para mostrarlo al ligar.
 */
export function mountWeb(
  app,
  {
    store,
    charges,
    limits,
    publicBaseUrl = null,
    registrationOpen = true,
    trustedEmails = [],
    whatsappNumber = null,
    demoEnabled = false,
    secureCookies = false,
    now = Date.now,
    log = console,
  },
) {
  const auth = createAuth({
    store,
    secure: secureCookies,
    now,
    forbiddenPage: (req) =>
      messagePage({ title: 'Solo para administradores', text: 'Pídele a un administrador de tu negocio que lo haga.', user: req.user, csrf: req.csrfToken }),
  });
  const form = express.urlencoded({ extended: false, limit: '16kb' });
  const canLink = Boolean(publicBaseUrl);
  const trusted = new Set(trustedEmails.map((e) => e.toLowerCase()));

  const web = express.Router();
  web.use((_req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });
  web.use('/assets', express.static(ASSETS, { maxAge: '1h', index: false }));
  web.use(auth.loadSession);

  const send = (res, html, status = 200) => res.status(status).type('html').send(html);
  const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
  const ctxFor = (req) => charges.contextFor(req.merchant, { channel: 'web', user: req.user });
  const isAdmin = (req) => req.user?.role === 'admin';
  const baseUrl = (req) => publicBaseUrl ?? `${req.protocol}://${req.get('host')}`;

  // ------------------------------------------------------------- públicas

  web.get(
    '/',
    wrap(async (req, res) => send(res, landingPage({ user: req.user, demoEnabled }))),
  );

  web.get('/registro', (req, res) => {
    if (req.user) return res.redirect('/panel');
    return send(res, authPage({ mode: 'registro', registrationOpen }));
  });

  web.post(
    '/registro',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      if (!registrationOpen) return send(res, authPage({ mode: 'registro', registrationOpen }), 403);
      const values = {
        negocio: String(req.body.negocio ?? '').trim(),
        nombre: String(req.body.nombre ?? '').trim(),
        correo: String(req.body.correo ?? '').trim().toLowerCase(),
      };
      const password = String(req.body.contrasena ?? '');
      const fail = (error, status = 422) => send(res, authPage({ mode: 'registro', error, values }), status);

      if (!(await store.hit(`signup-ip:${req.ip}`, { limit: 10, windowMs: 60 * MINUTE }))) {
        return fail('Demasiados registros desde esta conexión. Intenta en una hora.', 429);
      }
      if (!validName(values.negocio)) return fail('Escribe el nombre de tu negocio (hasta 60 caracteres).');
      if (!validName(values.nombre)) return fail('Escribe tu nombre (hasta 60 caracteres).');
      if (!EMAIL.test(values.correo)) return fail('Escribe un correo válido.');
      if (password.length < MIN_PASSWORD_LENGTH) return fail(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      if (await store.getUserByEmail(values.correo)) return fail('Ya existe una cuenta con ese correo. Entra con tu contraseña.');

      let user;
      try {
        ({ user } = await store.createMerchantWithAdmin({
          businessName: values.negocio,
          isTrusted: trusted.has(values.correo),
          name: values.nombre,
          email: values.correo,
          passwordHash: await hashPassword(password),
        }));
      } catch (error) {
        if (error.code === '23505') return fail('Ya existe una cuenta con ese correo. Entra con tu contraseña.');
        throw error;
      }
      await auth.startSession(res, user);
      return res.redirect(303, '/panel?ok=bienvenida');
    }),
  );

  web.get('/entrar', (req, res) => {
    if (req.user) return res.redirect(safeNext(req.query.siguiente));
    return send(res, authPage({ mode: 'entrar', next: safeNext(req.query.siguiente) }));
  });

  web.post(
    '/entrar',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      const correo = String(req.body.correo ?? '').trim().toLowerCase();
      const next = safeNext(req.body.siguiente);
      const fail = (error, status = 401) => send(res, authPage({ mode: 'entrar', error, values: { correo }, next }), status);

      const allowed =
        (await store.hit(`login-ip:${req.ip}`, { limit: 30, windowMs: 15 * MINUTE })) &&
        (await store.hit(`login-email:${correo}`, { limit: 10, windowMs: 15 * MINUTE }));
      if (!allowed) return fail('Demasiados intentos. Espera 15 minutos e intenta de nuevo.', 429);

      const user = await store.getUserByEmail(correo);
      const ok = user?.active && user.passwordHash && (await verifyPassword(String(req.body.contrasena ?? ''), user.passwordHash));
      if (!ok) return fail('El correo o la contraseña no coinciden.');

      await auth.startSession(res, user);
      return res.redirect(303, next);
    }),
  );

  web.post(
    '/salir',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      await auth.endSession(req, res);
      return res.redirect(303, '/');
    }),
  );

  // ----------------------------------------------------------- invitación

  async function invitation(token) {
    const invitee = typeof token === 'string' && token.length >= 20 ? await store.getUserByInvite(hashToken(token)) : null;
    const merchant = invitee ? await store.getMerchant(invitee.merchantId) : null;
    return merchant ? { invitee, merchantName: merchant.businessName } : { invitee: null, merchantName: null };
  }

  web.get(
    '/invitacion/:token',
    wrap(async (req, res) => {
      res.set('Referrer-Policy', 'no-referrer');
      const found = await invitation(req.params.token);
      return send(res, invitePage({ ...found, token: req.params.token, csrf: req.csrfToken }), found.invitee ? 200 : 404);
    }),
  );

  web.post(
    '/invitacion/:token',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      const found = await invitation(req.params.token);
      const values = { nombre: String(req.body.nombre ?? '').trim() };
      const password = String(req.body.contrasena ?? '');
      const fail = (error, status = 422) => send(res, invitePage({ ...found, token: req.params.token, error, values, csrf: req.csrfToken }), status);
      if (!found.invitee) return fail(null, 404);
      if (!(await store.hit(`invite-ip:${req.ip}`, { limit: 20, windowMs: 60 * MINUTE }))) return fail('Demasiados intentos. Espera una hora.', 429);
      if (!validName(values.nombre)) return fail('Escribe tu nombre (hasta 60 caracteres).');
      if (password.length < MIN_PASSWORD_LENGTH) return fail(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);

      const user = await store.updateUser(found.invitee.id, {
        name: values.nombre,
        passwordHash: await hashPassword(password),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      });
      // Si había otra sesión abierta en este navegador, se cierra antes.
      await auth.endSession(req, res, { clearCookie: false });
      await auth.startSession(res, user);
      return res.redirect(303, '/panel?ok=unido');
    }),
  );

  // ---------------------------------------------------------------- panel

  const panel = express.Router();
  panel.use(auth.requireUser);

  /**
   * De quién son los cobros que se listan: el vendedor solo ve los suyos; el
   * administrador ve todos o los de una persona (?persona=id) de su equipo.
   */
  async function listScope(req, team = null) {
    if (!isAdmin(req)) return { createdBy: req.user.id, team: null };
    const members = team ?? (await store.listUsers(req.merchant.id));
    const id = Number(req.query.persona);
    const chosen = Number.isInteger(id) && members.some((m) => m.id === id) ? id : null;
    return { createdBy: chosen, team: members };
  }

  async function renderPanel(req, res, { error = null, values = {}, status = 200 } = {}) {
    const ctx = ctxFor(req);
    const scope = await listScope(req);
    const [summary, list] = await Promise.all([
      charges.summary(ctx),
      store.listCharges(ctx.ownerKey, { limit: 50, createdBy: scope.createdBy }),
    ]);
    return send(
      res,
      panelPage({
        user: req.user,
        merchant: req.merchant,
        csrf: req.csrfToken,
        limits,
        summary,
        charges: list,
        team: scope.team,
        filterUserId: scope.createdBy,
        flash: FLASH[req.query.ok] ?? null,
        error,
        values,
        canLink,
      }),
      status,
    );
  }

  panel.get('/', wrap((req, res) => renderPanel(req, res)));

  panel.post(
    '/cobros',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      const values = {
        tipo: ['push', 'qr', 'link'].includes(req.body.tipo) ? req.body.tipo : 'push',
        monto: String(req.body.monto ?? '').trim(),
        concepto: String(req.body.concepto ?? '').trim().slice(0, 40),
        telefono: String(req.body.telefono ?? '').trim(),
      };
      const fail = (error) => renderPanel(req, res, { error, values, status: 422 });

      const parsed = parseAmount(values.monto);
      if (parsed.error) return fail(parsed.error);
      const input = { amountCents: toCents(parsed.amount), concept: values.concepto || null };
      const ctx = ctxFor(req);

      let result;
      if (values.tipo === 'push') {
        const payerPhone = normalizePhone(values.telefono);
        if (!payerPhone) return fail('El celular de tu cliente debe tener 10 dígitos.');
        result = await charges.draftPush(ctx, { ...input, payerPhone });
      } else if (values.tipo === 'qr') {
        result = await charges.createQr(ctx, input);
      } else {
        result = await charges.createLink(ctx, input);
      }
      if (!result.ok && !result.charge) return fail(plain(result.message));
      return res.redirect(303, `/panel/cobros/${result.charge.id}`);
    }),
  );

  /** El cobro con ese id si esta persona puede verlo, o null (no existe, es de otro negocio o de otro vendedor). */
  async function ownCharge(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const charge = await store.getCharge(id);
    return charges.canAccess(ctxFor(req), charge) ? charge : null;
  }

  async function renderCharge(req, res, charge, { error = null, status = 200 } = {}) {
    const png = charge.status === 'qr' ? await charges.qrPngFor(charge) : null;
    const creator = isAdmin(req) && charge.createdBy ? await store.getUser(charge.createdBy) : null;
    return send(
      res,
      chargePage({
        user: req.user,
        csrf: req.csrfToken,
        charge,
        creatorName: creator?.name ?? null,
        qrDataUrl: png ? `data:image/png;base64,${png.toString('base64')}` : null,
        flash: FLASH[req.query.ok] ?? null,
        error,
        canLink,
      }),
      status,
    );
  }

  const notFound = (req, res) =>
    send(res, messagePage({ title: 'No encontramos ese cobro', text: 'Puede que sea de otra persona o que el enlace esté mal.', user: req.user, csrf: req.csrfToken }), 404);

  panel.get(
    '/cobros/:id',
    wrap(async (req, res) => {
      const charge = await ownCharge(req);
      return charge ? renderCharge(req, res, charge) : notFound(req, res);
    }),
  );

  const action = (run, okFlash) =>
    wrap(async (req, res) => {
      const charge = await ownCharge(req);
      if (!charge) return notFound(req, res);
      const result = await run(ctxFor(req), charge.id);
      if (result.ok) return res.redirect(303, `/panel/cobros/${charge.id}${okFlash(result) ? `?ok=${okFlash(result)}` : ''}`);
      const fresh = await store.getCharge(charge.id);
      return renderCharge(req, res, fresh, { error: result.message ? plain(result.message) : null, status: 422 });
    });

  panel.post('/cobros/:id/confirmar', form, auth.checkForm, action(charges.confirmPush, (r) => (r.outcome === 'sent' ? 'enviado' : null)));
  panel.post('/cobros/:id/cancelar', form, auth.checkForm, action(charges.cancelPush, () => 'cancelado'));
  panel.post('/cobros/:id/liga', form, auth.checkForm, action(charges.linkForExpired, () => null));

  panel.get(
    '/cobros.csv',
    wrap(async (req, res) => {
      const scope = await listScope(req);
      const list = await store.listCharges(ctxFor(req).ownerKey, { limit: 5000, createdBy: scope.createdBy });
      const names = scope.team ? new Map(scope.team.map((u) => [u.id, u.name])) : null;
      const header = ['folio', 'creado', 'forma', 'monto', 'concepto', 'cliente', ...(names ? ['vendio'] : []), 'estado', 'pagado', 'clave_rastreo'];
      const rows = list.map((c) => [
        c.id,
        formatDateTime(c.createdAt),
        KIND[c.kind] ?? c.kind,
        (c.amountCents / 100).toFixed(2),
        c.concept ?? '',
        c.payerPhone ?? '',
        ...(names ? [names.get(c.createdBy) ?? ''] : []),
        STATUS[c.status]?.label ?? c.status,
        c.paidAt ? formatDateTime(c.paidAt * 1000) : '',
        c.trackingKey ?? '',
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      res
        .type('text/csv; charset=utf-8')
        .set('Content-Disposition', 'attachment; filename="cobros.csv"')
        // BOM para que Excel lea bien los acentos.
        .send(`﻿${csv}\r\n`);
    }),
  );

  // API para que el panel se actualice solo.
  panel.get(
    '/api/cobros',
    wrap(async (req, res) => {
      const ctx = ctxFor(req);
      const scope = await listScope(req);
      const [summary, list] = await Promise.all([
        charges.summary(ctx),
        store.listCharges(ctx.ownerKey, { limit: 50, createdBy: scope.createdBy }),
      ]);
      res.set('Cache-Control', 'no-store').json({
        charges: list.map((c) => ({ id: c.id, status: c.status, chip: statusChip(c.status) })),
        summary: { totalPaid: money(summary.totalPaidCents), pending: summary.pending.length, expired: summary.expiredCount },
      });
    }),
  );

  panel.get(
    '/api/cobros/:id',
    wrap(async (req, res) => {
      const charge = await ownCharge(req);
      if (!charge) return res.status(404).json({ error: 'No encontrado' });
      return res.set('Cache-Control', 'no-store').json({ charge: { id: charge.id, status: charge.status } });
    }),
  );

  // -------------------------------------------------------------- ajustes

  function renderSettings(req, res, { user = req.user, error = null, linkCode = null, values = {}, status = 200 } = {}) {
    const activeCode = linkCode ?? (user.linkCode && user.linkCodeExpiresAt > now() ? user.linkCode : null);
    return send(
      res,
      settingsPage({
        user,
        merchant: req.merchant,
        csrf: req.csrfToken,
        flash: FLASH[req.query.ok] ?? null,
        error,
        linkCode: activeCode,
        whatsappNumber,
        values,
      }),
      status,
    );
  }

  panel.get('/ajustes', wrap((req, res) => renderSettings(req, res)));

  panel.post(
    '/ajustes/perfil',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      const name = String(req.body.nombre ?? '').trim();
      if (!validName(name)) return renderSettings(req, res, { error: 'Escribe tu nombre (hasta 60 caracteres).', status: 422 });
      await store.updateUser(req.user.id, { name });
      return res.redirect(303, '/panel/ajustes?ok=perfil');
    }),
  );

  panel.post(
    '/ajustes/negocio',
    form,
    auth.checkForm,
    auth.requireAdmin,
    wrap(async (req, res) => {
      const name = String(req.body.negocio ?? '').trim();
      if (!validName(name)) return renderSettings(req, res, { error: 'Escribe el nombre del negocio (hasta 60 caracteres).', status: 422 });
      await store.updateMerchant(req.merchant.id, { businessName: name });
      return res.redirect(303, '/panel/ajustes?ok=negocio');
    }),
  );

  panel.post(
    '/ajustes/whatsapp/codigo',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      // Código de 6 dígitos; si choca con el de otra persona, se genera otro.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        try {
          const user = await store.updateUser(req.user.id, { linkCode: code, linkCodeExpiresAt: now() + LINK_CODE_MS });
          return renderSettings(req, res, { user, linkCode: code });
        } catch (error) {
          if (error.code !== '23505') throw error;
        }
      }
      return renderSettings(req, res, { error: 'No pudimos generar el código. Intenta de nuevo.', status: 500 });
    }),
  );

  panel.post(
    '/ajustes/whatsapp/quitar',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      await store.updateUser(req.user.id, { whatsappPhone: null });
      return res.redirect(303, '/panel/ajustes?ok=desligado#whatsapp');
    }),
  );

  panel.post(
    '/ajustes/clabe',
    form,
    auth.checkForm,
    auth.requireAdmin,
    wrap(async (req, res) => {
      const values = {
        titular: String(req.body.titular ?? '').trim(),
        clabe: String(req.body.clabe ?? '').trim(),
        entidad: req.body.entidad === 'BUSINESS' ? 'BUSINESS' : 'PERSON',
      };
      if (!(await store.hit(`clabe:${req.merchant.id}`, { limit: 5, windowMs: 60 * MINUTE }))) {
        return renderSettings(req, res, { error: 'Demasiados intentos. Espera una hora.', values, status: 429 });
      }
      const result = await charges.registerBankAccount(req.merchant, {
        holder: values.titular,
        clabe: values.clabe,
        entity: values.entidad,
      });
      if (!result.ok) return renderSettings(req, res, { error: plain(result.message), values, status: 422 });
      return res.redirect(303, '/panel/ajustes?ok=clabe#clabe');
    }),
  );

  // --------------------------------------------------------------- equipo

  const team = express.Router();
  team.use(auth.requireAdmin);

  async function renderTeam(req, res, { invite = null, error = null, values = {}, status = 200 } = {}) {
    return send(
      res,
      teamPage({
        user: req.user,
        merchant: req.merchant,
        csrf: req.csrfToken,
        team: await store.listUsers(req.merchant.id),
        invite,
        flash: FLASH[req.query.ok] ?? null,
        error,
        values,
      }),
      status,
    );
  }

  /** Genera una liga de invitación nueva para esa persona (la anterior deja de servir). */
  async function newInvite(req, member) {
    const token = newToken();
    await store.updateUser(member.id, { inviteTokenHash: hashToken(token), inviteExpiresAt: now() + INVITE_MS });
    return { name: member.name, url: `${baseUrl(req)}/invitacion/${token}` };
  }

  /** La persona del equipo con ese id (del mismo negocio), o null. */
  async function memberFor(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const member = await store.getUser(id);
    return member && member.merchantId === req.merchant.id ? member : null;
  }

  team.get('/', wrap((req, res) => renderTeam(req, res)));

  team.post(
    '/',
    form,
    auth.checkForm,
    wrap(async (req, res) => {
      const values = {
        nombre: String(req.body.nombre ?? '').trim(),
        correo: String(req.body.correo ?? '').trim().toLowerCase(),
        rol: req.body.rol === 'admin' ? 'admin' : 'seller',
      };
      const fail = (error, status = 422) => renderTeam(req, res, { error, values, status });
      if (!(await store.hit(`invite:${req.merchant.id}`, { limit: 30, windowMs: 60 * MINUTE }))) return fail('Demasiadas invitaciones. Espera una hora.', 429);
      if (!validName(values.nombre)) return fail('Escribe el nombre (hasta 60 caracteres).');
      if (!EMAIL.test(values.correo)) return fail('Escribe un correo válido.');
      if (await store.getUserByEmail(values.correo)) return fail('Ese correo ya tiene una cuenta de Cóbrale.');

      let member;
      try {
        member = await store.createUser({ merchantId: req.merchant.id, role: values.rol, name: values.nombre, email: values.correo });
      } catch (error) {
        if (error.code === '23505') return fail('Ese correo ya tiene una cuenta de Cóbrale.');
        throw error;
      }
      return renderTeam(req, res, { invite: await newInvite(req, member) });
    }),
  );

  const memberAction = (run) =>
    wrap(async (req, res) => {
      const member = await memberFor(req);
      if (!member) return renderTeam(req, res, { error: 'No encontramos a esa persona en tu equipo.', status: 404 });
      if (member.id === req.user.id) return renderTeam(req, res, { error: 'No puedes cambiar tu propio rol ni desactivarte. Pídeselo a otro administrador.', status: 422 });
      return run(req, res, member);
    });

  const LAST_ADMIN = 'El negocio necesita al menos un administrador activo.';

  team.post(
    '/:id/rol',
    form,
    auth.checkForm,
    memberAction(async (req, res, member) => {
      if (!member.active) return renderTeam(req, res, { error: 'Primero reactiva a esa persona.', status: 422 });
      const result = await store.changeMember(req.merchant.id, member.id, { role: member.role === 'admin' ? 'seller' : 'admin' });
      if (!result.ok) return renderTeam(req, res, { error: LAST_ADMIN, status: 422 });
      return res.redirect(303, '/panel/equipo?ok=rol');
    }),
  );

  team.post(
    '/:id/desactivar',
    form,
    auth.checkForm,
    memberAction(async (req, res, member) => {
      const result = await store.changeMember(req.merchant.id, member.id, { deactivate: true });
      if (!result.ok) return renderTeam(req, res, { error: LAST_ADMIN, status: 422 });
      return res.redirect(303, '/panel/equipo?ok=desactivado');
    }),
  );

  team.post(
    '/:id/reactivar',
    form,
    auth.checkForm,
    memberAction(async (req, res, member) => {
      await store.updateUser(member.id, { active: true });
      return res.redirect(303, '/panel/equipo?ok=reactivado');
    }),
  );

  team.post(
    '/:id/invitacion',
    form,
    auth.checkForm,
    memberAction(async (req, res, member) => {
      if (!member.active || member.passwordHash) return renderTeam(req, res, { error: 'Esa persona ya tiene su contraseña.', status: 422 });
      return renderTeam(req, res, { invite: await newInvite(req, member) });
    }),
  );

  panel.use('/equipo', team);

  web.use('/panel', panel);

  // Errores inesperados: una página sencilla, sin detalles internos.
  web.use((error, req, res, _next) => {
    log.error(`[web] ${req.method} ${req.originalUrl} falló: ${error.stack ?? error.message}`);
    send(res, messagePage({ title: 'Algo salió mal', text: 'Intenta de nuevo en un momento.', user: req.user, csrf: req.csrfToken }), 500);
  });

  app.use(web);
}
