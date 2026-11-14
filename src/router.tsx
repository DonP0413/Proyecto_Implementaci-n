/** Objetivo: definición de rutas de la SPA (todas protegidas salvo /login). */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { ClientsPage } from './features/clients/ClientsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { FailedNotificationsPage } from './features/notifications/FailedNotificationsPage';
import { UsersPage } from './features/users/UsersPage';
import { NewWorkOrderPage } from './features/work-orders/pages/NewWorkOrderPage';
import { WorkOrderDetailPage } from './features/work-orders/pages/WorkOrderDetailPage';
import { WorkOrdersListPage } from './features/work-orders/pages/WorkOrdersListPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'work-orders', element: <WorkOrdersListPage /> },
      {
        path: 'work-orders/new',
        element: (
          <ProtectedRoute roles={['RECEPCIONISTA']}>
            <NewWorkOrderPage />
          </ProtectedRoute>
        ),
      },
      { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },
      { path: 'clients', element: <ClientsPage /> },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute roles={['RECEPCIONISTA', 'TECNICO']}>
            <FailedNotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  future: { v7_relativeSplatPath: true },
});
