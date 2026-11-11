/** Objetivo: pantalla de inicio de sesión del personal. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/FormField';
import { env } from '../../config/env';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  email: z.string().trim().email('Ingrese un correo válido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});
type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const { token, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  if (token) return <Navigate to="/" replace />;

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      const result = await authApi.login(values.email, values.password);
      login(result.accessToken, result.user);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="brand brand-lg">
          <span className="brand-logo">PT</span>
          <span className="brand-name">{env.appName}</span>
        </div>
        <p className="muted">Sistema de gestión de reparaciones</p>
        {error && <Alert kind="error">{error}</Alert>}
        <Input label="Correo electrónico" type="email" autoComplete="username" error={errors.email?.message} {...register('email')} />
        <Input label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" loading={isSubmitting} className="btn-block">
          Ingresar
        </Button>
      </form>
    </div>
  );
}
