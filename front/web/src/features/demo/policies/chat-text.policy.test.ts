import { describe, expect, it } from 'vitest';
import { chatSegments } from './chat-text.policy';

describe('chatSegments', () => {
  it('convierte *negritas* de WhatsApp en segmentos', () => {
    expect(chatSegments('Vas a cobrar *$150.00* al cliente')).toEqual([
      { text: 'Vas a cobrar ', bold: false },
      { text: '$150.00', bold: true },
      { text: ' al cliente', bold: false },
    ]);
  });

  it('sin asteriscos o con uno suelto, todo es texto normal', () => {
    expect(chatSegments('hola')).toEqual([{ text: 'hola', bold: false }]);
    expect(chatSegments('5 * 3')).toEqual([{ text: '5 * 3', bold: false }]);
  });
});
