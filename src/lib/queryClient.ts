/** Objetivo: instancia única de React Query con política de reintentos y caché. */
import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // No reintentar errores de cliente (4xx); sí errores de red / 5xx.
      retry: (count, error) => {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        return status !== undefined && status < 500 ? false : count < 2;
      },
    },
  },
});
