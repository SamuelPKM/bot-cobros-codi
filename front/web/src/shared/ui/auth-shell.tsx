import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './logo';

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Va debajo de la tarjeta del formulario (p. ej. el enlace a registro). */
  footer?: ReactNode;
}

/**
 * Pantalla de entrada y registro: panel de marca a la izquierda (solo en
 * pantallas anchas) y el formulario en una tarjeta a la derecha.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      <BrandPanel />
      <main className="relative flex flex-1 flex-col items-center justify-center bg-zinc-50 px-5 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Link href="/" aria-label="Cóbrale, inicio">
            <Logo size={40} />
          </Link>
        </div>
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-7 shadow-xl shadow-emerald-950/5 ring-1 ring-zinc-200 sm:p-9">
            <div className="mb-7 flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
              <p className="text-sm text-zinc-600">{subtitle}</p>
            </div>
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-zinc-600">{footer}</div>}
          <p className="mt-4 text-center text-xs text-zinc-500">
            <Link href="/privacidad" className="hover:text-zinc-700 hover:underline">
              Aviso de privacidad
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-emerald-950 p-12 text-white lg:flex xl:w-[55%] xl:p-16">
      {/* Fondo: luces de color y una retícula tenue. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-lime-300/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <Link href="/" aria-label="Cóbrale, inicio" className="relative w-fit">
        <Logo size={40} tone="light" />
      </Link>

      <div className="relative flex items-center gap-10 xl:gap-14">
        <div className="flex max-w-sm flex-col gap-5">
          <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lime-200 ring-1 ring-white/15">
            Pagos con CoDi
          </span>
          <h2 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            Cobra en segundos, directo al celular de tu cliente.
          </h2>
          <p className="text-base text-emerald-100/80">
            Le llega la solicitud a la app de su banco. Si no, QR o liga de pago. El dinero cae en tu
            cuenta, sin comisiones de terminal.
          </p>
        </div>
        <PhoneIllustration />
      </div>

      <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm text-emerald-100/80">
        <Feature>Push al celular</Feature>
        <Feature>QR y liga de respaldo</Feature>
        <Feature>Tu equipo cobra sin ver tus cuentas</Feature>
      </ul>
    </aside>
  );
}

function Feature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-lime-300" aria-hidden="true">
        <path
          d="M5 10.5l3 3 7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </li>
  );
}

/** Un celular con la solicitud de cobro en la app del banco. Solo decorativo. */
function PhoneIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden shrink-0 select-none xl:block">
      <div className="motion-safe:animate-float relative w-60 rounded-[2.6rem] bg-zinc-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="absolute top-4 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex h-[29rem] flex-col overflow-hidden rounded-[2.1rem] bg-gradient-to-b from-zinc-100 to-white text-zinc-900">
          <div className="flex justify-between px-6 pt-3.5 text-[10px] font-semibold text-zinc-700">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="mt-8 px-5 text-[11px] font-medium text-zinc-500">Tu banco</div>
          <div className="px-5 text-lg font-semibold">Solicitud de pago</div>

          <div className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-base">🌮</span>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold whitespace-nowrap">Tacos La Esquina</div>
                <div className="text-[11px] text-zinc-500">Cobro CoDi</div>
              </div>
            </div>
            <div className="mt-4 text-[11px] text-zinc-500">Monto</div>
            <div className="text-3xl font-semibold tracking-tight">$185.00</div>
            <div className="mt-1 text-[11px] text-zinc-500">2 órdenes al pastor</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[12px] font-semibold">
              <span className="rounded-lg bg-zinc-100 py-2 text-zinc-600">Rechazar</span>
              <span className="rounded-lg bg-emerald-600 py-2 text-white">Aceptar</span>
            </div>
          </div>

          <div className="mt-auto mb-5 px-5 text-center text-[10px] text-zinc-400">Pago con CoDi</div>
        </div>
      </div>

      {/* Avisos flotantes alrededor del celular. */}
      <div className="motion-safe:animate-float-delayed absolute -top-4 -left-20 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-zinc-800 shadow-lg">
        <span className="h-2 w-2 rounded-full bg-sky-500" />
        Push enviado · 55 •••• 4821
      </div>
      <div className="motion-safe:animate-float-delayed absolute -right-14 bottom-24 flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-zinc-900 shadow-xl">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 20 20" className="h-4 w-4">
            <path
              d="M5 10.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-xs font-semibold">Pagado</span>
          <span className="block text-[11px] text-zinc-500">$185.00 · hace 3 s</span>
        </span>
      </div>
    </div>
  );
}
