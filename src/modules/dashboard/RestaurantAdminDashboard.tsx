import { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Store,
  Palette,
  Users,
  Shield,
  SlidersHorizontal,
  KeyRound,
  UtensilsCrossed,
  ClipboardList,
  CalendarClock,
  Boxes,
  Wallet,
  UserCheck,
  BookOpen,
  Truck,
  CalendarCheck,
  BarChart3,
  Receipt,
  Coins,
  ShoppingBag,
  Layers,
  Activity,
} from 'lucide-react';
import {
  DashboardShellLayout,
  type SidebarNavItem,
  type TopbarNotificationItem,
  type TopbarSearchResult,
} from '@/src/components/layout/DashboardShellLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import {
  HorizontalBarChart,
  TrendAreaChart,
  VerticalColumnChart,
} from '@/src/components/charts/SimpleCharts';
import { MenuModuleView } from '@/src/modules/menu/MenuModuleView';
import { OrdersModuleView } from '@/src/modules/orders/OrdersModuleView';
import { ReservationsModuleView } from '@/src/modules/reservations/ReservationsModuleView';
import { InventoryModuleView } from '@/src/modules/inventory/InventoryModuleView';
import { RecipesModuleView } from '@/src/modules/inventory/RecipesModuleView';
import { SuppliersPurchasingView } from '@/src/modules/inventory/SuppliersPurchasingView';
import { FinanceModuleView } from '@/src/modules/finance/FinanceModuleView';
import { FinancialReportsView } from '@/src/modules/finance/FinancialReportsView';
import { CashReportsView } from '@/src/modules/cashier/CashReportsView';
import { EmployeesModuleView } from '@/src/modules/employees/EmployeesModuleView';
import { AttendancePayrollView } from '@/src/modules/employees/AttendancePayrollView';
import { RolesPermissionsView } from '@/src/modules/employees/RolesPermissionsView';
import { CustomersModuleView } from '@/src/modules/customers/CustomersModuleView';
import { SettingsModuleView } from '@/src/modules/settings/SettingsModuleView';
import { TenantLicenseView } from '@/src/modules/licenses/TenantLicenseView';
import { useAuth } from '@/src/modules/authentication/AuthProvider';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import { computeRestaurantMetrics, type PeriodFilter } from '@/src/lib/domain/analytics';
import { computeStockValuation, evaluateInventoryAlerts } from '@/src/lib/domain/erp';

type AdminSection =
  | 'dashboard'
  | 'profile'
  | 'customization'
  | 'employees'
  | 'attendance_payroll'
  | 'roles'
  | 'settings'
  | 'license'
  | 'menu'
  | 'orders'
  | 'reservations'
  | 'inventory'
  | 'recipes'
  | 'suppliers'
  | 'finance'
  | 'cash_reports'
  | 'reports'
  | 'customers';

const ADMIN_NAV: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Exploitation' },
  { id: 'orders', label: 'Commandes', icon: <ClipboardList className="h-4 w-4" />, group: 'Exploitation' },
  { id: 'menu', label: 'Menus & Plats', icon: <UtensilsCrossed className="h-4 w-4" />, group: 'Exploitation' },
  { id: 'reservations', label: 'Réservations', icon: <CalendarClock className="h-4 w-4" />, group: 'Exploitation' },
  { id: 'customers', label: 'Clients', icon: <UserCheck className="h-4 w-4" />, group: 'Exploitation' },
  { id: 'finance', label: 'Caisse & Paiements', icon: <Wallet className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'cash_reports', label: 'Rapports de caisse', icon: <Receipt className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'reports', label: 'Finances & Dépenses', icon: <BarChart3 className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'inventory', label: 'Stocks & Inventaire', icon: <Boxes className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'recipes', label: 'Recettes & Coûts', icon: <BookOpen className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'suppliers', label: 'Fournisseurs & Achats', icon: <Truck className="h-4 w-4" />, group: 'Finances & Stocks' },
  { id: 'employees', label: 'Personnel', icon: <Users className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'attendance_payroll', label: 'Présences & Paie', icon: <CalendarCheck className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'roles', label: 'Rôles & Permissions', icon: <Shield className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'customization', label: 'Personnalisation', icon: <Palette className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'profile', label: 'Mon restaurant', icon: <Store className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'settings', label: 'Paramètres', icon: <SlidersHorizontal className="h-4 w-4" />, group: 'Équipe & Configuration' },
  { id: 'license', label: 'Ma licence', icon: <KeyRound className="h-4 w-4" />, group: 'Équipe & Configuration' },
];

