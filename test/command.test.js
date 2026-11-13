import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizePhone, parseCommand } from '../src/command.js';

describe('normalizePhone', () => {
  it('deja en 10 dígitos los formatos comunes', () => {
    assert.equal(normalizePhone('5512345678'), '5512345678');
    assert.equal(normalizePhone('55 1234 5678'), '5512345678');
    assert.equal(normalizePhone('(55) 1234-5678'), '5512345678');
    assert.equal(normalizePhone('+52 55 1234 5678'), '5512345678');
    assert.equal(normalizePhone('525512345678'), '5512345678');
    assert.equal(normalizePhone('+52 1 55 1234 5678'), '5512345678');
    assert.equal(normalizePhone('5215512345678'), '5512345678'); // formato de WhatsApp
  });

  it('no confunde un número de 10 dígitos que empieza con 52', () => {
    assert.equal(normalizePhone('5212345678'), '5212345678');
  });

  it('devuelve null si no es un teléfono mexicano válido', () => {
    assert.equal(normalizePhone('12345'), null);
    assert.equal(normalizePhone('55123456789'), null);
    assert.equal(normalizePhone('+1 415 555 2671 00'), null);
    assert.equal(normalizePhone(''), null);
    assert.equal(normalizePhone(undefined), null);
  });
});

describe('parseCommand', () => {
  it('entiende el comando básico', () => {
    assert.deepEqual(parseCommand('cobra 150 a 5512345678 corte de pelo'), {
      ok: true,
      amount: 150,
      phoneNumber: '5512345678',
      concept: 'corte de pelo',
    });
  });

  it('acepta mayúsculas, $, comas, decimales, "pesos" y "al"', () => {
    assert.deepEqual(parseCommand('  Cobra $1,500.50 al +52 55 1234 5678 anticipo  '), {
      ok: true,
      amount: 1500.5,
      phoneNumber: '5512345678',
      concept: 'anticipo',
    });
    assert.equal(parseCommand('cobrar 80 pesos a 5215512345678').amount, 80);
    assert.equal(parseCommand('Cóbrale 0.01 a 5512345678 prueba').amount, 0.01);
  });

  it('el concepto es opcional', () => {
    assert.deepEqual(parseCommand('cobra 150 a 5512345678'), {
      ok: true,
      amount: 150,
      phoneNumber: '5512345678',
      concept: null,
    });
  });

  it('separa bien un concepto que empieza con número', () => {
    const result = parseCommand('cobra 300 a 55 1234 5678 2 cortes y barba');
    assert.equal(result.phoneNumber, '5512345678');
    assert.equal(result.concept, '2 cortes y barba');
  });

  it('explica qué falta cuando el mensaje no es un cobro', () => {
    for (const text of ['hola', 'cobra a 5512345678', 'cobra 150', '', undefined]) {
      const result = parseCommand(text);
      assert.equal(result.ok, false, String(text));
      assert.match(result.error, /cobra <monto> a <teléfono/);
    }
  });

  it('rechaza montos inválidos', () => {
    assert.match(parseCommand('cobra 0 a 5512345678').error, /mayor a 0/);
    assert.match(parseCommand('cobra 1000001 a 5512345678').error, /máximo/);
    assert.match(parseCommand('cobra 10.999 a 5512345678').error, /monto/);
    assert.match(parseCommand('cobra 1,50 a 5512345678').error, /monto/);
  });

  it('rechaza teléfonos que no quedan en 10 dígitos', () => {
    assert.match(parseCommand('cobra 150 a 12345 corte').error, /10 dígitos/);
    assert.match(parseCommand('cobra 150 a Juan corte').error, /10 dígitos/);
  });
});
