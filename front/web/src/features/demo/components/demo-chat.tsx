'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { primaryButton } from '@/shared/ui/styles';
import type { ChatMessage } from '../interfaces/demo.interface';
import { chatSegments } from '../policies/chat-text.policy';

const POLL_MS = 3_000;

type Reply = { messages?: ChatMessage[]; error?: string };

async function call(input: string, init?: RequestInit): Promise<{ status: number; body: Reply }> {
  const response = await fetch(input, init);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Reply };
}

/** Chat de la demo: la misma conversación que en WhatsApp, con cobros reales y límites. */
export function DemoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const list = useRef<HTMLOListElement>(null);

  const append = useCallback((incoming: ChatMessage[] = []) => {
    const fresh = incoming.filter((m) => m.id > lastId.current);
    if (fresh.length === 0) return;
    lastId.current = fresh.at(-1)!.id;
    setMessages((current) => [...current, ...fresh]);
  }, []);

  // Una sola apertura de sesión y una sola consulta a la vez: sin esto, dos
  // consultas con 401 (StrictMode, o el intervalo) abrían dos sesiones.
  const starting = useRef<Promise<void> | null>(null);
  const polling = useRef(false);

  const startSession = useCallback(() => {
    starting.current ??= (async () => {
      try {
        const { status, body } = await call('/api/demo/session', { method: 'POST' });
        if (status === 200) {
          lastId.current = 0;
          setMessages([]);
          append(body.messages);
        } else setError(body.error ?? 'No pudimos abrir la demo. Intenta más tarde.');
      } finally {
        starting.current = null;
      }
    })();
    return starting.current;
  }, [append]);

  const poll = useCallback(async () => {
    if (polling.current || starting.current) return;
    polling.current = true;
    try {
      const { status, body } = await call(`/api/demo/messages?after=${lastId.current}`);
      if (status === 401) await startSession();
      else if (status === 200) append(body.messages);
    } finally {
      polling.current = false;
    }
  }, [append, startSession]);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError(undefined);
    try {
      const { status, body } = await call('/api/demo/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, after: lastId.current }),
      });
      if (status === 200) {
        append(body.messages);
        setText('');
      } else if (status === 401) {
        await startSession();
      } else {
        setError(body.error ?? 'Algo salió mal. Intenta de nuevo.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ol
        ref={list}
        aria-label="Conversación"
        aria-live="polite"
        className="flex h-[28rem] flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3"
      >
        {messages.map((message) => (
          <li
            key={message.id}
            className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
              message.sender === 'visitor'
                ? 'self-end bg-emerald-700 text-white'
                : 'self-start bg-white text-zinc-900 shadow-sm'
            }`}
          >
            {chatSegments(message.text).map((segment, i) =>
              segment.bold ? <strong key={i}>{segment.text}</strong> : <span key={i}>{segment.text}</span>,
            )}
            {message.qrImage && (
              // eslint-disable-next-line @next/next/no-img-element -- PNG generado en el servidor
              <img
                src={message.qrImage}
                alt="QR CoDi para pagar"
                width={200}
                height={200}
                className="mt-2 rounded border border-zinc-200 bg-white"
              />
            )}
            {message.url && (
              <a
                href={message.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all font-medium underline"
              >
                Abrir la liga de pago
              </a>
            )}
          </li>
        ))}
      </ol>
      <FormAlert message={error} />
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="demo-text" className="sr-only">
          Mensaje
        </label>
        <input
          id="demo-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="qr 0.01 prueba"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-emerald-600"
        />
        <button type="submit" disabled={sending} className={primaryButton}>
          Enviar
        </button>
      </form>
    </div>
  );
}
