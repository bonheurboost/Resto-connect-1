import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { hasRolePermission } from '@/src/lib/auth/rbac';
import { convertCurrencyAmount, formatMoney } from '@/src/lib/domain/operations';
import {
  calculateOrderPaymentSummary,
  computeCashSessionSummary,
  evaluateClosureDiscrepancy,
  getOrderPaymentStatusLabel,
  getPaymentMethodLabel,
  PAYMENT_CONTEXT_LABELS,
} from '@/src/lib/domain/cashRegister';
import type {
  CashPaymentMethod,
  CurrencyCode,
  PaymentContext,
  PaymentTransactionRecord,
  ReceiptRecord,
  RestaurantRoleCode,
} from '@/src/lib/supabase/database.types';
import { ReceiptDialog } from '@/src/modules/cashier/ReceiptDialog';

interface CashierPosViewProps {
  restaurantId?: string;
  actorRole: RestaurantRoleCode;
  actorName?: string;
}

type PosTab = 'pos' | 'transactions' | 'receipts_closures';
type OrderFilter = 'to_collect' | 'partial' | 'paid' | 'all';

const CONTEXT_OPTIONS: PaymentContext[] = ['counter', 'takeaway', 'delivery', 'table'];

export function CashierPosView({
  restaurantId,
  actorRole,
  actorName = 'Caissier',
}: CashierPosViewProps) {
  const {
    activeTenantId,
    restaurants,
    orders,
    orderItems,
    orderItemOptions,
    cashRegisters,
    cashSessions,
    cashMovements,
    paymentTransactions,
    refunds,
    receipts,
    cashClosures,
    createCashRegister,
    openCashSession,
    recordCashMovement,
    recordCashPayment,
    voidOrCorrectPaymentTransaction,
    recordRefund,
    closeCashSession,
    adjustLockedClosure,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId) ?? restaurants[0] ?? null;
  const currentRate =
    restaurant && restaurant.exchange_rate_usd_cdf > 0
      ? restaurant.exchange_rate_usd_cdf
      : 2850;

  const canOpenCash = hasRolePermission(actorRole, 'cash.open');
  const canCloseCash = hasRolePermission(actorRole, 'cash.close');
  const canCollect = hasRolePermission(actorRole, 'payments.collect');
  const canRefund = hasRolePermission(actorRole, 'payments.refund');
  const canCorrect = hasRolePermission(actorRole, 'cash.correct');

  const tenantRegisters = cashRegisters.filter((r) => r.restaurant_id === tenantId && r.is_active);
  const tenantSessions = cashSessions.filter((s) => s.restaurant_id === tenantId);
  const activeSession = tenantSessions.find((s) => s.status === 'open') ?? null;

  const tenantOrders = useMemo(
    () => orders.filter((o) => o.restaurant_id === tenantId),
    [orders, tenantId]
  );
  const tenantTransactions = useMemo(
    () => paymentTransactions.filter((t) => t.restaurant_id === tenantId),
    [paymentTransactions, tenantId]
  );
  const tenantRefunds = useMemo(
    () => refunds.filter((r) => r.restaurant_id === tenantId),
    [refunds, tenantId]
  );
  const tenantReceipts = useMemo(
    () => receipts.filter((r) => r.restaurant_id === tenantId),
    [receipts, tenantId]
  );
  const tenantClosures = useMemo(
    () => cashClosures.filter((c) => c.restaurant_id === tenantId),
    [cashClosures, tenantId]
  );
  const tenantMovements = useMemo(
    () => cashMovements.filter((m) => m.restaurant_id === tenantId),
    [cashMovements, tenantId]
  );

  const sessionSummary = useMemo(() => {
    if (!activeSession) return null;
    return computeCashSessionSummary({
      session: activeSession,
      transactions: tenantTransactions,
      movements: tenantMovements,
      refunds: tenantRefunds,
    });
  }, [activeSession, tenantTransactions, tenantMovements, tenantRefunds]);

  // UI Navigation & Receipt Modal
  const [posTab, setPosTab] = useState<PosTab>('pos');
  const [activeReceipt, setActiveReceipt] = useState<ReceiptRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Register creation & Session open/movement/close state
  const [showNewRegister, setShowNewRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');

  const [selectedRegisterId, setSelectedRegisterId] = useState(tenantRegisters[0]?.id ?? '');
  const [openingUsd, setOpeningUsd] = useState('0');
  const [openingCdf, setOpeningCdf] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');

  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movType, setMovType] = useState<'in' | 'out'>('out');
  const [movCurrency, setMovCurrency] = useState<CurrencyCode>('USD');
  const [movAmount, setMovAmount] = useState('');
  const [movReason, setMovReason] = useState('');

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [countedUsd, setCountedUsd] = useState('');
  const [countedCdf, setCountedCdf] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  // Order selection & POS collection state
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('to_collect');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<CashPaymentMethod>('cash_usd');
  const [payContext, setPayContext] = useState<PaymentContext>('counter');
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>('USD');
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  // Refund & Void state
  const [refundTargetTx, setRefundTargetTx] = useState<PaymentTransactionRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState<CashPaymentMethod>('cash_usd');
  const [refundReason, setRefundReason] = useState('');

  const [voidTargetTx, setVoidTargetTx] = useState<PaymentTransactionRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Receipt search & Closure adjustment
  const [receiptSearch, setReceiptSearch] = useState('');
  const [adjustClosureId, setAdjustClosureId] = useState<string | null>(null);
  const [adjUsd, setAdjUsd] = useState('');
  const [adjCdf, setAdjCdf] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Order summaries
  const enrichedOrders = useMemo(() => {
    return tenantOrders.map((o) => ({
      order: o,
      summary: calculateOrderPaymentSummary(o, tenantTransactions, tenantRefunds),
    }));
  }, [tenantOrders, tenantTransactions, tenantRefunds]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return enrichedOrders.filter(({ order, summary }) => {
      if (orderFilter === 'to_collect') {
        if (order.status === 'cancelled') return false;
        if (summary.paymentStatus !== 'unpaid' && summary.paymentStatus !== 'partial') return false;
      } else if (orderFilter === 'partial') {
        if (summary.paymentStatus !== 'partial') return false;
      } else if (orderFilter === 'paid') {
        if (summary.paymentStatus !== 'paid') return false;
      }
      if (!q) return true;
      return (
        order.order_number.toLowerCase().includes(q) ||
        (order.customer_name ?? '').toLowerCase().includes(q) ||
        (order.customer_phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [enrichedOrders, orderFilter, orderSearch]);

  const selectedEntry =
    enrichedOrders.find((e) => e.order.id === selectedOrderId) ??
    filteredOrders[0] ??
    enrichedOrders[0] ??
    null;

  const selectedOrder = selectedEntry?.order ?? null;
  const selectedSummary = selectedEntry?.summary ?? null;

  function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    const entry = enrichedOrders.find((e) => e.order.id === orderId);
    if (!entry) return;
    const defaultCurr = entry.order.currency;
    const defaultMethod: CashPaymentMethod = defaultCurr === 'CDF' ? 'cash_cdf' : 'cash_usd';
    setPayMethod(defaultMethod);
    setPayCurrency(defaultCurr);
    setPayContext(
      entry.order.order_type === 'delivery'
        ? 'delivery'
        : entry.order.order_type === 'takeaway'
          ? 'takeaway'
          : 'counter'
    );
    setPayAmount(entry.summary.remainingAmount > 0 ? String(entry.summary.remainingAmount) : '');
    setPayRef('');
    setPayNote('');
  }

  function handleMethodSelect(method: CashPaymentMethod) {
    setPayMethod(method);
    let nextCurrency = payCurrency;
    if (method === 'cash_usd') {
      nextCurrency = 'USD';
    } else if (method === 'cash_cdf') {
      nextCurrency = 'CDF';
    }
    setPayCurrency(nextCurrency);
    if (selectedSummary && selectedSummary.remainingAmount > 0) {
      const converted = convertCurrencyAmount(
        selectedSummary.remainingAmount,
        selectedSummary.currency,
        nextCurrency,
        currentRate
      );
      setPayAmount(String(converted));
    }
  }

  function handleCurrencySelect(nextCurrency: CurrencyCode) {
    if (payMethod === 'cash_usd' && nextCurrency !== 'USD') return;
    if (payMethod === 'cash_cdf' && nextCurrency !== 'CDF') return;
    setPayCurrency(nextCurrency);
    if (selectedSummary && selectedSummary.remainingAmount > 0) {
      const converted = convertCurrencyAmount(
        selectedSummary.remainingAmount,
        selectedSummary.currency,
        nextCurrency,
        currentRate
      );
      setPayAmount(String(converted));
    }
  }

  function fillFraction(ratio: number) {
    if (!selectedSummary || selectedSummary.remainingAmount <= 0) return;
    const remainingInPayCurr = convertCurrencyAmount(
      selectedSummary.remainingAmount,
      selectedSummary.currency,
      payCurrency,
      currentRate
    );
    const val =
      payCurrency === 'CDF'
        ? Math.round(remainingInPayCurr * ratio)
        : Math.round(remainingInPayCurr * ratio * 100) / 100;
    setPayAmount(String(val));
  }

  function handleCreateRegister(e: FormEvent) {
    e.preventDefault();
    const res = createCashRegister({ restaurantId: tenantId, name: regName, code: regCode });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setSelectedRegisterId(res.register.id);
    setRegName('');
    setRegCode('');
    setShowNewRegister(false);
    setFeedback({ type: 'success', text: `Caisse ${res.register.name} créée.` });
  }

  function handleOpenSession(e: FormEvent) {
    e.preventDefault();
    const regId = selectedRegisterId || tenantRegisters[0]?.id;
    if (!regId) {
      setFeedback({ type: 'error', text: 'Aucune caisse active disponible.' });
      return;
    }
    const res = openCashSession({
      restaurantId: tenantId,
      cashRegisterId: regId,
      cashierName: actorName,
      actorRole,
      openingAmountUsd: Number(openingUsd) || 0,
      openingAmountCdf: Number(openingCdf) || 0,
      notes: openingNotes,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setOpeningNotes('');
    setFeedback({ type: 'success', text: 'Session de caisse ouverte avec fonds initiaux USD & CDF.' });
  }

  function handleRecordMovement(e: FormEvent) {
    e.preventDefault();
    if (!activeSession) return;
    const res = recordCashMovement({
      restaurantId: tenantId,
      cashSessionId: activeSession.id,
      movementType: movType,
      amount: Number(movAmount),
      currency: movCurrency,
      reason: movReason,
      actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setMovAmount('');
    setMovReason('');
    setShowMovementForm(false);
    setFeedback({
      type: 'success',
      text: `${movType === 'in' ? 'Entrée' : 'Sortie'} de caisse enregistrée avec motif.`,
    });
  }

  function handleCloseSession(e: FormEvent) {
    e.preventDefault();
    if (!activeSession) return;
    const res = closeCashSession({
      restaurantId: tenantId,
      cashSessionId: activeSession.id,
      countedUsd: Number(countedUsd),
      countedCdf: Number(countedCdf),
      notes: closeNotes,
      actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setShowCloseForm(false);
    setCountedUsd('');
    setCountedCdf('');
    setCloseNotes('');
    setFeedback({
      type: res.closure.status === 'closed_with_discrepancy' ? 'error' : 'success',
      text:
        res.closure.status === 'closed_with_discrepancy'
          ? `Session clôturée avec écart détecté (USD : ${res.closure.discrepancy_usd}, CDF : ${res.closure.discrepancy_cdf}).`
          : 'Session de caisse clôturée et verrouillée sans écart.',
    });
  }

  function handleCollectPayment(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    const res = recordCashPayment({
      restaurantId: tenantId,
      orderId: selectedOrder.id,
      cashSessionId: activeSession?.id ?? null,
      amount: Number(payAmount),
      currency: payCurrency,
      paymentMethod: payMethod,
      paymentContext: payContext,
      referenceCode: payRef,
      note: payNote,
      cashierName: actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setSelectedOrderId(selectedOrder.id);
    setPayAmount('');
    setPayRef('');
    setPayNote('');
    setActiveReceipt(res.receipt);
    setFeedback({
      type: 'success',
      text: `Encaissement ${res.transaction.transaction_number} validé. Reçu ${res.receipt.receipt_number} généré.`,
    });
  }

  function handleRefundSubmit(e: FormEvent) {
    e.preventDefault();
    if (!refundTargetTx) return;
    const res = recordRefund({
      restaurantId: tenantId,
      orderId: refundTargetTx.order_id,
      paymentTransactionId: refundTargetTx.id,
      cashSessionId: activeSession?.id ?? null,
      amount: Number(refundAmount),
      refundMethod,
      reason: refundReason,
      responsibleName: actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setRefundTargetTx(null);
    setRefundAmount('');
    setRefundReason('');
    setActiveReceipt(res.receipt);
    setFeedback({
      type: 'success',
      text: `Remboursement ${res.refund.refund_number} enregistré avec reçu justificatif.`,
    });
  }

  function handleVoidSubmit(e: FormEvent) {
    e.preventDefault();
    if (!voidTargetTx) return;
    const res = voidOrCorrectPaymentTransaction({
      restaurantId: tenantId,
      transactionId: voidTargetTx.id,
      reason: voidReason,
      actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setVoidTargetTx(null);
    setVoidReason('');
    setFeedback({
      type: 'success',
      text: 'Transaction annulée avec conservation intégrale dans le journal d’audit.',
    });
  }

  function handleAdjustClosure(e: FormEvent) {
    e.preventDefault();
    if (!adjustClosureId) return;
    const res = adjustLockedClosure({
      restaurantId: tenantId,
      closureId: adjustClosureId,
      countedUsd: Number(adjUsd),
      countedCdf: Number(adjCdf),
      correctionReason: adjReason,
      actorName,
      actorRole,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setAdjustClosureId(null);
    setAdjReason('');
    setFeedback({ type: 'success', text: 'Clôture rectifiée avec motif journalisé.' });
  }

  const methodChoices: Array<{
    key: CashPaymentMethod;
    label: string;
    icon: typeof Banknote;
  }> = [
    { key: 'cash_usd', label: 'Espèces USD', icon: Banknote },
    { key: 'cash_cdf', label: 'Espèces CDF', icon: Banknote },
    { key: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { key: 'card', label: 'Carte (TPE)', icon: CreditCard },
    {
      key: 'other',
      label: restaurant?.custom_payment_method_label?.trim() || 'Autre mode',
      icon: Wallet,
    },
  ];

  const convertedPreview = useMemo(() => {
    if (!selectedOrder) return 0;
    const num = Number(payAmount) || 0;
    return convertCurrencyAmount(num, payCurrency, selectedOrder.currency, currentRate);
  }, [payAmount, payCurrency, selectedOrder, currentRate]);

  const closeDiscrepancyPreview = useMemo(() => {
    if (!sessionSummary) return null;
    if (countedUsd === '' && countedCdf === '') return null;
    return evaluateClosureDiscrepancy({
      expectedUsd: sessionSummary.expectedCashUsd,
      expectedCdf: sessionSummary.expectedCashCdf,
      countedUsd: Number(countedUsd) || 0,
      countedCdf: Number(countedCdf) || 0,
    });
  }, [sessionSummary, countedUsd, countedCdf]);

  const filteredReceipts = useMemo(() => {
    const q = receiptSearch.trim().toLowerCase();
    if (!q) return tenantReceipts;
    return tenantReceipts.filter(
      (r) =>
        r.receipt_number.toLowerCase().includes(q) ||
        r.snapshot_json.orderNumber.toLowerCase().includes(q) ||
        r.snapshot_json.customerName.toLowerCase().includes(q)
    );
  }, [tenantReceipts, receiptSearch]);

  if (!restaurant) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--rc-muted)]">
          Aucun restaurant sélectionné pour la caisse.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ReceiptDialog receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />

      {/* 1. SESSION DE CAISSE ACTIVE OU OUVERTURE */}
      <Card className="border-[var(--rc-border-strong)]">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">
                {activeSession ? 'Session de caisse ouverte' : 'Caisse fermée — Ouverture requise'}
              </CardTitle>
              <StatusLabel
                label={activeSession ? 'Ouverte' : 'Fermée'}
                tone={activeSession ? 'emerald' : 'amber'}
              />
            </div>
            <CardDescription className="mt-1">
              {activeSession
                ? `Ouverte par ${activeSession.cashier_name} · Taux actif du jour : 1 USD = ${currentRate.toLocaleString('fr-FR')} CDF`
                : 'Ouvrez une caisse avec les fonds initiaux en USD et CDF pour encaisser les paiements sur place.'}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(canCorrect || actorRole === 'restaurant_admin' || actorRole === 'manager') && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowNewRegister((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Nouvelle caisse</span>
              </Button>
            )}
            {activeSession && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowMovementForm((v) => !v);
                    setShowCloseForm(false);
                  }}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mouvement caisse</span>
                </Button>
                {canCloseCash && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!showCloseForm && sessionSummary) {
                        setCountedUsd(String(sessionSummary.expectedCashUsd));
                        setCountedCdf(String(sessionSummary.expectedCashCdf));
                      }
                      setShowCloseForm((v) => !v);
                      setShowMovementForm(false);
                    }}
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clôturer la caisse</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showNewRegister && (
            <form
              onSubmit={handleCreateRegister}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3 items-end"
            >
              <div className="space-y-1">
                <Label htmlFor="reg-name" className="text-xs">Nom du poste de caisse *</Label>
                <Input
                  id="reg-name"
                  placeholder="ex: Caisse Bar VIP"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-code" className="text-xs">Code *</Label>
                <Input
                  id="reg-code"
                  placeholder="CAISSE-03"
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm">Créer la caisse</Button>
            </form>
          )}

          {!activeSession ? (
            canOpenCash ? (
              <form
                onSubmit={handleOpenSession}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-4 items-end"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="open-reg">Poste de caisse</Label>
                  <select
                    id="open-reg"
                    value={selectedRegisterId || tenantRegisters[0]?.id || ''}
                    onChange={(e) => setSelectedRegisterId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                  >
                    {tenantRegisters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="open-usd">Fond initial USD</Label>
                  <Input
                    id="open-usd"
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingUsd}
                    onChange={(e) => setOpeningUsd(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="open-cdf">Fond initial CDF</Label>
                  <Input
                    id="open-cdf"
                    type="number"
                    min="0"
                    step="1"
                    value={openingCdf}
                    onChange={(e) => setOpeningCdf(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="open-notes">Note d&apos;ouverture</Label>
                  <Input
                    id="open-notes"
                    placeholder="Service matin / soir"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full">Ouvrir la session</Button>
              </form>
            ) : (
              <p className="text-xs text-[var(--rc-warn-fg)] rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-3">
                Vous n&apos;avez pas la permission d&apos;ouvrir une session de caisse.
              </p>
            )
          ) : (
            sessionSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3">
                  <p className="text-[11px] font-medium text-[var(--rc-muted)]">Tiroir Espèces USD attendu</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[var(--rc-gold)] mt-0.5">
                    {formatMoney(sessionSummary.expectedCashUsd, 'USD')}
                  </p>
                  <p className="text-[11px] text-[var(--rc-muted)] mt-0.5">
                    Fond {formatMoney(sessionSummary.openingUsd, 'USD')} + Ventes{' '}
                    {formatMoney(sessionSummary.cashInUsd, 'USD')} − Sorties{' '}
                    {formatMoney(sessionSummary.movementsOutUsd + sessionSummary.cashRefundsUsd, 'USD')}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3">
                  <p className="text-[11px] font-medium text-[var(--rc-muted)]">Tiroir Espèces CDF attendu</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[var(--rc-gold)] mt-0.5">
                    {formatMoney(sessionSummary.expectedCashCdf, 'CDF')}
                  </p>
                  <p className="text-[11px] text-[var(--rc-muted)] mt-0.5">
                    Fond {formatMoney(sessionSummary.openingCdf, 'CDF')} + Ventes{' '}
                    {formatMoney(sessionSummary.cashInCdf, 'CDF')} − Sorties{' '}
                    {formatMoney(sessionSummary.movementsOutCdf + sessionSummary.cashRefundsCdf, 'CDF')}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-card)] p-3">
                  <p className="text-[11px] font-medium text-[var(--rc-muted)]">Mobile Money (sur place)</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--rc-fg)] mt-0.5">
                    {formatMoney(sessionSummary.nonCashMobileMoneyUsd, 'USD')}
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--rc-muted)]">
                    {formatMoney(sessionSummary.nonCashMobileMoneyCdf, 'CDF')}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-card)] p-3">
                  <p className="text-[11px] font-medium text-[var(--rc-muted)]">Carte TPE &amp; Autre</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--rc-fg)] mt-0.5">
                    {formatMoney(sessionSummary.nonCashCardUsd + sessionSummary.nonCashOtherUsd, 'USD')}
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--rc-muted)]">
                    {formatMoney(sessionSummary.nonCashCardCdf + sessionSummary.nonCashOtherCdf, 'CDF')}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Formulaire mouvement de caisse */}
          {activeSession && showMovementForm && (
            <form
              onSubmit={handleRecordMovement}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] p-4 items-end"
            >
              <div className="space-y-1">
                <Label htmlFor="mov-type" className="text-xs">Type</Label>
                <select
                  id="mov-type"
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as 'in' | 'out')}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="out">Sortie de caisse</option>
                  <option value="in">Entrée de caisse</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov-curr" className="text-xs">Devise</Label>
                <select
                  id="mov-curr"
                  value={movCurrency}
                  onChange={(e) => setMovCurrency(e.target.value as CurrencyCode)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov-amt" className="text-xs">Montant *</Label>
                <Input
                  id="mov-amt"
                  type="number"
                  min={movCurrency === 'CDF' ? '1' : '0.01'}
                  step="any"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov-reason" className="text-xs">Motif obligatoire *</Label>
                <Input
                  id="mov-reason"
                  placeholder="ex: Achat glace / Appoint monnaie"
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1">Enregistrer</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMovementForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          )}

          {/* Formulaire clôture de caisse */}
          {activeSession && showCloseForm && sessionSummary && (
            <form
              onSubmit={handleCloseSession}
              className="rounded-md border border-[var(--rc-gold)] bg-[var(--rc-bg-subtle)] p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold text-[var(--rc-fg)]">
                  Clôture journalière &amp; comptage réel du tiroir
                </p>
                <span className="text-xs text-[var(--rc-muted)]">
                  Attendu : <strong className="font-mono text-[var(--rc-fg)]">{formatMoney(sessionSummary.expectedCashUsd, 'USD')}</strong> ·{' '}
                  <strong className="font-mono text-[var(--rc-fg)]">{formatMoney(sessionSummary.expectedCashCdf, 'CDF')}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="close-usd" className="text-xs">Montant réel compté USD *</Label>
                  <Input
                    id="close-usd"
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedUsd}
                    onChange={(e) => setCountedUsd(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="close-cdf" className="text-xs">Montant réel compté CDF *</Label>
                  <Input
                    id="close-cdf"
                    type="number"
                    min="0"
                    step="1"
                    value={countedCdf}
                    onChange={(e) => setCountedCdf(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="close-notes" className="text-xs">Observations / justification</Label>
                  <Input
                    id="close-notes"
                    placeholder="Commentaire de fin de service..."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>
              </div>

              {closeDiscrepancyPreview && (
                <div
                  className={`rounded border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
                    closeDiscrepancyPreview.status === 'closed_with_discrepancy'
                      ? 'border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] text-[var(--rc-warn-fg)]'
                      : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                  }`}
                >
                  <span>
                    {closeDiscrepancyPreview.status === 'closed_with_discrepancy'
                      ? 'Écart détecté à la clôture (sera consigné dans le rapport)'
                      : 'Comptage conforme au solde théorique'}
                  </span>
                  <span className="font-mono font-semibold">
                    Écart USD : {closeDiscrepancyPreview.discrepancyUsd >= 0 ? '+' : ''}
                    {closeDiscrepancyPreview.discrepancyUsd.toFixed(2)} $ · Écart CDF :{' '}
                    {closeDiscrepancyPreview.discrepancyCdf >= 0 ? '+' : ''}
                    {closeDiscrepancyPreview.discrepancyCdf.toLocaleString('fr-FR')} CDF
                  </span>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCloseForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" size="sm">
                  Confirmer &amp; Verrouiller la clôture
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
            feedback.type === 'error'
              ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
              : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* NAVIGATION SOUS-ONGLETS CAISSE */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] p-1.5">
        {(
          [
            { id: 'pos', label: 'Encaissement POS' },
            { id: 'transactions', label: `Transactions & Remboursements (${tenantTransactions.length})` },
            { id: 'receipts_closures', label: `Reçus (${tenantReceipts.length}) & Clôtures (${tenantClosures.length})` },
          ] as Array<{ id: PosTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPosTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              posTab === tab.id
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ONGLET 1 : ENCAISSEMENT POS */}
      {posTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Liste des commandes */}
          <Card className="lg:col-span-5">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Commandes ({filteredOrders.length})</CardTitle>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 text-[var(--rc-muted)] absolute left-3 top-2.5" aria-hidden="true" />
                <Input
                  aria-label="Rechercher une commande"
                  placeholder="N° commande, client, téléphone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: 'to_collect', label: 'À encaisser' },
                    { key: 'partial', label: 'Partielles' },
                    { key: 'paid', label: 'Payées' },
                    { key: 'all', label: 'Toutes' },
                  ] as Array<{ key: OrderFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setOrderFilter(f.key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                      orderFilter === f.key
                        ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold border-[var(--rc-gold)]'
                        : 'bg-[var(--rc-bg-subtle)] text-[var(--rc-muted)] border-[var(--rc-border)] hover:text-[var(--rc-fg)]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[540px] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <p className="text-xs text-center text-[var(--rc-muted)] py-8">
                  Aucune commande dans ce filtre.
                </p>
              ) : (
                filteredOrders.map(({ order, summary }) => {
                  const isSelected = selectedOrder?.id === order.id;
                  const payMeta = getOrderPaymentStatusLabel(summary.paymentStatus);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => selectOrder(order.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'border-[var(--rc-gold)] bg-[var(--rc-gold-tint)]'
                          : 'border-[var(--rc-border)] bg-[var(--rc-card)] hover:bg-[var(--rc-card-elevated)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--rc-fg)]">
                          {order.order_number}
                        </span>
                        <StatusLabel label={payMeta.label} tone={payMeta.tone} />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[var(--rc-muted)]">
                        <span className="truncate">
                          {order.customer_name ?? 'Client comptoir'} ·{' '}
                          {order.order_type === 'dine_in'
                            ? 'Sur place'
                            : order.order_type === 'takeaway'
                              ? 'À emporter'
                              : 'Livraison'}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[var(--rc-fg)] shrink-0">
                          {formatMoney(summary.totalAmount, summary.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-[var(--rc-success-fg)]">
                          Payé : {formatMoney(summary.paidAmount, summary.currency)}
                        </span>
                        <span className={summary.remainingAmount > 0 ? 'text-[var(--rc-warn-fg)] font-semibold' : 'text-[var(--rc-muted)]'}>
                          Reste : {formatMoney(summary.remainingAmount, summary.currency)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Panneau d'encaissement rapide */}
          <Card className="lg:col-span-7">
            {!selectedOrder || !selectedSummary ? (
              <CardContent className="py-12 text-center text-xs text-[var(--rc-muted)]">
                Sélectionnez une commande pour enregistrer un paiement sur place ou afficher son reçu.
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b border-[var(--rc-border)] pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-mono text-lg">
                        {selectedOrder.order_number} · {selectedOrder.customer_name ?? 'Client comptoir'}
                      </CardTitle>
                      <CardDescription>
                        {selectedOrder.customer_phone ?? 'Sans téléphone'} ·{' '}
                        {selectedOrder.notes ?? 'Paiement sur place'}
                      </CardDescription>
                    </div>
                    <StatusLabel
                      label={getOrderPaymentStatusLabel(selectedSummary.paymentStatus).label}
                      tone={getOrderPaymentStatusLabel(selectedSummary.paymentStatus).tone}
                    />
                  </div>

                  {/* Résumé financier commande */}
                  <div className="grid grid-cols-3 gap-2 pt-3">
                    <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-2.5">
                      <p className="text-[11px] text-[var(--rc-muted)]">Montant total</p>
                      <p className="font-mono text-sm font-bold tabular-nums">
                        {formatMoney(selectedSummary.totalAmount, selectedSummary.currency)}
                      </p>
                    </div>
                    <div className="rounded-md border border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] p-2.5">
                      <p className="text-[11px] text-[var(--rc-success-fg)]">Déjà payé</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-[var(--rc-success-fg)]">
                        {formatMoney(selectedSummary.paidAmount, selectedSummary.currency)}
                      </p>
                    </div>
                    <div className="rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-2.5">
                      <p className="text-[11px] text-[var(--rc-warn-fg)]">Reste à payer</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-[var(--rc-warn-fg)]">
                        {formatMoney(selectedSummary.remainingAmount, selectedSummary.currency)}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-5">
                  {/* Lignes de la commande */}
                  <div className="rounded-md border border-[var(--rc-border)] divide-y divide-[var(--rc-border)] text-xs">
                    {orderItems
                      .filter((oi) => oi.order_id === selectedOrder.id)
                      .map((oi) => {
                        const opts = orderItemOptions.filter((o) => o.order_item_id === oi.id);
                        return (
                          <div key={oi.id} className="px-3 py-2 flex items-center justify-between gap-3">
                            <div>
                              <span className="font-medium">
                                {oi.quantity}× {oi.product_name_snapshot ?? oi.product_id}
                              </span>
                              {(oi.options_summary || opts.length > 0) && (
                                <p className="text-[11px] text-[var(--rc-muted)]">
                                  {oi.options_summary ??
                                    opts
                                      .map((o) => `${o.option_name_snapshot}: ${o.value_label_snapshot}`)
                                      .join(' · ')}
                                </p>
                              )}
                            </div>
                            <span className="font-mono tabular-nums">
                              {formatMoney(oi.line_total, selectedOrder.currency)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Formulaire d'encaissement */}
                  {selectedSummary.remainingAmount <= (selectedOrder.currency === 'CDF' ? 1 : 0.01) ? (
                    <div className="rounded-md border border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] p-3 text-xs text-[var(--rc-success-fg)] font-medium">
                      Commande intégralement réglée. Tout encaissement supplémentaire est bloqué pour éviter les doublons.
                    </div>
                  ) : !canCollect ? (
                    <div className="rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-3 text-xs text-[var(--rc-warn-fg)]">
                      Votre rôle actuel ne dispose pas de la permission d&apos;encaissement.
                    </div>
                  ) : (
                    <form onSubmit={handleCollectPayment} className="space-y-4">
                      {!activeSession && (
                        <div className="rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-2.5 text-xs text-[var(--rc-warn-fg)]">
                          Aucune session de caisse ouverte : ouvrez d&apos;abord une session ci-dessus pour enregistrer l&apos;encaissement.
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs">Mode de paiement sur place</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {methodChoices.map((m) => {
                            const Icon = m.icon;
                            const active = payMethod === m.key;
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => handleMethodSelect(m.key)}
                                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold border-[var(--rc-gold)]'
                                    : 'bg-[var(--rc-card)] text-[var(--rc-fg)] border-[var(--rc-border-strong)] hover:bg-[var(--rc-card-elevated)]'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{m.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="pos-context" className="text-xs">Contexte du paiement</Label>
                          <select
                            id="pos-context"
                            value={payContext}
                            onChange={(e) => setPayContext(e.target.value as PaymentContext)}
                            className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                          >
                            {CONTEXT_OPTIONS.map((ctx) => (
                              <option key={ctx} value={ctx}>
                                {PAYMENT_CONTEXT_LABELS[ctx]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="pos-currency" className="text-xs">Devise encaissée</Label>
                          <select
                            id="pos-currency"
                            value={payCurrency}
                            disabled={payMethod === 'cash_usd' || payMethod === 'cash_cdf'}
                            onChange={(e) => handleCurrencySelect(e.target.value as CurrencyCode)}
                            className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm disabled:opacity-75"
                          >
                            <option value="USD">USD (Dollar américain)</option>
                            <option value="CDF">CDF (Franc congolais)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor="pos-amount" className="text-xs">
                            Montant reçu ({payCurrency}) *
                          </Label>
                          <div className="flex items-center gap-1.5">
                            {restaurant.allow_partial_payments !== false && (
                              <button
                                type="button"
                                onClick={() => fillFraction(0.5)}
                                className="px-2 py-0.5 rounded border border-[var(--rc-border-strong)] bg-[var(--rc-bg-subtle)] text-[var(--rc-fg)] text-[11px] font-medium hover:bg-[var(--rc-card-elevated)] cursor-pointer"
                              >
                                50% (Acompte)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => fillFraction(1)}
                              className="px-2 py-0.5 rounded border border-[var(--rc-gold)] bg-[var(--rc-gold-tint)] text-[var(--rc-gold-text)] text-[11px] font-semibold cursor-pointer"
                            >
                              Solde complet
                            </button>
                          </div>
                        </div>
                        <Input
                          id="pos-amount"
                          type="number"
                          min={payCurrency === 'CDF' ? '1' : '0.01'}
                          step="any"
                          placeholder={payCurrency === 'CDF' ? '0' : '0.00'}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="font-mono text-base"
                          required
                        />
                        <p className="text-[11px] text-[var(--rc-muted)]">
                          Équivalent commande :{' '}
                          <strong className="font-mono text-[var(--rc-fg)]">
                            {formatMoney(convertedPreview, selectedOrder.currency)}
                          </strong>{' '}
                          · Taux verrouillé à la validation : 1 USD ={' '}
                          {currentRate.toLocaleString('fr-FR')} CDF
                          {restaurant.allow_partial_payments === false &&
                            ' · Paiements partiels désactivés pour ce restaurant.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="pos-ref" className="text-xs">
                            Référence{' '}
                            {payMethod === 'mobile_money' || payMethod === 'card'
                              ? '(obligatoire) *'
                              : '(optionnelle)'}
                          </Label>
                          <Input
                            id="pos-ref"
                            placeholder="Réf. M-Pesa / Airtel / TPE..."
                            value={payRef}
                            onChange={(e) => setPayRef(e.target.value)}
                            required={payMethod === 'mobile_money' || payMethod === 'card'}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pos-note" className="text-xs">Note interne</Label>
                          <Input
                            id="pos-note"
                            placeholder="Remarque caissier..."
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                          />
                        </div>
                      </div>

                      <Button type="submit" className="w-full" disabled={!activeSession}>
                        Valider l&apos;encaissement &amp; Générer le reçu
                      </Button>
                    </form>
                  )}

                  {/* Paiements & Reçus existants sur cette commande */}
                  {tenantReceipts.some((r) => r.order_id === selectedOrder.id) && (
                    <div className="border-t border-[var(--rc-border)] pt-3 space-y-2">
                      <p className="text-xs font-semibold text-[var(--rc-fg)]">Reçus émis sur cette commande</p>
                      <div className="space-y-1.5">
                        {tenantReceipts
                          .filter((r) => r.order_id === selectedOrder.id)
                          .map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between gap-2 rounded border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-mono font-semibold">{r.receipt_number}</span> ·{' '}
                                <span>{r.snapshot_json.paymentMethodLabel}</span> ·{' '}
                                <span className="font-mono">
                                  {formatMoney(
                                    r.snapshot_json.amountPaidThisReceipt,
                                    r.snapshot_json.paymentCurrency
                                  )}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveReceipt(r)}
                              >
                                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Voir reçu</span>
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ONGLET 2 : TRANSACTIONS & REMBOURSEMENTS */}
      {posTab === 'transactions' && (
        <div className="space-y-6">
          {!canRefund && !canCorrect && (
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3 text-xs text-[var(--rc-muted)]">
              Les remboursements et corrections d&apos;encaissements sont réservés au Gestionnaire et à l&apos;Administrateur (permissions <code className="font-mono">payments.refund</code> et <code className="font-mono">cash.correct</code>).
            </div>
          )}

          {/* Modale inline Remboursement borné */}
          {refundTargetTx && (
            <Card className="border-[var(--rc-danger-border)]">
              <CardHeader>
                <CardTitle className="text-base">
                  Remboursement borné · {refundTargetTx.transaction_number}
                </CardTitle>
                <CardDescription>
                  Encaissement initial : {formatMoney(refundTargetTx.amount, refundTargetTx.currency)} · Taux verrouillé : 1 USD = {refundTargetTx.exchange_rate_applied} CDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRefundSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="ref-amt" className="text-xs">
                      Montant ({refundTargetTx.currency}) *
                    </Label>
                    <Input
                      id="ref-amt"
                      type="number"
                      min={refundTargetTx.currency === 'CDF' ? '1' : '0.01'}
                      step="any"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ref-meth" className="text-xs">Mode de restitution</Label>
                    <select
                      id="ref-meth"
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value as CashPaymentMethod)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                    >
                      <option value="cash_usd">Espèces USD</option>
                      <option value="cash_cdf">Espèces CDF</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Carte bancaire</option>
                      <option value="other">Autre mode</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ref-reason" className="text-xs">Motif obligatoire *</Label>
                    <Input
                      id="ref-reason"
                      placeholder="Article indisponible, erreur..."
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1">Valider remboursement</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRefundTargetTx(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Modale inline Annulation / Correction */}
          {voidTargetTx && (
            <Card className="border-[var(--rc-gold)]">
              <CardHeader>
                <CardTitle className="text-base">
                  Annulation / Correction tracée · {voidTargetTx.transaction_number}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVoidSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full space-y-1">
                    <Label htmlFor="void-reason" className="text-xs">Motif de correction obligatoire *</Label>
                    <Input
                      id="void-reason"
                      placeholder="Erreur de saisie montant ou mode..."
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Confirmer annulation</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setVoidTargetTx(null)}>
                      Fermer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Journal des transactions d&apos;encaissement ({tenantTransactions.length})</CardTitle>
              <CardDescription>
                Historique immuable avec taux de change verrouillé par transaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">N° Transaction</th>
                      <th className="px-4 py-3">Commande</th>
                      <th className="px-4 py-3">Mode &amp; Contexte</th>
                      <th className="px-4 py-3 text-right">Encaissé</th>
                      <th className="px-4 py-3 text-right">Équivalent (taux figé)</th>
                      <th className="px-4 py-3">Caissier</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-[var(--rc-muted)]">
                          Aucune transaction enregistrée pour le moment.
                        </td>
                      </tr>
                    ) : (
                      tenantTransactions.map((tx) => {
                        const ord = tenantOrders.find((o) => o.id === tx.order_id);
                        const linkedReceipt = tenantReceipts.find(
                          (r) => r.payment_transaction_id === tx.id && r.receipt_type !== 'refund'
                        );
                        return (
                          <tr key={tx.id} className={`hover:bg-[var(--rc-card-elevated)] ${tx.status !== 'confirmed' ? 'opacity-65' : ''}`}>
                            <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                              {tx.transaction_number}
                            </td>
                            <td className="px-4 py-3 font-mono whitespace-nowrap">
                              {ord?.order_number ?? tx.order_id}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium">
                                {getPaymentMethodLabel(tx.payment_method, restaurant.custom_payment_method_label)}
                              </p>
                              <p className="text-[11px] text-[var(--rc-muted)]">
                                {PAYMENT_CONTEXT_LABELS[tx.payment_context]}
                                {tx.reference_code ? ` · Réf: ${tx.reference_code}` : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {formatMoney(tx.amount, tx.currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                              <p>{formatMoney(tx.converted_amount_order_currency, tx.order_currency)}</p>
                              <p className="text-[10px] text-[var(--rc-muted)]">
                                1 USD = {tx.exchange_rate_applied.toLocaleString('fr-FR')} CDF
                              </p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{tx.cashier_name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusLabel
                                label={tx.status === 'confirmed' ? 'Confirmé' : 'Annulé'}
                                tone={tx.status === 'confirmed' ? 'emerald' : 'crimson'}
                              />
                              {tx.void_or_correction_reason && (
                                <p className="text-[10px] text-[var(--rc-danger-fg)] mt-0.5">
                                  {tx.void_or_correction_reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {linkedReceipt && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActiveReceipt(linkedReceipt)}
                                  >
                                    <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Reçu</span>
                                  </Button>
                                )}
                                {tx.status === 'confirmed' && canRefund && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRefundTargetTx(tx);
                                      setRefundAmount(String(tx.amount));
                                      setRefundMethod(tx.currency === 'CDF' ? 'cash_cdf' : 'cash_usd');
                                    }}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Rembourser</span>
                                  </Button>
                                )}
                                {tx.status === 'confirmed' && canCorrect && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setVoidTargetTx(tx)}
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-[var(--rc-danger-fg)]" aria-hidden="true" />
                                    <span>Annuler</span>
                                  </Button>
                                )}
                              </div>
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

          {tenantRefunds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historique des remboursements ({tenantRefunds.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                        <th className="px-4 py-3">N°</th>
                        <th className="px-4 py-3">Motif</th>
                        <th className="px-4 py-3">Responsable</th>
                        <th className="px-4 py-3 text-right">Montant remboursé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rc-border)]">
                      {tenantRefunds.map((rf) => (
                        <tr key={rf.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono font-semibold">{rf.refund_number}</td>
                          <td className="px-4 py-3">{rf.reason}</td>
                          <td className="px-4 py-3">{rf.responsible_name}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--rc-danger-fg)]">
                            -{formatMoney(rf.amount, rf.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ONGLET 3 : ARCHIVE REÇUS & CLÔTURES */}
      {posTab === 'receipts_closures' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Historique des reçus ({filteredReceipts.length})</CardTitle>
                <CardDescription>
                  Archive immuable des reçus standard, partiels et remboursements.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-[var(--rc-muted)] absolute left-3 top-2.5" aria-hidden="true" />
                <Input
                  placeholder="N° reçu, commande, client..."
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">N° Reçu</th>
                      <th className="px-4 py-3">Commande &amp; Client</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Caissier</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[var(--rc-muted)]">
                          Aucun reçu généré pour le moment.
                        </td>
                      </tr>
                    ) : (
                      filteredReceipts.map((r) => (
                        <tr key={r.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono font-semibold">{r.receipt_number}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono">{r.snapshot_json.orderNumber}</span> ·{' '}
                            {r.snapshot_json.customerName}
                          </td>
                          <td className="px-4 py-3">
                            <StatusLabel
                              label={
                                r.receipt_type === 'refund'
                                  ? 'Remboursement'
                                  : r.receipt_type === 'partial'
                                    ? 'Partiel'
                                    : 'Standard'
                              }
                              tone={
                                r.receipt_type === 'refund'
                                  ? 'crimson'
                                  : r.receipt_type === 'partial'
                                    ? 'amber'
                                    : 'emerald'
                              }
                            />
                          </td>
                          <td className="px-4 py-3">{r.cashier_name}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {formatMoney(
                              r.snapshot_json.amountPaidThisReceipt,
                              r.snapshot_json.paymentCurrency
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveReceipt(r)}
                            >
                              Réafficher / Imprimer
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {adjustClosureId && (
            <Card className="border-[var(--rc-gold)]">
              <CardHeader>
                <CardTitle className="text-base">Rectification d&apos;une clôture verrouillée</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdjustClosure} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="adj-usd" className="text-xs">Nouveau comptage USD</Label>
                    <Input
                      id="adj-usd"
                      type="number"
                      step="0.01"
                      value={adjUsd}
                      onChange={(e) => setAdjUsd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="adj-cdf" className="text-xs">Nouveau comptage CDF</Label>
                    <Input
                      id="adj-cdf"
                      type="number"
                      step="1"
                      value={adjCdf}
                      onChange={(e) => setAdjCdf(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="adj-reason" className="text-xs">Motif obligatoire *</Label>
                    <Input
                      id="adj-reason"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Rectifier</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAdjustClosureId(null)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Clôtures de caisse verrouillées ({tenantClosures.length})</CardTitle>
              <CardDescription>
                Comparaison théorique vs réel séparée en USD et CDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Date clôture</th>
                      <th className="px-4 py-3">Caissier</th>
                      <th className="px-4 py-3 text-right">Attendu USD / CDF</th>
                      <th className="px-4 py-3 text-right">Compté USD / CDF</th>
                      <th className="px-4 py-3 text-right">Écarts USD / CDF</th>
                      <th className="px-4 py-3">Statut</th>
                      {canCorrect && <th className="px-4 py-3 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantClosures.length === 0 ? (
                      <tr>
                        <td colSpan={canCorrect ? 7 : 6} className="px-4 py-8 text-center text-[var(--rc-muted)]">
                          Aucune clôture enregistrée pour le moment.
                        </td>
                      </tr>
                    ) : (
                      tenantClosures.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                            {c.closed_at.replace('T', ' ').slice(0, 16)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{c.cashier_name}</p>
                            {c.correction_reason && (
                              <p className="text-[11px] text-[var(--rc-warn-fg)]">Rectifiée : {c.correction_reason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <p>{formatMoney(c.expected_usd, 'USD')}</p>
                            <p className="text-[var(--rc-muted)]">{formatMoney(c.expected_cdf, 'CDF')}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <p>{formatMoney(c.counted_usd, 'USD')}</p>
                            <p className="text-[var(--rc-muted)]">{formatMoney(c.counted_cdf, 'CDF')}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <p className={Math.abs(c.discrepancy_usd) >= 0.01 ? 'text-[var(--rc-danger-fg)] font-semibold' : ''}>
                              {c.discrepancy_usd >= 0 ? '+' : ''}
                              {c.discrepancy_usd.toFixed(2)} $
                            </p>
                            <p className={Math.abs(c.discrepancy_cdf) >= 1 ? 'text-[var(--rc-danger-fg)] font-semibold' : 'text-[var(--rc-muted)]'}>
                              {c.discrepancy_cdf >= 0 ? '+' : ''}
                              {c.discrepancy_cdf.toLocaleString('fr-FR')} CDF
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusLabel
                              label={
                                c.status === 'closed_with_discrepancy'
                                  ? 'Clôturée avec écart'
                                  : 'Conforme'
                              }
                              tone={c.status === 'closed_with_discrepancy' ? 'amber' : 'emerald'}
                            />
                          </td>
                          {canCorrect && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAdjustClosureId(c.id);
                                  setAdjUsd(String(c.counted_usd));
                                  setAdjCdf(String(c.counted_cdf));
                                }}
                              >
                                Rectifier
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {tenantMovements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mouvements manuels de caisse ({tenantMovements.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] font-semibold text-[var(--rc-muted)]">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Motif</th>
                        <th className="px-4 py-3">Auteur</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rc-border)]">
                      {tenantMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono">{m.created_at.replace('T', ' ').slice(0, 16)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-medium">
                              {m.movement_type === 'in' ? (
                                <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--rc-success-fg)]" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--rc-danger-fg)]" />
                              )}
                              {m.movement_type === 'in' ? 'Entrée' : 'Sortie'}
                            </span>
                          </td>
                          <td className="px-4 py-3">{m.reason}</td>
                          <td className="px-4 py-3">{m.performed_by_label}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {m.movement_type === 'out' ? '-' : '+'}
                            {formatMoney(m.amount, m.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
