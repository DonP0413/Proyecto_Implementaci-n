/** Objetivo: administración del personal (sólo ADMIN): alta, rol, activación y reseteo de contraseña. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersApi } from '../../api/endpoints';
import type { User, UserRole } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, Spinner } from '../../components/ui/Feedback';
import { Input, Select } from '../../components/ui/FormField';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { personNameField } from '../../lib/validation';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'RECEPCIONISTA', label: 'Recepción' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'ADMIN', label: 'Administrador' },
];

const password = z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, 'Mínimo 8 caracteres con letras y números');
const userSchema = z.object({
  fullName: personNameField(3, 120, 'Nombre requerido'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._@-]{3,60}$/, 'Entre 3 y 60 caracteres: letras, números, punto, guion o guion bajo, sin espacios'),
  password,
  role: z.enum(['ADMIN', 'RECEPCIONISTA', 'TECNICO']),
});
type UserForm = z.infer<typeof userSchema>;

const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] });
type ResetForm = z.infer<typeof resetSchema>;

/**
 * Diálogo propio para restablecer la contraseña. Reemplaza a window.prompt(),
 * que Electron no implementa (en la app de escritorio no aparecía nada) y que
 * además mostraba la contraseña en texto visible.
 */
function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async ({ password: newPassword }: ResetForm) => {
    if (!user) return;
    try {
      await usersApi.resetPassword(user.id, newPassword);
      toast.success('Contraseña actualizada');
      close();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const own = user?.id === me?.id;
  return (
    <Modal open={!!user} title={own ? 'Cambiar mi contraseña' : `Nueva contraseña para ${user?.fullName ?? ''}`} onClose={close}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="muted">Mínimo 8 caracteres, con letras y números.</p>
        <Input label="Nueva contraseña" type="password" required autoComplete="new-password" autoFocus error={errors.password?.message} {...register('password')} />
        <Input label="Repita la contraseña" type="password" required autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <div className="form-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  // Cambios sensibles (rol, activar/desactivar) se confirman antes de aplicarse.
  const [pendingChange, setPendingChange] = useState<{ user: User; data: Parameters<typeof usersApi.update>[1]; description: string } | null>(null);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({ mutationFn: usersApi.create, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof usersApi.update>[1] }) => usersApi.update(id, data),
    onSuccess: invalidate,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserForm>({ resolver: zodResolver(userSchema), defaultValues: { role: 'RECEPCIONISTA' } });

  const onCreate = async (values: UserForm) => {
    try {
      await create.mutateAsync(values);
      toast.success('Usuario creado');
      reset();
      setCreating(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };


  const patch = (user: User, data: Parameters<typeof usersApi.update>[1]) =>
    update
      .mutateAsync({ id: user.id, data })
      .then(() => toast.success('Usuario actualizado'))
      .catch((e) => toast.error(getErrorMessage(e)));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Usuarios del sistema</h1>
        <Button onClick={() => setCreating(true)}>+ Nuevo usuario</Button>
      </div>
      <Card>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <Alert kind="error">{getErrorMessage(error)}</Alert>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.username}</td>
                  <td>
                    <select
                      aria-label={`Rol de ${user.fullName}`}
                      value={user.role}
                      disabled={user.id === me?.id}
                      onChange={(e) => {
                        const role = e.target.value as UserRole;
                        setPendingChange({
                          user,
                          data: { role },
                          description: `cambiar el rol de ${user.fullName} a "${ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role}"`,
                        });
                      }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{user.isActive ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td className="row-actions">
                    <Button size="sm" variant="ghost" onClick={() => setResettingUser(user)}>
                      Contraseña
                    </Button>
                    {user.id !== me?.id && (
                      <Button size="sm" variant={user.isActive ? 'danger' : 'secondary'} onClick={() =>
                          setPendingChange({
                            user,
                            data: { isActive: !user.isActive },
                            description: user.isActive
                              ? `desactivar a ${user.fullName}: no podrá iniciar sesión`
                              : `activar a ${user.fullName}: podrá iniciar sesión nuevamente`,
                          })
                        }>
                        {user.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingChange}
        title="¿Está seguro de modificar este usuario?"
        confirmLabel="Sí, aplicar cambio"
        tone={pendingChange?.data.isActive === false ? 'danger' : 'primary'}
        loading={update.isPending}
        onCancel={() => setPendingChange(null)}
        onConfirm={() => pendingChange && patch(pendingChange.user, pendingChange.data).finally(() => setPendingChange(null))}
        message={<p>Va a {pendingChange?.description}.</p>}
      />
      <ResetPasswordDialog user={resettingUser} onClose={() => setResettingUser(null)} />
      <Modal open={creating} title="Nuevo usuario" onClose={() => setCreating(false)}>
        <form onSubmit={handleSubmit(onCreate)} noValidate>
          <Input label="Nombre completo" required error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Usuario" required autoCapitalize="none" spellCheck={false} placeholder="ana.torres" error={errors.username?.message} {...register('username')} />
          <Input label="Contraseña inicial" type="password" required autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Select label="Rol" required options={ROLE_OPTIONS} error={errors.role?.message} {...register('role')} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Crear usuario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
