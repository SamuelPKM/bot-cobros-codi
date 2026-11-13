// Almacén mínimo en un archivo JSON: cobros y eventos de webhook ya vistos.
// Alcanza para el primer cobro real; se cambia por una base de datos en la
// tarea "BD de cobros con ID interno en metadata".

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createFileStore(filePath) {
  function read() {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return { charges: {}, events: {} };
      throw error;
    }
  }

  function write(state) {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, filePath); // escritura atómica: nunca queda un archivo a medias
  }

  return {
    /** Guarda un cobro recién creado (estado "pending"). */
    saveCharge(charge) {
      const state = read();
      state.charges[charge.transactionId] = { status: 'pending', createdAt: Date.now(), ...charge };
      write(state);
    },

    getCharge(transactionId) {
      return read().charges[transactionId] ?? null;
    },

    /**
     * Marca un cobro como pagado. Devuelve true solo la primera vez, para que
     * el aviso de "Pagado" no se mande dos veces.
     */
    markChargePaid(transactionId, details) {
      const state = read();
      const existing = state.charges[transactionId];
      if (existing?.status === 'paid') return false;
      state.charges[transactionId] = { ...existing, transactionId, ...details, status: 'paid' };
      write(state);
      return true;
    },

    /** Registra la entrega de un webhook. Devuelve el evento tal como quedó guardado. */
    recordEvent(webhookId, type) {
      const state = read();
      state.events[webhookId] ??= { type, receivedAt: Date.now(), processedAt: null };
      write(state);
      return state.events[webhookId];
    },

    markEventProcessed(webhookId, result) {
      const state = read();
      state.events[webhookId] = { ...state.events[webhookId], processedAt: Date.now(), result };
      write(state);
    },
  };
}

/** Mismo contrato, en memoria. Para pruebas. */
export function createMemoryStore() {
  const charges = new Map();
  const events = new Map();
  return {
    saveCharge(charge) {
      charges.set(charge.transactionId, { status: 'pending', createdAt: Date.now(), ...charge });
    },
    getCharge(transactionId) {
      return charges.get(transactionId) ?? null;
    },
    markChargePaid(transactionId, details) {
      const existing = charges.get(transactionId);
      if (existing?.status === 'paid') return false;
      charges.set(transactionId, { ...existing, transactionId, ...details, status: 'paid' });
      return true;
    },
    recordEvent(webhookId, type) {
      if (!events.has(webhookId)) events.set(webhookId, { type, receivedAt: Date.now(), processedAt: null });
      return events.get(webhookId);
    },
    markEventProcessed(webhookId, result) {
      events.set(webhookId, { ...events.get(webhookId), processedAt: Date.now(), result });
    },
  };
}
