import { useAuthStore } from './authStore';

const user = (role: 'ADMIN' | 'RECEPCIONISTA' | 'TECNICO') => ({
  id: '1',
  fullName: 'X',
  username: 'x',
  role,
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
});

describe('authStore.hasRole', () => {
  it('ADMIN tiene todos los permisos', () => {
    useAuthStore.getState().login('t', user('ADMIN'));
    expect(useAuthStore.getState().hasRole('TECNICO')).toBe(true);
  });

  it('TECNICO no tiene permisos de recepción', () => {
    useAuthStore.getState().login('t', user('TECNICO'));
    expect(useAuthStore.getState().hasRole('RECEPCIONISTA')).toBe(false);
    expect(useAuthStore.getState().hasRole('TECNICO', 'RECEPCIONISTA')).toBe(true);
  });

  it('logout limpia la sesión', () => {
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().hasRole('TECNICO')).toBe(false);
  });
});
