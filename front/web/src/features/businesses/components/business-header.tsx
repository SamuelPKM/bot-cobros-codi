import Link from 'next/link';
import type { Role } from '@/shared/interfaces/public-user.interface';
import { Avatar } from '@/shared/ui/avatar';
import { logoUrl } from '../constants/logo.constants';

const TIME_ZONE = 'America/Mexico_City';

/** "Buenos días" / "Buenas tardes" / "Buenas noches", según la hora de la Ciudad de México. */
export function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const longDate = new Intl.DateTimeFormat('es-MX', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

interface BusinessHeaderProps {
  businessName: string;
  /** Versión del logo; null para mostrar las iniciales. */
  logoVersion: string | null;
  userName: string;
  role: Role;
  /** La hora de la visita (la calcula la página, en cada visita). */
  now: Date;
}

/** Cabecera del panel: el negocio con su avatar, el saludo y el botón de cobrar. */
export function BusinessHeader({ businessName, logoVersion, userName, role, now }: BusinessHeaderProps) {
  const firstName = userName.trim().split(/\s+/)[0];
  const date = longDate.format(now);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-emerald-950 p-6 text-white sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-lime-300/10 blur-3xl" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            name={businessName}
            src={logoVersion ? logoUrl(logoVersion) : null}
            size={64}
            tone="brand"
            className="ring-4 ring-white/10"
          />
          <div className="min-w-0">
            <p className="text-sm text-emerald-100/80">
              {greeting(now)}, {firstName} · <span className="first-letter:uppercase">{date}</span>
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{businessName}</h1>
            <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-lime-200 ring-1 ring-white/15">
              {role === 'admin' ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </div>
        <Link
          href="/panel/cobros/nuevo"
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 focus-visible:outline-none active:scale-[0.99]"
        >
          + Nuevo cobro
        </Link>
      </div>
    </section>
  );
}
