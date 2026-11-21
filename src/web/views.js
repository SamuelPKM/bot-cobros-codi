// Páginas de la web de Cóbrale. HTML generado en el servidor, sin paso de
// compilación. Todo texto que viene de la base o de la persona pasa por `h()`.

import { money, phone } from '../messages.js';

export function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const TIME_ZONE = 'America/Mexico_City';
const dateTime = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });
const timeOnly = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, timeStyle: 'short' });
export const formatDateTime = (ms) => (ms ? dateTime.format(new Date(ms)) : '');
export const formatTime = (ms) => (ms ? timeOnly.format(new Date(ms)) : '');

export const STATUS = {
  awaiting_confirmation: { label: 'Por confirmar', tone: 'neutral' },
  sending: { label: 'Enviando', tone: 'wait' },
  creating: { label: 'Creando', tone: 'wait' },
  link_creating: { label: 'Creando liga', tone: 'wait' },
  pending: { label: 'Esperando pago', tone: 'wait' },
  unknown: { label: 'Envío sin confirmar', tone: 'warn' },
  qr: { label: 'QR vigente', tone: 'wait' },
  link: { label: 'Liga activa', tone: 'wait' },
  paid: { label: 'Pagado', tone: 'ok' },
  expired: { label: 'Expiró', tone: 'muted' },
  failed: { label: 'Falló', tone: 'bad' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
};

export const KIND = { push: 'Al celular', qr: 'QR', link: 'Liga' };
export const ROLE = { admin: 'Administrador', seller: 'Vendedor' };

export function statusChip(status) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' };
  return `<span class="chip chip-${s.tone}" data-status="${h(status)}">${h(s.label)}</span>`;
}

/** Quita el formato de WhatsApp (*negritas*) de los textos compartidos con el bot. */
export const plain = (text) => String(text ?? '').replace(/\*([^*\n]+)\*/g, '$1');

const csrfField = (csrf) => (csrf ? `<input type="hidden" name="_csrf" value="${h(csrf)}">` : '');

function nav(user, csrf, active) {
  if (!user) {
    return `<nav class="nav">
      <a href="/demo">Demo</a>
      <a href="/entrar">Entrar</a>
      <a class="button button-small" href="/registro">Crear cuenta</a>
    </nav>`;
  }
  const link = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="nav">
    ${link('/panel', 'Cobros', 'panel')}
    ${user.role === 'admin' ? link('/panel/equipo', 'Equipo', 'equipo') : ''}
    ${link('/panel/ajustes', 'Ajustes', 'ajustes')}
    <span class="who">${h(user.name)} · ${h(ROLE[user.role])}</span>
    <form method="post" action="/salir" class="inline">${csrfField(csrf)}<button class="link-button" type="submit">Salir</button></form>
  </nav>`;
}

export function layout({ title, body, user = null, csrf = null, active = null, scripts = [] }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${h(title)} · Cóbrale</title>
<link rel="stylesheet" href="/assets/app.css">
${scripts.map((src) => `<script src="${src}" defer></script>`).join('\n')}
</head>
<body>
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="${user ? '/panel' : '/'}">Cóbrale</a>
    ${nav(user, csrf, active)}
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="wrap footer">
  Cóbrale usa CoDi a través de la API de pey. No es un producto oficial de pey ni de Banco de México.
</footer>
</body>
</html>`;
}

// ------------------------------------------------------------------ inicio

export function landingPage({ user, demoEnabled }) {
  return layout({
    title: 'Cobra con CoDi escribiendo un mensaje',
    user,
    body: `
<section class="hero">
  <h1>Cobra con CoDi escribiendo un mensaje</h1>
  <p class="lead">Para quien vive de su oficio: manda un cobro desde WhatsApp o desde la web, y te avisamos en cuanto te pagan. Sin terminal, sin comisión por CoDi y sin instalar nada.</p>
  <div class="actions">
    ${user ? '<a class="button" href="/panel">Ir a mis cobros</a>' : '<a class="button" href="/registro">Crear cuenta gratis</a>'}
    ${demoEnabled ? '<a class="button button-secondary" href="/demo">Probar la demo</a>' : ''}
  </div>
</section>

<section class="grid-3">
  <article class="card">
    <h2>Al celular</h2>
    <p>Escribe <code>cobra 150 a 5512345678 corte</code>. A tu cliente le llega la solicitud de pago en la app de su banco.</p>
  </article>
  <article class="card">
    <h2>Con QR</h2>
    <p>Escribe <code>qr 150 corte</code> y muestra el código en el mostrador. Tu cliente lo escanea con su banco.</p>
  </article>
  <article class="card">
    <h2>Con liga</h2>
    <p>Escribe <code>liga 150 corte</code> y mándala por donde quieras. También acepta tarjeta.</p>
  </article>
</section>

<section class="card">
  <h2>Cómo funciona</h2>
  <ol class="steps">
    <li><strong>Crea tu cuenta</strong> con tu correo y el nombre de tu negocio. Quedas como administrador, y también puedes cobrar.</li>
    <li><strong>Invita a tu equipo</strong> si tienes vendedores: cada quien cobra con su cuenta y su WhatsApp, y tú ves lo de todos.</li>
    <li><strong>Registra tu CLABE</strong> para que los pagos te lleguen directo. Mientras Banxico la valida, puedes probar con montos pequeños.</li>
  </ol>
</section>`,
  });
}

