import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { authApi } from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => useAuthStore.setState({ token: null, user: null }));

  it('valida los campos antes de enviar', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingrese un correo válido')).toBeInTheDocument();
    expect(screen.getByText('Ingrese su contraseña')).toBeInTheDocument();
  });

  it('guarda la sesión al iniciar correctamente', async () => {
    const spy = vi.spyOn(authApi, 'login').mockResolvedValue({
      accessToken: 'jwt',
      expiresIn: '8h',
      user: { id: '1', fullName: 'Ana', email: 'ana@pt.ec', role: 'RECEPCIONISTA', isActive: true, lastLoginAt: null, createdAt: '' },
    });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@pt.ec');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave2026');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt'));
    expect(spy).toHaveBeenCalledWith('ana@pt.ec', 'Clave2026');
  });
});
