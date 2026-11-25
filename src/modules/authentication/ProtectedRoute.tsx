import type { ReactNode } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { canAccessWorkspace, type WorkspaceSpace } from '@/src/lib/auth/rbac';
import { useAuth } from './AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';

interface ProtectedRouteProps {
  requiredSpace: WorkspaceSpace;
  children: ReactNode;
}

export function ProtectedRoute({ requiredSpace, children }: ProtectedRouteProps) {
  const { isLoading, accessContext } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--rc-bg)] flex items-center justify-center p-6">
        <div className="text-sm text-[var(--rc-muted)]">Vérification de session et des autorisations...</div>
      </div>
    );
  }

  if (!accessContext.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const check = canAccessWorkspace(accessContext, requiredSpace);
  if (!check.allowed) {
    return (
      <div className="min-h-screen bg-[var(--rc-bg)] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-[var(--rc-danger-fg)]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              <CardTitle>Accès refusé</CardTitle>
            </div>
            <CardDescription>{check.reason ?? 'Autorisations insuffisantes pour cet espace.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Accueil public</span>
              </Link>
            </Button>
            <Button asChild>
              <Link to="/login">Changer de compte</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
