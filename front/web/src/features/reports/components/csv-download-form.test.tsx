import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CsvDownloadForm } from './csv-download-form';

describe('CsvDownloadForm', () => {
  it('es un formulario GET a la descarga con las dos fechas opcionales', () => {
    const { container } = render(<CsvDownloadForm />);
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('action', '/panel/cobros/csv');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('Desde')).toHaveAttribute('name', 'from');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('name', 'to');
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeInTheDocument();
  });
});
