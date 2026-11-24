import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/business-logo.action', () => ({
  uploadLogo: vi.fn(async () => ({})),
  removeLogo: vi.fn(async () => ({})),
}));

const { checkLogoFile, LogoSettings } = await import('./logo-settings');

const file = (type: string, size: number) =>
  new File([new Uint8Array(size)], 'logo', { type });

describe('checkLogoFile', () => {
  it('acepta PNG, JPG y WebP de hasta 1 MB', () => {
    expect(checkLogoFile(file('image/png', 500_000))).toBeNull();
    expect(checkLogoFile(file('image/jpeg', 1024 * 1024))).toBeNull();
    expect(checkLogoFile(file('image/webp', 10))).toBeNull();
  });

  it('rechaza SVG, GIF y archivos de más de 1 MB', () => {
    expect(checkLogoFile(file('image/svg+xml', 10))).toMatch(/PNG, JPG o WebP/);
    expect(checkLogoFile(file('image/gif', 10))).toMatch(/PNG, JPG o WebP/);
    expect(checkLogoFile(file('image/png', 1024 * 1024 + 1))).toMatch(/1 MB/);
  });
});

describe('LogoSettings', () => {
  it('sin logo muestra las iniciales y el botón de subir', () => {
    render(<LogoSettings businessName="Tacos Ana" logoVersion={null} enabled />);
    expect(screen.getByText('TA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir logo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Quitar logo' })).not.toBeInTheDocument();
  });

  it('con logo lo muestra y deja cambiarlo o quitarlo', () => {
    const { container } = render(<LogoSettings businessName="Tacos Ana" logoVersion="abc123" enabled />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/panel/logo?v=abc123');
    expect(screen.getByRole('button', { name: 'Cambiar logo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar logo' })).toBeInTheDocument();
  });

  it('si el servidor no guarda logos, lo explica en lugar del formulario', () => {
    render(<LogoSettings businessName="Tacos Ana" logoVersion={null} enabled={false} />);
    expect(screen.getByText(/no están activos/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
