/** Objetivo: pantalla de inicio de sesión del personal con identidad PINTO TECH. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '../../api/endpoints';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/FormField';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});
type LoginForm = z.infer<typeof schema>;

const SPECIALTIES = [
  'Reparación de Laptops',
  'Impresoras y Multifunción',
  'Televisores',
  'Electrónicos en General',
];

const PILLARS = [
  'Servicio Confiable',
  'Calidad y Garantía',
  'Diagnóstico Rápido',
  'Servicio Técnico Profesional',
];

export function LoginPage() {
  const { token, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  if (token) return <Navigate to="/" replace />;

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      const result = await authApi.login(values.username, values.password);
      login(result.accessToken, result.user);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-brand-panel" aria-label="Identidad PINTO TECH">
          <BrandLogo variant="negativo" size="lg" showTagline />
          <div>
            <h1 className="login-headline">
              Especialistas en <span className="login-headline-accent">reparaciones electrónicas</span>
            </h1>
            <p className="login-mission">
              Ofrecer soluciones integrales y confiables en la reparación eléctrica y electrónica de computadoras,
              televisores y más, mediante un diagnóstico preciso y atención personalizada.
            </p>
          </div>
          <div className="login-services" aria-label="Áreas de especialidad">
            {SPECIALTIES.map((item) => (
              <span key={item} className="login-service-pill">
                {item}
              </span>
            ))}
          </div>
          <div className="login-pillars" aria-label="Pilares de servicio">
            {PILLARS.map((pillar) => (
              <div key={pillar} className="login-pillar">
                <span className="login-pillar-check" aria-hidden="true">
                  ✓
                </span>
                <span>{pillar}</span>
              </div>
            ))}
          </div>
        </section>

        <form className="login-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="login-card-brand">
            <BrandLogo variant="positivo" size="md" />
            <p className="login-card-subtitle">Sistema de gestión de reparaciones</p>
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <Input label="Usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} error={errors.username?.message} {...register('username')} />
          <Input label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <Button type="submit" loading={isSubmitting} className="btn-block">
            Ingresar
          </Button>
          <button
            type="button"
            className="link-button"
            aria-expanded={showRecovery}
            onClick={() => setShowRecovery((open) => !open)}
          >
            ¿Olvidó su contraseña?
          </button>
          {showRecovery && (
            <Alert kind="info">
              <p>
                Solicite al <strong>administrador</strong> que restablezca su contraseña desde la sección <strong>Usuarios</strong>.
              </p>
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
