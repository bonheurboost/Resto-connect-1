import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { HorizontalBarChart } from '@/src/components/charts/SimpleCharts';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import { type PeriodFilter } from '@/src/lib/domain/analytics';
import {
  calculateOrderPaymentSummary,
  computeCashReports,
  getOrderPaymentStatusLabel,
} from '@/src/lib/domain/cashRegister';
import type { CashPaymentMethod, CurrencyCode } from '@/src/lib/supabase/database.types';

interface CashReportsViewProps {
  restaurantId?: string;
}

const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Personnalisée' },
];

export function CashReportsView({ restaurantId }: CashReportsViewProps) {
  const {
    activeTenantId,
    restaurants,
    orders,
    paymentTransactions,
    refunds,
    cashClosures,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId) ?? restaurants[0] ?? null;

  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState('2026-11-01');
  const [customEnd, setCustomEnd] = useState('2026-12-31');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | CurrencyCode>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | CashPaymentMethod>('all');

  const distinctCashiers = useMemo(() => {
    const names = new Set<string>();
    for (const tx of paymentTransactions) {
      if (tx.restaurant_id === tenantId) names.add(tx.cashier_name);
    }
    for (const cl of cashClosures) {
      if (cl.restaurant_id === tenantId) names.add(cl.cashier_name);
    }
    return Array.from(names).sort();
  }, [paymentTransactions, cashClosures, tenantId]);

  const report = useMemo(() => {
    if (!restaurant) return null;
    return computeCashReports({
      restaurant,
      orders,
      transactions: paymentTransactions,
      refunds,
      closures: cashClosures,
      period,
      customStart,
      customEnd,
      cashierFilter,
      currencyFilter,
      methodFilter,
    });
  }, [
    restaurant,
    orders,
    paymentTransactions,
    refunds,
    cashClosures,
    period,
    customStart,
    customEnd,
    cashierFilter,
    currencyFilter,
    methodFilter,
  ]);

  const pendingOrders = useMemo(() => {
    return orders
      .filter((o) => o.restaurant_id === tenantId && o.status !== 'cancelled')
      .map((o) => ({
        order: o,
        summary: calculateOrderPaymentSummary(o, paymentTransactions, refunds),
      }))
      .filter((x) => x.summary.paymentStatus === 'unpaid' || x.summary.paymentStatus === 'partial');
  }, [orders, paymentTransactions, refunds, tenantId]);

  const tenantClosures = useMemo(
    () => cashClosures.filter((c) => c.restaurant_id === tenantId),
    [cashClosures, tenantId]
  );

  if (!restaurant || !report) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--rc-muted)]">
          Aucun restaurant sélectionné pour les rapports de caisse.
        </CardContent>
      </Card>
    );
  }

  function exportReportCsv() {
    if (!restaurant || !report) return;
    const lines = [
      ['Section', 'Libellé', 'USD natif', 'CDF natif', 'Volume'].join(';'),
      [
        'Synthèse',
        'Encaissements bruts',
        report.collectedUsdNative,
        report.collectedCdfNative,
        report.transactionsCount,
      ].join(';'),
      ['Synthèse', 'Remboursements', report.refundedUsdNative, report.refundedCdfNative, ''].join(';'),
      ['Synthèse', 'Net encaissé', report.netUsdNative, report.netCdfNative, ''].join(';'),
      [
        'Synthèse',
        'Reste à encaisser (non payé + partiel)',
        report.remainingToCollectUsdNative,
        report.remainingToCollectCdfNative,
        report.unpaidOrdersCount + report.partialOrdersCount,
      ].join(';'),
      ...report.byMethod.map((m) =>
        ['Mode de paiement', m.label, m.usdNative, m.cdfNative, m.txCount].join(';')
      ),
      ...report.byCashier.map((c) =>
        ['Caissier', c.cashierName, c.usdNative, c.cdfNative, c.txCount].join(';')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-caisse-${restaurant.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriod(opt.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    period === opt.key
                      ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                      : 'bg-[var(--rc-bg-subtle)] text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={exportReportCsv}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV caisse</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {period === 'custom' && (
              <>
                <Input
                  type="date"
                  aria-label="Date début rapport"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 text-xs"
                />
                <Input
                  type="date"
                  aria-label="Date fin rapport"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 text-xs"
                />
              </>
            )}
            <select
              aria-label="Filtrer par caissier"
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Tous les caissiers</option>
              {distinctCashiers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par devise"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as 'all' | CurrencyCode)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Toutes devises (USD &amp; CDF séparés)</option>
              <option value="USD">USD uniquement</option>
              <option value="CDF">CDF uniquement</option>
            </select>
            <select
              aria-label="Filtrer par mode de paiement"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as 'all' | CashPaymentMethod)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Tous modes de paiement</option>
              <option value="cash_usd">Espèces USD</option>
              <option value="cash_cdf">Espèces CDF</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Carte (TPE)</option>
              <option value="other">
                {restaurant.custom_payment_method_label?.trim() || 'Autre mode'}
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs multi-devises strictement séparées */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Encaissements USD (natifs)</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-gold)]">
              {formatMoney(report.collectedUsdNative, 'USD')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Remboursements : -{formatMoney(report.refundedUsdNative, 'USD')} · Net :{' '}
            <strong className="font-mono text-[var(--rc-fg)]">{formatMoney(report.netUsdNative, 'USD')}</strong>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Encaissements CDF (natifs)</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-gold)]">
              {formatMoney(report.collectedCdfNative, 'CDF')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Remboursements : -{formatMoney(report.refundedCdfNative, 'CDF')} · Net :{' '}
            <strong className="font-mono text-[var(--rc-fg)]">{formatMoney(report.netCdfNative, 'CDF')}</strong>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reste à encaisser (partiel &amp; non payé)</CardDescription>
            <CardTitle className="font-mono text-xl tabular-nums text-[var(--rc-warn-fg)]">
              {formatMoney(report.remainingToCollectUsdNative, 'USD')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            <p className="font-mono font-semibold text-[var(--rc-warn-fg)]">
              + {formatMoney(report.remainingToCollectCdfNative, 'CDF')}
            </p>
            <p>
              {report.partialOrdersCount} partielle(s) · {report.unpaidOrdersCount} non payée(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clôtures &amp; Écarts cumulés</CardDescription>
            <CardTitle className="font-mono text-xl tabular-nums">
              {report.closuresCount} clôture(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            <p>
              {report.closuresWithDiscrepancyCount} avec écart · USD :{' '}
              <span className="font-mono">{report.totalDiscrepancyUsd.toFixed(2)} $</span> · CDF :{' '}
              <span className="font-mono">{report.totalDiscrepancyCdf.toLocaleString('fr-FR')}</span>
            </p>
            <p className="text-[11px] mt-0.5">
              Indicatif consolidé ({report.displayCurrency}) :{' '}
              {formatMoney(report.indicativeEquivalentDisplayCurrency, report.displayCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Répartition par mode et par caissier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissements par mode de paiement</CardTitle>
            <CardDescription>Montants natifs USD et CDF strictement séparés.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                    <th className="px-3 py-2.5">Mode</th>
                    <th className="px-3 py-2.5 text-right">USD natif</th>
                    <th className="px-3 py-2.5 text-right">CDF natif</th>
                    <th className="px-3 py-2.5 text-right">Opérations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rc-border)]">
                  {report.byMethod.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[var(--rc-muted)]">
                        Aucune transaction sur la période.
                      </td>
                    </tr>
                  ) : (
                    report.byMethod.map((row) => (
                      <tr key={row.method} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-3 py-2.5 font-medium">{row.label}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(row.usdNative, 'USD')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(row.cdfNative, 'CDF')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{row.txCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <HorizontalBarChart
              title="Volume d'opérations par mode"
              data={report.byMethod.map((m) => ({ label: m.label, value: m.txCount }))}
              valueFormatter={(v) => `${v} op.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissements par caissier</CardTitle>
            <CardDescription>Suivi individuel des recettes encaissées USD &amp; CDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                    <th className="px-3 py-2.5">Caissier</th>
                    <th className="px-3 py-2.5 text-right">USD natif</th>
                    <th className="px-3 py-2.5 text-right">CDF natif</th>
                    <th className="px-3 py-2.5 text-right">Opérations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rc-border)]">
                  {report.byCashier.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[var(--rc-muted)]">
                        Aucun encaissement par caissier sur cette période.
                      </td>
                    </tr>
                  ) : (
                    report.byCashier.map((row) => (
                      <tr key={row.cashierName} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-3 py-2.5 font-medium">{row.cashierName}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(row.usdNative, 'USD')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(row.cdfNative, 'CDF')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{row.txCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <HorizontalBarChart
              title="Opérations par caissier"
              data={report.byCashier.map((c) => ({ label: c.cashierName, value: c.txCount }))}
              valueFormatter={(v) => `${v} op.`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Commandes avec solde restant & Clôtures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Commandes non soldées ({pendingOrders.length})
            </CardTitle>
            <CardDescription>Commandes en paiement partiel ou non payées.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                    <th className="px-3 py-2.5">Commande</th>
                    <th className="px-3 py-2.5">Statut</th>
                    <th className="px-3 py-2.5 text-right">Payé</th>
                    <th className="px-3 py-2.5 text-right">Reste dû</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rc-border)]">
                  {pendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[var(--rc-muted)]">
                        Toutes les commandes actives sont soldées.
                      </td>
                    </tr>
                  ) : (
                    pendingOrders.map(({ order, summary }) => {
                      const meta = getOrderPaymentStatusLabel(summary.paymentStatus);
                      return (
                        <tr key={order.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-semibold">{order.order_number}</span> ·{' '}
                            {order.customer_name ?? 'Client'}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusLabel label={meta.label} tone={meta.tone} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {formatMoney(summary.paidAmount, summary.currency)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--rc-warn-fg)]">
                            {formatMoney(summary.remainingAmount, summary.currency)}
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
            <CardTitle className="text-base">
              Écarts de clôtures de caisse ({tenantClosures.length})
            </CardTitle>
            <CardDescription>Contrôle des écarts USD &amp; CDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Caissier</th>
                    <th className="px-3 py-2.5 text-right">Écart USD</th>
                    <th className="px-3 py-2.5 text-right">Écart CDF</th>
                    <th className="px-3 py-2.5">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rc-border)]">
                  {tenantClosures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--rc-muted)]">
                        Aucune clôture sur cet établissement.
                      </td>
                    </tr>
                  ) : (
                    tenantClosures.map((c) => (
                      <tr key={c.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-3 py-2.5 font-mono">
                          {c.closed_at.replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className="px-3 py-2.5">{c.cashier_name}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {c.discrepancy_usd >= 0 ? '+' : ''}
                          {c.discrepancy_usd.toFixed(2)} $
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                          {c.discrepancy_cdf >= 0 ? '+' : ''}
                          {c.discrepancy_cdf.toLocaleString('fr-FR')} CDF
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusLabel
                            label={c.status === 'closed_with_discrepancy' ? 'Écart' : 'Conforme'}
                            tone={c.status === 'closed_with_discrepancy' ? 'amber' : 'emerald'}
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
    </div>
  );
}
