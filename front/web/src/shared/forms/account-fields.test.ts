import { describe, expect, it } from 'vitest';
import { nameError, parsePesos, passwordError, usernameError } from './account-fields';

describe('account-fields', () => {
  it('usuario: 3 a 30 letras, números, punto, guion o guion bajo', () => {
    expect(usernameError('ana.lopez_1')).toBeUndefined();
    expect(usernameError('ab')).toBe(
      'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
    );
    expect(usernameError('ana lopez')).toBeDefined();
  });

  it('contraseña: 8 a 200 caracteres', () => {
    expect(passwordError('12345678')).toBeUndefined();
    expect(passwordError('corta')).toBe('La contraseña debe tener entre 8 y 200 caracteres');
  });

  it('nombre: 1 a 80 caracteres', () => {
    expect(nameError('Ana', 'Escribe el nombre')).toBeUndefined();
    expect(nameError('', 'Escribe el nombre')).toBe('Escribe el nombre');
    expect(nameError('x'.repeat(81), 'Escribe el nombre')).toBe('Escribe el nombre');
  });

  it('pesos: acepta $ y comas, máximo 2 decimales y mayor a 0', () => {
    expect(parsePesos('$1,500.5')).toEqual({ ok: true, value: 1500.5 });
    expect(parsePesos('1.234')).toEqual({ ok: false, error: 'decimals' });
    expect(parsePesos('abc')).toEqual({ ok: false, error: 'decimals' });
    expect(parsePesos('0')).toEqual({ ok: false, error: 'positive' });
  });
});
