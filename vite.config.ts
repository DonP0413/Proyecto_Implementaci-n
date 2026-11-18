/**
 * Objetivo: configuración de Vite (dev server + build) y Vitest.
 * En desarrollo, /api y /health se redirigen al backend local (sin CORS).
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: true },
      '/health': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: { reporter: ['text', 'lcov'], include: ['src/**/*.{ts,tsx}'], exclude: ['src/main.tsx', 'src/test/**'] },
  },
});
