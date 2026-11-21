'use client';

import { useState } from 'react';
import { secondaryButton } from './styles';

/** Copia un texto (una liga) para pegarlo en cualquier chat. */
export function CopyButton({ text, label = 'Copiar liga' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={secondaryButton} aria-live="polite">
      {copied ? '¡Copiada!' : label}
    </button>
  );
}
