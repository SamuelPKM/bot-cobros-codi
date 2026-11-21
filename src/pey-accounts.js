// Cuentas de pey propias. Por defecto todos los negocios cobran con la API key
// del proyecto (y, con su CLABE registrada, el dinero les llega con
// bankAccountId). Un negocio puede conectar además su propia cuenta de pey:
// desde ese momento sus cobros, incluidas las ligas de pago, se crean con su
// API key, el dinero llega a la cuenta de pago ligada a esa llave y pey le
// avisa los pagos a un webhook que es solo suyo.
//
// pey no tiene API para crear cuentas ni API keys: el negocio las crea en el
// portal y aquí pega la llave y el secreto del webhook. Los dos se guardan
// cifrados (secrets.js) y nunca se vuelven a mostrar.
//
// Conectar es en dos pasos, porque el secreto del webhook solo existe después
// de registrar en pey la URL que Cóbrale le da al negocio:
//   1. API key  -> se valida con una consulta de solo lectura y se guarda.
//   2. Secreto  -> se guarda y la cuenta queda conectada.
// Hasta el paso 2 los cobros siguen saliendo por la cuenta del proyecto.

import { randomBytes } from 'node:crypto';
import { PeyError } from './pey.js';

const API_KEY = /^\S{16,200}$/;
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9+/=]{16,}$/;

/** Estado de la cuenta propia de un negocio, para mostrarlo. */
export function peyAccountStatus(merchant) {
  if (!merchant?.peyKeySealed) return 'none';
  if (!merchant.peyWebhookSecretSealed) return 'needs_webhook';
  return 'connected';
}

/**
 * @param platform el cliente de pey con la API key del proyecto.
 * @param makeClient (apiKey) => cliente de pey con esa llave.
 * @param secrets caja de secretos (createSecretBox), o null si falta SECRETS_KEY:
 *   entonces no se pueden conectar cuentas propias.
 */