// --------------------------------------------------------- registro/entrar

export function authPage({ mode, error = null, values = {}, next = '', registrationOpen = true }) {
  const isSignup = mode === 'registro';
  if (isSignup && !registrationOpen) {
    return layout({ title: 'Crear cuenta', body: `<section class="card narrow"><h1>Crear cuenta</h1><p>El registro está cerrado por ahora.</p></section>` });
  }
  return layout({
    title: isSignup ? 'Crear cuenta' : 'Entrar',
    body: `
<section class="card narrow">
  <h1>${isSignup ? 'Crea tu cuenta' : 'Entra a tu cuenta'}</h1>
  ${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}
  <form method="post" action="/${isSignup ? 'registro' : 'entrar'}" class="form">
    ${next ? `<input type="hidden" name="siguiente" value="${h(next)}">` : ''}
    ${
      isSignup
        ? `<label>Nombre de tu negocio
      <input name="negocio" required maxlength="60" autocomplete="organization" value="${h(values.negocio)}" placeholder="Barbería Leo">
      <small>Es lo que ve tu cliente en su banco al pagar.</small>
    </label>
    <label>Tu nombre
      <input name="nombre" required maxlength="60" autocomplete="name" value="${h(values.nombre)}" placeholder="Leonardo">
      <small>Quedas como administrador del negocio. Después puedes invitar a tus vendedores.</small>
    </label>`
        : ''
    }
    <label>Correo
      <input name="correo" type="email" required autocomplete="email" value="${h(values.correo)}">
    </label>
    <label>Contraseña
      <input name="contrasena" type="password" required minlength="${isSignup ? 10 : 1}" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
      ${isSignup ? '<small>Al menos 10 caracteres.</small>' : ''}
    </label>
    <button class="button" type="submit">${isSignup ? 'Crear cuenta' : 'Entrar'}</button>
  </form>
  <p class="muted">${
    isSignup ? '¿Ya tienes cuenta? <a href="/entrar">Entra</a>' : '¿Todavía no tienes cuenta? <a href="/registro">Crea una</a>'
  }</p>
</section>`,
  });
}

// ------------------------------------------------------------------- panel

function modeBanner(merchant, limits, user) {
  if (merchant.isDemo) {
    return `<p class="alert alert-info">Cuenta de demostración: los cobros son reales y de hasta ${money(limits.maxAmountCents)}. El dinero llega a la cuenta del proyecto.</p>`;
  }
  if (merchant.peyConnected) return '';
  if (merchant.bankStatus === 'ACTIVE') return '';
  if (merchant.isTrusted) return '';
  const pending = merchant.bankStatus === 'PENDING' || merchant.bankStatus === 'PROCESSING';
  return `<p class="alert alert-info">Modo prueba: cobros de hasta ${money(limits.maxAmountCents)}, que llegan a la cuenta del proyecto. ${
    pending
      ? 'La CLABE del negocio está en validación con Banxico (hasta 5 días hábiles).'
      : user.role === 'admin'
        ? '<a href="/panel/ajustes#clabe">Registra la CLABE del negocio</a> para cobrar a su nombre y sin límite.'
        : 'Cuando el administrador registre la CLABE del negocio, los cobros llegarán directo y sin límite.'
  }</p>`;
}

/** @param names Map de id de persona -> nombre; con él se agrega la columna "Vendió". */
export function chargeRow(charge, names = null) {
  const who = charge.payerPhone ? phone(charge.payerPhone) : KIND[charge.kind];
  return `<tr data-id="${charge.id}" data-status="${h(charge.status)}">
    <td><a href="/panel/cobros/${charge.id}">${h(money(charge.amountCents))}</a></td>
    <td>${h(charge.concept ?? '—')}</td>
    <td>${h(who)}</td>
    ${names ? `<td>${h(names.get(charge.createdBy) ?? '—')}</td>` : ''}
    <td class="status-cell">${statusChip(charge.status)}</td>
    <td class="muted">${h(formatDateTime(charge.createdAt))}</td>
  </tr>`;
}

