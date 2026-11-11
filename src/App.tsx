/** Objetivo: providers globales (React Query, Router, Toaster). */
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from './components/ui/Toaster';
import { queryClient } from './lib/queryClient';
import { router } from './router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <Toaster />
    </QueryClientProvider>
  );
}
