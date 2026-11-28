/** Mismo sistema visual que la web (Tailwind por defecto). Solo modo claro. */
export const palette = {
  // Fondos y texto
  background: '#fafafa', // zinc-50
  surface: '#ffffff',
  text: '#18181b', // zinc-900
  textStrong: '#27272a', // zinc-800
  textSoft: '#3f3f46', // zinc-700
  muted: '#52525b', // zinc-600
  subtle: '#71717a', // zinc-500
  border: '#e4e4e7', // zinc-200
  borderInput: '#d4d4d8', // zinc-300
  neutralSurface: '#f4f4f5', // zinc-100

  // Marca
  primary: '#059669', // emerald-600
  primaryPressed: '#047857', // emerald-700
  primaryDark: '#065f46', // emerald-800
  brandDark: '#022c22', // emerald-950
  brandSoft: '#ecfdf5', // emerald-50
  brandSofter: '#d1fae5', // emerald-100
  brandText: '#064e3b', // emerald-900
  brandBright: '#10b981', // emerald-500
  accent: '#d9f99d', // lime-200
  onPrimary: '#ffffff',

  // Estados
  success: '#047857',
  successSurface: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#b45309', // amber-700
  warningSurface: '#fffbeb', // amber-50
  warningBorder: '#fde68a',
  pendingSurface: '#fef3c7', // amber-100
  pendingText: '#78350f', // amber-900
  danger: '#b91c1c', // red-700
  dangerInput: '#dc2626', // red-600
  dangerSurface: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerText: '#991b1b',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

/** Geist por peso: en Android `fontWeight` no elige el archivo. */
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;