/** Desglose del día por persona, para el administrador. */
function bySellerCard(bySeller, filterUserId) {
  if (!bySeller) return '';
  return `<section class="card">
  <h2>Hoy por persona</h2>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Persona</th><th>Cobrado</th><th>Cobros pagados</th><th>Pendientes</th><th></th></tr></thead>
    <tbody>${bySeller
      .map(
        (s) => `<tr>
      <td>${h(s.name)} <span class="muted">· ${h(ROLE[s.role])}</span></td>
      <td>${h(money(s.paidCents))}</td>
      <td>${s.paidCount}</td>
      <td>${s.pendingCount}</td>
      <td>${filterUserId === s.userId ? '<span class="muted">viendo</span>' : `<a href="/panel?persona=${s.userId}#ultimos">Ver sus cobros</a>`}</td>
    </tr>`,
      )
      .join('')}</tbody>
  </table></div>
</section>`;
}

/**
 * @param team el equipo (solo para el administrador): filtro y columna "Vendió".
 * @param filterUserId la persona cuyos cobros se están viendo, o null para todos.
 */
export function panelPage({
  user,
  merchant,
  csrf,
  limits,
  summary,
  charges,
  team = null,
  filterUserId = null,
  flash = null,
  error = null,
  values = {},
  canLink,
}) {
  const kind = values.tipo ?? 'push';
  const isAdmin = user.role === 'admin';
  const names = isAdmin && team ? new Map(team.map((u) => [u.id, u.name])) : null;
  const radio = (value, label) =>
    `<label class="radio"><input type="radio" name="tipo" value="${value}"${kind === value ? ' checked' : ''}> ${label}</label>`;
  const filter =
    isAdmin && team && team.length > 1
      ? `<form method="get" action="/panel" class="filter">
      <label>Ver cobros de
        <select name="persona" data-autosubmit>
          <option value="">Todo el equipo</option>
          ${team.map((u) => `<option value="${u.id}"${filterUserId === u.id ? ' selected' : ''}>${h(u.name)}${u.active ? '' : ' (desactivado)'}</option>`).join('')}
        </select>
      </label>
      <noscript><button class="button button-small" type="submit">Ver</button></noscript>
    </form>`
      : '';
  const csvHref = `/panel/cobros.csv${filterUserId ? `?persona=${filterUserId}` : ''}`;
  return layout({
    title: 'Cobros',
    user,
    csrf,
    active: 'panel',
    scripts: ['/assets/panel.js'],
    body: `
<h1>${h(merchant.businessName)}</h1>
<p class="muted subtitle">Hola, ${h(user.name)}. ${isAdmin ? 'Ves los cobros de todo el negocio.' : 'Ves tus cobros.'}</p>
${modeBanner(merchant, limits, user)}
${flash ? `<p class="alert alert-ok" role="status">${h(flash)}</p>` : ''}

<section class="stats" aria-label="Hoy">
  <div class="stat"><span class="stat-label">${isAdmin ? 'Cobrado hoy' : 'Cobraste hoy'}</span><span class="stat-value" id="stat-paid">${h(money(summary.totalPaidCents))}</span></div>
  <div class="stat"><span class="stat-label">Pendientes</span><span class="stat-value" id="stat-pending">${summary.pending.length}</span></div>
  <div class="stat"><span class="stat-label">Expirados hoy</span><span class="stat-value" id="stat-expired">${summary.expiredCount}</span></div>
</section>
${isAdmin ? bySellerCard(summary.bySeller, filterUserId) : ''}

<section class="card">
  <h2>Nuevo cobro</h2>
  ${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}
  <form method="post" action="/panel/cobros" class="form" id="new-charge">
    ${csrfField(csrf)}
    <fieldset class="radios">
      <legend>¿Cómo quieres cobrar?</legend>
      ${radio('push', 'Al celular de mi cliente')}
      ${radio('qr', 'Con QR')}
      ${canLink ? radio('link', 'Con liga de pago') : ''}
    </fieldset>
    <div class="row">
      <label>Monto (MXN)
        <input name="monto" inputmode="decimal" required placeholder="150.00" value="${h(values.monto)}">
      </label>
      <label class="grow">Concepto
        <input name="concepto" maxlength="40" placeholder="Corte de pelo" value="${h(values.concepto)}">
      </label>
    </div>
    <label data-only="push">Celular de tu cliente (10 dígitos)
      <input name="telefono" inputmode="tel" placeholder="55 1234 5678" value="${h(values.telefono)}">
      <small>Debe tener CoDi activo en la app de su banco. Si no lo tiene, usa QR o liga.</small>
    </label>
    <button class="button" type="submit">Continuar</button>
  </form>
</section>

<section class="card" id="ultimos">
  <div class="card-head">
    <h2>${isAdmin ? 'Últimos cobros' : 'Tus últimos cobros'}</h2>
    <div class="card-tools">${filter}<a class="muted" href="${csvHref}">Descargar CSV</a></div>
  </div>
  ${
    charges.length === 0
      ? '<p class="muted" id="empty">Todavía no hay cobros. Crea el primero arriba.</p>'
      : `<div class="table-wrap"><table class="table" id="charges">
    <thead><tr><th>Monto</th><th>Concepto</th><th>A quién</th>${names ? '<th>Vendió</th>' : ''}<th>Estado</th><th>Creado</th></tr></thead>
    <tbody>${charges.map((c) => chargeRow(c, names)).join('')}</tbody>
  </table></div>`
  }
</section>`,
  });
}