const PERIOD_LABELS: Array<{ key: PeriodFilter; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Période personnalisée' },
];

interface RestaurantAdminDashboardProps {
  isPreviewMode?: boolean;
}

export function RestaurantAdminDashboard({ isPreviewMode = false }: RestaurantAdminDashboardProps) {
  const { profile, membership, signOut } = useAuth();
  const {
    activeTenantId,
    setActiveTenantId,
    restaurants,
    licenses,
    categories,
    orders,
    orderItems,
    products,
    reservations,
    customers,
    payments,
    expenses,
    ingredients,
    employees,
    attendanceRecords,
    cashRegisters,
    cashSessions,
    notifications,
    markNotificationRead,
  } = useRestoStore();

  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState('2026-11-01');
  const [customEnd, setCustomEnd] = useState('2026-12-31');
  const [globalSearch, setGlobalSearch] = useState('');

  const currentRestaurant =
    (!isPreviewMode && membership?.restaurant) ||
    restaurants.find((r) => r.id === activeTenantId) ||
    restaurants[0] ||
    null;

  const tenantId = currentRestaurant?.id ?? '';
  const tenantLicense =
    licenses.find((l) => l.restaurant_id === tenantId && l.status === 'active') ??
    licenses.find((l) => l.restaurant_id === tenantId);

  const metrics = useMemo(
    () =>
      currentRestaurant
        ? computeRestaurantMetrics({
            restaurant: currentRestaurant,
            orders,
            orderItems,
            products,
            reservations,
            customers,
            payments,
            expenses,
            period,
            customStart,
            customEnd,
          })
        : null,
    [
      currentRestaurant,
      orders,
      orderItems,
      products,
      reservations,
      customers,
      payments,
      expenses,
      period,
      customStart,
      customEnd,
    ]
  );

  const stockAlerts = useMemo(
    () => evaluateInventoryAlerts(ingredients, tenantId),
    [ingredients, tenantId]
  );

  const stockValuation = useMemo(
    () =>
      currentRestaurant
        ? computeStockValuation(
            ingredients,
            tenantId,
            currentRestaurant.default_currency,
            currentRestaurant.exchange_rate_usd_cdf
          )
        : 0,
    [ingredients, tenantId, currentRestaurant]
  );

  const popularCategories = useMemo(() => {
    const tenantCats = categories.filter((c) => c.restaurant_id === tenantId && c.is_active);
    const tenantOrderIds = new Set(
      orders.filter((o) => o.restaurant_id === tenantId && o.status !== 'cancelled').map((o) => o.id)
    );
    const countByCat = new Map<string, number>();
    for (const oi of orderItems) {
      if (!tenantOrderIds.has(oi.order_id)) continue;
      const prod = products.find((p) => p.id === oi.product_id);
      if (!prod) continue;
      countByCat.set(prod.category_id, (countByCat.get(prod.category_id) ?? 0) + oi.quantity);
    }
    return tenantCats
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        dishesCount: products.filter((p) => p.restaurant_id === tenantId && p.category_id === cat.id).length,
        orderedQty: countByCat.get(cat.id) ?? 0,
      }))
      .sort((a, b) => b.orderedQty - a.orderedQty)
      .slice(0, 4);
  }, [categories, orders, orderItems, products, tenantId]);

  const tenantEmployees = useMemo(
    () => employees.filter((e) => e.restaurant_id === tenantId),
    [employees, tenantId]
  );

  const recentAttendance = useMemo(
    () =>
      attendanceRecords
        .filter((a) => a.restaurant_id === tenantId)
        .slice(0, 4),
    [attendanceRecords, tenantId]
  );

  const tenantCashSessions = useMemo(
    () => cashSessions.filter((s) => s.restaurant_id === tenantId),
    [cashSessions, tenantId]
  );
  const openCashSession = tenantCashSessions.find((s) => s.status === 'open');
  const openRegister = openCashSession
    ? cashRegisters.find((r) => r.id === openCashSession.cash_register_id)
    : undefined;

  const tenantNotifications = notifications.filter((n) => n.restaurant_id === tenantId);
  const unreadNotifications = tenantNotifications.filter((n) => !n.is_read);

  const topbarNotifications: TopbarNotificationItem[] = tenantNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at,
    onRead: () => markNotificationRead(n.id),
  }));

  const searchResults: TopbarSearchResult[] = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: TopbarSearchResult[] = [];
    for (const o of orders) {
      if (o.restaurant_id !== tenantId) continue;
      if (
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name ?? '').toLowerCase().includes(q)
      ) {
        results.push({
          id: `ord-${o.id}`,
          title: `Commande ${o.order_number}`,
          subtitle: `${o.customer_name ?? 'Client salle'} · ${formatMoney(o.total_amount, o.currency)}`,
          onSelect: () => {
            setActiveSection('orders');
            setGlobalSearch('');
          },
        });
      }
    }
    for (const p of products) {
      if (p.restaurant_id !== tenantId) continue;
      if (p.name.toLowerCase().includes(q)) {
        results.push({
          id: `prod-${p.id}`,
          title: p.name,
          subtitle: `Plat · ${formatMoney(p.price_amount, p.currency)}`,
          onSelect: () => {
            setActiveSection('menu');
            setGlobalSearch('');
          },
        });
      }
    }
    for (const c of customers) {
      if (c.restaurant_id !== tenantId) continue;
      if (c.full_name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)) {
        results.push({
          id: `cust-${c.id}`,
          title: c.full_name,
          subtitle: `Client · ${c.phone ?? '—'}`,
          onSelect: () => {
            setActiveSection('customers');
            setGlobalSearch('');
          },
        });
      }
    }
    return results;
  }, [globalSearch, orders, products, customers, tenantId]);

  if (!currentRestaurant || !metrics) {
    return (
      <DashboardShellLayout
        spaceTitle="Espace Administrateur Restaurant"
        tenantName="Aucun établissement"
        tenantSubtitle="En attente de création"
        userDisplayName={profile?.full_name ?? 'Propriétaire'}
        userRoleLabel="Administrateur du restaurant"
        navItems={ADMIN_NAV}
        activeItemId={activeSection}
        onSelectNav={(id) => setActiveSection(id as AdminSection)}
        isPreviewMode={isPreviewMode}
        onSignOut={() => void signOut()}
      >
        <Card>
          <CardHeader>
            <CardTitle>Aucun restaurant disponible</CardTitle>
            <CardDescription>
              Créez d&apos;abord un établissement depuis l&apos;espace Super Administrateur pour accéder à sa gestion.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardShellLayout>
    );
  }

  return (
    <DashboardShellLayout
      spaceTitle="Espace Administrateur Restaurant"
      tenantName={currentRestaurant.name}
      tenantSubtitle={`${currentRestaurant.city} · ${currentRestaurant.default_currency}`}
      userDisplayName={profile?.full_name ?? currentRestaurant.owner_name ?? 'Propriétaire'}
      userRoleLabel="Administrateur du restaurant"
      navItems={ADMIN_NAV}
      activeItemId={activeSection}
      onSelectNav={(id) => setActiveSection(id as AdminSection)}
      isPreviewMode={isPreviewMode}
      onSignOut={() => void signOut()}
      searchQuery={globalSearch}
      onSearchChange={setGlobalSearch}
      searchPlaceholder="Chercher commande, plat, client..."
      searchResults={searchResults}
      notifications={topbarNotifications}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[var(--rc-border)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
              Espace isolé par établissement
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--rc-fg)]">
              {ADMIN_NAV.find((n) => n.id === activeSection)?.label}
            </h1>
            <p className="mt-1 text-sm text-[var(--rc-muted)]">
              Établissement actif : <span className="font-medium text-[var(--rc-fg)]">{currentRestaurant.name}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isPreviewMode && restaurants.length > 1 && (
              <select
                aria-label="Choisir l'établissement actif"
                value={tenantId}
                onChange={(e) => setActiveTenantId(e.target.value)}
                className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs font-medium text-[var(--rc-fg)]"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.city})
                  </option>
                ))}
              </select>
            )}
            {stockAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSection('inventory')}
                className="rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] px-2.5 py-1 text-xs font-medium text-[var(--rc-warn-fg)] cursor-pointer"
              >
                {stockAlerts.length} alerte(s) stock
              </button>
            )}
            <StatusLabel
              label={
                tenantLicense?.status === 'active'
                  ? 'Licence active'
                  : tenantLicense?.status === 'suspended'
                    ? 'Licence suspendue'
                    : 'Licence en attente'
              }
              tone={
                tenantLicense?.status === 'active'
                  ? 'emerald'
                  : tenantLicense?.status === 'suspended'
                    ? 'crimson'
                    : 'amber'
              }
            />
          </div>
        </div>

        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            {unreadNotifications.length > 0 && (
              <Card className="border-[var(--rc-gold)]/40 bg-[var(--rc-gold-tint)]">
                <CardContent className="pt-4 space-y-2 text-xs">
                  <p className="font-semibold text-[var(--rc-gold-text)]">
                    Notifications récentes ({unreadNotifications.length})
                  </p>
                  {unreadNotifications.slice(0, 3).map((n) => (
                    <div key={n.id} className="flex items-center justify-between gap-2 text-[var(--rc-fg)]">
                      <span>
                        <strong>{n.title}</strong> — {n.message}
                      </span>
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="underline text-[var(--rc-gold-text)] shrink-0 cursor-pointer"
                      >
                        Marquer lu
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Filtres de période */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-3">
              <div className="flex flex-wrap gap-1.5">
                {PERIOD_LABELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPeriod(item.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      period === item.key
                        ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                        : 'bg-[var(--rc-surface-muted)] text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <Input
                    type="date"
                    aria-label="Date de début"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                  <span className="text-[var(--rc-muted)]">→</span>
                  <Input
                    type="date"
                    aria-label="Date de fin"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                </div>
              )}
            </div>

            {/* 8 KPIs réels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>Chiffre d&apos;affaires</CardDescription>
                    <CardTitle className="font-mono text-2xl tabular-nums mt-1">
                      {formatMoney(metrics.revenueAmount, metrics.currency)}
                    </CardTitle>
                  </div>
                  <span className="h-9 w-9 rounded-lg bg-[var(--rc-gold-tint)] text-[var(--rc-gold)] flex items-center justify-center shrink-0">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">Encaissements confirmés</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>Commandes actives</CardDescription>
                    <CardTitle className="font-mono text-2xl tabular-nums mt-1">
                      {metrics.ordersCount}
                    </CardTitle>
                  </div>
                  <span className="h-9 w-9 rounded-lg bg-[var(--rc-surface-muted)] text-[var(--rc-fg)] flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">
                    Attente {metrics.pendingOrders} · Prépa {metrics.preparingOrders} · Clôturées {metrics.completedOrders}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>Réservations</CardDescription>
                    <CardTitle className="font-mono text-2xl tabular-nums mt-1">
                      {metrics.reservationsCount}
                    </CardTitle>
                  </div>
                  <span className="h-9 w-9 rounded-lg bg-[var(--rc-surface-muted)] text-[var(--rc-fg)] flex items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">
                    Clients enregistrés : <span className="font-mono text-[var(--rc-fg)]">{metrics.customersCount}</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardDescription>Valeur du stock</CardDescription>
                    <CardTitle className="font-mono text-2xl tabular-nums mt-1">
                      {formatMoney(stockValuation, currentRestaurant.default_currency)}
                    </CardTitle>
                  </div>
                  <span className="h-9 w-9 rounded-lg bg-[var(--rc-surface-muted)] text-[var(--rc-gold)] flex items-center justify-center shrink-0">
                    <Boxes className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {stockAlerts.length > 0 ? `${stockAlerts.length} alerte(s) seuil` : 'Niveaux nominaux'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>En attente / Préparation</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {metrics.pendingOrders} / {metrics.preparingOrders}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">Flux cuisine temps réel</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Commandes terminées</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">{metrics.completedOrders}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">Servies, livrées ou clôturées</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Dépenses de la période</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {formatMoney(metrics.expensesAmount, metrics.currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">Charges actives validées</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Résultat net estimé</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-gold-text)]">
                    {formatMoney(metrics.revenueAmount - metrics.expensesAmount, metrics.currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">Recettes − Dépenses</p>
                </CardContent>
              </Card>
            </div>

            {/* 4 Graphiques réels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendAreaChart
                title="Évolution des ventes"
                subtitle="Encaissements confirmés par jour"
                data={metrics.salesTimelineSeries}
                valueFormatter={(v) => formatMoney(v, metrics.currency)}
              />
              <VerticalColumnChart
                title="Commandes par statut"
                subtitle="En attente, préparation et terminées"
                data={metrics.ordersByStatusSeries}
              />
              <HorizontalBarChart
                title="Top produits commandés"
                subtitle="Quantités commandées sur la période"
                data={metrics.topProductsSeries}
              />
              <HorizontalBarChart
                title="Répartition des paiements"
                subtitle="Par méthode d'encaissement"
                data={metrics.paymentMethodsSeries}
                valueFormatter={(v) => formatMoney(v, metrics.currency)}
              />
            </div>

            {/* Synthèse : Catégories populaires, Activité employés & Aperçu Caisse */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Catégories populaires</CardTitle>
                    <CardDescription>Volumes servis par famille de carte</CardDescription>
                  </div>
                  <Layers className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {popularCategories.length === 0 ? (
                    <p className="text-[var(--rc-muted)]">Aucune catégorie active configurée.</p>
                  ) : (
                    popularCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-[var(--rc-fg)]">{cat.name}</p>
                          <p className="text-[11px] text-[var(--rc-muted)]">{cat.dishesCount} plat(s) actifs</p>
                        </div>
                        <span className="font-mono font-semibold text-[var(--rc-gold-text)] tabular-nums">
                          {cat.orderedQty} cmd
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Activité du personnel</CardTitle>
                    <CardDescription>{tenantEmployees.length} collaborateur(s) rattaché(s)</CardDescription>
                  </div>
                  <Activity className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {recentAttendance.length === 0 ? (
                    <p className="text-[var(--rc-muted)]">Aucun pointage récent enregistré.</p>
                  ) : (
                    recentAttendance.map((att) => {
                      const emp = tenantEmployees.find((e) => e.id === att.employee_id);
                      return (
                        <div
                          key={att.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--rc-fg)] truncate">
                              {emp?.full_name ?? att.employee_id}
                            </p>
                            <p className="text-[11px] text-[var(--rc-muted)]">
                              {att.attendance_date} · {att.status}
                            </p>
                          </div>
                          <StatusLabel
                            label={att.check_out_at ? 'Terminé' : 'En poste'}
                            tone={att.check_out_at ? 'neutral' : 'emerald'}
                          />
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Aperçu de la caisse</CardTitle>
                    <CardDescription>Session et flux en cours</CardDescription>
                  </div>
                  <Wallet className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {openCashSession ? (
                    <div className="rounded-lg border border-[var(--rc-gold)]/40 bg-[var(--rc-gold-tint)] p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--rc-fg)]">
                          {openRegister?.name ?? 'Caisse principale'}
                        </span>
                        <StatusLabel label="Ouverte" tone="emerald" />
                      </div>
                      <p className="text-[var(--rc-muted)]">
                        Ouverture :{' '}
                        <span className="font-mono text-[var(--rc-fg)]">
                          {formatMoney(openCashSession.opening_amount_usd, 'USD')}
                        </span>{' '}
                        / <span className="font-mono text-[var(--rc-fg)]">{formatMoney(openCashSession.opening_amount_cdf, 'CDF')}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3">
                      <p className="text-[var(--rc-muted)]">Aucune session de caisse ouverte actuellement.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveSection('finance')}
                    className="w-full rounded-lg border border-[var(--rc-border-strong)] bg-[var(--rc-card)] py-2 text-xs font-medium text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] cursor-pointer"
                  >
                    Ouvrir le module Caisse &amp; Paiements →
                  </button>
                </CardContent>
              </Card>
            </div>

            <OrdersModuleView restaurantId={tenantId} />
          </div>
        )}

        {activeSection === 'profile' && <SettingsModuleView restaurantId={tenantId} mode="profile" />}
        {activeSection === 'customization' && <SettingsModuleView restaurantId={tenantId} mode="customization" />}
        {activeSection === 'employees' && <EmployeesModuleView restaurantId={tenantId} />}
        {activeSection === 'attendance_payroll' && <AttendancePayrollView restaurantId={tenantId} />}
        {activeSection === 'roles' && <RolesPermissionsView restaurantId={tenantId} />}
        {activeSection === 'settings' && <SettingsModuleView restaurantId={tenantId} mode="settings" />}
        {activeSection === 'license' && <TenantLicenseView restaurantId={tenantId} />}

        {activeSection === 'menu' && <MenuModuleView restaurantId={tenantId} />}
        {activeSection === 'orders' && <OrdersModuleView restaurantId={tenantId} />}
        {activeSection === 'reservations' && <ReservationsModuleView restaurantId={tenantId} />}
        {activeSection === 'inventory' && <InventoryModuleView restaurantId={tenantId} />}
        {activeSection === 'recipes' && <RecipesModuleView restaurantId={tenantId} />}
        {activeSection === 'suppliers' && <SuppliersPurchasingView restaurantId={tenantId} />}
        {activeSection === 'finance' && (
          <FinanceModuleView
            restaurantId={tenantId}
            actorRole="restaurant_admin"
            actorName={profile?.full_name ?? currentRestaurant.owner_name ?? 'Admin Restaurant'}
          />
        )}
        {activeSection === 'cash_reports' && <CashReportsView restaurantId={tenantId} />}
        {activeSection === 'reports' && <FinancialReportsView restaurantId={tenantId} />}
        {activeSection === 'customers' && <CustomersModuleView restaurantId={tenantId} />}
      </div>
    </DashboardShellLayout>
  );
}
