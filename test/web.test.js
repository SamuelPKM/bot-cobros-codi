// Web de punta a punta por HTTP: cuentas, panel, seguridad y ajustes.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createCharges } from '../src/charges.js';
import { mountWeb } from '../src/web/routes.js';
import { fakePey, fakeWhatsApp, freshStore, silentLog } from './helpers.js';

const LIMITS = { maxAmountCents: 100, maxChargesPerHour: 10, maxPushesPerPayerPerHour: 3 };

/** Un navegador mínimo: guarda la cookie de sesión y sabe leer el token CSRF de la página. */
function browser(base) {
  let cookie = '';
  const request = async (path, { method = 'GET', form = null, headers = {} } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers,
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const value = setCookie.split(';')[0];
      cookie = value.endsWith('=') ? '' : value;
    }
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), headers: res.headers, text, setCookie };
  };
  return {
    request,
    get: (path) => request(path),
    post: (path, form, headers) => request(path, { method: 'POST', form, headers }),
    /** El token CSRF que trae una página del panel. */
    async csrf(path = '/panel') {
      const page = await request(path);
      return /name="_csrf" value="([^"]+)"/.exec(page.text)?.[1];
    },
    get cookie() {
      return cookie;
    },
  };
}

describe('web', () => {
  let server;
  let base;
  const state = {};

  before(async () => {
    const proxy = (key) => new Proxy({}, { get: (_t, prop) => (...args) => state[key][prop](...args) });
    const app = createApp({
      pey: proxy('pey'),
      store: proxy('store'),
      log: silentLog,
      web: (target) =>
        mountWeb(target, {
          store: proxy('store'),
          charges: proxy('charges'),
          limits: LIMITS,
          publicBaseUrl: 'https://cobrale.example.com',
          registrationOpen: true,
          trustedEmails: ['equipo@cobrale.mx'],
          whatsappNumber: '55 0000 1111',
          demoEnabled: true,
          log: silentLog,
        }),
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    state.store = await freshStore();
    state.pey = fakePey();
    state.charges = createCharges({
      store: state.store,
      pey: state.pey,
      outbox: fakeWhatsApp(),
      limits: LIMITS,
      publicBaseUrl: 'https://cobrale.example.com',
      renderQr: async () => Buffer.from('png'),
      log: silentLog,
    });
  });

  async function signup(email = 'leo@example.com', negocio = 'Barbería Leo') {
    const b = browser(base);
    const res = await b.post('/registro', { negocio, nombre: 'Leo', correo: email, contrasena: 'una-clave-larga' });
    assert.equal(res.status, 303, res.text);
    return b;
  }

  /** El administrador invita a alguien; esa persona abre la liga y elige su contraseña. */
  async function invite(admin, { nombre = 'Ana', correo = 'ana@example.com', rol = 'seller' } = {}) {
    const page = await admin.post('/panel/equipo', { nombre, correo, rol, _csrf: await admin.csrf('/panel/equipo') });
    assert.equal(page.status, 200, page.text);
    const url = /value="(https:\/\/cobrale\.example\.com\/invitacion\/[^"]+)"/.exec(page.text)?.[1];
    assert.ok(url, 'la página muestra la liga de invitación');
    const path = new URL(url).pathname;
    const b = browser(base);
    const res = await b.post(path, { nombre, contrasena: 'clave-de-ana-123' });
    assert.equal(res.location, '/panel?ok=unido', res.text);
    return { b, user: await state.store.getUserByEmail(correo), path };
  }

  describe('páginas públicas', () => {
    it('la página de inicio y los archivos cargan con cabeceras de seguridad', async () => {
      const b = browser(base);
      const home = await b.get('/');
      assert.equal(home.status, 200);
      assert.match(home.text, /Cobra con CoDi escribiendo un mensaje/);
      assert.match(home.text, /No es un producto oficial de pey ni de Banco de México/);
      assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
      assert.equal(home.headers.get('x-frame-options'), 'DENY');

      assert.equal((await b.get('/assets/app.css')).status, 200);
      assert.equal((await b.get('/assets/panel.js')).status, 200);
    });
  });

  describe('cuentas', () => {
    it('el registro crea la cuenta, abre sesión con una cookie segura y lleva al panel', async () => {
      const b = browser(base);
      const res = await b.post('/registro', { negocio: 'Barbería Leo', nombre: 'Leo', correo: 'Leo@Example.com', contrasena: 'una-clave-larga' });

      assert.equal(res.status, 303);
      assert.equal(res.location, '/panel?ok=bienvenida');
      assert.match(res.setCookie, /HttpOnly/);
      assert.match(res.setCookie, /SameSite=Lax/);

      const user = await state.store.getUserByEmail('leo@example.com');
      assert.equal(user.role, 'admin');
      assert.equal(user.name, 'Leo');
      assert.equal((await state.store.getMerchant(user.merchantId)).businessName, 'Barbería Leo');
      assert.match(user.passwordHash, /^scrypt\$/);
      assert.doesNotMatch(user.passwordHash, /una-clave-larga/);

      const panel = await b.get('/panel?ok=bienvenida');
      assert.equal(panel.status, 200);
      assert.match(panel.text, /Tu cuenta está lista/);
      assert.match(panel.text, /Modo prueba/);
    });

    it('valida el registro y no repite correos', async () => {
      const b = browser(base);
      assert.match((await b.post('/registro', { negocio: 'X', nombre: 'X', correo: 'no-es-correo', contrasena: 'una-clave-larga' })).text, /correo válido/);
      assert.match((await b.post('/registro', { negocio: 'X', nombre: 'X', correo: 'a@b.mx', contrasena: 'corta' })).text, /al menos 10 caracteres/);
      assert.match((await b.post('/registro', { negocio: '', nombre: 'X', correo: 'a@b.mx', contrasena: 'una-clave-larga' })).text, /nombre de tu negocio/);
      assert.match((await b.post('/registro', { negocio: 'X', nombre: '', correo: 'a@b.mx', contrasena: 'una-clave-larga' })).text, /Escribe tu nombre/);
      await signup('a@b.mx');
      assert.match((await browser(base).post('/registro', { negocio: 'X', nombre: 'X', correo: 'A@B.MX', contrasena: 'una-clave-larga' })).text, /Ya existe una cuenta/);
    });

    it('un correo de confianza queda sin el límite del modo prueba', async () => {
      await signup('equipo@cobrale.mx', 'Equipo');
      const user = await state.store.getUserByEmail('equipo@cobrale.mx');
      assert.equal((await state.store.getMerchant(user.merchantId)).isTrusted, true);
    });

    it('iniciar sesión: contraseña mala, buena, y límite de intentos', async () => {
      await signup('leo@example.com');
      const b = browser(base);
      const bad = await b.post('/entrar', { correo: 'leo@example.com', contrasena: 'otra-clave-larga' });
      assert.equal(bad.status, 401);
      assert.match(bad.text, /no coinciden/);

      const good = await b.post('/entrar', { correo: 'LEO@example.com', contrasena: 'una-clave-larga' });
      assert.equal(good.status, 303);
      assert.equal(good.location, '/panel');

      const attacker = browser(base);
      let last;
      for (let i = 0; i < 10; i += 1) last = await attacker.post('/entrar', { correo: 'leo@example.com', contrasena: `mala-${i}` });
      assert.equal(last.status, 429);
    });

    it('después de entrar solo vuelve a rutas del panel, nunca a otro sitio', async () => {
      await signup('leo@example.com');
      const b = browser(base);
      const res = await b.post('/entrar', { correo: 'leo@example.com', contrasena: 'una-clave-larga', siguiente: 'https://otro.example.com/' });
      assert.equal(res.location, '/panel');
      const ok = await browser(base).post('/entrar', { correo: 'leo@example.com', contrasena: 'una-clave-larga', siguiente: '/panel/ajustes' });
      assert.equal(ok.location, '/panel/ajustes');
    });

    it('sin sesión el panel manda a iniciar sesión y la API responde 401', async () => {
      const b = browser(base);
      const page = await b.get('/panel/ajustes');
      assert.equal(page.status, 302);
      assert.equal(page.location, '/entrar?siguiente=%2Fpanel%2Fajustes');
      assert.equal((await b.get('/panel/api/cobros')).status, 401);
    });

    it('salir cierra la sesión en la base, no solo en el navegador', async () => {
      const b = await signup();
      const oldCookie = b.cookie;
      const csrf = await b.csrf();
      assert.equal((await b.post('/salir', { _csrf: csrf })).location, '/');
      assert.equal((await b.get('/panel')).status, 302);
      // Reusar la cookie vieja ya no sirve.
      const replay = await fetch(`${base}/panel`, { headers: { cookie: oldCookie }, redirect: 'manual' });
      assert.equal(replay.status, 302);
    });
  });

  describe('seguridad de formularios', () => {
    it('rechaza un POST del panel sin token CSRF o con uno equivocado', async () => {
      const b = await signup();
      assert.equal((await b.post('/panel/cobros', { tipo: 'qr', monto: '0.5' })).status, 403);
      assert.equal((await b.post('/panel/cobros', { tipo: 'qr', monto: '0.5', _csrf: 'otro' })).status, 403);
      assert.equal(state.pey.qrs.length, 0);
    });

    it('rechaza un POST que viene de otro sitio', async () => {
      const b = await signup();
      const csrf = await b.csrf();
      const res = await b.post('/panel/cobros', { tipo: 'qr', monto: '0.5', _csrf: csrf }, { origin: 'https://otro.example.com' });
      assert.equal(res.status, 403);
      assert.equal(state.pey.qrs.length, 0);
    });
  });

  describe('panel de cobros', () => {
    it('QR: lo crea y muestra la imagen en el detalle', async () => {
      const b = await signup();
      const res = await b.post('/panel/cobros', { tipo: 'qr', monto: '0.50', concepto: 'corte', _csrf: await b.csrf() });
      assert.equal(res.status, 303);
      assert.equal(res.location, '/panel/cobros/1');
      assert.equal(state.pey.qrs[0].concept, 'Barbería Leo: corte');

      const detail = await b.get('/panel/cobros/1');
      assert.match(detail.text, /<img class="qr" src="data:image\/png;base64,/);
      assert.match(detail.text, /QR vigente/);
    });

    it('liga: la crea y la muestra para copiarla', async () => {
      const b = await signup();
      await b.post('/panel/cobros', { tipo: 'link', monto: '0.75', _csrf: await b.csrf() });
      assert.match((await b.get('/panel/cobros/1')).text, /value="https:\/\/app\.mipey\.mx\/payment-link\/LINK1"/);
    });

    it('push: pide confirmación y solo cobra al confirmar', async () => {
      const b = await signup();
      const csrf = await b.csrf();
      const draft = await b.post('/panel/cobros', { tipo: 'push', monto: '0.01', telefono: '55 1234 5678', concepto: 'prueba', _csrf: csrf });
      assert.equal(draft.location, '/panel/cobros/1');
      assert.match((await b.get('/panel/cobros/1')).text, /Enviar cobro/);
      assert.equal(state.pey.pushes.length, 0);

      const sent = await b.post('/panel/cobros/1/confirmar', { _csrf: csrf });
      assert.equal(sent.location, '/panel/cobros/1?ok=enviado');
      assert.equal(state.pey.pushes.length, 1);

      // Un segundo envío del formulario no manda otro cobro.
      await b.post('/panel/cobros/1/confirmar', { _csrf: csrf });
      assert.equal(state.pey.pushes.length, 1);
    });

    it('cancelar un push por confirmar', async () => {
      const b = await signup();
      const csrf = await b.csrf();
      await b.post('/panel/cobros', { tipo: 'push', monto: '0.01', telefono: '5512345678', _csrf: csrf });
      assert.equal((await b.post('/panel/cobros/1/cancelar', { _csrf: csrf })).location, '/panel/cobros/1?ok=cancelado');
      assert.equal((await state.store.getCharge(1)).status, 'cancelled');
    });

    it('explica errores del formulario sin perder lo escrito', async () => {
      const b = await signup();
      const csrf = await b.csrf();
      const badAmount = await b.post('/panel/cobros', { tipo: 'qr', monto: 'mucho', concepto: 'corte', _csrf: csrf });
      assert.equal(badAmount.status, 422);
      assert.match(badAmount.text, /No entendí el monto/);
      assert.match(badAmount.text, /value="corte"/);

      const badPhone = await b.post('/panel/cobros', { tipo: 'push', monto: '0.5', telefono: '123', _csrf: csrf });
      assert.match(badPhone.text, /10 dígitos/);

      const overLimit = await b.post('/panel/cobros', { tipo: 'qr', monto: '50', _csrf: csrf });
      assert.match(overLimit.text, /modo prueba el monto máximo es de \$1\.00/);
    });

    it('un negocio no puede ver ni tocar los cobros de otro', async () => {
      const leo = await signup('leo@example.com');
      await leo.post('/panel/cobros', { tipo: 'push', monto: '0.01', telefono: '5512345678', _csrf: await leo.csrf() });

      const ana = await signup('ana@example.com', 'Tacos Ana');
      assert.equal((await ana.get('/panel/cobros/1')).status, 404);
      assert.equal((await ana.get('/panel/api/cobros/1')).status, 404);
      assert.equal((await ana.post('/panel/cobros/1/confirmar', { _csrf: await ana.csrf() })).status, 404);
      assert.equal(state.pey.pushes.length, 0);
      assert.doesNotMatch((await ana.get('/panel')).text, /data-id="1"/);
    });

    it('la API del panel da estados y totales para actualizarse en vivo', async () => {
      const b = await signup();
      await b.post('/panel/cobros', { tipo: 'qr', monto: '0.50', _csrf: await b.csrf() });
      await state.store.markPaid(1, { paidVia: 'qr' });

      const data = JSON.parse((await b.get('/panel/api/cobros')).text);
      assert.equal(data.charges[0].status, 'paid');
      assert.match(data.charges[0].chip, /Pagado/);
      assert.deepEqual(data.summary, { totalPaid: '$0.50', pending: 0, expired: 0 });
    });

    it('el CSV trae todos los cobros y neutraliza fórmulas en el concepto', async () => {
      const b = await signup();
      await b.post('/panel/cobros', { tipo: 'qr', monto: '0.50', concepto: '=HYPERLINK("x")', _csrf: await b.csrf() });
      const csv = await b.get('/panel/cobros.csv');
      assert.match(csv.headers.get('content-type'), /text\/csv/);
      // El administrador solo, sin equipo: igual trae quién vendió.
      assert.match(csv.text, /folio,creado,forma,monto,concepto,cliente,vendio,estado,pagado,clave_rastreo/);
      assert.match(csv.text, /"'=HYPERLINK\(""x""\)"/);
    });
  });

  describe('ajustes', () => {
    it('cambia el nombre del negocio', async () => {
      const b = await signup();
      const res = await b.post('/panel/ajustes/negocio', { negocio: 'Barbería Leo e Hijos', _csrf: await b.csrf('/panel/ajustes') });
      assert.equal(res.location, '/panel/ajustes?ok=negocio');
      const user = await state.store.getUserByEmail('leo@example.com');
      assert.equal((await state.store.getMerchant(user.merchantId)).businessName, 'Barbería Leo e Hijos');
    });

    it('genera un código para ligar WhatsApp, con el número del bot', async () => {
      const b = await signup();
      const page = await b.post('/panel/ajustes/whatsapp/codigo', { _csrf: await b.csrf('/panel/ajustes') });
      const code = /vincular (\d{6})/.exec(page.text)?.[1];
      assert.ok(code);
      assert.match(page.text, /55 0000 1111/);

      const linked = await state.store.linkWhatsapp(code, '5511112222');
      assert.equal(linked.email, 'leo@example.com');
      assert.match((await b.get('/panel/ajustes')).text, /Ligado al <strong>55 1111 2222<\/strong>/);

      await b.post('/panel/ajustes/whatsapp/quitar', { _csrf: await b.csrf('/panel/ajustes') });
      assert.equal((await state.store.getUserByEmail('leo@example.com')).whatsappPhone, null);
    });

    it('cambia tu nombre', async () => {
      const b = await signup();
      await b.post('/panel/ajustes/perfil', { nombre: 'Leonardo', _csrf: await b.csrf('/panel/ajustes') });
      assert.equal((await state.store.getUserByEmail('leo@example.com')).name, 'Leonardo');
    });

    it('registra la CLABE y muestra que está en validación', async () => {
      const b = await signup();
      const csrf = await b.csrf('/panel/ajustes');
      const bad = await b.post('/panel/ajustes/clabe', { titular: 'Leo', clabe: '012180015826225714', entidad: 'PERSON', _csrf: csrf });
      assert.equal(bad.status, 422);
      assert.match(bad.text, /CLABE no es válida/);

      const ok = await b.post('/panel/ajustes/clabe', { titular: 'Leonardo Pérez', clabe: '012180015826225713', entidad: 'PERSON', _csrf: csrf });
      assert.equal(ok.location, '/panel/ajustes?ok=clabe#clabe');
      const page = await b.get('/panel/ajustes');
      assert.match(page.text, /terminación <strong>5713<\/strong>/);
      assert.match(page.text, /En validación con Banxico/);
    });
  });

  describe('equipo', () => {
    it('el administrador invita a un vendedor y este entra con su propia contraseña', async () => {
      const leo = await signup();
      const { b: ana, user, path } = await invite(leo);
      assert.equal(user.role, 'seller');
      assert.match(user.passwordHash, /^scrypt\$/);
      assert.equal(user.inviteTokenHash, null);

      // La liga sirve una sola vez.
      assert.equal((await browser(base).get(path)).status, 404);
      // Y ya puede entrar con su correo.
      const login = await browser(base).post('/entrar', { correo: 'ana@example.com', contrasena: 'clave-de-ana-123' });
      assert.equal(login.status, 303);

      const panel = await ana.get('/panel');
      assert.match(panel.text, /Ves tus cobros/);
      assert.doesNotMatch(panel.text, /href="\/panel\/equipo"/);
    });

    it('una liga de invitación inventada no sirve', async () => {
      const res = await browser(base).get('/invitacion/inventada-inventada-inventada');
      assert.equal(res.status, 404);
      assert.match(res.text, /ya no sirve/);
    });

    it('no invita un correo que ya tiene cuenta', async () => {
      const leo = await signup();
      await signup('otro@example.com', 'Otro');
      const page = await leo.post('/panel/equipo', { nombre: 'X', correo: 'OTRO@example.com', rol: 'seller', _csrf: await leo.csrf('/panel/equipo') });
      assert.equal(page.status, 422);
      assert.match(page.text, /ya tiene una cuenta/);
    });

    it('el vendedor ve solo sus cobros; el administrador ve todos y quién vendió', async () => {
      const leo = await signup();
      await leo.post('/panel/cobros', { tipo: 'qr', monto: '0.50', concepto: 'de-leo', _csrf: await leo.csrf() });
      const { b: ana } = await invite(leo);
      await ana.post('/panel/cobros', { tipo: 'qr', monto: '0.75', concepto: 'de-ana', _csrf: await ana.csrf() });
      await state.store.markPaid(1, { paidVia: 'qr' });
      await state.store.markPaid(2, { paidVia: 'qr' });

      const anaPanel = (await ana.get('/panel')).text;
      assert.match(anaPanel, /de-ana/);
      assert.doesNotMatch(anaPanel, /de-leo/);
      assert.match(anaPanel, /id="stat-paid">\$0\.75</);
      assert.equal((await ana.get('/panel/cobros/1')).status, 404);
      assert.equal((await ana.get('/panel/api/cobros/1')).status, 404);
      assert.doesNotMatch((await ana.get('/panel/cobros.csv')).text, /de-leo|vendio/);

      const leoPanel = (await leo.get('/panel')).text;
      assert.match(leoPanel, /de-ana/);
      assert.match(leoPanel, /de-leo/);
      assert.match(leoPanel, /id="stat-paid">\$1\.25</);
      assert.match(leoPanel, /Hoy por persona/);
      assert.match(leoPanel, /<th>Vendió<\/th>/);
      assert.match((await leo.get('/panel/cobros/2')).text, /<dt>Vendió<\/dt><dd>Ana<\/dd>/);
      assert.match((await leo.get('/panel/cobros.csv')).text, /de-ana,,Ana,Pagado/);

      // Filtrar por persona.
      const anaId = (await state.store.getUserByEmail('ana@example.com')).id;
      const filtered = (await leo.get(`/panel?persona=${anaId}`)).text;
      assert.match(filtered, /de-ana/);
      assert.doesNotMatch(filtered, /de-leo/);
    });

    it('el vendedor no puede administrar el equipo, el negocio ni la CLABE', async () => {
      const leo = await signup();
      const { b: ana } = await invite(leo);
      const csrf = await ana.csrf('/panel/ajustes');
      assert.equal((await ana.get('/panel/equipo')).status, 403);
      assert.equal((await ana.post('/panel/equipo', { nombre: 'X', correo: 'x@example.com', _csrf: csrf })).status, 403);
      assert.equal((await ana.post('/panel/ajustes/negocio', { negocio: 'Mío', _csrf: csrf })).status, 403);
      assert.equal(
        (await ana.post('/panel/ajustes/clabe', { titular: 'Ana', clabe: '012180015826225713', entidad: 'PERSON', _csrf: csrf })).status,
        403,
      );
      assert.equal(state.pey.bankAccounts.size, 0);
      assert.doesNotMatch((await ana.get('/panel/ajustes')).text, /Registrar CLABE/);
      // Pero sí liga su propio WhatsApp.
      assert.match((await ana.post('/panel/ajustes/whatsapp/codigo', { _csrf: csrf })).text, /vincular \d{6}/);
    });

    it('cambiar de rol y desactivar, sin quedarse nunca sin administrador', async () => {
      const leo = await signup();
      const { b: ana, user } = await invite(leo);
      const leoUser = await state.store.getUserByEmail('leo@example.com');
      let csrf = await leo.csrf('/panel/equipo');

      // Nadie se cambia a sí mismo.
      assert.match((await leo.post(`/panel/equipo/${leoUser.id}/rol`, { _csrf: csrf })).text, /No puedes cambiar tu propio rol/);

      // Ana pasa a administradora y ve el equipo.
      assert.equal((await leo.post(`/panel/equipo/${user.id}/rol`, { _csrf: csrf })).location, '/panel/equipo?ok=rol');
      assert.equal((await ana.get('/panel/equipo')).status, 200);

      // Ana le quita el rol a Leo; Leo ya no puede volver a quitárselo a ella.
      const anaCsrf = await ana.csrf('/panel/equipo');
      await ana.post(`/panel/equipo/${leoUser.id}/rol`, { _csrf: anaCsrf });
      assert.equal((await state.store.getUser(leoUser.id)).role, 'seller');
      assert.equal((await leo.post(`/panel/equipo/${user.id}/desactivar`, { _csrf: csrf })).status, 403);

      // Ana desactiva a Leo: su sesión deja de servir y no puede entrar.
      await ana.post(`/panel/equipo/${leoUser.id}/desactivar`, { _csrf: anaCsrf });
      assert.equal((await leo.get('/panel')).status, 302);
      assert.equal((await browser(base).post('/entrar', { correo: 'leo@example.com', contrasena: 'una-clave-larga' })).status, 401);

      // Y la reactiva.
      csrf = anaCsrf;
      await ana.post(`/panel/equipo/${leoUser.id}/reactivar`, { _csrf: csrf });
      assert.equal((await browser(base).post('/entrar', { correo: 'leo@example.com', contrasena: 'una-clave-larga' })).status, 303);
    });

    it('un administrador no toca personas de otro negocio', async () => {
      const leo = await signup();
      await signup('otro@example.com', 'Otro');
      const otro = await state.store.getUserByEmail('otro@example.com');
      const res = await leo.post(`/panel/equipo/${otro.id}/desactivar`, { _csrf: await leo.csrf('/panel/equipo') });
      assert.equal(res.status, 404);
      assert.equal((await state.store.getUser(otro.id)).active, true);
    });
  });
});