// --------------------------------------------------------- detalle de cobro

export function chargePage({ user, csrf, charge, creatorName = null, qrDataUrl = null, flash = null, error = null, canLink }) {
  const post = (action, label, cls = 'button') =>
    `<form method="post" action="/panel/cobros/${charge.id}/${action}" class="inline">${csrfField(csrf)}<button class="${cls}" type="submit">${label}</button></form>`;

  let main = '';
  if (charge.status === 'awaiting_confirmation') {
    main = `<p>Vas a mandarle a <strong>${h(phone(charge.payerPhone))}</strong> una solicitud de pago por <strong>${h(money(charge.amountCents))}</strong>${
      charge.concept ? ` por “${h(charge.concept)}”` : ''
    }. Le llega en la app de su banco y tiene 6 minutos para aprobarla.</p>
    <div class="actions">${post('confirmar', 'Enviar cobro')}${post('cancelar', 'Cancelar', 'button button-secondary')}</div>`;
  } else if (charge.status === 'qr' && qrDataUrl) {
    main = `<img class="qr" src="${qrDataUrl}" alt="Código QR CoDi para pagar ${h(money(charge.amountCents))}" width="280" height="280">
    <p>Tu cliente lo escanea con la app de su banco. Vence a las <strong>${h(formatTime(charge.expiresAt))}</strong>.</p>`;
  } else if (charge.status === 'link' && charge.linkUrl) {
    main = `<p>Mándale esta liga a tu cliente. Puede pagar con CoDi o con tarjeta.</p>
    <div class="copy">
      <input readonly value="${h(charge.linkUrl)}" id="link-url" aria-label="Liga de pago">
      <button class="button" type="button" data-copy="#link-url">Copiar</button>
    </div>
    <p><a href="${h(charge.linkUrl)}" target="_blank" rel="noopener noreferrer">Abrir la liga</a></p>`;
  } else if (charge.status === 'pending') {
    main = `<p>Le llegó la solicitud a tu cliente. Tiene hasta las <strong>${h(formatTime(charge.expiresAt))}</strong> para aprobarla. Esta página se actualiza sola.</p>`;
  } else if (charge.status === 'unknown') {
    main = `<p>No pudimos confirmar si la solicitud se envió porque se cortó la conexión con el banco. No la repitas todavía: pregúntale a tu cliente si le llegó. Si paga, aparecerá aquí.</p>`;
  } else if (charge.status === 'paid') {
    main = `<p class="big-ok">Pagado${charge.paidAt ? ` el ${h(formatDateTime(charge.paidAt * 1000))}` : ''}</p>
    ${charge.trackingKey ? `<p>Clave de rastreo: <code>${h(charge.trackingKey)}</code></p>` : ''}`;
  } else if (charge.status === 'expired') {
    main =
      charge.kind === 'push' && canLink
        ? `<p>Expiró sin pagarse. Si tu cliente no tiene CoDi activo, no le llegó la solicitud. Genera una liga de pago para mandársela; también acepta tarjeta.</p>
      <div class="actions">${post('liga', 'Generar liga de pago')}</div>`
        : '<p>Expiró sin pagarse. Si tu cliente todavía quiere pagar, crea un cobro nuevo.</p>';
  } else if (charge.status === 'failed') {
    main = `<p>No se pudo crear el cobro. Intenta de nuevo; si sigue fallando, usa otra forma de cobro.</p>`;
  } else if (charge.status === 'cancelled') {
    main = '<p>Cancelado: no se envió nada.</p>';
  }

  return layout({
    title: `Cobro de ${money(charge.amountCents)}`,
    user,
    csrf,
    active: 'panel',
    scripts: ['/assets/panel.js'],
    body: `
<p><a href="/panel">← Todos los cobros</a></p>
<section class="card" data-charge="${charge.id}" data-status="${h(charge.status)}">
  <div class="card-head">
    <h1>${h(money(charge.amountCents))}${charge.concept ? ` · ${h(charge.concept)}` : ''}</h1>
    ${statusChip(charge.status)}
  </div>
  ${flash ? `<p class="alert alert-ok" role="status">${h(flash)}</p>` : ''}
  ${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}
  ${main}
  <dl class="details">
    <dt>Forma de cobro</dt><dd>${h(KIND[charge.kind] ?? charge.kind)}</dd>
    ${charge.payerPhone ? `<dt>Cliente</dt><dd>${h(phone(charge.payerPhone))}</dd>` : ''}
    <dt>Creado</dt><dd>${h(formatDateTime(charge.createdAt))} desde ${h(charge.channel === 'whatsapp' ? 'WhatsApp' : 'la web')}</dd>
    ${creatorName ? `<dt>Vendió</dt><dd>${h(creatorName)}</dd>` : ''}
    <dt>Folio</dt><dd>${charge.id}</dd>
  </dl>
</section>`,
  });
}

