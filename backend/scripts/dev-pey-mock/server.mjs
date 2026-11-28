// pey SIMULADO: solo para desarrollo local. Imita la parte de la API de pey que
// usa Cóbrale y manda los webhooks firmados (Standard Webhooks). No cobra nada.
// Uso: MOCK_WEBHOOK_SECRET=whsec_... node scripts/dev-pey-mock/server.mjs
import { createServer } from 'node:http';
import { randomUUID, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';

const { Webhook } = createRequire(import.meta.url)('standardwebhooks');

if (process.env.NODE_ENV === 'production') {
  console.error('pey SIMULADO: se niega a arrancar con NODE_ENV=production.');
  process.exit(1);
}
const secret = process.env.MOCK_WEBHOOK_SECRET;
if (!secret) {
  console.error(
    'Falta MOCK_WEBHOOK_SECRET (formato whsec_ + base64, el mismo que guardes en el negocio).',
  );
  process.exit(1);
}
try {
  new Webhook(secret);
} catch {
  console.error('MOCK_WEBHOOK_SECRET no es válido: usa "whsec_" + base64.');
  process.exit(1);
}

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const WEBHOOK_URL =
  process.env.MOCK_WEBHOOK_URL ?? 'http://localhost:3000/webhooks/pey/dev-prueba';
const MIN_EXPIRATION = 360;

/** Cobros por su id principal (transactionId del push, id del QR o id de la liga). */
const items = new Map();
/** Transacciones por id. */
const txs = new Map();

const now = () => Math.floor(Date.now() / 1000);
const digits = (n) => Array.from({ length: n }, () => randomInt(10)).join('');
const money = (n) => `$${Number(n).toFixed(2)}`;

class HttpError extends Error {
  constructor(status, type, message) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

function validAmount(amount) {
  return (
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount > 0 &&
    Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6
  );
}
function assertCommon(body, { expirationRequired }) {
  if (!validAmount(body.amount))
    throw new HttpError(400, 'INVALID_AMOUNT', 'Monto inválido');
  if (
    (expirationRequired || body.expiration !== undefined) &&
    !(Number.isInteger(body.expiration) && body.expiration >= MIN_EXPIRATION)
  )
    throw new HttpError(
      400,
      'INVALID_PARAMETER',
      `La expiración mínima es de ${MIN_EXPIRATION} segundos`,
    );
}

function newTx(item, status) {
  const tx = {
    id: item.kind === 'push' ? item.id : `txn_${randomUUID()}`,
    status,
    amount: item.amount,
    amountBreakdown: { base: item.amount, tip: 0, fee: 0 },
    paymentMethod: 'CODI',
    payableType: item.kind,
    metadata: { externalMetadata: item.metadata },
  };
  txs.set(tx.id, tx);
  item.txId = tx.id;
  return tx;
}

function createItem(kind, body, extra) {
  const item = {
    kind,
    amount: body.amount,
    concept: body.concept ?? '',
    metadata: body.metadata ?? {},
    status: 'PENDING',
    createdAt: now(),
    webhook: null,
    ...extra,
  };
  items.set(item.id, item);
  return item;
}

function publicTx(tx) {
  return tx;
}

function linkView(item) {
  const paid = item.status === 'PAID';
  const tx = paid ? txs.get(item.txId) : null;
  return {
    id: item.id,
    status: paid ? 'paid' : 'pending',
    amount: item.amount,
    clientReferenceId: item.clientReferenceId,
    transactions: tx
      ? [
          {
            transactionId: tx.id,
            paymentMethod: tx.paymentMethod,
            datePaid: tx.datePaid,
            amount: tx.amount,
            amountBreakdown: tx.amountBreakdown,
            metadata: { trackingKey: tx.metadata.trackingKey },
          },
        ]
      : [],
  };
}

/** Marca pagado y manda el webhook firmado. Nunca lanza por el webhook. */
async function pay(id) {
  const item = items.get(id);
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'No existe ese cobro');
  if (item.status === 'PAID')
    throw new HttpError(409, 'ALREADY_PAID', 'Ese cobro ya está pagado');

  const tx = item.kind === 'push' ? txs.get(item.id) : newTx(item, 'PENDING');
  tx.status = 'PAID';
  tx.datePaid = now();
  tx.metadata.trackingKey = `SIM${digits(12)}`;
  item.status = 'PAID';

  const event = {
    type:
      item.kind === 'link'
        ? 'payment_link.status_updated'
        : item.kind === 'push'
          ? 'codi.pn.payment_received'
          : 'codi.qr.payment_received',
    transactionId: tx.id,
    ...(item.kind === 'qr' ? { codiQrId: item.id } : {}),
    ...(item.kind === 'link'
      ? { paymentLinkId: item.id, status: 'paid' }
      : { status: 'PAID' }),
    amount: tx.amount,
    datePaid: tx.datePaid,
    metadata: {
      trackingKey: tx.metadata.trackingKey,
      externalMetadata: item.metadata,
    },
  };
  item.webhook = await sendWebhook(event);
  return item;
}

async function sendWebhook(event) {
  const body = JSON.stringify(event);
  const id = `msg_${randomUUID()}`;
  const at = new Date();
  const signature = new Webhook(secret).sign(id, at, body);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(Math.floor(at.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = (await res.text()).slice(0, 200);
    const result = { ok: res.ok, status: res.status, detail: text };
    console.log(`webhook ${event.type} -> HTTP ${res.status} ${text}`);
    return result;
  } catch (error) {
    console.warn(`webhook ${event.type} FALLÓ: ${error.message}`);
    return { ok: false, status: 0, detail: error.message };
  }
}

// ---------- API imitada ----------

async function api(method, path, body) {
  let m;
  if (method === 'GET' && path === '/transaction/api-key') return {};
  if (method === 'POST' && path === '/codi/pn') {
    assertCommon(body, { expirationRequired: false });
    if (!/^\d{10}$/.test(body.phoneNumber ?? ''))
      throw new HttpError(400, 'INVALID_PARAMETER', 'Teléfono inválido');
    const id = `txn_${randomUUID()}`;
    const item = createItem('push', body, { id, phone: body.phoneNumber });
    newTx(item, 'PENDING');
    return { transactionId: id, codiId: digits(20) };
  }
  if (method === 'POST' && path === '/codi/qr') {
    assertCommon(body, { expirationRequired: true });
    const id = `qr_${randomUUID()}`;
    createItem('qr', body, { id });
    return {
      id,
      qrString: `0002010102122638SIMULADO${digits(16)}5204000053034845406${String(body.amount).replace('.', '')}5802MX6304${digits(4)}`,
    };
  }
  if (method === 'POST' && path === '/payment-link/create') {
    assertCommon(body, { expirationRequired: false });
    const id = `lnk_${randomUUID()}`;
    createItem('link', body, { id, clientReferenceId: body.clientReferenceId });
    return { id, url: `${origin}/pagar/${id}` };
  }
  if (method === 'GET' && (m = /^\/payment-link\/([^/]+)$/.exec(path))) {
    const item = items.get(decodeURIComponent(m[1]));
    if (!item || item.kind !== 'link') throw notFound();
    return linkView(item);
  }
  if (method === 'GET' && (m = /^\/transaction\/codi\/qr\/([^/]+)$/.exec(path))) {
    const item = items.get(decodeURIComponent(m[1]));
    if (!item || item.kind !== 'qr') throw notFound();
    const tx = item.txId ? txs.get(item.txId) : null;
    return { items: tx && tx.status === 'PAID' ? [publicTx(tx)] : [] };
  }
  if (method === 'GET' && (m = /^\/transaction\/([^/]+)$/.exec(path))) {
    const tx = txs.get(decodeURIComponent(m[1]));
    if (!tx) throw notFound();
    return publicTx(tx);
  }
  throw notFound();
}
const notFound = () => new HttpError(404, 'NOT_FOUND', 'No encontrado');

// ---------- HTML ----------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const KIND = { push: 'Push', qr: 'QR', link: 'Liga' };

function page(inner) {
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>pey simulado</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:1rem auto;padding:0 1rem}
.warn{background:#b00020;color:#fff;padding:.6rem 1rem;border-radius:6px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:1rem}td,th{border-bottom:1px solid #ddd;padding:.5rem;text-align:left}
button{padding:.5rem 1rem;font-size:1rem;cursor:pointer}.ok{color:#0a7d2c}.bad{color:#b00020}small{color:#555}</style></head>
<body><div class="warn">pey SIMULADO, solo desarrollo. No se cobra dinero real.</div>${inner}
<script>
async function pagar(id){
  const r=await fetch('/__dev/pay/'+encodeURIComponent(id),{method:'POST'});
  const j=await r.json();
  if(j.webhook&&!j.webhook.ok)alert('Se marcó pagado, pero el aviso a la API falló: '+j.webhook.detail+'\\nLa API puede confirmarlo con el barrido.');
  else if(!r.ok)alert(j.error&&j.error.message);
  location.reload();
}
</script></body></html>`;
}

function indexPage() {
  const list = [...items.values()].sort((a, b) => b.createdAt - a.createdAt);
  const rows = list
    .map((i) => {
      const hook = i.webhook
        ? i.webhook.ok
          ? `<small class="ok">aviso enviado (${i.webhook.status})</small>`
          : `<small class="bad">aviso falló: ${esc(i.webhook.detail)}</small>`
        : '';
      const action =
        i.status === 'PAID'
          ? `<b class="ok">Pagado</b><br>${hook}`
          : `<button onclick="pagar('${esc(i.id)}')">Marcar pagado</button>`;
      return `<tr><td>${KIND[i.kind]}</td><td>${money(i.amount)}</td><td>${esc(i.concept) || '<small>sin concepto</small>'}<br><small>${esc(i.id)}</small></td><td>${action}</td></tr>`;
    })
    .join('');
  return page(
    `<h1>Cobros pendientes y pagados</h1><p><small>Webhook a ${esc(WEBHOOK_URL)}</small></p>
<table><tr><th>Tipo</th><th>Monto</th><th>Concepto</th><th></th></tr>${rows || '<tr><td colspan="4">Aún no hay cobros.</td></tr>'}</table>`,
  );
}

function linkPage(item) {
  const body =
    item.status === 'PAID'
      ? '<p class="ok"><b>Pago recibido. Gracias.</b></p>'
      : `<button onclick="pagar('${esc(item.id)}')">Pagar ${money(item.amount)}</button>`;
  return page(`<h1>Pagar ${money(item.amount)}</h1><p>${esc(item.concept)}</p>${body}`);
}

// ---------- Servidor ----------

let origin = `http://localhost:${PORT}`;

function send(res, status, type, text) {
  res.writeHead(status, { 'content-type': type });
  res.end(text);
}
const sendJson = (res, status, obj) =>
  send(res, status, 'application/json', JSON.stringify(obj));
const sendError = (res, error) =>
  sendJson(res, error.status ?? 500, {
    error: {
      message: error.message,
      type: error.type ?? 'INTERNAL',
      requestId: randomUUID(),
    },
  });

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'INVALID_PARAMETER', 'JSON inválido');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    origin = `http://${req.headers.host ?? `localhost:${PORT}`}`;

    if (req.method === 'GET' && path === '/') {
      return send(res, 200, 'text/html; charset=utf-8', indexPage());
    }
    let m;
    if (req.method === 'GET' && (m = /^\/pagar\/([^/]+)$/.exec(path))) {
      const item = items.get(decodeURIComponent(m[1]));
      if (!item || item.kind !== 'link')
        return send(res, 404, 'text/html; charset=utf-8', page('<p>Liga no encontrada.</p>'));
      return send(res, 200, 'text/html; charset=utf-8', linkPage(item));
    }
    if (req.method === 'POST' && (m = /^\/__dev\/pay\/([^/]+)$/.exec(path))) {
      const item = await pay(decodeURIComponent(m[1]));
      return sendJson(res, 200, {
        id: item.id,
        status: item.status,
        webhook: item.webhook,
      });
    }

    // Todo lo demás es la API de pey: exige Authorization: Bearer <key>.
    const auth = req.headers.authorization ?? '';
    if (!/^Bearer\s+\S+/.test(auth))
      throw new HttpError(401, 'UNAUTHORIZED', 'API key faltante o inválida');
    const body = req.method === 'POST' ? await readJson(req) : undefined;
    sendJson(res, 200, await api(req.method, path, body));
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error);
    sendError(res, error);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  origin = `http://localhost:${server.address().port}`;
  const bar = '='.repeat(60);
  console.log(
    `\n${bar}\n  pey SIMULADO, solo desarrollo. No se cobra dinero real.\n${bar}`,
  );
  console.log(`escuchando en ${origin} (PEY_BASE_URL=${origin})`);
  console.log(`webhooks a ${WEBHOOK_URL}`);
});
