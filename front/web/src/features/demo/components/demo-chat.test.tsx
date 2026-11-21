import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoChat } from './demo-chat';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('DemoChat', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sin sesión abre una y muestra la bienvenida', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'sin sesión' }))
      .mockResolvedValueOnce(json(200, { messages: [{ id: 1, sender: 'bot', text: 'Hola, soy *Cóbrale*' }] }));
    render(<DemoChat />);
    expect(await screen.findByText('Cóbrale')).toHaveProperty('tagName', 'STRONG');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/demo/messages?after=0');
    expect(fetchMock.mock.calls[1]).toEqual(['/api/demo/session', { method: 'POST' }]);
  });

  it('aunque React monte dos veces (StrictMode), abre una sola sesión', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/demo/session'
        ? json(200, { messages: [{ id: 1, sender: 'bot', text: 'Bienvenida' }] })
        : json(401, { error: 'sin sesión' }),
    );
    render(
      <StrictMode>
        <DemoChat />
      </StrictMode>,
    );
    expect(await screen.findAllByText('Bienvenida')).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/demo/session')).toHaveLength(1);
    expect(screen.getAllByText('Bienvenida')).toHaveLength(1);
  });

  it('manda el mensaje y agrega la respuesta con su QR', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { messages: [{ id: 1, sender: 'bot', text: 'Hola' }] }))
      .mockResolvedValueOnce(
        json(200, {
          messages: [
            { id: 2, sender: 'visitor', text: 'qr 1' },
            { id: 3, sender: 'bot', text: 'QR para cobrar $1.00', qrImage: 'data:image/png;base64,AAA' },
          ],
        }),
      );
    render(<DemoChat />);
    await screen.findByText('Hola');
    await userEvent.type(screen.getByLabelText('Mensaje'), 'qr 1');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('img', { name: /QR CoDi/ })).toHaveAttribute('src', 'data:image/png;base64,AAA');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/demo/messages');
    expect(JSON.parse(init.body)).toEqual({ text: 'qr 1', after: 1 });
    expect(screen.getByLabelText('Mensaje')).toHaveValue('');
  });

  it('un límite de la API se muestra como alerta', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { messages: [] }))
      .mockResolvedValueOnce(json(429, { error: 'Vas muy rápido. Espera unos minutos.' }));
    render(<DemoChat />);
    await userEvent.type(screen.getByLabelText('Mensaje'), 'hola');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vas muy rápido');
  });

  it('cada 3 segundos pregunta por mensajes nuevos (el "✅ Pagado")', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock
      .mockResolvedValueOnce(json(200, { messages: [{ id: 4, sender: 'bot', text: 'Hola' }] }))
      .mockResolvedValue(json(200, { messages: [{ id: 5, sender: 'bot', text: '✅ Pagado: $1.00' }] }));
    render(<DemoChat />);
    await screen.findByText('Hola');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(await screen.findByText(/✅ Pagado/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/demo/messages?after=4');
  });
});
