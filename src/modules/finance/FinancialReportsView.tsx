import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { HorizontalBarChart } from '@/src/components/charts/SimpleCharts';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import { computeFinancialReport } from '@/src/lib/domain/erp';
import type { PeriodFilter } from '@/src/lib/domain/analytics';
import type { CurrencyCode } from '@/src/lib/supabase/database.types';

interface FinancialReportsViewProps {
  restaurantId?: string;
}

const PERIOD_LABELS: Array<{ key: PeriodFilter; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Période personnalisée' },
];

export function FinancialReportsView({ restaurantId }: FinancialReportsViewProps) {
  const {
    activeTenantId,
    restaurants,
    orders,
    orderItems,
    recipes,
    recipeItems,
    ingredients,
    payments,
    expenses,
    purchaseOrders,
    salaryPayments,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId) ?? restaurants[0] ?? null;

  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState('2026-11-01');
  const [customEnd, setCustomEnd] = useState('2026-12-31');
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(
    restaurant?.default_currency ?? 'USD'
  );

  const report = useMemo(() => {
    if (!restaurant) return null;
    return computeFinancialReport({
      restaurant,
      orders,
      orderItems,
      recipes,
      recipeItems,
      ingredients,
      payments,
      expenses,
      purchaseOrders,
      salaryPayments,
      period,
      customStart,
      customEnd,
      displayCurrency,
    });
  }, [
    restaurant,
    orders,
    orderItems,
    recipes,
    recipeItems,
    ingredients,
    payments,
    expenses,
    purchaseOrders,
    salaryPayments,
    period,
    customStart,
    customEnd,
    displayCurrency,
  ]);

  if (!restaurant || !report) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--rc-muted)]">
          Aucun restaurant sélectionné pour les rapports financiers.
        </CardContent>
      </Card>
    );
  }

  function handleExportCsv() {
    if (!restaurant || !report) return;
    const lines = [
      ['Indicateur', 'Valeur', 'Devise'].join(';'),
      ['Recettes encaissées confirmées', report.confirmedRevenue, report.displayCurrency].join(';'),
      ['Paiements en attente', report.pendingPaymentsAmount, report.displayCurrency].join(';'),
      ['Paiements échoués / rejetés', report.failedPaymentsAmount, report.displayCurrency].join(';'),
      ['Paiements remboursés', report.refundedPaymentsAmount, report.displayCurrency].join(';'),
      ['Coût matière estimé (COGS)', report.estimatedCogs, report.displayCurrency].join(';'),
      ['Marge brute estimée', report.estimatedGrossMargin, report.displayCurrency].join(';'),
      ['Dépenses actives', report.activeExpenses, report.displayCurrency].join(';'),
      ['Salaires versés', report.salariesPaid, report.displayCurrency].join(';'),
      ['Achats fournisseurs payés', report.purchasesPaid, report.displayCurrency].join(';'),
      ['Résultat opérationnel estimé', report.estimatedOperatingResult, report.displayCurrency].join(';'),
      ['Valeur du stock', report.stockValue, report.displayCurrency].join(';'),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-financier-${restaurant.slug}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_LABELS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                period === p.key
                  ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                  : 'bg-[var(--rc-bg-subtle)] text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 pl-2">
              <Input
                type="date"
                aria-label="Début rapport"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <span className="text-xs">→</span>
              <Input
                type="date"
                aria-label="Fin rapport"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-bg-subtle)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDisplayCurrency('USD')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                displayCurrency === 'USD'
                  ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold shadow-xs'
                  : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setDisplayCurrency('CDF')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                displayCurrency === 'CDF'
                  ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold shadow-xs'
                  : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
              }`}
            >
              CDF
            </button>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CSV</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Imprimer / PDF</span>
          </Button>
        </div>
      </div>

      {/* Note de transparence comptable */}
      <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] px-4 py-2.5 text-xs text-[var(--rc-muted)]">
        Taux de change appliqué :{' '}
        <strong className="font-mono text-[var(--rc-fg)]">
          1 USD = {report.exchangeRateUsed.toLocaleString('fr-FR')} CDF
        </strong>{' '}
        · Les recettes excluent les commandes annulées ({report.cancelledOrdersCount}) ainsi que les paiements en attente, échoués ou remboursés.
      </div>

      {/* Synthèse P&L */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recettes confirmées</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatMoney(report.confirmedRevenue, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Natif : {formatMoney(report.confirmedRevenueUsdNative, 'USD')} +{' '}
            {formatMoney(report.confirmedRevenueCdfNative, 'CDF')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coût matière (COGS estimé)</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatMoney(report.estimatedCogs, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Marge brute : {formatMoney(report.estimatedGrossMargin, report.displayCurrency)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dépenses + Salaires versés</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatMoney(report.activeExpenses + report.salariesPaid, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Charges : {formatMoney(report.activeExpenses, report.displayCurrency)} · Paie :{' '}
            {formatMoney(report.salariesPaid, report.displayCurrency)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Résultat opérationnel estimé</CardDescription>
            <CardTitle
              className={`font-mono text-2xl tabular-nums ${
                report.estimatedOperatingResult >= 0 ? 'text-[var(--rc-gold)]' : 'text-[var(--rc-danger-fg)]'
              }`}
            >
              {formatMoney(report.estimatedOperatingResult, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[var(--rc-muted)]">
            Valeur du stock : {formatMoney(report.stockValue, report.displayCurrency)}
          </CardContent>
        </Card>
      </div>

      {/* Statuts de paiement & achats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paiements en attente</CardDescription>
            <CardTitle className="font-mono text-lg tabular-nums">
              {formatMoney(report.pendingPaymentsAmount, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paiements échoués / rejetés</CardDescription>
            <CardTitle className="font-mono text-lg tabular-nums text-[var(--rc-danger-fg)]">
              {formatMoney(report.failedPaymentsAmount, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paiements remboursés</CardDescription>
            <CardTitle className="font-mono text-lg tabular-nums">
              {formatMoney(report.refundedPaymentsAmount, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Achats fournisseurs réglés</CardDescription>
            <CardTitle className="font-mono text-lg tabular-nums">
              {formatMoney(report.purchasesPaid, report.displayCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarChart
          title="Recettes par mode de paiement"
          subtitle="Encaissements confirmés uniquement"
          data={report.revenueByMethod.map((r) => ({ label: r.method, value: r.amount }))}
          valueFormatter={(v) => formatMoney(v, report.displayCurrency)}
        />
        <HorizontalBarChart
          title="Dépenses par catégorie"
          subtitle="Hors dépenses annulées ou archivées"
          data={report.expensesByCategory.map((e) => ({ label: e.category, value: e.amount }))}
          valueFormatter={(v) => formatMoney(v, report.displayCurrency)}
        />
      </div>
    </div>
  );
}
