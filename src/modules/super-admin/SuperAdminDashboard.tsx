import { useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  KeyRound,
  Users,
  CreditCard,
  BarChart3,
  ShieldCheck,
  LayoutDashboard,
  History,
  Settings,
  Check,
  XCircle,
  RotateCcw,
  MessageSquare,
  Receipt,
  Wrench,
  Upload,
} from 'lucide-react';
import {
  DashboardShellLayout,
  type SidebarNavItem,
  type TopbarSearchResult,
} from '@/src/components/layout/DashboardShellLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import {
  HorizontalBarChart,
  TrendAreaChart,
  VerticalColumnChart,
} from '@/src/components/charts/SimpleCharts';
import { RestaurantsRegistryView } from '@/src/modules/restaurants/RestaurantsRegistryView';
import { LicensesManagementView } from '@/src/modules/licenses/LicensesManagementView';
import { MaintenanceContractsView } from '@/src/modules/licenses/MaintenanceContractsView';
import { CommercialDocumentDialog } from '@/src/modules/licenses/CommercialDocumentDialog';
import { useAuth } from '@/src/modules/authentication/AuthProvider';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { ROLE_LABELS_FR } from '@/src/lib/auth/rbac';
import { formatMoney } from '@/src/lib/domain/operations';
import { computeSuperAdminMetrics } from '@/src/lib/domain/analytics';
import { readImageFileAsDataUrl } from '@/src/lib/media/imageUpload';
import type {
  CommercialDocumentRecord,
  CommercialInquiryRecord,
  CurrencyCode,
  PaymentRecord,
  RestaurantRoleCode,
} from '@/src/lib/supabase/database.types';

type SuperAdminSection =
  | 'overview'
  | 'restaurants'
  | 'licenses'
  | 'maintenance'
  | 'payments'
  | 'inquiries'
  | 'users'
  | 'statistics'
  | 'audit'
  | 'settings';