// ------------------------------------------------------------------ ajustes

export const PEY_PORTAL_URL = 'https://portal.mipey.mx';

/**
 * Asistente para conectar la cuenta de pey propia del negocio.
 * @param pey { enabled, status: 'none'|'needs_webhook'|'connected', last4, webhookUrl, connectedAt, lastEventAt }
 */
function peySection({ user, csrf, pey, values }) {
  const isAdmin = user.role === 'admin';
  const portal = `<a href="${PEY_PORTAL_URL}" target="_blank" rel="noopener noreferrer">portal.mipey.mx</a>`;
  const post = (action, label, cls = 'button button-secondary') =>
    `<form method="post" action="/panel/ajustes/pey/${action}" class="inline">${csrfField(csrf)}<button class="${cls}" type="submit">${label}</button></form>`;
  const keyForm = (label) => `<form method="post" action="/panel/ajustes/pey/llave" class="form">
      ${csrfField(csrf)}
      <label>API key de pey
        <input name="llave" type="password" required autocomplete="off" spellcheck="false" placeholder="Pégala aquí">
        <small>La comprobamos con pey con una consulta que no cobra nada, y la guardamos cifrada. Nadie la vuelve a ver, ni tú.</small>
      </label>
      <button class="button" type="submit">${label}</button>
    </form>`;
  const urlBox = pey.webhookUrl
    ? `<div class="copy"><input readonly value="${h(pey.webhookUrl)}" id="pey-webhook-url" aria-label="URL del webhook"><button class="button" type="button" data-copy="#pey-webhook-url">Copiar</button></div>`
    : '';

  let body;
  if (!pey.enabled) {
    body = '<p class="muted">Esta instalación de Cóbrale no permite conectar cuentas propias de pey (falta <code>SECRETS_KEY</code> en el servidor).</p>';
  } else if (pey.status === 'connected') {
    body = `<p class="alert alert-ok">Conectada. Los cobros del negocio se crean con tu API key que termina en <strong>${h(pey.last4)}</strong>, y el dinero llega a la cuenta de pago ligada a ella, sin el límite del modo prueba.</p>
    <dl class="details">
      <dt>Conectada</dt><dd>${h(formatDateTime(pey.connectedAt))}</dd>
      <dt>Último aviso de pey</dt><dd>${pey.lastEventAt ? h(formatDateTime(pey.lastEventAt)) : 'Todavía ninguno. Haz un cobro de $0.01 para probar que llegan.'}</dd>
    </dl>
    ${
      isAdmin
        ? `<h3>URL de tu webhook</h3><p class="muted">Es la que registraste en pey. Si rotas el secreto en el portal, vuelve a pegarlo abajo.</p>${urlBox}
    <details class="more"><summary>Rotaste el secreto del webhook</summary>
      <form method="post" action="/panel/ajustes/pey/webhook" class="form">${csrfField(csrf)}
        <label>Secreto nuevo<input name="secreto" type="password" required autocomplete="off" spellcheck="false" placeholder="whsec_…"></label>
        <button class="button" type="submit">Guardar secreto</button>
      </form>
    </details>
    <details class="more"><summary>Cambiar de API key</summary>${keyForm('Comprobar y cambiar')}<p class="muted">Al cambiarla, la URL del webhook cambia: tendrás que registrarla otra vez en pey.</p></details>
    <div class="actions">${post('desconectar', 'Desconectar y volver a la cuenta de Cóbrale')}</div>`
        : ''
    }`;
  } else if (!isAdmin) {
    body = '<p>El negocio cobra con la cuenta de Cóbrale. Un administrador puede conectar la cuenta de pey propia del negocio.</p>';
  } else {
    const keyDone = pey.status === 'needs_webhook';
    body = `<p>Opcional. Con tu propia cuenta de pey, el dinero de <strong>todos</strong> los cobros del negocio, incluidas las ligas de pago, llega a tu cuenta, sin el límite del modo prueba. pey no permite crear cuentas desde otra app, así que son unos pasos en su portal.</p>
    <ol class="wizard">
      <li class="${keyDone ? 'done' : 'current'}">
        <h3>Crea tu cuenta y tu API key en pey</h3>
        <ol>
          <li>Entra a ${portal} y crea tu perfil.</li>
          <li>En <b>Finanzas</b>, agrega una cuenta de pago <b>CoDi</b> con la CLABE donde quieres recibir. Banxico la valida en hasta 5 días hábiles.</li>
          <li>En <b>Desarrollador</b>, da clic en <b>Crear API Key</b>, ponle un nombre (por ejemplo “Cóbrale”) y vincúlala a esa cuenta de pago. Copia la llave.</li>
        </ol>
      </li>
      <li class="${keyDone ? 'done' : 'current'}">
        <h3>Pega tu API key</h3>
        ${keyDone ? `<p>Guardada y comprobada: termina en <strong>${h(pey.last4)}</strong>.</p>` : keyForm('Comprobar y guardar')}
      </li>
      <li class="${keyDone ? 'current' : 'todo'}">
        <h3>Conecta el aviso de pagos</h3>
        ${
          keyDone
            ? `<ol>
          <li>En ${portal} &gt; <b>Desarrollador</b>, da clic en el engrane de tu API key.</li>
          <li>Crea el webhook con esta URL:${urlBox}</li>
          <li>Copia el secreto que te muestra (empieza con <code>whsec_</code>; solo se ve una vez) y pégalo aquí.</li>
        </ol>
        <form method="post" action="/panel/ajustes/pey/webhook" class="form">${csrfField(csrf)}
          <label>Secreto del webhook<input name="secreto" type="password" required autocomplete="off" spellcheck="false" placeholder="whsec_…"></label>
          <button class="button" type="submit">Conectar</button>
        </form>
        <p class="muted">Hasta este paso, los cobros siguen saliendo por la cuenta de Cóbrale.</p>
        <div class="actions">${post('desconectar', 'Cancelar y borrar la API key', 'link-button')}</div>`
            : '<p class="muted">Después de guardar tu API key, aquí aparece la URL que vas a registrar en pey.</p>'
        }
      </li>
    </ol>`;
  }

  return `<section class="card" id="pey">
  <h2>Tu propia cuenta de pey</h2>
  ${body}
</section>`;
}

