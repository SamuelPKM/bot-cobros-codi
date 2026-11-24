import { MIN_EXPIRATION_SECONDS } from '../../pey/constants/pey.constants';

/** Vigencia del push CoDi: la mínima que acepta pey (6 minutos). */
export const PUSH_EXPIRATION_SECONDS = MIN_EXPIRATION_SECONDS;

/** Vigencia del QR de respaldo: 15 minutos para que el cliente lo escanee con calma. */
export const QR_EXPIRATION_SECONDS = 15 * 60;

/** Vigencia de la liga de pago: un día para que el cliente la abra cuando pueda. */
export const LINK_EXPIRATION_HOURS = 24;

/** Pantallas del frontend a las que pey regresa al cliente después de la liga. */
export const LINK_SUCCESS_PATH = '/pago/gracias';
export const LINK_BACK_PATH = '/pago/cancelado';

/** Máximo de push al mismo celular por hora, sumando a todos los vendedores (anti-spam). */
export const MAX_PUSHES_PER_PAYER_PER_HOUR = 3;

/** numRef de CoDi: hasta 7 dígitos. */
export const NUM_REF_MODULUS = 10_000_000;

/** Un cobro sin ningún intento vigente vence a los 30 minutos de creado. */
export const CHARGE_TTL_MINUTES = 30;

/** Margen antes de vencer un intento, por si el webhook de pago viene en camino. */
export const EXPIRATION_GRACE_SECONDS = 20;

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
