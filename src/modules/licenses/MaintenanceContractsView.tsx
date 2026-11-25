import { useState, type FormEvent } from 'react';
import { FileText, ShieldCheck, Wrench, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { CommercialDocumentDialog } from './CommercialDocumentDialog';
import { formatMoney } from '@/src/lib/domain/operations';
import { isMaintenanceContractActive } from '@/src/lib/licensing/licenseRules';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import type {
  CommercialDocumentRecord,
  CurrencyCode,
  MaintenanceContractStatus,
  MaintenancePaymentRecord,
} from '@/src/lib/supabase/database.types';

const MAINTENANCE_STATUS_META: Record<
  MaintenanceContractStatus,
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  pending: { label: 'En attente', tone: 'amber' },
  active: { label: 'Maintenance active', tone: 'emerald' },
  expired: { label: 'Échue (licence active)', tone: 'neutral' },
  cancelled: { label: 'Résiliée (licence active)', tone: 'crimson' },
};

export function MaintenanceContractsView() {
  const {
    restaurants,
    licenses,
    maintenanceContracts,
    maintenancePayments,
    platformSettings,
    createMaintenanceContract,
    updateMaintenanceContractStatus,
    recordMaintenancePayment,
    generateCommercialDocument,
  } = useRestoStore();

  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? '');
  const matchingLicenses = licenses.filter((l) => l.restaurant_id === restaurantId);
  const [licenseId, setLicenseId] = useState(matchingLicenses[0]?.id ?? licenses[0]?.id ?? '');
  const [durationMonths, setDurationMonths] = useState('12');
  const [priceAmount, setPriceAmount] = useState(String(platformSettings.maintenanceAnnualPriceUsd));
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [includedServices, setIncludedServices] = useState(
    'Assistance technique prioritaire, mises à jour correctives et évolutives, suivi sauvegardes.'
  );
  const [startDate, setStartDate] = useState('2026-11-25');
  const [endDate, setEndDate] = useState('2027-11-25');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Payment for an existing maintenance contract
  const [payContractId, setPayContractId] = useState(maintenanceContracts[0]?.id ?? '');
  const [payAmount, setPayAmount] = useState(String(platformSettings.maintenanceAnnualPriceUsd));
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>('USD');
  const [payMethod, setPayMethod] =
    useState<MaintenancePaymentRecord['payment_method']>('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [activeDoc, setActiveDoc] = useState<CommercialDocumentRecord | null>(null);

  function handleRestaurantChange(nextRestId: string) {
    setRestaurantId(nextRestId);
    const firstLic = licenses.find((l) => l.restaurant_id === nextRestId);
    setLicenseId(firstLic?.id ?? '');
  }

  function handleCreateContract(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const targetLic =
      matchingLicenses.find((l) => l.id === licenseId) ?? matchingLicenses[0];
    if (!targetLic) {
      setFeedback({
        ok: false,
        text: "Ce restaurant ne possède aucune licence attribuée pour y rattacher une maintenance.",
      });
      return;
    }
    const res = createMaintenanceContract({
      restaurantId,
      licenseId: targetLic.id,
      durationMonths: Number(durationMonths) || 12,
      priceAmount: Number(priceAmount) || 0,
      currency,
      includedServices,
      startDate,
      endDate,
      notes,
    });
    if (!res.ok) {
      setFeedback({ ok: false, text: res.error });
      return;
    }
    setPayContractId(res.contract.id);
    setNotes('');
    setFeedback({
      ok: true,
      text: `Contrat ${res.contract.contract_number} créé. La licence reste perpétuelle indépendamment de la maintenance.`,
    });
  }

  function handleRecordMaintenancePayment(e: FormEvent) {
    e.preventDefault();
    setPayMsg(null);
    const targetContract =
      maintenanceContracts.find((c) => c.id === payContractId) ?? maintenanceContracts[0];
    if (!targetContract) {
      setPayMsg({ ok: false, text: 'Aucun contrat de maintenance disponible.' });
      return;
    }
    const res = recordMaintenancePayment({
      restaurantId: targetContract.restaurant_id,
      contractId: targetContract.id,
      amount: Number(payAmount) || 0,
      currency: payCurrency,
      paymentMethod: payMethod,
      referenceCode: payRef,
      adminComment: `Règlement maintenance ${targetContract.contract_number}`,
    });
    if (!res.ok) {
      setPayMsg({ ok: false, text: res.error });
      return;
    }
    setPayRef('');
    setPayMsg({ ok: true, text: `Paiement de maintenance enregistré (${res.payment.reference_code}).` });
  }

  function handleOpenContractDoc(contractId: string, restId: string, licId: string) {
    const res = generateCommercialDocument({
      documentType: 'maintenance_contract',
      restaurantId: restId,
      licenseId: licId,
      maintenanceContractId: contractId,
    });
    if (!res.ok) {
      setFeedback({ ok: false, text: res.error });
      return;
    }
    setActiveDoc(res.document);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--rc-gold)]/35 bg-[var(--rc-gold-tint)] p-4 flex items-start gap-3 text-xs text-[var(--rc-fg)]">
        <ShieldCheck className="h-5 w-5 text-[var(--rc-gold)] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-[var(--rc-gold-text)]">
            Garantie de licence perpétuelle dissociée de la maintenance
          </p>
          <p className="text-[var(--rc-muted)]">
            Les contrats de maintenance sont strictement optionnels. Lorsqu&apos;un contrat expire ou est résilié,
            la licence perpétuelle du restaurant demeure <strong>active sans limitation de durée</strong> (seule une
            suspension ou révocation manuelle du Super Administrateur peut bloquer l&apos;accès).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
              <span>Créer un contrat de maintenance optionnel</span>
            </CardTitle>
            <CardDescription>
              Rattaché à une licence existante : durée, tarif, prestations incluses et période de couverture.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateContract} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-rest">Restaurant</Label>
                  <select
                    id="mnt-rest"
                    value={restaurantId}
                    onChange={(e) => handleRestaurantChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
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
                  <Label htmlFor="mnt-lic">Licence associée</Label>
                  <select
                    id="mnt-lic"
                    value={licenseId}
                    onChange={(e) => setLicenseId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                  >
                    {matchingLicenses.length === 0 ? (
                      <option value="">Aucune licence sur ce restaurant</option>
                    ) : (
                      matchingLicenses.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.license_key} ({l.status})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-duration">Durée (mois)</Label>
                  <Input
                    id="mnt-duration"
                    type="number"
                    min="1"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mnt-price">Tarif</Label>
                    <Input
                      id="mnt-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mnt-curr">Devise</Label>
                    <select
                      id="mnt-curr"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-start">Date de début</Label>
                  <Input
                    id="mnt-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mnt-end">Date de fin</Label>
                  <Input
                    id="mnt-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mnt-services">Services inclus</Label>
                <Input
                  id="mnt-services"
                  value={includedServices}
                  onChange={(e) => setIncludedServices(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mnt-notes">Notes contractuelles</Label>
                <Input
                  id="mnt-notes"
                  placeholder="Conditions de renouvellement facultatif..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {feedback && (
                <p className={`text-xs font-medium ${feedback.ok ? 'text-[var(--rc-gold-text)]' : 'text-[var(--rc-danger-fg)]'}`}>
                  {feedback.text}
                </p>
              )}

              <Button type="submit" size="sm">
                Enregistrer le contrat de maintenance
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
              <span>Encaisser un paiement de maintenance</span>
            </CardTitle>
            <CardDescription>
              Suivi séparé de la vente initiale de licence perpétuelle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordMaintenancePayment} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mpay-contract">Contrat concerné</Label>
                <select
                  id="mpay-contract"
                  value={payContractId}
                  onChange={(e) => setPayContractId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  {maintenanceContracts.length === 0 ? (
                    <option value="">Aucun contrat enregistré</option>
                  ) : (
                    maintenanceContracts.map((c) => {
                      const r = restaurants.find((rest) => rest.id === c.restaurant_id);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.contract_number} · {r?.name ?? c.restaurant_id}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mpay-amt">Montant</Label>
                  <Input
                    id="mpay-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mpay-curr">Devise</Label>
                  <select
                    id="mpay-curr"
                    value={payCurrency}
                    onChange={(e) => setPayCurrency(e.target.value as CurrencyCode)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpay-method">Mode de paiement</Label>
                <select
                  id="mpay-method"
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(e.target.value as MaintenancePaymentRecord['payment_method'])
                  }
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Espèces</option>
                  <option value="card">Carte bancaire</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpay-ref">Référence justificative *</Label>
                <Input
                  id="mpay-ref"
                  placeholder="Référence justificative"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  required
                />
              </div>

              {payMsg && (
                <p className={`text-xs font-medium ${payMsg.ok ? 'text-[var(--rc-gold-text)]' : 'text-[var(--rc-danger-fg)]'}`}>
                  {payMsg.text}
                </p>
              )}

              <Button type="submit" size="sm" variant="outline" className="w-full">
                Confirmer le paiement de maintenance
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Registre des contrats */}
      <Card>
        <CardHeader>
          <CardTitle>Contrats de maintenance enregistrés ({maintenanceContracts.length})</CardTitle>
          <CardDescription>
            Gérez les échéances et éditez les contrats officiels. La fin d&apos;un contrat n&apos;affecte jamais la licence perpétuelle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3 whitespace-nowrap">Contrat</th>
                  <th className="px-4 py-3 whitespace-nowrap">Restaurant / Licence</th>
                  <th className="px-4 py-3 whitespace-nowrap">Période</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tarif</th>
                  <th className="px-4 py-3 whitespace-nowrap">Maintenance</th>
                  <th className="px-4 py-3 whitespace-nowrap">Licence liée</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions &amp; Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {maintenanceContracts.map((contract) => {
                  const rest = restaurants.find((r) => r.id === contract.restaurant_id);
                  const lic = licenses.find((l) => l.id === contract.license_id);
                  const meta = MAINTENANCE_STATUS_META[contract.status];
                  const activeNow = isMaintenanceContractActive(contract);
                  return (
                    <tr key={contract.id} className="hover:bg-[var(--rc-card-elevated)]">
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--rc-fg)] whitespace-nowrap">
                        {contract.contract_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-[var(--rc-fg)]">{rest?.name ?? contract.restaurant_id}</p>
                        <p className="font-mono text-[11px] text-[var(--rc-muted)]">{lic?.license_key ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--rc-muted)] whitespace-nowrap">
                        {contract.start_date} → {contract.end_date} ({contract.duration_months}m)
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap tabular-nums">
                        {formatMoney(contract.price_amount, contract.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusLabel
                          label={activeNow ? 'Couverture active' : meta.label}
                          tone={activeNow ? 'emerald' : meta.tone}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusLabel
                          label={lic?.status === 'active' ? 'Licence perpétuelle active' : lic?.status ?? '—'}
                          tone={lic?.status === 'active' ? 'emerald' : 'amber'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <select
                            aria-label={`Statut du contrat ${contract.contract_number}`}
                            value={contract.status}
                            onChange={(e) =>
                              updateMaintenanceContractStatus(
                                contract.id,
                                e.target.value as MaintenanceContractStatus
                              )
                            }
                            className="h-8 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2 text-xs text-[var(--rc-fg)]"
                          >
                            <option value="pending">En attente</option>
                            <option value="active">Active</option>
                            <option value="expired">Échue</option>
                            <option value="cancelled">Résiliée</option>
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenContractDoc(
                                contract.id,
                                contract.restaurant_id,
                                contract.license_id
                              )
                            }
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Contrat</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {maintenancePayments.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-[var(--rc-fg)] mb-2">
                Règlements de maintenance enregistrés ({maintenancePayments.length})
              </p>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-[var(--rc-muted)]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Référence</th>
                      <th className="px-3 py-2">Contrat</th>
                      <th className="px-3 py-2">Méthode</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {maintenancePayments.map((mp) => {
                      const c = maintenanceContracts.find((mc) => mc.id === mp.contract_id);
                      return (
                        <tr key={mp.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-3 py-2 font-mono text-[var(--rc-muted)] whitespace-nowrap">
                            {(mp.paid_at ?? mp.created_at).slice(0, 10)}
                          </td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{mp.reference_code}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            {c?.contract_number ?? mp.contract_id}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{mp.payment_method}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatMoney(mp.amount, mp.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CommercialDocumentDialog document={activeDoc} onClose={() => setActiveDoc(null)} />
    </div>
  );
}
