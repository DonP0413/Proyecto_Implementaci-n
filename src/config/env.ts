/** Objetivo: único punto de lectura de variables de entorno del frontend. */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? 'PINTOTECH',
} as const;
