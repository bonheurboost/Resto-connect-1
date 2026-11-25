import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/src/components/theme/ThemeProvider';
import { AuthProvider } from '@/src/modules/authentication/AuthProvider';
import { RestoConnectProvider } from '@/src/lib/store/RestoConnectStore';
import { ProtectedRoute } from '@/src/modules/authentication/ProtectedRoute';
import { AuthPage } from '@/src/modules/authentication/AuthPage';
import { PublicRestaurantPortal } from '@/src/modules/restaurants/PublicRestaurantPortal';
import { RestoConnectCommercialSite } from '@/src/modules/marketing/RestoConnectCommercialSite';
import { OrderTrackingPage } from '@/src/modules/orders/OrderTrackingPage';
import { SuperAdminDashboard } from '@/src/modules/super-admin/SuperAdminDashboard';
import { RestaurantAdminDashboard } from '@/src/modules/dashboard/RestaurantAdminDashboard';
import { StaffWorkspace } from '@/src/modules/employees/StaffWorkspace';
import { ArchitecturePreviewPage } from '@/src/modules/dashboard/ArchitecturePreviewPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RestoConnectProvider>
          <BrowserRouter>
            <Routes>
              {/* Vitrine commerciale SaaS RestoConnect */}
              <Route path="/" element={<RestoConnectCommercialSite />} />
              <Route path="/presentation" element={<RestoConnectCommercialSite />} />
              <Route path="/fonctionnalites" element={<RestoConnectCommercialSite />} />
              <Route path="/avantages" element={<RestoConnectCommercialSite />} />
              <Route path="/demonstration" element={<RestoConnectCommercialSite />} />
              <Route path="/contact" element={<RestoConnectCommercialSite />} />
              <Route path="/faq" element={<RestoConnectCommercialSite />} />
              <Route path="/conditions-utilisation" element={<RestoConnectCommercialSite />} />
              <Route path="/confidentialite" element={<RestoConnectCommercialSite />} />

              {/* Espace D : Vitrines publiques individuelles des restaurants par slug */}
              <Route path="/r/:slug" element={<PublicRestaurantPortal />} />
              <Route path="/restaurant/:slug" element={<PublicRestaurantPortal />} />
              <Route path="/suivi-commande" element={<OrderTrackingPage />} />
              <Route path="/suivi/:token" element={<OrderTrackingPage />} />

              {/* Authentification : Connexion, Inscription contrôlée, Réinitialisation */}
              <Route path="/login" element={<AuthPage />} />

              {/* Aperçu interactif des 3 espaces privés avant liaison Supabase */}
              <Route path="/apercu-architecture" element={<ArchitecturePreviewPage />} />

              {/* Espace A : Super Administrateur (strictement protégé) */}
              <Route
                path="/super-admin/*"
                element={
                  <ProtectedRoute requiredSpace="super_admin">
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Espace B : Administrateur du restaurant (strictement protégé) */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requiredSpace="restaurant_admin">
                    <RestaurantAdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Espace C : Personnel du restaurant (strictement protégé) */}
              <Route
                path="/staff/*"
                element={
                  <ProtectedRoute requiredSpace="staff">
                    <StaffWorkspace />
                  </ProtectedRoute>
                }
              />

              {/* Redirection de secours */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </RestoConnectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
