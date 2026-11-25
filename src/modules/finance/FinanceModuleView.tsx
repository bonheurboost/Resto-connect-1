import { useMemo, useState, type FormEvent } from 'react';
import { Archive, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { convertCurrencyAmount, formatMoney } from '@/src/lib/domain/operations';
import { EXPENSE_CATEGORIES } from '@/src/lib/domain/erp';
import { calculateOrderPaymentSummary } from '@/src/lib/domain/cashRegister';
import { CashierPosView } from '@/src/modules/cashier/CashierPosView';
import type {
  CurrencyCode,
  ExpenseRecord,
  RestaurantRoleCode,
} from '@/src/lib/supabase/database.types';

interface FinanceModuleViewProps {
  restaurantId?: string;
  cashierOnly?: boolean;
  actorRole?: RestaurantRoleCode;
  actorName?: string;
}

export function FinanceModuleView({
  restaurantId,
  cashierOnly = false,
  actorRole = 'restaurant_admin',
  actorName = 'Responsable',
}: FinanceModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    orders,
    payments,
    paymentTransactions,
    refunds,
    expenses,
    recordExpense,
    archiveExpense,
  } = useRestoStore();

  const [financeTab, setFinanceTab] = useState<'cashier' | 'expenses'>('cashier');

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const currency: CurrencyCode = restaurant?.default_currency ?? 'CDF';
  const rate = restaurant?.exchange_rate_usd_cdf ?? 2850;

  const tenantOrders = orders.filter((o) => o.restaurant_id === tenantId);
  const tenantPayments = payments.filter(
    (p) => p.restaurant_id === tenantId && p.payment_scope === 'order'
  );
  const tenantExpenses = expenses.filter((e) => e.restaurant_id === tenantId);

  const unpaidOrPartialOrdersCount = tenantOrders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const sum = calculateOrderPaymentSummary(o, paymentTransactions, refunds);
    return sum.paymentStatus === 'unpaid' || sum.paymentStatus === 'partial';
  }).length;

  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expBeneficiary, setExpBeneficiary] = useState('');
  const [expMethod, setExpMethod] = useState<NonNullable<ExpenseRecord['payment_method']>>('cash');
  const [expAmount, setExpAmount] = useState('');
  const [expCurr, setExpCurr] = useState<CurrencyCode>(currency);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCatFilter, setExpCatFilter] = useState('all');
  const [showArchivedExp, setShowArchivedExp] = useState(false);

  const [archivingExpId, setArchivingExpId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const confirmedPayments = tenantPayments.filter((p) => p.status === 'confirmed');
  const pendingOrdersAmount = tenantOrders.reduce((sum, o) => {
    if (o.status === 'cancelled') return sum;
    const s = calculateOrderPaymentSummary(o, paymentTransactions, refunds);
    if (s.remainingAmount <= 0) return sum;
    return sum + convertCurrencyAmount(s.remainingAmount, s.currency, currency, rate);
  }, 0);

  const totalCollected = confirmedPayments.reduce(
    (sum, p) => sum + convertCurrencyAmount(p.amount, p.currency, currency, p.exchange_rate_applied ?? rate),
    0
  );
  const activeExpenses = tenantExpenses.filter((e) => (e.status ?? 'active') === 'active');
  const totalExpenses = activeExpenses.reduce(
    (sum, e) => sum + convertCurrencyAmount(e.amount, e.currency, currency, e.exchange_rate_applied ?? rate),
    0
  );

  const filteredExpenses = useMemo(() => {
    return tenantExpenses.filter((e) => {
      const isArch = (e.status ?? 'active') !== 'active';
      if (!showArchivedExp && isArch) return false;
      if (expCatFilter !== 'all' && e.category !== expCatFilter) return false;
      return true;
    });
  }, [tenantExpenses, showArchivedExp, expCatFilter]);

  if (cashierOnly) {
    return (
      <CashierPosView
        restaurantId={tenantId}
        actorRole={actorRole}
        actorName={actorName}
      />
    );
  }

  function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    const res = recordExpense({
      restaurantId: tenantId,
      category: expCategory,
      description: expDesc,
      amount: Number(expAmount),
      currency: expCurr,
      expenseDate: expDate,
      paymentMethod: expMethod,
      beneficiary: expBeneficiary,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setExpDesc('');
    setExpAmount('');
    setExpBeneficiary('');
    setFeedback('Dépense enregistrée dans le journal comptable.');
  }

  function handleConfirmArchive(e: FormEvent) {
    e.preventDefault();
    if (!archivingExpId) return;
    const res = archiveExpense(archivingExpId, archiveReason);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setArchivingExpId(null);
    setArchiveReason('');
    setFeedback('Dépense archivée avec traçabilité.');
  }

  function exportExpensesCsv() {
    const rows = [
      ['Date', 'Catégorie', 'Libellé', 'Bénéficiaire', 'Méthode', 'Montant', 'Devise', 'Statut'].join(';'),
      ...filteredExpenses.map((e) =>
        [
          e.expense_date,
          e.category,
          `"${e.description.replace(/"/g, '""')}"`,
          `"${(e.beneficiary ?? '').replace(/"/g, '""')}"`,
          e.payment_method ?? 'cash',
          e.amount,
          e.currency,
          e.status ?? 'active',
        ].join(';')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depenses-${restaurant?.slug ?? tenantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] p-1.5 w-fit">
        <button
          type="button"
          onClick={() => setFinanceTab('cashier')}
          className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            financeTab === 'cashier'
              ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
              : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
          }`}
        >
          Caisse &amp; Encaissements POS
        </button>
        <button
          type="button"
          onClick={() => setFinanceTab('expenses')}
          className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            financeTab === 'expenses'
              ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
              : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
          }`}
        >
          Dépenses &amp; Trésorerie ({activeExpenses.length})
        </button>
      </div>

      {financeTab === 'cashier' ? (
        <CashierPosView
          restaurantId={tenantId}
          actorRole={actorRole}
          actorName={actorName}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recettes confirmées</CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums">
                  {formatMoney(totalCollected, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[var(--rc-muted)]">{confirmedPayments.length} encaissement(s) validé(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Soldes commandes à encaisser</CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-gold-text)]">
                  {formatMoney(pendingOrdersAmount, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[var(--rc-muted)]">{unpaidOrPartialOrdersCount} commande(s) ouverte(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Dépenses actives</CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums">
                  {formatMoney(totalExpenses, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[var(--rc-muted)]">{activeExpenses.length} charge(s) active(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Trésorerie nette estimée</CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums">
                  {formatMoney(totalCollected - totalExpenses, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-[var(--rc-muted)]">1 USD = {rate.toLocaleString('fr-FR')} CDF</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Enregistrer une dépense (12 catégories)</CardTitle>
              <CardDescription>Saisie avec bénéficiaire, mode de paiement et devise.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-cat">Catégorie</Label>
                  <select
                    id="exp-cat"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <Label htmlFor="exp-desc">Libellé *</Label>
                  <Input
                    id="exp-desc"
                    placeholder="ex: Carburant groupe électrogène"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <Label htmlFor="exp-ben">Bénéficiaire / Fournisseur</Label>
                  <Input
                    id="exp-ben"
                    placeholder="Station, SNEL, Régideso..."
                    value={expBeneficiary}
                    onChange={(e) => setExpBeneficiary(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-amt">Montant *</Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="exp-amt"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      required
                    />
                    <select
                      aria-label="Devise dépense"
                      value={expCurr}
                      onChange={(e) => setExpCurr(e.target.value as CurrencyCode)}
                      className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp-meth">Mode de règlement</Label>
                  <select
                    id="exp-meth"
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as NonNullable<ExpenseRecord['payment_method']>)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                  >
                    <option value="cash">Espèces</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="card">Carte</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-4 pt-1">
                  <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback ?? ''}</span>
                  <Button type="submit" size="sm">Ajouter la dépense</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {archivingExpId && (
            <Card className="border-[var(--rc-danger-border)]">
              <CardHeader>
                <CardTitle className="text-base">Archiver une dépense (traçabilité obligatoire)</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfirmArchive} className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full space-y-1">
                    <Label htmlFor="arch-reason">Motif d&apos;archivage *</Label>
                    <Input
                      id="arch-reason"
                      placeholder="Erreur de saisie, doublon..."
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Confirmer l&apos;archivage</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setArchivingExpId(null)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <CardTitle>Journal des dépenses ({filteredExpenses.length})</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filtrer dépenses par catégorie"
                  value={expCatFilter}
                  onChange={(e) => setExpCatFilter(e.target.value)}
                  className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                >
                  <option value="all">Toutes catégories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[var(--rc-muted)] px-2">
                  <input
                    type="checkbox"
                    checked={showArchivedExp}
                    onChange={(e) => setShowArchivedExp(e.target.checked)}
                  />
                  <span>Archivées</span>
                </label>
                <Button type="button" size="sm" variant="outline" onClick={exportExpensesCsv}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Catégorie &amp; Libellé</th>
                      <th className="px-4 py-3">Bénéficiaire</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3">État</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                          Aucune dépense enregistrée pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((e) => {
                        const isArch = (e.status ?? 'active') !== 'active';
                        return (
                          <tr key={e.id} className={`hover:bg-[var(--rc-card-elevated)] ${isArch ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{e.expense_date}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-xs">{e.category}</p>
                              <p className="text-xs text-[var(--rc-muted)]">{e.description}</p>
                              {e.archived_reason && (
                                <p className="text-[11px] text-[var(--rc-danger-fg)]">Archivée : {e.archived_reason}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">{e.beneficiary ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {formatMoney(e.amount, e.currency)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusLabel label={isArch ? 'Archivée' : 'Active'} tone={isArch ? 'neutral' : 'emerald'} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!isArch && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Archiver dépense ${e.description}`}
                                  onClick={() => setArchivingExpId(e.id)}
                                >
                                  <Archive className="h-3.5 w-3.5 text-[var(--rc-danger-fg)]" />
                                </Button>
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

          <Card>
            <CardHeader>
              <CardTitle>Journal comptable des encaissements ({tenantPayments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Référence</th>
                      <th className="px-4 py-3">Méthode</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                          Aucun encaissement enregistré.
                        </td>
                      </tr>
                    ) : (
                      tenantPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-xs">{p.reference_code}</td>
                          <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">{p.payment_method}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {formatMoney(p.amount, p.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusLabel
                              label={
                                p.status === 'confirmed'
                                  ? 'Confirmé'
                                  : p.status === 'pending'
                                    ? 'En attente'
                                    : p.status === 'refunded'
                                      ? 'Remboursé'
                                      : 'Rejeté'
                              }
                              tone={
                                p.status === 'confirmed'
                                  ? 'emerald'
                                  : p.status === 'pending'
                                    ? 'amber'
                                    : 'crimson'
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
