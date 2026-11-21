import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { DemoRole } from '../../types';

interface ProtectedRouteProps {
  requiredRole: DemoRole;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, children }) => {
  const { authSession } = useApp();
  const location = useLocation();

  if (!authSession) {
    const loginPath = requiredRole === 'merchant' ? '/merchant/login' : '/admin/login';
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  if (authSession.role !== requiredRole) {
    const fallbackPath = authSession.role === 'merchant' ? '/merchant' : '/admin';
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