const NAV_ITEMS: SidebarNavItem[] = [
  { id: 'overview', label: 'Vue générale', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Gouvernance' },
  { id: 'restaurants', label: 'Restaurants', icon: <Building2 className="h-4 w-4" />, group: 'Gouvernance' },
  { id: 'licenses', label: 'Licences', icon: <KeyRound className="h-4 w-4" />, group: 'Commercial & Contrats' },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" />, group: 'Commercial & Contrats' },
  { id: 'payments', label: 'Paiements', icon: <CreditCard className="h-4 w-4" />, group: 'Commercial & Contrats' },
  { id: 'inquiries', label: 'Demandes commerciales', icon: <MessageSquare className="h-4 w-4" />, group: 'Commercial & Contrats' },
  { id: 'users', label: 'Utilisateurs', icon: <Users className="h-4 w-4" />, group: 'Système & Sécurité' },
  { id: 'statistics', label: 'Rapports / Statistiques', icon: <BarChart3 className="h-4 w-4" />, group: 'Système & Sécurité' },
  { id: 'audit', label: "Journal d'activité", icon: <History className="h-4 w-4" />, group: 'Système & Sécurité' },
  { id: 'settings', label: 'Paramètres globaux', icon: <Settings className="h-4 w-4" />, group: 'Système & Sécurité' },
];

const PAYMENT_STATUS_META: Record<
  PaymentRecord['status'],
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  pending: { label: 'En attente', tone: 'amber' },
  confirmed: { label: 'Confirmé', tone: 'emerald' },
  rejected: { label: 'Rejeté', tone: 'crimson' },
  failed: { label: 'Échoué', tone: 'crimson' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

interface SuperAdminDashboardProps {
  isPreviewMode?: boolean;
}

export function SuperAdminDashboard({ isPreviewMode = false }: SuperAdminDashboardProps) {
  const { profile, signOut } = useAuth();
  const {
    restaurants,
    licenses,
    members,
    payments,
    commercialInquiries,
    auditLogs,
    userActivityLogs,
    platformSettings,
    recordLicensePayment,
    verifyCommercialPayment,
    createOwnerAccountInvitation,
    toggleMemberStatus,
    requestAccessReset,
    updatePlatformSettings,
    updateCommercialInquiryStatus,
    generateCommercialDocument,
  } = useRestoStore();

  const [activeSection, setActiveSection] = useState<SuperAdminSection>('overview');
  const [activeDoc, setActiveDoc] = useState<CommercialDocumentRecord | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  // Paiements state
  const [payLicenseId, setPayLicenseId] = useState(licenses[0]?.id ?? '');
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>('USD');
  const [payMethod, setPayMethod] = useState<PaymentRecord['payment_method']>('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payInitialStatus, setPayInitialStatus] = useState<'pending' | 'confirmed'>('pending');
  const [payVerified, setPayVerified] = useState(false);
  const [payComment, setPayComment] = useState('');
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [payFilter, setPayFilter] = useState<'all' | PaymentRecord['status']>('all');
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  // Utilisateurs state
  const [inviteRestId, setInviteRestId] = useState(restaurants[0]?.id ?? '');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RestaurantRoleCode>('restaurant_admin');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  // Audit filter
  const [auditSearch, setAuditSearch] = useState('');

  // Platform settings
  const [platSaved, setPlatSaved] = useState(false);
  const [platDraft, setPlatDraft] = useState(platformSettings);

  const metrics = useMemo(
    () => computeSuperAdminMetrics(restaurants, licenses, payments),
    [restaurants, licenses, payments]
  );

  const licensePayments = useMemo(() => {
    const base = payments.filter((p) => p.payment_scope === 'license');
    return payFilter === 'all' ? base : base.filter((p) => p.status === payFilter);
  }, [payments, payFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entity_table.toLowerCase().includes(q) ||
        JSON.stringify(l.new_data ?? {}).toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const searchResults: TopbarSearchResult[] = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: TopbarSearchResult[] = [];
    for (const r of restaurants) {
      if (r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)) {
        results.push({
          id: `rest-${r.id}`,
          title: r.name,
          subtitle: `Restaurant · ${r.city} (${r.status})`,
          onSelect: () => {
            setActiveSection('restaurants');
            setGlobalSearch('');
          },
        });
      }
    }
    for (const l of licenses) {
      if (l.license_key.toLowerCase().includes(q)) {
        results.push({
          id: `lic-${l.id}`,
          title: l.license_key,
          subtitle: `Licence · ${l.status}`,
          onSelect: () => {
            setActiveSection('licenses');
            setGlobalSearch('');
          },
        });
      }
    }
    for (const inq of commercialInquiries) {
      if (inq.restaurant_name.toLowerCase().includes(q) || inq.full_name.toLowerCase().includes(q)) {
        results.push({
          id: `inq-${inq.id}`,
          title: inq.restaurant_name,
          subtitle: `Demande · ${inq.full_name}`,
          onSelect: () => {
            setActiveSection('inquiries');
            setGlobalSearch('');
          },
        });
      }
    }
    return results;
  }, [globalSearch, restaurants, licenses, commercialInquiries]);

  function handleRecordLicensePayment(e: FormEvent) {
    e.preventDefault();
    setPayMessage(null);
    const lic = licenses.find((l) => l.id === payLicenseId) ?? licenses[0];
    if (!lic) return;

    const result = recordLicensePayment({
      restaurantId: lic.restaurant_id,
      licenseId: lic.id,
      amount: Number(payAmount),
      currency: payCurrency,
      paymentMethod: payMethod,
      referenceCode: payRef,
      initialStatus: payInitialStatus,
      verifiedConfirmed: payVerified,
      adminComment: payComment,
    });
    if (!result.ok) {
      setPayMessage(result.error);
      return;
    }
    setPayAmount('');
    setPayRef('');
    setPayComment('');
    setPayVerified(false);
    setPayMessage('Règlement enregistré dans le registre commercial.');
  }

  function handleCreateOwnerInvite(e: FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    const targetRest = inviteRestId || restaurants[0]?.id;
    if (!targetRest) return;
    const res = createOwnerAccountInvitation({
      restaurantId: targetRest,
      fullName: inviteName,
      email: inviteEmail,
      roleCode: inviteRole,
    });
    if (!res.ok) {
      setInviteMsg(res.error);
      return;
    }
    setInviteName('');
    setInviteEmail('');
    setInviteMsg(`Invitation créée avec succès. Code sécurisé : ${res.invitationCode}`);
  }

  function handleSavePlatformSettings(e: FormEvent) {
    e.preventDefault();
    updatePlatformSettings(platDraft);
    setPlatSaved(true);
    setTimeout(() => setPlatSaved(false), 2500);
  }

  return (
    <DashboardShellLayout
      spaceTitle="Espace Super Administrateur"
      tenantName="RestoConnect Plateforme"
      tenantSubtitle="Contrôle global & licences"
      userDisplayName={profile?.full_name ?? 'Propriétaire RestoConnect'}
      userRoleLabel="Super Administrateur"
      navItems={NAV_ITEMS}
      activeItemId={activeSection}
      onSelectNav={(id) => setActiveSection(id as SuperAdminSection)}
      isPreviewMode={isPreviewMode}
      onSignOut={() => void signOut()}
      searchQuery={globalSearch}
      onSearchChange={setGlobalSearch}
      searchPlaceholder="Chercher restaurant, licence..."
      searchResults={searchResults}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[var(--rc-border)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
              Gouvernance centrale RestoConnect
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--rc-fg)]">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
            </h1>
            <p className="mt-1 text-sm text-[var(--rc-muted)]">
              Pilotage global des restaurants, licences perpétuelles, paiements vérifiés et sécurité multi-tenant.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--rc-gold-text)] font-semibold">
            <ShieldCheck className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
            <span>Contrôle exclusif Super Admin</span>
          </div>
        </div>

        {(activeSection === 'overview' || activeSection === 'statistics') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total restaurants</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {metrics.totalRestaurants}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">
                    Nouveaux (30j) : <span className="font-mono text-[var(--rc-fg)]">{metrics.newRestaurants30d}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Actifs / Suspendus</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {metrics.activeRestaurants} / {metrics.suspendedRestaurants}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusLabel
                    label={`${metrics.activeRestaurants} ouverts · ${metrics.suspendedRestaurants} bloqués`}
                    tone={metrics.suspendedRestaurants > 0 ? 'amber' : 'emerald'}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Licences vendues / actives</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {metrics.totalLicensesSold} / {metrics.activeLicenses}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--rc-muted)]">
                    Révoquées : <span className="font-mono text-[var(--rc-fg)]">{metrics.revokedLicenses}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>CA licences confirmé</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-gold-text)]">
                    {formatMoney(metrics.confirmedLicenseRevenueUsd, 'USD')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-mono text-[var(--rc-muted)] tabular-nums">
                    + {formatMoney(metrics.confirmedLicenseRevenueCdf, 'CDF')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendAreaChart
                title="Évolution des ventes de licences"
                subtitle="Volume mensuel issu des licences émises"
                data={metrics.licenseSalesByMonthSeries}
              />
              <HorizontalBarChart
                title="Répartition des restaurants par ville"
                subtitle="Établissements enregistrés en RDC"
                data={metrics.restaurantsByCitySeries}
              />
              <VerticalColumnChart
                title="Répartition des licences par statut"
                subtitle="Actives, en attente, suspendues et révoquées"
                data={metrics.licenseStatusSeries}
              />
              <HorizontalBarChart
                title="Évolution des revenus par méthode"
                subtitle="Paiements commerciaux confirmés uniquement"
                data={metrics.revenueByMethodSeries}
                emptyMessage="Aucun paiement de licence confirmé pour le moment."
              />
            </div>

            {activeSection === 'overview' && (
              <Card>
                <CardHeader>
                  <CardTitle>Dernières opérations administratives</CardTitle>
                  <CardDescription>
                    Journal en direct des créations, attributions et vérifications effectuées.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] font-semibold text-[var(--rc-muted)]">
                          <th className="px-4 py-2.5">Horodatage</th>
                          <th className="px-4 py-2.5">Action</th>
                          <th className="px-4 py-2.5">Table</th>
                          <th className="px-4 py-2.5">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rc-border)]">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-[var(--rc-muted)]">
                              Aucune opération administrative enregistrée dans cette session.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.slice(0, 6).map((log) => (
                            <tr key={log.id} className="hover:bg-[var(--rc-card-elevated)]">
                              <td className="px-4 py-2.5 font-mono text-[var(--rc-muted)] whitespace-nowrap">
                                {log.created_at.replace('T', ' ').slice(0, 19)}
                              </td>
                              <td className="px-4 py-2.5 font-mono font-medium text-[var(--rc-gold-text)] whitespace-nowrap">
                                {log.action}
                              </td>
                              <td className="px-4 py-2.5 font-mono whitespace-nowrap">{log.entity_table}</td>
                              <td className="px-4 py-2.5 font-mono text-[var(--rc-muted)]">
                                {JSON.stringify(log.new_data)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeSection === 'restaurants' && <RestaurantsRegistryView />}

        {activeSection === 'licenses' && <LicensesManagementView />}

        {activeSection === 'maintenance' && <MaintenanceContractsView />}

        {activeSection === 'payments' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Enregistrer un paiement commercial de licence</CardTitle>
                <CardDescription>
                  Espèces, Mobile Money, Virement bancaire ou Carte. Aucune simulation de paiement : chaque confirmation exige une vérification manuelle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecordLicensePayment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-lic">Licence concernée</Label>
                      <select
                        id="pay-lic"
                        value={payLicenseId}
                        onChange={(e) => setPayLicenseId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                      >
                        {licenses.length === 0 ? (
                          <option value="">Aucune licence enregistrée</option>
                        ) : (
                          licenses.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.license_key} ({l.status})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-amount">Montant</Label>
                      <Input
                        id="pay-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-curr">Devise</Label>
                      <select
                        id="pay-curr"
                        value={payCurrency}
                        onChange={(e) => setPayCurrency(e.target.value as CurrencyCode)}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                      >
                        <option value="USD">USD</option>
                        <option value="CDF">CDF</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-method">Méthode de paiement</Label>
                      <select
                        id="pay-method"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as PaymentRecord['payment_method'])}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                      >
                        <option value="bank_transfer">Virement bancaire</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="cash">Espèces</option>
                        <option value="card">Carte</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-ref">Référence reçu / bordereau *</Label>
                      <Input
                        id="pay-ref"
                        placeholder="REC-2026-01"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-init-status">Statut initial</Label>
                      <select
                        id="pay-init-status"
                        value={payInitialStatus}
                        onChange={(e) => setPayInitialStatus(e.target.value as 'pending' | 'confirmed')}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                      >
                        <option value="pending">En attente de validation</option>
                        <option value="confirmed">Confirmé après vérification</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pay-comment">Commentaire administratif</Label>
                    <Input
                      id="pay-comment"
                      placeholder="Référence ou commentaire de vérification"
                      value={payComment}
                      onChange={(e) => setPayComment(e.target.value)}
                    />
                  </div>

                  {payInitialStatus === 'confirmed' && (
                    <label className="flex items-start gap-2.5 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payVerified}
                        onChange={(e) => setPayVerified(e.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        Je confirme avoir vérifié la preuve réelle de paiement avant comptabilisation.
                      </span>
                    </label>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[var(--rc-gold-text)] font-medium">{payMessage ?? ''}</span>
                    <Button type="submit" size="sm">
                      Enregistrer l&apos;opération
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Registre des paiements de licences</CardTitle>
                  <CardDescription>
                    Validez, rejetez ou remboursez les règlements en attente avec commentaire obligatoire.
                  </CardDescription>
                </div>
                <select
                  aria-label="Filtrer les paiements par statut"
                  value={payFilter}
                  onChange={(e) => setPayFilter(e.target.value as 'all' | PaymentRecord['status'])}
                  className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs text-[var(--rc-fg)]"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmés</option>
                  <option value="rejected">Rejetés</option>
                  <option value="refunded">Remboursés</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] text-xs font-semibold text-[var(--rc-muted)]">
                        <th className="px-4 py-3">Référence</th>
                        <th className="px-4 py-3">Restaurant</th>
                        <th className="px-4 py-3">Méthode</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3">Commentaire / Vérification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rc-border)]">
                      {licensePayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                            Aucun paiement de licence enregistré.
                          </td>
                        </tr>
                      ) : (
                        licensePayments.map((p) => {
                          const rest = restaurants.find((r) => r.id === p.restaurant_id);
                          const meta = PAYMENT_STATUS_META[p.status];
                          const commentVal = reviewComments[p.id] ?? p.admin_comment ?? '';
                          return (
                            <tr key={p.id} className="hover:bg-[var(--rc-card-elevated)]">
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                {p.reference_code}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {rest?.name ?? p.restaurant_id}
                              </td>
                              <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                                {p.payment_method}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {formatMoney(p.amount, p.currency)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusLabel label={meta.label} tone={meta.tone} />
                              </td>
                              <td className="px-4 py-3 space-y-2 min-w-[260px]">
                                <Input
                                  aria-label={`Commentaire administratif pour ${p.reference_code}`}
                                  placeholder="Commentaire vérification..."
                                  value={commentVal}
                                  onChange={(e) =>
                                    setReviewComments((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                                {p.status === 'pending' && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        verifyCommercialPayment({
                                          paymentId: p.id,
                                          nextStatus: 'confirmed',
                                          adminComment: commentVal || 'Vérifié par Super Admin',
                                          verifiedConfirmed: true,
                                        })
                                      }
                                    >
                                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Confirmer</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        verifyCommercialPayment({
                                          paymentId: p.id,
                                          nextStatus: 'rejected',
                                          adminComment: commentVal || 'Justificatif non conforme',
                                          verifiedConfirmed: false,
                                        })
                                      }
                                    >
                                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Rejeter</span>
                                    </Button>
                                  </div>
                                )}
                                {p.status === 'confirmed' && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const res = generateCommercialDocument({
                                          documentType: 'payment_receipt',
                                          restaurantId: p.restaurant_id,
                                          licenseId: p.license_id ?? undefined,
                                          paymentId: p.id,
                                        });
                                        if (res.ok) setActiveDoc(res.document);
                                      }}
                                    >
                                      <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Reçu officiel</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        verifyCommercialPayment({
                                          paymentId: p.id,
                                          nextStatus: 'refunded',
                                          adminComment: commentVal || 'Remboursement validé',
                                          verifiedConfirmed: false,
                                        })
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Rembourser</span>
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'inquiries' && (
          <Card>
            <CardHeader>
              <CardTitle>Demandes commerciales &amp; Démonstrations ({commercialInquiries.length})</CardTitle>
              <CardDescription>
                Prospects enregistrés depuis la vitrine publique RestoConnect (/contact).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Contact &amp; Restaurant</th>
                      <th className="px-4 py-3 whitespace-nowrap">Coordonnées</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">Suivi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {commercialInquiries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--rc-muted)]">
                          Aucune demande commerciale enregistrée pour le moment.
                        </td>
                      </tr>
                    ) : (
                      commercialInquiries.map((inq) => (
                        <tr key={inq.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-[var(--rc-muted)] whitespace-nowrap">
                            {inq.created_at.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-semibold text-[var(--rc-fg)]">{inq.restaurant_name}</p>
                            <p className="text-[var(--rc-muted)]">
                              {inq.full_name} · {inq.city}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-mono">{inq.phone}</p>
                            <p className="text-[var(--rc-muted)]">{inq.email}</p>
                          </td>
                          <td className="px-4 py-3 max-w-md text-[var(--rc-fg)]">{inq.message}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <select
                              aria-label={`Statut prospect ${inq.restaurant_name}`}
                              value={inq.status}
                              onChange={(e) =>
                                updateCommercialInquiryStatus(
                                  inq.id,
                                  e.target.value as CommercialInquiryRecord['status']
                                )
                              }
                              className="h-8 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2 text-xs text-[var(--rc-fg)]"
                            >
                              <option value="new">Nouvelle</option>
                              <option value="contacted">Contactée</option>
                              <option value="qualified">Qualifiée</option>
                              <option value="closed">Clôturée</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'users' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Créer un accès Administrateur / Propriétaire d&apos;établissement</CardTitle>
                <CardDescription>
                  Aucun mot de passe en clair. L&apos;invitation génère un code d&apos;enrôlement contrôlé ; l&apos;escalade vers Super Administrateur est bloquée par PostgreSQL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOwnerInvite} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-rest">Établissement</Label>
                    <select
                      id="inv-rest"
                      value={inviteRestId}
                      onChange={(e) => setInviteRestId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      {restaurants.length === 0 ? (
                        <option value="">Aucun restaurant enregistré</option>
                      ) : (
                        restaurants.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-name">Nom complet</Label>
                    <Input
                      id="inv-name"
                      placeholder="Nom du responsable"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-email">E-mail professionnel</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      placeholder="email@exemple.cd"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-role">Rôle attribué</Label>
                    <select
                      id="inv-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as RestaurantRoleCode)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="restaurant_admin">Administrateur du restaurant</option>
                      <option value="manager">Gestionnaire</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-[var(--rc-gold-text)]">{inviteMsg ?? ''}</span>
                    <Button type="submit" size="sm">
                      Générer l&apos;accès propriétaire
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comptes utilisateurs &amp; Contrôle des accès ({members.length})</CardTitle>
                <CardDescription>
                  Suspendez un compte ou déclenchez une réinitialisation sécurisée via Supabase Auth.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] text-xs font-semibold text-[var(--rc-muted)]">
                        <th className="px-4 py-3 whitespace-nowrap">Nom</th>
                        <th className="px-4 py-3 whitespace-nowrap">E-mail</th>
                        <th className="px-4 py-3 whitespace-nowrap">Établissement</th>
                        <th className="px-4 py-3 whitespace-nowrap">Rôle</th>
                        <th className="px-4 py-3 whitespace-nowrap">Code invitation</th>
                        <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rc-border)]">
                      {members.map((m) => {
                        const rest = restaurants.find((r) => r.id === m.restaurant_id);
                        return (
                          <tr key={m.id} className="hover:bg-[var(--rc-card-elevated)]">
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{m.full_name}</td>
                            <td className="px-4 py-3 text-[var(--rc-muted)] whitespace-nowrap">{m.email}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{rest?.name ?? m.restaurant_id}</td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">{ROLE_LABELS_FR[m.role_code]}</td>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{m.invitation_code}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusLabel
                                label={
                                  m.status === 'active'
                                    ? 'Actif'
                                    : m.status === 'suspended'
                                      ? 'Suspendu'
                                      : 'Invité'
                                }
                                tone={
                                  m.status === 'active'
                                    ? 'emerald'
                                    : m.status === 'suspended'
                                      ? 'crimson'
                                      : 'amber'
                                }
                              />
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => requestAccessReset(m.id)}
                              >
                                Réinit. accès
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => toggleMemberStatus(m.id)}
                              >
                                {m.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activité récente des comptes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {userActivityLogs.slice(0, 8).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-4 border-b border-[var(--rc-border)] pb-2 last:border-b-0"
                    >
                      <span>
                        <strong>{u.actor_name}</strong> — {u.action}
                      </span>
                      <span className="font-mono text-[var(--rc-muted)] whitespace-nowrap">
                        {u.created_at.replace('T', ' ').slice(0, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'audit' && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Historique des activités &amp; Journal d&apos;audit immuable</CardTitle>
                <CardDescription>
                  Protégé contre toute modification ou suppression côté PostgreSQL (`audit_logs` append-only).
                </CardDescription>
              </div>
              <Input
                aria-label="Filtrer le journal d'audit"
                placeholder="Filtrer par action ou table..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="sm:w-64"
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Horodatage</th>
                      <th className="px-4 py-3">Acteur</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                          Aucune action administrative journalisée dans cette session. Effectuez une opération pour observer la traçabilité en direct.
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                            {log.created_at.replace('T', ' ').slice(0, 19)}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {log.actor_label ?? 'Super Administrateur'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-[var(--rc-gold-text)] whitespace-nowrap">
                            {log.action}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{log.entity_table}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)]">
                            {JSON.stringify(log.new_data)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Apparence &amp; Thème de la plateforme</CardTitle>
                <CardDescription>
                  Basculez instantanément entre le mode sombre (principal), le mode clair ou la détection automatique du système.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeToggle variant="detailed" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Paramètres globaux de la plateforme {platformSettings.platformName}</CardTitle>
                <CardDescription>
                  Identité commerciale publique, coordonnées, tarifs indicatifs et configuration par défaut en RDC.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePlatformSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-name">Nom de la plateforme</Label>
                    <Input
                      id="plat-name"
                      value={platDraft.platformName}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, platformName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-tagline">Slogan commercial</Label>
                    <Input
                      id="plat-tagline"
                      value={platDraft.tagline}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, tagline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-logo">Logo plateforme (URL ou fichier)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="plat-logo"
                        placeholder="https://... ou importer un fichier"
                        value={platDraft.logoUrl ?? ''}
                        onChange={(e) =>
                          setPlatDraft((d) => ({ ...d, logoUrl: e.target.value.trim() || null }))
                        }
                      />
                      <label className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs font-medium text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] cursor-pointer shrink-0">
                        <Upload className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                        <span>Importer</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            try {
                              const dataUrl = await readImageFileAsDataUrl(file);
                              setPlatDraft((d) => ({ ...d, logoUrl: dataUrl }));
                            } catch {
                              // Ignore invalid file errors silently or handled via form
                            }
                            ev.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-support">E-mail commercial</Label>
                    <Input
                      id="plat-support"
                      type="email"
                      value={platDraft.supportEmail}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, supportEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-phone">Téléphone commercial</Label>
                    <Input
                      id="plat-phone"
                      value={platDraft.commercialPhone}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, commercialPhone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-whatsapp">WhatsApp commercial</Label>
                    <Input
                      id="plat-whatsapp"
                      value={platDraft.commercialWhatsapp}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, commercialWhatsapp: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="plat-address">Adresse du siège</Label>
                    <Input
                      id="plat-address"
                      value={platDraft.commercialAddress}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, commercialAddress: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-tz">Fuseau horaire par défaut</Label>
                    <Input
                      id="plat-tz"
                      value={platDraft.defaultTimezone}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, defaultTimezone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-curr">Devise de référence</Label>
                    <select
                      id="plat-curr"
                      value={platDraft.referenceCurrency}
                      onChange={(e) =>
                        setPlatDraft((d) => ({ ...d, referenceCurrency: e.target.value as CurrencyCode }))
                      }
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-rate">Taux de référence USD / CDF</Label>
                    <Input
                      id="plat-rate"
                      type="number"
                      value={platDraft.defaultUsdCdfRate}
                      onChange={(e) =>
                        setPlatDraft((d) => ({ ...d, defaultUsdCdfRate: Number(e.target.value) || 2850 }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="plat-lic-price">Tarif licence perpétuelle (USD)</Label>
                      <Input
                        id="plat-lic-price"
                        type="number"
                        min="0"
                        value={platDraft.standardLicensePriceUsd}
                        onChange={(e) =>
                          setPlatDraft((d) => ({
                            ...d,
                            standardLicensePriceUsd: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="plat-mnt-price">Tarif maintenance / an (USD)</Label>
                      <Input
                        id="plat-mnt-price"
                        type="number"
                        min="0"
                        value={platDraft.maintenanceAnnualPriceUsd}
                        onChange={(e) =>
                          setPlatDraft((d) => ({
                            ...d,
                            maintenanceAnnualPriceUsd: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="plat-terms">Conditions commerciales affichées sur les documents</Label>
                    <textarea
                      id="plat-terms"
                      rows={2}
                      value={platDraft.commercialTerms}
                      onChange={(e) => setPlatDraft((d) => ({ ...d, commercialTerms: e.target.value }))}
                      className="flex w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3.5 py-2 text-sm text-[var(--rc-fg)]"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between pt-2">
                    <span className="text-xs font-medium text-[var(--rc-gold-text)]">
                      {platSaved ? 'Paramètres globaux enregistrés.' : ''}
                    </span>
                    <Button type="submit" size="sm">
                      Enregistrer les paramètres globaux
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <CommercialDocumentDialog document={activeDoc} onClose={() => setActiveDoc(null)} />
    </DashboardShellLayout>
  );
}