export function createPeyAccounts({ store, platform, makeClient, secrets = null, publicBaseUrl = null, now = Date.now, log = console }) {
  const cache = new Map(); // merchantId -> { sealed, client }

  const enabled = Boolean(secrets);

  /** El cliente de pey con el que se crea y consulta un cobro: el del negocio o el del proyecto. */
  async function clientFor(peyMerchantId) {
    if (!peyMerchantId) return platform;
    const merchant = await store.getMerchant(peyMerchantId);
    const sealed = merchant?.peyKeySealed;
    if (!sealed) throw new PeyError('El negocio ya no tiene su cuenta de pey conectada', { type: 'ACCOUNT_DISCONNECTED' });
    const cached = cache.get(peyMerchantId);
    if (cached?.sealed === sealed) return cached.client;
    const apiKey = secrets?.open(sealed);
    if (!apiKey) throw new PeyError('No se pudo leer la API key guardada (¿cambió SECRETS_KEY?)', { type: 'ACCOUNT_UNREADABLE' });
    const client = makeClient(apiKey);
    cache.set(peyMerchantId, { sealed, client });
    return client;
  }

  /** Con qué cuenta cobra hoy un negocio: su id si tiene la cuenta propia completa, o null. */
  const accountFor = (merchant) => (enabled && peyAccountStatus(merchant) === 'connected' ? merchant.id : null);

  const webhookUrl = (merchant) =>
    merchant?.peyWebhookToken && publicBaseUrl ? `${publicBaseUrl}/webhooks/pey/n/${merchant.peyWebhookToken}` : null;

  const fail = (message) => ({ ok: false, message });

  /** Paso 1: valida la API key contra pey y la guarda. Reinicia el webhook. */
  async function saveApiKey(merchant, rawKey) {
    if (!enabled) return fail('Esta instalación de Cóbrale no tiene SECRETS_KEY: no puede guardar API keys.');
    if (!publicBaseUrl) return fail('Esta instalación no tiene URL pública, así que pey no podría avisarte los pagos.');
    const apiKey = String(rawKey ?? '').trim();
    if (!API_KEY.test(apiKey)) return fail('Pega la API key completa, como la copiaste del portal de pey.');
    if ((await store.countOpenWithPeyAccount(merchant.id)) > 0 && merchant.peyKeySealed) {
      return fail('Tienes cobros en espera hechos con tu API key actual. Espera a que se paguen o venzan para cambiarla.');
    }

    try {
      await makeClient(apiKey).listApiKeyTransactions();
    } catch (error) {
      if (error.status === 401 || error.status === 403) return fail('pey no reconoció esa API key. Revisa que esté completa y activa.');
      log.error(`[pey] negocio ${merchant.id}: no se pudo validar la API key: ${error.message}`);
      return fail('No pudimos comprobar la API key con pey. Intenta de nuevo en unos minutos.');
    }

    const updated = await store.updateMerchant(merchant.id, {
      peyKeySealed: secrets.seal(apiKey),
      peyKeyLast4: apiKey.slice(-4),
      // Una URL nueva por llave: así un webhook viejo no puede marcar nada.
      peyWebhookToken: randomBytes(24).toString('base64url'),
      peyWebhookSecretSealed: null,
      peyConnectedAt: null,
      peyLastEventAt: null,
    });
    cache.delete(merchant.id);
    log.info(`[pey] negocio ${merchant.id}: API key guardada (termina en ${updated.peyKeyLast4})`);
    return { ok: true, merchant: updated };
  }

  /** Paso 2: guarda el secreto del webhook. Desde aquí sus cobros usan su cuenta. */
  async function saveWebhookSecret(merchant, rawSecret) {
    if (!enabled) return fail('Esta instalación de Cóbrale no tiene SECRETS_KEY.');
    if (!merchant.peyKeySealed) return fail('Primero guarda tu API key.');
    const secret = String(rawSecret ?? '').trim();
    if (!WEBHOOK_SECRET.test(secret)) return fail('El secreto empieza con whsec_. Cópialo completo del portal de pey.');
    const updated = await store.updateMerchant(merchant.id, {
      peyWebhookSecretSealed: secrets.seal(secret),
      peyConnectedAt: now(),
    });
    log.info(`[pey] negocio ${merchant.id}: cuenta de pey propia conectada`);
    return { ok: true, merchant: updated };
  }

  /** Vuelve a la cuenta del proyecto. No se permite con cobros propios todavía abiertos. */
  async function disconnect(merchant) {
    if ((await store.countOpenWithPeyAccount(merchant.id)) > 0) {
      return fail('Tienes cobros en espera hechos con tu cuenta de pey. Espera a que se paguen o venzan para desconectarla.');
    }
    const updated = await store.updateMerchant(merchant.id, {
      peyKeySealed: null,
      peyKeyLast4: null,
      peyWebhookToken: null,
      peyWebhookSecretSealed: null,
      peyConnectedAt: null,
      peyLastEventAt: null,
    });
    cache.delete(merchant.id);
    log.info(`[pey] negocio ${merchant.id}: cuenta de pey propia desconectada`);
    return { ok: true, merchant: updated };
  }

  /** Para el webhook de un negocio: su id, su secreto y su cliente, o null si la URL no es de nadie. */
  async function webhookFor(token) {
    if (!enabled || typeof token !== 'string' || token.length < 20) return null;
    const merchant = await store.getMerchantByWebhookToken(token);
    if (!merchant?.peyWebhookSecretSealed) return null;
    const secret = secrets.open(merchant.peyWebhookSecretSealed);
    if (!secret) return null;
    return { merchantId: merchant.id, secret, client: await clientFor(merchant.id) };
  }

  async function touch(merchantId) {
    await store.updateMerchant(merchantId, { peyLastEventAt: now() });
  }

  return { enabled, clientFor, accountFor, webhookUrl, saveApiKey, saveWebhookSecret, disconnect, webhookFor, touch };
}
