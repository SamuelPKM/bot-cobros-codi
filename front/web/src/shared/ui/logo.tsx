import { useId } from 'react';

interface LogoMarkProps {
  /** Lado del ícono en píxeles. */
  size?: number;
  className?: string;
}

/**
 * Ícono de Cóbrale: una "C" abierta y, en la abertura, el punto del pago que
 * llega. El mismo dibujo está en app/icon.svg (favicon); si cambias uno,
 * cambia el otro.
 */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path
        d="M42.6 21.4 A15 15 0 1 0 42.6 42.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <circle cx="43.5" cy="32" r="5" fill="#bef264" />
    </svg>
  );
}

interface LogoProps extends LogoMarkProps {
  /** `light` para fondos oscuros. */
  tone?: 'dark' | 'light';
}

/** Ícono y nombre. El nombre lo lee el lector de pantalla. */
export function Logo({ size = 36, tone = 'dark', className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span
        className={`font-semibold tracking-tight ${tone === 'light' ? 'text-white' : 'text-zinc-900'}`}
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        Cóbrale
      </span>
    </span>
  );
}
