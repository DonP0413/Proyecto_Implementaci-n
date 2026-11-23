/**
 * Objetivo: estado global de autenticación (Zustand + persistencia).
 * Se guarda el JWT en sessionStorage: sobrevive a recargas pero se borra al
 * cerrar el navegador (menor exposición que localStorage en equipos
 * compartidos del mostrador). La mitigación XSS principal es CSP + React.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User, UserRole } from '../api/types';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      hasRole: (...roles) => {
        const role = get().user?.role;
        return !!role && (role === 'ADMIN' || roles.includes(role));
      },
    }),
    { name: 'pintotech-auth', storage: createJSONStorage(() => sessionStorage) },
  ),
);
