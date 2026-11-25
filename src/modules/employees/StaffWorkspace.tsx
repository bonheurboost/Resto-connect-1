import { useState } from 'react';
import {
  ClipboardList,
  ChefHat,
  CreditCard,
  CalendarClock,
  Boxes,
  Truck,
  BookOpen,
  Shield,
  Users,
  BarChart3,
  Receipt,
} from 'lucide-react';
import { DashboardShellLayout, type SidebarNavItem } from '@/src/components/layout/DashboardShellLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import {
  ROLE_LABELS_FR,
  ROLE_PERMISSIONS_MAP,
  hasRolePermission,
  type PermissionCode,
} from '@/src/lib/auth/rbac';
import type { RestaurantRoleCode } from '@/src/lib/supabase/database.types';
import { OrdersModuleView } from '@/src/modules/orders/OrdersModuleView';
import { ReservationsModuleView } from '@/src/modules/reservations/ReservationsModuleView';
import { InventoryModuleView } from '@/src/modules/inventory/InventoryModuleView';
import { RecipesModuleView } from '@/src/modules/inventory/RecipesModuleView';
import { SuppliersPurchasingView } from '@/src/modules/inventory/SuppliersPurchasingView';
import { AttendancePayrollView } from '@/src/modules/employees/AttendancePayrollView';
import { FinanceModuleView } from '@/src/modules/finance/FinanceModuleView';
import { FinancialReportsView } from '@/src/modules/finance/FinancialReportsView';
import { CashReportsView } from '@/src/modules/cashier/CashReportsView';
import { useAuth } from '@/src/modules/authentication/AuthProvider';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';

type StaffSection =
  | 'permissions'
  | 'orders'
  | 'kitchen'
  | 'cashier'
  | 'cash_reports'
  | 'reservations'
  | 'inventory'
  | 'recipes'
  | 'suppliers'
  | 'payroll'
  | 'reports';

const STAFF_ROLES: RestaurantRoleCode[] = ['manager', 'cashier', 'server', 'cook'];

const PERMISSION_LABELS: Record<PermissionCode, string> = {
  'dashboard.view': 'Tableau de bord établissement',
  'menu.read': 'Lecture du menu',
  'menu.write': 'Modification du menu & tarifs',
  'orders.read': 'Consultation des commandes',
  'orders.create': 'Prise de commande en salle',
  'orders.kitchen': 'Suivi préparation cuisine',
  'payments.collect': 'Encaissement en caisse',
  'payments.confirm': 'Confirmation de paiement reçu',
  'payments.refund': 'Émission de remboursements',
  'cash.open': 'Ouverture de session de caisse',
  'cash.close': 'Clôture journalière de caisse',
  'cash.reports': 'Consultation des rapports de caisse',
  'cash.correct': 'Correction / annulation & ajustement clôture',
  'finance.view': 'Consultation finances & dépenses',
  'reservations.manage': 'Gestion des tables & réservations',
  'inventory.manage': 'Gestion des stocks & mouvements',
  'employees.manage': 'Gestion du personnel & présences',
  'payroll.manage': 'Calcul et paiement des salaires',
  'suppliers.manage': 'Fournisseurs & bons d’achat',
  'settings.customize': 'Personnalisation identité visuelle',
};

interface StaffWorkspaceProps {
  isPreviewMode?: boolean;
}

