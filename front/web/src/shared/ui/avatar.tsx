/** Hasta dos iniciales: "Tacos La Esquina" → "TL", "ana" → "A". */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}|\d/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => w.match(/\p{L}|\d/u)?.[0] ?? '')
    .join('')
    .toUpperCase();
}

interface AvatarProps {
  name: string;
  /** Lado en píxeles. */
  size?: number;
  /** `brand`: degradado de la marca (el negocio). `neutral`: gris (personas). */
  tone?: 'brand' | 'neutral';
  /** Imagen (el logo del negocio). Sin ella, las iniciales. */
  src?: string | null;
  className?: string;
}

/** Avatar con imagen o iniciales. Decorativo: el nombre siempre va escrito al lado. */
export function Avatar({ name, size = 40, tone = 'neutral', src, className }: AvatarProps) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagen privada, servida por /panel/logo con la sesión
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full bg-white object-cover ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    );
  const toneClass =
    tone === 'brand'
      ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm shadow-emerald-900/20'
      : 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${toneClass} ${className ?? ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name) || '·'}
    </span>
  );
}
