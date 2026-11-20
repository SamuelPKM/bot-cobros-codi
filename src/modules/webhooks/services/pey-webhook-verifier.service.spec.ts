import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Webhook } from 'standardwebhooks';
import { PeyWebhookVerifier } from './pey-webhook-verifier.service';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

function signed(
  payload: object,
  { id = 'msg_1', at = new Date(), secret = SECRET } = {},
) {
  const body = JSON.stringify(payload);
  return {
    body: Buffer.from(body),
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(at.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, at, body),
    },
  };
}

describe('PeyWebhookVerifier', () => {
  const verifier = new PeyWebhookVerifier(SECRET);
  const event = { type: 'codi.pn.payment_received', transactionId: 'TX1' };

  it('devuelve el evento y su webhook-id cuando la firma es válida', () => {
    const { body, headers } = signed(event, { id: 'msg_42' });
    expect(verifier.verify(body, headers)).toEqual({ id: 'msg_42', event });
  });

  it('verifica sobre los bytes crudos: un cuerpo re-serializado distinto no pasa', () => {
    const { headers } = signed(event);
    const reformatted = Buffer.from(JSON.stringify(event, null, 2));
    expect(() => verifier.verify(reformatted, headers)).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza otro secreto, un timestamp viejo o la falta de headers', () => {
    const other = signed(event, {
      secret: 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bw==',
    });
    expect(() => verifier.verify(other.body, other.headers)).toThrow(
      UnauthorizedException,
    );

    const old = signed(event, { at: new Date(Date.now() - 10 * 60 * 1000) });
    expect(() => verifier.verify(old.body, old.headers)).toThrow(
      UnauthorizedException,
    );

    expect(() => verifier.verify(Buffer.from('{}'), {})).toThrow(
      UnauthorizedException,
    );
    expect(() => verifier.verify(undefined, signed(event).headers)).toThrow(
      UnauthorizedException,
    );
  });

  it('responde 503 mientras no esté configurado el secreto (pey reintentará)', () => {
    const { body, headers } = signed(event);
    expect(() =>
      new PeyWebhookVerifier(undefined).verify(body, headers),
    ).toThrow(ServiceUnavailableException);
  });
});
