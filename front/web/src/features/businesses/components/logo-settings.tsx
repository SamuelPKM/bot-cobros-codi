'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { Avatar } from '@/shared/ui/avatar';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormNotice } from '@/shared/ui/form-notice';
import { primaryButton, secondaryButton } from '@/shared/ui/styles';
import { removeLogo, uploadLogo, type LogoState } from '../actions/business-logo.action';
import { LOGO_ACCEPT, logoUrl, MAX_LOGO_BYTES } from '../constants/logo.constants';

const initialState: LogoState = {};
const ACCEPTED = LOGO_ACCEPT.split(',');

/** Qué tiene de malo el archivo elegido, antes de subirlo; null si está bien. */
export function checkLogoFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'El logo debe ser una imagen PNG, JPG o WebP';
  if (file.size > MAX_LOGO_BYTES) return 'El logo debe pesar máximo 1 MB';
  return null;
}

interface LogoSettingsProps {
  businessName: string;
  logoVersion: string | null;
  enabled: boolean;
}

/** Logo del negocio (solo admin): se ve en el panel de todo el equipo. */
export function LogoSettings({ businessName, logoVersion, enabled }: LogoSettingsProps) {
  const inputId = useId();
  const [uploadState, uploadAction, uploading] = useActionState(uploadLogo, initialState);
  const [removeState, removeAction, removing] = useActionState(removeLogo, initialState);
  // La vista previa vale solo para el logo que había al elegirla: al subirla,
  // llega otra versión del servidor y se deja de mostrar sola.
  const [chosen, setChosen] = useState<{ url: string; forVersion: string | null } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const preview = chosen && chosen.forVersion === logoVersion ? chosen.url : null;

  // Libera la imagen elegida cuando cambia o al salir.
  useEffect(() => () => {
    if (chosen) URL.revokeObjectURL(chosen.url);
  }, [chosen]);

  if (!enabled)
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-zinc-900">Logo</h3>
        <p className="text-sm text-zinc-600">
          Los logos no están activos en este servidor. Mientras tanto, el panel muestra las iniciales del negocio.
        </p>
      </div>
    );

  const current = logoVersion ? logoUrl(logoVersion) : null;
  const shown = preview ?? current;
  const busy = uploading || removing;
  const state = removeState.notice || removeState.error ? removeState : uploadState;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium text-zinc-900">Logo</h3>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={businessName} src={shown} size={80} tone="brand" className="ring-1 ring-zinc-200" />
        <form action={uploadAction} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm text-zinc-700">
            PNG, JPG o WebP de máximo 1 MB. Se ve mejor cuadrado.
          </label>
          <input
            id={inputId}
            name="logo"
            type="file"
            accept={LOGO_ACCEPT}
            required
            aria-invalid={fileError ? true : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              const problem = file ? checkLogoFile(file) : null;
              setFileError(problem);
              setChosen(file && !problem ? { url: URL.createObjectURL(file), forVersion: logoVersion } : null);
              if (problem) event.target.value = '';
            }}
            className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !preview} className={primaryButton}>
              {uploading ? 'Subiendo…' : current ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {current && !preview && (
              <button type="submit" formAction={removeAction} formNoValidate disabled={busy} className={secondaryButton}>
                {removing ? 'Quitando…' : 'Quitar logo'}
              </button>
            )}
          </div>
        </form>
      </div>
      <FormAlert message={fileError ?? state.error} />
      <FormNotice message={fileError ? undefined : state.notice} />
    </div>
  );
}