const BANK_STATUS = {
  PENDING: 'En validación con Banxico',
  PROCESSING: 'En validación con Banxico',
  ACTIVE: 'Activa: tus cobros te llegan directo',
  ERROR: 'Rechazada',
};

export function settingsPage({ user, merchant, csrf, flash = null, error = null, linkCode = null, whatsappNumber = null, values = {}, pey = null }) {
  const isAdmin = user.role === 'admin';
  const peyConnected = pey?.status === 'connected' && pey.enabled;
  const bankState = peyConnected
    ? '<p>Con tu cuenta de pey conectada, los cobros llegan a la cuenta de pago de tu API key. La CLABE de esta sección solo se usa si la desconectas.</p>'
    : merchant.bankAccountId
    ? `<p>CLABE terminación <strong>${h(merchant.bankClabeLast4)}</strong> a nombre de ${h(merchant.bankHolder)}: <strong>${h(
        BANK_STATUS[merchant.bankStatus] ?? merchant.bankStatus,
      )}</strong>.</p>
      ${merchant.bankStatus === 'ERROR' ? `<p class="alert alert-bad">${h(merchant.bankError ?? 'Banxico rechazó la cuenta.')} ${isAdmin ? 'Revisa los datos y regístrala otra vez.' : ''}</p>` : ''}`
    : `<p>El negocio todavía no registra una CLABE. Mientras tanto está en modo prueba: cobros pequeños que llegan a la cuenta del proyecto.${
        isAdmin ? '' : ' Solo un administrador puede registrarla.'
      }</p>`;
  const canRegisterBank = !peyConnected && isAdmin && (!merchant.bankAccountId || merchant.bankStatus === 'ERROR');

  return layout({
    title: 'Ajustes',
    user,
    csrf,
    active: 'ajustes',
    scripts: ['/assets/panel.js'],
    body: `
<h1>Ajustes</h1>
${flash ? `<p class="alert alert-ok" role="status">${h(flash)}</p>` : ''}
${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}

<section class="card">
  <h2>Tus datos</h2>
  <form method="post" action="/panel/ajustes/perfil" class="form">
    ${csrfField(csrf)}
    <label>Tu nombre
      <input name="nombre" required maxlength="60" value="${h(user.name)}">
      <small>Así te ve tu equipo en los cobros. Entras con ${h(user.email)} como ${h(ROLE[user.role].toLowerCase())}.</small>
    </label>
    <button class="button" type="submit">Guardar</button>
  </form>
</section>

<section class="card" id="whatsapp">
  <h2>Tu WhatsApp</h2>
  ${
    user.whatsappPhone
      ? `<p>Ligado al <strong>${h(phone(user.whatsappPhone))}</strong>. Desde ese número le escribes al bot <code>cobra 150 a 5512345678 corte</code>, y los cobros quedan a tu nombre.</p>
      <form method="post" action="/panel/ajustes/whatsapp/quitar" class="inline">${csrfField(csrf)}<button class="button button-secondary" type="submit">Desligar</button></form>`
      : '<p>Liga tu WhatsApp para cobrar escribiéndole al bot. Los avisos de "Pagado" de tus cobros te llegan ahí.</p>'
  }
  ${
    linkCode
      ? `<p class="alert alert-info">Desde tu WhatsApp, manda este mensaje${whatsappNumber ? ` al <strong>${h(whatsappNumber)}</strong>` : ' al número de Cóbrale'}: <code class="big-code">vincular ${h(linkCode)}</code> El código vence en 15 minutos.</p>`
      : `<form method="post" action="/panel/ajustes/whatsapp/codigo" class="inline">${csrfField(csrf)}<button class="button" type="submit">${
          user.whatsappPhone ? 'Ligar otro número' : 'Ligar mi WhatsApp'
        }</button></form>`
  }
</section>

<section class="card">
  <h2>El negocio</h2>
  ${
    isAdmin
      ? `<form method="post" action="/panel/ajustes/negocio" class="form">
    ${csrfField(csrf)}
    <label>Nombre del negocio
      <input name="negocio" required maxlength="60" value="${h(merchant.businessName)}">
      <small>Es lo que ve el cliente en su banco al pagar, en los cobros de todo el equipo.</small>
    </label>
    <button class="button" type="submit">Guardar</button>
  </form>`
      : `<p><strong>${h(merchant.businessName)}</strong>. Solo un administrador puede cambiar el nombre.</p>`
  }
</section>

${pey && !merchant.isDemo ? peySection({ user, csrf, pey, values }) : ''}

<section class="card" id="clabe">
  <h2>Cuenta para recibir pagos</h2>
  ${bankState}
  ${
    canRegisterBank
      ? `<form method="post" action="/panel/ajustes/clabe" class="form">
    ${csrfField(csrf)}
    <label>Nombre del titular, como aparece en el banco
      <input name="titular" required maxlength="120" value="${h(values.titular)}">
    </label>
    <label>CLABE (18 dígitos)
      <input name="clabe" required inputmode="numeric" maxlength="22" value="${h(values.clabe)}" autocomplete="off">
    </label>
    <fieldset class="radios">
      <legend>La cuenta es de</legend>
      <label class="radio"><input type="radio" name="entidad" value="PERSON"${values.entidad !== 'BUSINESS' ? ' checked' : ''}> Persona física</label>
      <label class="radio"><input type="radio" name="entidad" value="BUSINESS"${values.entidad === 'BUSINESS' ? ' checked' : ''}> Empresa</label>
    </fieldset>
    <p class="muted">Banxico valida la cuenta en hasta 5 días hábiles. Cuando quede activa, los cobros por celular y QR de todo el equipo llegarán directo y sin el límite del modo prueba.</p>
    <button class="button" type="submit">Registrar CLABE</button>
  </form>`
      : ''
  }
</section>`,
  });
}

