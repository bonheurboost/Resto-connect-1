import { useState, type FormEvent } from 'react';
import {
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Receipt,
  FileCheck2,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { CommercialDocumentDialog } from './CommercialDocumentDialog';
import { MaintenanceContractsView } from './MaintenanceContractsView';
import { LICENSE_STATUS_META, LICENSE_TYPE_LABELS } from '@/src/lib/licensing/licenseRules';
import { formatMoney, generateLicenseKey } from '@/src/lib/domain/operations';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import type {
  CommercialDocumentRecord,
  CommercialDocumentType,
  CurrencyCode,
  LicenseStatus,
  LicenseType,
  PaymentRecord,
} from '@/src/lib/supabase/database.types';

export function LicensesManagementView() {
  const {
    restaurants,
    licenses,
    licenseHistory,
    payments,
    platformSettings,
    attributeLicense,
    updateLicenseStatus,
    generateCommercialDocument,
  } = useRestoStore();

  const [subTab, setSubTab] = useState<'licenses' | 'maintenance'>('licenses');

  const [selectedRestaurantId, setSelectedRestaurantId] = useState(restaurants[0]?.id ?? '');
  const [licenseType, setLicenseType] = useState<LicenseType>('perpetual_with_maintenance');
  const [amount, setAmount] = useState(String(platformSettings.standardLicensePriceUsd));
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [saleDate, setSaleDate] = useState('2026-11-25');
  const [businessClientName, setBusinessClientName] = useState('');
  const [businessClientContact, setBusinessClientContact] = useState('');
  const [businessClientPhone, setBusinessClientPhone] = useState('');
  const [businessClientEmail, setBusinessClientEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentRecord['payment_method']>('bank_transfer');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed'>('confirmed');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState('2027-12-31');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [docFeedback, setDocFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | LicenseStatus>('all');
  const [activeDoc, setActiveDoc] = useState<CommercialDocumentRecord | null>(null);

  const selectedRestaurant =
    restaurants.find((r) => r.id === selectedRestaurantId) ?? restaurants[0] ?? null;

  const previewKey = selectedRestaurant
    ? generateLicenseKey(selectedRestaurant.slug, licenses.length + 1)
    : 'RC-XXXX-2026-0001';

  const existingActiveForTarget = selectedRestaurant
    ? licenses.find((l) => l.restaurant_id === selectedRestaurant.id && l.status === 'active')
    : null;

  function handleAttribute(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!selectedRestaurant) return;

    const result = attributeLicense({
      restaurantId: selectedRestaurant.id,
      licenseType,
      amount: Number(amount) || 0,
      currency,
      paymentMethod,
      paymentStatus,
      paymentReference,
      paymentVerified,
      saleDate,
      businessClientName: businessClientName.trim() || selectedRestaurant.name,
      businessClientContact:
        businessClientContact.trim() || selectedRestaurant.owner_name || undefined,
      businessClientPhone: businessClientPhone.trim() || selectedRestaurant.phone || undefined,
      businessClientEmail: businessClientEmail.trim() || selectedRestaurant.email || undefined,
      maintenanceExpiresAt:
        licenseType === 'perpetual_with_maintenance' && maintenanceDate
          ? new Date(maintenanceDate).toISOString()
          : undefined,
      notes,
    });

    if (!result.ok) {
      setFeedback({ ok: false, text: result.error });
      return;
    }

    setPaymentReference('');
    setPaymentVerified(false);
    setBusinessClientName('');
    setBusinessClientContact('');
    setBusinessClientPhone('');
    setBusinessClientEmail('');
    setNotes('');
    setFeedback({
      ok: true,
      text: `Licence perpétuelle ${result.license.license_key} liée à ${selectedRestaurant.name} (${LICENSE_STATUS_META[result.license.status].label}).`,
    });
  }

  function handleGenerateDocument(
    docType: CommercialDocumentType,
    restaurantId: string,
    licenseId: string
  ) {
    setDocFeedback(null);
    const matchingPayment = payments.find(
      (p) => p.license_id === licenseId && p.status === 'confirmed'
    );
    const res = generateCommercialDocument({
      documentType: docType,
      restaurantId,
      licenseId,
      paymentId: docType === 'payment_receipt' ? matchingPayment?.id : undefined,
    });
    if (!res.ok) {
      setDocFeedback(res.error);
      return;
    }
    setActiveDoc(res.document);
  }

  const filteredLicenses =
    statusFilter === 'all' ? licenses : licenses.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Navigation interne Licences vs Contrats de maintenance */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
        <button
          type="button"
          onClick={() => setSubTab('licenses')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer ${
            subTab === 'licenses'
              ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
              : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Licences perpétuelles ({licenses.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('maintenance')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer ${
            subTab === 'maintenance'
              ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
              : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
          }`}
        >
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Contrats de maintenance (optionnels)</span>
        </button>
      </div>

      {subTab === 'maintenance' ? (
        <MaintenanceContractsView />
      ) : (
        <>
          {/* Offres commerciales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Offre A · Licence perpétuelle standard</CardTitle>
                <CardDescription>Paiement unique · Utilisation sans expiration</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-[var(--rc-muted)] space-y-1.5">
                <p>• Accès complet aux modules opérationnels du restaurant.</p>
                <p>• Aucune expiration automatique — gérée exclusivement par le Super Administrateur.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Offre B · Licence perpétuelle + maintenance optionnelle
                </CardTitle>
                <CardDescription>Paiement unique + contrat de maintenance séparé</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-[var(--rc-muted)] space-y-1.5">
                <p>• Licence d&apos;exploitation perpétuelle liée au restaurant.</p>
                <p>• L&apos;échéance de la maintenance n&apos;affecte jamais la validité perpétuelle de la licence.</p>
              </CardContent>
            </Card>
          </div>

          {/* Processus d'attribution en 8 étapes + Coordonnées client professionnel */}
          <Card>
            <CardHeader>
              <CardTitle>Processus guidé d&apos;attribution de licence commerciale</CardTitle>
              <CardDescription>
                Contrôle exclusif Super Administrateur. Enregistre la date de vente, le client professionnel et les
                justificatifs pour la génération de documents officiels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAttribute} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="lic-restaurant">1. Sélectionner le restaurant</Label>
                    <select
                      id="lic-restaurant"
                      value={selectedRestaurantId}
                      onChange={(e) => setSelectedRestaurantId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      {restaurants.length === 0 ? (
                        <option value="">Aucun restaurant enregistré</option>
                      ) : (
                        restaurants.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.city})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-type">2. Type de licence</Label>
                    <select
                      id="lic-type"
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value as LicenseType)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="perpetual">{LICENSE_TYPE_LABELS.perpetual}</option>
                      <option value="perpetual_with_maintenance">
                        {LICENSE_TYPE_LABELS.perpetual_with_maintenance}
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-sale-date">3. Date de vente *</Label>
                    <Input
                      id="lic-sale-date"
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-amount">4. Prix de vente</Label>
                    <Input
                      id="lic-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-currency">Devise</Label>
                    <select
                      id="lic-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="USD">USD (Dollar américain)</option>
                      <option value="CDF">CDF (Franc congolais)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-pay-method">5a. Mode de paiement</Label>
                    <select
                      id="lic-pay-method"
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value as PaymentRecord['payment_method'])
                      }
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="bank_transfer">Virement bancaire</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="cash">Espèces</option>
                      <option value="card">Carte</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-pay-status">5b. Statut du paiement</Label>
                    <select
                      id="lic-pay-status"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as 'pending' | 'confirmed')}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                    >
                      <option value="confirmed">Confirmé (activer immédiatement)</option>
                      <option value="pending">En attente (licence en attente)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lic-pay-ref">5c. Référence justificative</Label>
                    <Input
                      id="lic-pay-ref"
                      placeholder="Référence justificative"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>

                  {licenseType === 'perpetual_with_maintenance' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="lic-expiry">Échéance maintenance indicative</Label>
                      <Input
                        id="lic-expiry"
                        type="date"
                        value={maintenanceDate}
                        onChange={(e) => setMaintenanceDate(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>6. Clé sécurisée générée</Label>
                    <div className="flex h-10 items-center rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] px-3 font-mono text-xs text-[var(--rc-gold-text)]">
                      {previewKey}
                    </div>
                  </div>
                </div>

                {/* Coordonnées du client professionnel / acquéreur */}
                <div className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--rc-fg)]">
                    Client professionnel / Entité acquéreuse (pour factures &amp; confirmations)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="lic-client-name" className="text-xs">Raison sociale / Client</Label>
                      <Input
                        id="lic-client-name"
                        placeholder={selectedRestaurant?.name ?? 'Nom société'}
                        value={businessClientName}
                        onChange={(e) => setBusinessClientName(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lic-client-contact" className="text-xs">Nom du signataire</Label>
                      <Input
                        id="lic-client-contact"
                        placeholder={selectedRestaurant?.owner_name ?? 'Représentant'}
                        value={businessClientContact}
                        onChange={(e) => setBusinessClientContact(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lic-client-phone" className="text-xs">Téléphone client</Label>
                      <Input
                        id="lic-client-phone"
                        placeholder={selectedRestaurant?.phone ?? '+243 ...'}
                        value={businessClientPhone}
                        onChange={(e) => setBusinessClientPhone(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lic-client-email" className="text-xs">E-mail facturation</Label>
                      <Input
                        id="lic-client-email"
                        type="email"
                        placeholder={selectedRestaurant?.email ?? 'contact@...'}
                        value={businessClientEmail}
                        onChange={(e) => setBusinessClientEmail(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lic-notes">Notes contractuelles (optionnel)</Label>
                  <Input
                    id="lic-notes"
                    placeholder="Conditions particulières, durée d'assistance..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {existingActiveForTarget && (
                  <div className="flex items-start gap-2.5 rounded-md border border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] p-3 text-xs text-[var(--rc-danger-fg)]">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Ce restaurant détient déjà une licence active ({existingActiveForTarget.license_key}).
                      Suspendez ou révoquez la licence actuelle avant d&apos;en attribuer une nouvelle.
                    </span>
                  </div>
                )}

                {paymentStatus === 'confirmed' && (
                  <label className="flex items-start gap-2.5 rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-3 text-xs text-[var(--rc-fg)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentVerified}
                      onChange={(e) => setPaymentVerified(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--rc-gold)]"
                    />
                    <span>
                      <strong>7. Confirmation réelle du paiement :</strong> je certifie avoir vérifié la réception
                      effective des fonds avant l&apos;activation définitive et la liaison permanente (étape 8).
                    </span>
                  </label>
                )}

                {feedback && (
                  <p
                    className={`text-xs font-medium ${
                      feedback.ok ? 'text-[var(--rc-gold-text)]' : 'text-[var(--rc-danger-fg)]'
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}

                <Button type="submit" disabled={Boolean(existingActiveForTarget)}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Attribuer et lier la licence perpétuelle</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Registre des licences + Génération des documents officiels */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Registre des licences délivrées ({filteredLicenses.length})</CardTitle>
                <CardDescription>
                  Gouvernance des statuts et édition de documents officiels (confirmation, facture, reçu).
                </CardDescription>
              </div>
              <select
                aria-label="Filtrer les licences par statut"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | LicenseStatus)}
                className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs text-[var(--rc-fg)]"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actives</option>
                <option value="pending">En attente</option>
                <option value="suspended">Suspendues</option>
                <option value="revoked">Révoquées</option>
              </select>
            </CardHeader>
            <CardContent className="space-y-3">
              {docFeedback && (
                <div className="rounded-md border border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] px-3 py-2 text-xs text-[var(--rc-danger-fg)]">
                  {docFeedback}
                </div>
              )}

              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3 whitespace-nowrap">Clé</th>
                      <th className="px-4 py-3 whitespace-nowrap">Restaurant / Client</th>
                      <th className="px-4 py-3 whitespace-nowrap">Vente</th>
                      <th className="px-4 py-3 whitespace-nowrap">Montant</th>
                      <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                      <th className="px-4 py-3 whitespace-nowrap">Documents officiels</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">Gouvernance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {filteredLicenses.map((lic) => {
                      const rest = restaurants.find((r) => r.id === lic.restaurant_id);
                      const meta = LICENSE_STATUS_META[lic.status];
                      const hasConfirmedPay = payments.some(
                        (p) => p.license_id === lic.id && p.status === 'confirmed'
                      );
                      return (
                        <tr key={lic.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-[var(--rc-fg)] whitespace-nowrap">
                            <p>{lic.license_key}</p>
                            <p className="text-[11px] text-[var(--rc-muted)] font-sans">
                              {LICENSE_TYPE_LABELS[lic.license_type]}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            <p className="font-medium text-[var(--rc-fg)]">{rest?.name ?? lic.restaurant_id}</p>
                            <p className="text-[var(--rc-muted)]">
                              {lic.business_client_name ?? rest?.owner_name ?? '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                            {lic.sale_date ?? lic.activated_at?.slice(0, 10) ?? '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap tabular-nums">
                            {formatMoney(lic.amount, lic.currency)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusLabel label={meta.label} tone={meta.tone} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleGenerateDocument(
                                    'license_confirmation',
                                    lic.restaurant_id,
                                    lic.id
                                  )
                                }
                              >
                                <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Confirmation</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleGenerateDocument('sale_invoice', lic.restaurant_id, lic.id)
                                }
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Facture</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                title={
                                  hasConfirmedPay
                                    ? 'Générer le reçu officiel'
                                    : 'Exige un paiement confirmé'
                                }
                                onClick={() =>
                                  handleGenerateDocument('payment_receipt', lic.restaurant_id, lic.id)
                                }
                              >
                                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Reçu</span>
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <select
                              aria-label={`Statut de la licence ${lic.license_key}`}
                              value={lic.status}
                              onChange={(e) =>
                                updateLicenseStatus(lic.id, e.target.value as LicenseStatus)
                              }
                              className="h-8 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2 text-xs text-[var(--rc-fg)]"
                            >
                              <option value="pending">En attente</option>
                              <option value="active">Active</option>
                              <option value="suspended">Suspendue</option>
                              <option value="revoked">Révoquée</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Historique des statuts de licence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Historique des changements de statut des licences</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Restaurant</th>
                      <th className="px-4 py-2.5">Transition</th>
                      <th className="px-4 py-2.5">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {licenseHistory.map((h) => {
                      const rest = restaurants.find((r) => r.id === h.restaurant_id);
                      return (
                        <tr key={h.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-2.5 font-mono text-[var(--rc-muted)] whitespace-nowrap">
                            {h.created_at.replace('T', ' ').slice(0, 16)}
                          </td>
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {rest?.name ?? h.restaurant_id}
                          </td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                            {h.previous_status ?? 'création'} → {h.new_status}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--rc-muted)]">{h.reason ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <CommercialDocumentDialog document={activeDoc} onClose={() => setActiveDoc(null)} />
    </div>
  );
}
