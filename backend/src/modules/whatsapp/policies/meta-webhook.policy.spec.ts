import { createHmac } from 'node:crypto';
import { extractMessages, verifyMetaSignature } from './meta-webhook.policy';

const SECRET = 'secreto-de-la-app';
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifyMetaSignature', () => {
  const body = Buffer.from('{"entry":[]}');

  it('acepta la firma HMAC-SHA256 del cuerpo crudo', () => {
    expect(verifyMetaSignature(body, sign(body.toString()), SECRET)).toBe(true);
  });

  it('rechaza otro secreto, un cuerpo alterado o la falta de firma', () => {
    expect(
      verifyMetaSignature(body, sign(body.toString(), 'otro'), SECRET),
    ).toBe(false);
    expect(
      verifyMetaSignature(
        Buffer.from('{"entry":[1]}'),
        sign(body.toString()),
        SECRET,
      ),
    ).toBe(false);
    expect(verifyMetaSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyMetaSignature(undefined, sign(body.toString()), SECRET)).toBe(
      false,
    );
    expect(verifyMetaSignature(body, 'sha256=zz', SECRET)).toBe(false);
  });
});

describe('extractMessages', () => {
  it('saca los mensajes de texto y marca como null los que no son texto; ignora los estados', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'm1',
                    from: '5215512345678',
                    type: 'text',
                    text: { body: 'hola' },
                  },
                  {
                    id: 'm2',
                    from: '5215512345678',
                    type: 'image',
                    image: { id: 'x' },
                  },
                ],
                statuses: [{ id: 's1', status: 'read' }],
              },
            },
          ],
        },
      ],
    };
    expect(extractMessages(payload)).toEqual([
      { id: 'm1', from: '5215512345678', text: 'hola' },
      { id: 'm2', from: '5215512345678', text: null },
    ]);
  });

  it('tolera cuerpos raros sin lanzar', () => {
    expect(extractMessages(null)).toEqual([]);
    expect(
      extractMessages({
        entry: [{ changes: [{ value: { messages: [{ type: 'text' }] } }] }],
      }),
    ).toEqual([]);
  });
});