// ------------------------------------------------------------------- equipo

function teamStatus(member) {
  if (!member.active) return '<span class="chip chip-muted">Desactivado</span>';
  if (!member.passwordHash) return '<span class="chip chip-warn">Invitación pendiente</span>';
  return '<span class="chip chip-ok">Activo</span>';
}

export function teamPage({ user, merchant, csrf, team, invite = null, flash = null, error = null, values = {} }) {
  const post = (action, id, label, cls = 'link-button') =>
    `<form method="post" action="/panel/equipo/${id}/${action}" class="inline">${csrfField(csrf)}<button class="${cls}" type="submit">${label}</button></form>`;
  const rows = team
    .map((m) => {
      const self = m.id === user.id;
      const actions = self
        ? '<span class="muted">tú</span>'
        : !m.active
          ? post('reactivar', m.id, 'Reactivar')
          : [
              m.role === 'admin' ? post('rol', m.id, 'Hacer vendedor') : post('rol', m.id, 'Hacer administrador'),
              !m.passwordHash ? post('invitacion', m.id, 'Nueva liga') : '',
              post('desactivar', m.id, 'Desactivar'),
            ]
              .filter(Boolean)
              .join('<span class="sep">·</span>');
      return `<tr>
      <td>${h(m.name)}</td>
      <td>${h(m.email ?? '—')}</td>
      <td>${h(ROLE[m.role])}</td>
      <td>${m.whatsappPhone ? h(phone(m.whatsappPhone)) : '<span class="muted">sin ligar</span>'}</td>
      <td>${teamStatus(m)}</td>
      <td class="actions-cell">${actions}</td>
    </tr>`;
    })
    .join('');
  const role = values.rol === 'admin' ? 'admin' : 'seller';

  return layout({
    title: 'Equipo',
    user,
    csrf,
    active: 'equipo',
    scripts: ['/assets/panel.js'],
    body: `
<h1>Equipo de ${h(merchant.businessName)}</h1>
<p class="muted subtitle">Cada persona cobra con su cuenta y su WhatsApp. Los vendedores ven solo sus cobros; los administradores ven los de todos, administran el equipo y la cuenta del negocio, y también cobran.</p>
${flash ? `<p class="alert alert-ok" role="status">${h(flash)}</p>` : ''}
${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}
${
  invite
    ? `<div class="alert alert-info">
    <p>Comparte esta liga con <strong>${h(invite.name)}</strong> por WhatsApp o correo. Con ella elige su contraseña. Vence en 7 días y sirve una sola vez.</p>
    <div class="copy">
      <input readonly value="${h(invite.url)}" id="invite-url" aria-label="Liga de invitación">
      <button class="button" type="button" data-copy="#invite-url">Copiar</button>
    </div>
  </div>`
    : ''
}

<section class="card">
  <h2>Personas</h2>
  <div class="table-wrap"><table class="table" id="team">
    <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>WhatsApp</th><th>Estado</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>

<section class="card">
  <h2>Invitar a alguien</h2>
  <form method="post" action="/panel/equipo" class="form">
    ${csrfField(csrf)}
    <div class="row row-2">
      <label>Nombre
        <input name="nombre" required maxlength="60" value="${h(values.nombre)}" placeholder="Ana">
      </label>
      <label>Correo
        <input name="correo" type="email" required value="${h(values.correo)}" placeholder="ana@ejemplo.com">
      </label>
    </div>
    <fieldset class="radios">
      <legend>Rol</legend>
      <label class="radio"><input type="radio" name="rol" value="seller"${role === 'seller' ? ' checked' : ''}> Vendedor: cobra y ve sus cobros</label>
      <label class="radio"><input type="radio" name="rol" value="admin"${role === 'admin' ? ' checked' : ''}> Administrador: además ve todo y administra</label>
    </fieldset>
    <button class="button" type="submit">Crear invitación</button>
  </form>
</section>`,
  });
}