export function StaffWorkspace({ isPreviewMode = false }: StaffWorkspaceProps) {
  const { profile, membership, signOut } = useAuth();
  const { activeTenantId, restaurants } = useRestoStore();
  const [previewRole, setPreviewRole] = useState<RestaurantRoleCode>('manager');
  const [activeSection, setActiveSection] = useState<StaffSection>('permissions');

  const currentRestaurant =
    (!isPreviewMode && membership?.restaurant) ||
    restaurants.find((r) => r.id === activeTenantId) ||
    restaurants[0] ||
    null;

  const activeRole: RestaurantRoleCode =
    !isPreviewMode && membership?.roleCode ? membership.roleCode : previewRole;

  const actorDisplayName = profile?.full_name ?? ROLE_LABELS_FR[activeRole];

  const navItems: SidebarNavItem[] = [
    { id: 'permissions', label: 'Poste & Permissions', icon: <Shield className="h-4 w-4" /> },
    {
      id: 'orders',
      label: 'Commandes salle',
      icon: <ClipboardList className="h-4 w-4" />,
      disabled: !hasRolePermission(activeRole, 'orders.read'),
    },
    {
      id: 'kitchen',
      label: 'Écran cuisine',
      icon: <ChefHat className="h-4 w-4" />,
      disabled: !hasRolePermission(activeRole, 'orders.kitchen'),
    },
    {
      id: 'cashier',
      label: 'Caisse',
      icon: <CreditCard className="h-4 w-4" />,
      disabled: !hasRolePermission(activeRole, 'payments.collect'),
    },
    ...(hasRolePermission(activeRole, 'cash.reports')
      ? [{ id: 'cash_reports', label: 'Rapports de caisse', icon: <Receipt className="h-4 w-4" /> }]
      : []),
    {
      id: 'reservations',
      label: 'Salle & Réservations',
      icon: <CalendarClock className="h-4 w-4" />,
      disabled: !hasRolePermission(activeRole, 'reservations.manage'),
    },
    {
      id: 'inventory',
      label: 'Stocks',
      icon: <Boxes className="h-4 w-4" />,
      disabled: !hasRolePermission(activeRole, 'inventory.manage'),
    },
    ...(hasRolePermission(activeRole, 'orders.kitchen') && hasRolePermission(activeRole, 'inventory.manage')
      ? [{ id: 'recipes', label: 'Recettes', icon: <BookOpen className="h-4 w-4" /> }]
      : []),
    ...(hasRolePermission(activeRole, 'suppliers.manage')
      ? [{ id: 'suppliers', label: 'Fournisseurs & Achats', icon: <Truck className="h-4 w-4" /> }]
      : []),
    ...(hasRolePermission(activeRole, 'payroll.manage')
      ? [{ id: 'payroll', label: 'Présences & Paie', icon: <Users className="h-4 w-4" /> }]
      : []),
    ...(hasRolePermission(activeRole, 'finance.view')
      ? [{ id: 'reports', label: 'Rapports financiers', icon: <BarChart3 className="h-4 w-4" /> }]
      : []),
  ];

  if (!currentRestaurant) {
    return (
      <DashboardShellLayout
        spaceTitle="Espace Personnel"
        tenantName="Aucun établissement"
        tenantSubtitle={`Poste : ${ROLE_LABELS_FR[activeRole]}`}
        userDisplayName={actorDisplayName}
        userRoleLabel={ROLE_LABELS_FR[activeRole]}
        navItems={navItems}
        activeItemId={activeSection}
        onSelectNav={(id) => setActiveSection(id as StaffSection)}
        isPreviewMode={isPreviewMode}
        onSignOut={() => void signOut()}
      >
        <Card>
          <CardHeader>
            <CardTitle>Aucun restaurant configuré</CardTitle>
            <CardDescription>
              Créez un établissement depuis l&apos;espace Super Administrateur pour accéder aux postes opérationnels.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardShellLayout>
    );
  }

  return (
    <DashboardShellLayout
      spaceTitle="Espace Personnel"
      tenantName={currentRestaurant.name}
      tenantSubtitle={`Poste : ${ROLE_LABELS_FR[activeRole]}`}
      userDisplayName={actorDisplayName}
      userRoleLabel={ROLE_LABELS_FR[activeRole]}
      navItems={navItems}
      activeItemId={activeSection}
      onSelectNav={(id) => setActiveSection(id as StaffSection)}
      isPreviewMode={isPreviewMode}
      onSignOut={() => void signOut()}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[var(--rc-border)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
              Contrôle d&apos;accès opérationnel
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--rc-fg)]">
              Espace {ROLE_LABELS_FR[activeRole]}
            </h1>
            <p className="mt-1 text-sm text-[var(--rc-muted)]">
              Les droits ci-dessous sont appliqués dans l&apos;interface et vérifiés dans PostgreSQL RLS.
            </p>
          </div>

          {isPreviewMode && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
              {STAFF_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setPreviewRole(role);
                    setActiveSection('permissions');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    previewRole === role
                      ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                      : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                  }`}
                >
                  {ROLE_LABELS_FR[role]}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeSection === 'permissions' && (
          <Card>
            <CardHeader>
              <CardTitle>Matrice des permissions — {ROLE_LABELS_FR[activeRole]}</CardTitle>
              <CardDescription>
                Périmètre strict défini pour le rôle <code className="font-mono">{activeRole}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.keys(PERMISSION_LABELS) as PermissionCode[]).map((perm) => {
                  const granted = ROLE_PERMISSIONS_MAP[activeRole].includes(perm);
                  return (
                    <div
                      key={perm}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--rc-fg)] truncate">
                          {PERMISSION_LABELS[perm]}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--rc-muted)] truncate">{perm}</p>
                      </div>
                      <StatusLabel
                        label={granted ? 'Autorisé' : 'Restreint'}
                        tone={granted ? 'emerald' : 'neutral'}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'orders' && (
          <OrdersModuleView
            restaurantId={currentRestaurant.id}
            canCreate={hasRolePermission(activeRole, 'orders.create')}
          />
        )}
        {activeSection === 'kitchen' && (
          <OrdersModuleView restaurantId={currentRestaurant.id} kitchenOnly canCreate={false} />
        )}
        {activeSection === 'cashier' && (
          <FinanceModuleView
            restaurantId={currentRestaurant.id}
            cashierOnly={!hasRolePermission(activeRole, 'finance.view')}
            actorRole={activeRole}
            actorName={actorDisplayName}
          />
        )}
        {activeSection === 'cash_reports' &&
          hasRolePermission(activeRole, 'cash.reports') && (
            <CashReportsView restaurantId={currentRestaurant.id} />
          )}
        {activeSection === 'reservations' && (
          <ReservationsModuleView restaurantId={currentRestaurant.id} />
        )}
        {activeSection === 'inventory' && (
          <InventoryModuleView
            restaurantId={currentRestaurant.id}
            hideValuation={activeRole === 'cook'}
          />
        )}
        {activeSection === 'recipes' &&
          hasRolePermission(activeRole, 'orders.kitchen') && (
            <RecipesModuleView restaurantId={currentRestaurant.id} />
          )}
        {activeSection === 'suppliers' &&
          hasRolePermission(activeRole, 'suppliers.manage') && (
            <SuppliersPurchasingView restaurantId={currentRestaurant.id} />
          )}
        {activeSection === 'payroll' &&
          hasRolePermission(activeRole, 'payroll.manage') && (
            <AttendancePayrollView restaurantId={currentRestaurant.id} />
          )}
        {activeSection === 'reports' &&
          hasRolePermission(activeRole, 'finance.view') && (
            <FinancialReportsView restaurantId={currentRestaurant.id} />
          )}
      </div>
    </DashboardShellLayout>
  );
}
