import { describe, expect, it } from 'vitest';
import { parseMemberUpdate, parseNewSeller } from './member-form.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe('parseNewSeller', () => {
  it('alta con tope opcional', () => {
    expect(
      parseNewSeller(form({ name: ' Leo ', username: 'leo', password: 'segura-123', maxAmount: '500' })),
    ).toEqual({ ok: true, data: { name: 'Leo', username: 'leo', password: 'segura-123', maxAmount: 500 } });
    expect(parseNewSeller(form({ name: 'Leo', username: 'leo', password: 'segura-123', maxAmount: '' }))).toEqual({
      ok: true,
      data: { name: 'Leo', username: 'leo', password: 'segura-123' },
    });
  });

  it('explica los errores', () => {
    expect(parseNewSeller(form({ name: '', username: 'l', password: 'x', maxAmount: '0' }))).toEqual({
      ok: false,
      fieldErrors: {
        name: 'Escribe el nombre de la persona',
        username: 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
        password: 'La contraseña debe tener entre 8 y 200 caracteres',
        maxAmount: 'El tope debe ser mayor a 0',
      },
    });
  });
});

describe('parseMemberUpdate', () => {
  const base = { userId: '5', name: 'Leo', role: 'seller', active: 'on', maxAmount: '', password: '' };

  it('tope vacío lo quita (null) y sin contraseña no la cambia', () => {
    expect(parseMemberUpdate(form(base))).toEqual({
      ok: true,
      data: { userId: 5, body: { name: 'Leo', role: 'seller', active: true, maxAmount: null } },
    });
  });

  it('desactivar, cambiar rol, tope y contraseña', () => {
    const rest = { userId: '5', name: 'Leo', role: 'seller', maxAmount: '', password: '' };
    expect(
      parseMemberUpdate(form({ ...rest, role: 'admin', maxAmount: '250.50', password: 'nueva-clave-1' })),
    ).toEqual({
      ok: true,
      data: {
        userId: 5,
        body: { name: 'Leo', role: 'admin', active: false, maxAmount: 250.5, password: 'nueva-clave-1' },
      },
    });
  });

  it('rechaza datos manipulados o inválidos', () => {
    expect(parseMemberUpdate(form({ ...base, userId: 'x' }))).toMatchObject({ ok: false });
    expect(parseMemberUpdate(form({ ...base, role: 'root' }))).toMatchObject({
      fieldErrors: { role: 'El rol debe ser admin o vendedor' },
    });
    expect(parseMemberUpdate(form({ ...base, password: 'corta' }))).toMatchObject({
      fieldErrors: { password: 'La contraseña debe tener entre 8 y 200 caracteres' },
    });
  });
});
