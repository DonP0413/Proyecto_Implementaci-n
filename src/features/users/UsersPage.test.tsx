import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { usersApi } from '../../api/endpoints';
import type { User } from '../../api/types';
import { useAuthStore } from '../../stores/authStore';
import { UsersPage } from './UsersPage';

const admin: User = {
  id: 'u1',
  fullName: 'Administrador',
  username: 'admin',
  role: 'ADMIN',
  isActive: true,
  lastLoginAt: null,
  createdAt: '',
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UsersPage />
    </QueryClientProvider>,
  );

describe('UsersPage — restablecer contraseña', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'jwt', user: admin });
    vi.spyOn(usersApi, 'list').mockResolvedValue([admin]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('usa un diálogo propio (no window.prompt) y valida antes de guardar', async () => {
    const prompt = vi.spyOn(window, 'prompt');
    const reset = vi.spyOn(usersApi, 'resetPassword').mockResolvedValue({} as never);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Contraseña' }));
    expect(prompt).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cambiar mi contraseña' })).toBeInTheDocument();

    const nueva = screen.getByLabelText(/Nueva contraseña/);
    const repetir = screen.getByLabelText(/Repita la contraseña/);
    expect(nueva).toHaveAttribute('type', 'password');

    await userEvent.type(nueva, 'corta');
    await userEvent.type(repetir, 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Mínimo 8 caracteres con letras y números')).toBeInTheDocument();

    await userEvent.clear(nueva);
    await userEvent.clear(repetir);
    await userEvent.type(nueva, 'Nueva2026x');
    await userEvent.type(repetir, 'Distinta2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();

    await userEvent.clear(repetir);
    await userEvent.type(repetir, 'Nueva2026x');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith('u1', 'Nueva2026x'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
