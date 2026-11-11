/** Objetivo: proteger rutas por autenticación y, opcionalmente, por rol. */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '../../api/types';
import { Alert } from '../../components/ui/Feedback';
import { useAuthStore } from '../../stores/authStore';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const token = useAuthStore((s) => s.token);
  const hasRole = useAuthStore((s) => s.hasRole);
  const location = useLocation();

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !hasRole(...roles)) {
    return <Alert kind="warning">Su rol no tiene acceso a esta sección.</Alert>;
  }
  return <>{children}</>;
}