// --------------------------------------------------------------- invitación

export function invitePage({ invitee = null, merchantName = null, error = null, values = {}, token = '', csrf = null }) {
  if (!invitee) {
    return layout({
      title: 'Invitación',
      body: `<section class="card narrow"><h1>Esta invitación ya no sirve</h1><p>Venció o ya se usó. Pídele al administrador de tu negocio una nueva.</p><p><a href="/entrar">Entrar</a></p></section>`,
    });
  }
  return layout({
    title: 'Únete al equipo',
    body: `
<section class="card narrow">
  <h1>Únete a ${h(merchantName)}</h1>
  <p>Te invitaron como <strong>${h(ROLE[invitee.role].toLowerCase())}</strong>. Entrarás con <strong>${h(invitee.email)}</strong>.</p>
  ${error ? `<p class="alert alert-bad" role="alert">${h(error)}</p>` : ''}
  <form method="post" action="/invitacion/${h(token)}" class="form">
    ${csrf ? csrfField(csrf) : ''}
    <label>Tu nombre
      <input name="nombre" required maxlength="60" autocomplete="name" value="${h(values.nombre ?? invitee.name)}">
    </label>
    <label>Elige una contraseña
      <input name="contrasena" type="password" required minlength="10" autocomplete="new-password">
      <small>Al menos 10 caracteres.</small>
    </label>
    <button class="button" type="submit">Entrar al equipo</button>
  </form>
</section>`,
  });
}

export function messagePage({ title, text, user = null, csrf = null }) {
  return layout({ title, user, csrf, body: `<section class="card narrow"><h1>${h(title)}</h1><p>${h(text)}</p></section>` });
}
