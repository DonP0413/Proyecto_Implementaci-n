/** Objetivo: layout principal (barra lateral de navegación + cabecera con usuario). */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { env } from '../../config/env';
import { useAuthStore } from '../../stores/authStore';

const ROLE_LABELS = { ADMIN: 'Administrador', RECEPCIONISTA: 'Recepción', TECNICO: 'Técnico' } as const;

export function AppLayout() {
  const { user, logout, hasRole } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">PT</span>
          <span className="brand-name">{env.appName}</span>
        </div>
        <nav className="nav" aria-label="Navegación principal">
          <NavLink to="/" end>
            Tablero
          </NavLink>
          <NavLink to="/work-orders">Órdenes de trabajo</NavLink>
          {hasRole('RECEPCIONISTA') && <NavLink to="/work-orders/new">+ Registrar ingreso</NavLink>}
          <NavLink to="/clients">Clientes</NavLink>
          {hasRole('ADMIN') && <NavLink to="/users">Usuarios</NavLink>}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div />
          <div className="user-box">
            <div className="user-info">
              <strong>{user?.fullName}</strong>
              <small className="muted">{user ? ROLE_LABELS[user.role] : ''}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
