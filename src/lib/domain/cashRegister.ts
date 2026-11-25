import type {
  CashClosureRecord,
  CashMovementRecord,
  CashPaymentMethod,
  CashSessionRecord,
  CurrencyCode,
  OrderPaymentStatus,
  OrderRecord,
  PaymentContext,
  PaymentTransactionRecord,
  RefundRecord,
  RestaurantRecord,
} from '../supabase/database.types';
import { isTimestampInPeriod, type PeriodFilter } from './analytics';
import { convertCurrencyAmount } from './operations';

export const PAYMENT_CONTEXT_LABELS: Record<PaymentContext, string> = {
  counter: 'À la caisse',
  takeaway: 'Retrait commande',
  delivery: 'À la livraison',
  table: 'Sur place / Table',
};

export function getPaymentMethodLabel(
  method: CashPaymentMethod | 'cash' | 'bank_transfer',
  customLabel?: string | null
): string {
  switch (method) {
    case 'cash_usd':
      return 'Espèces USD';
    case 'cash_cdf':
      return 'Espèces CDF';
    case 'cash':
      return 'Espèces';
    case 'mobile_money':
      return 'Mobile Money (sur place)';
    case 'card':
      return 'Carte bancaire (TPE)';
    case 'bank_transfer':
      return 'Virement';
    case 'other':
      return customLabel?.trim() || 'Autre mode configurable';
  }
}

export function getOrderPaymentStatusLabel(status?: OrderPaymentStatus): {
  label: string;
  tone: 'emerald' | 'amber' | 'crimson' | 'neutral';
} {
  switch (status) {
    case 'paid':
    case 'confirmed':
      return { label: 'Payé', tone: 'emerald' };
    case 'partial':
      return { label: 'Paiement partiel', tone: 'amber' };
    case 'refunded':
      return { label: 'Remboursé', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Annulé', tone: 'crimson' };
    case 'failed':
      return { label: 'Échoué', tone: 'crimson' };
    case 'unpaid':
    case 'pending':
    default:
      return { label: 'Non payé', tone: 'amber' };
  }
}

function roundForCurrency(amount: number, currency: CurrencyCode): number {
  if (currency === 'CDF') return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

function currencyTolerance(currency: CurrencyCode): number {
  return currency === 'CDF' ? 1 : 0.01;
}

export interface OrderPaymentSummary {
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  currency: CurrencyCode;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'cancelled';
}

export function calculateOrderPaymentSummary(
  order: OrderRecord,
  paymentTransactions: readonly PaymentTransactionRecord[],
  refunds: readonly RefundRecord[]
): OrderPaymentSummary {
  const currency = order.currency;
  const tol = currencyTolerance(currency);

  if (order.status === 'cancelled' || order.payment_status === 'cancelled') {
    return {
      totalAmount: order.total_amount,
      paidAmount: 0,
      refundedAmount: 0,
      netPaidAmount: 0,
      remainingAmount: 0,
      currency,
      paymentStatus: 'cancelled',
    };
  }

  const confirmedTxs = paymentTransactions.filter(
    (tx) =>
      tx.order_id === order.id &&
      tx.restaurant_id === order.restaurant_id &&
      tx.status === 'confirmed'
  );

  const txPaidSum = roundForCurrency(
    confirmedTxs.reduce((sum, tx) => sum + tx.converted_amount_order_currency, 0),
    currency
  );

  // Fallback si la commande a été marquée payée avant création des transactions détaillées
  const paidAmount =
    confirmedTxs.length > 0
      ? txPaidSum
      : roundForCurrency(
          order.paid_amount ?? (order.payment_status === 'paid' || order.payment_status === 'confirmed' ? order.total_amount : 0),
          currency
        );

  const orderRefunds = refunds.filter(
    (r) => r.order_id === order.id && r.restaurant_id === order.restaurant_id
  );
  const refundedAmount = roundForCurrency(
    orderRefunds.reduce((sum, r) => sum + r.converted_amount_order_currency, 0),
    currency
  );

  const netPaidAmount = Math.max(0, roundForCurrency(paidAmount - refundedAmount, currency));
  const remainingAmount = Math.max(0, roundForCurrency(order.total_amount - paidAmount, currency));

  let paymentStatus: OrderPaymentSummary['paymentStatus'] = 'unpaid';
  if (refundedAmount > tol && netPaidAmount <= tol) {
    paymentStatus = 'refunded';
  } else if (paidAmount >= order.total_amount - tol) {
    paymentStatus = 'paid';
  } else if (paidAmount > tol) {
    paymentStatus = 'partial';
  }

  return {
    totalAmount: order.total_amount,
    paidAmount,
    refundedAmount,
    netPaidAmount,
    remainingAmount,
    currency,
    paymentStatus,
  };
}

export interface ValidateOrderPaymentInput {
  restaurant: RestaurantRecord;
  order: OrderRecord;
  paymentTransactions: readonly PaymentTransactionRecord[];
  refunds: readonly RefundRecord[];
  activeSession?: CashSessionRecord | null;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: CashPaymentMethod;
  paymentContext: PaymentContext;
  referenceCode?: string;
  requireOpenSession?: boolean;
}

export function validateOrderPaymentInput(
  input: ValidateOrderPaymentInput
):
  | {
      ok: true;
      exchangeRateApplied: number;
      convertedAmountOrderCurrency: number;
      nextPaidAmount: number;
      nextRemainingAmount: number;
      nextPaymentStatus: 'partial' | 'paid';
      isPartial: boolean;
    }
  | { ok: false; error: string } {
  const {
    restaurant,
    order,
    paymentTransactions,
    refunds,
    activeSession,
    amount,
    currency,
    paymentMethod,
    referenceCode,
    requireOpenSession = false,
  } = input;

  if (order.restaurant_id !== restaurant.id) {
    return { ok: false, error: 'Commande isolée sur un autre établissement.' };
  }
  if (order.status === 'cancelled' || order.payment_status === 'cancelled') {
    return { ok: false, error: "Impossible d'encaisser une commande annulée." };
  }

  if (requireOpenSession) {
    if (!activeSession || activeSession.restaurant_id !== restaurant.id || activeSession.status !== 'open') {
      return {
        ok: false,
        error: 'Ouvrez une session de caisse pour ce restaurant avant d’enregistrer un encaissement.',
      };
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Le montant encaissé doit être strictement supérieur à zéro.' };
  }

  if (paymentMethod === 'cash_usd' && currency !== 'USD') {
    return { ok: false, error: 'Le mode Espèces USD requiert une saisie en USD.' };
  }
  if (paymentMethod === 'cash_cdf' && currency !== 'CDF') {
    return { ok: false, error: 'Le mode Espèces CDF requiert une saisie en CDF.' };
  }

  if ((paymentMethod === 'mobile_money' || paymentMethod === 'card') && !referenceCode?.trim()) {
    return {
      ok: false,
      error: 'Saisissez la référence Mobile Money ou le numéro d’autorisation TPE.',
    };
  }

  const summary = calculateOrderPaymentSummary(order, paymentTransactions, refunds);
  const orderTol = currencyTolerance(order.currency);

  if (summary.remainingAmount <= orderTol) {
    return {
      ok: false,
      error: 'Cette commande est déjà intégralement payée. Double encaissement bloqué.',
    };
  }

  const exchangeRateApplied =
    restaurant.exchange_rate_usd_cdf > 0 ? restaurant.exchange_rate_usd_cdf : 2850;
  const convertedAmountOrderCurrency = convertCurrencyAmount(
    amount,
    currency,
    order.currency,
    exchangeRateApplied
  );

  // Marge de tolérance d'arrondi multi-devises (ex: 5 CDF ou 0.05 USD)
  const overpaymentSlack = order.currency === 'CDF' ? 50 : 0.05;
  if (convertedAmountOrderCurrency > summary.remainingAmount + overpaymentSlack) {
    return {
      ok: false,
      error: `Le montant (${convertedAmountOrderCurrency} ${order.currency}) dépasse le solde restant à payer (${summary.remainingAmount} ${order.currency}).`,
    };
  }

  const cappedConverted = Math.min(summary.remainingAmount, convertedAmountOrderCurrency);
  const nextPaidAmount = roundForCurrency(summary.paidAmount + cappedConverted, order.currency);
  const nextRemainingAmount = Math.max(
    0,
    roundForCurrency(order.total_amount - nextPaidAmount, order.currency)
  );
  const isPartial = nextRemainingAmount > orderTol;

  if (isPartial && restaurant.allow_partial_payments === false) {
    return {
      ok: false,
      error: "Les paiements partiels ne sont pas activés pour cet établissement. Encaissez le solde complet.",
    };
  }

  return {
    ok: true,
    exchangeRateApplied,
    convertedAmountOrderCurrency: cappedConverted,
    nextPaidAmount,
    nextRemainingAmount,
    nextPaymentStatus: isPartial ? 'partial' : 'paid',
    isPartial,
  };
}

export function validateRefundInput(input: {
  restaurant: RestaurantRecord;
  order: OrderRecord;
  transaction: PaymentTransactionRecord;
  existingTransactions: readonly PaymentTransactionRecord[];
  existingRefunds: readonly RefundRecord[];
  amount: number;
  reason: string;
}):
  | {
      ok: true;
      currency: CurrencyCode;
      exchangeRateApplied: number;
      convertedAmountOrderCurrency: number;
    }
  | { ok: false; error: string } {
  const { order, transaction, existingTransactions, existingRefunds, amount, reason } = input;

  if (!reason.trim()) {
    return { ok: false, error: 'Un motif de remboursement est obligatoire.' };
  }
  if (
    transaction.restaurant_id !== input.restaurant.id ||
    order.restaurant_id !== input.restaurant.id ||
    transaction.order_id !== order.id
  ) {
    return { ok: false, error: 'Transaction ou commande non rattachée à cet établissement.' };
  }
  if (transaction.status !== 'confirmed') {
    return { ok: false, error: 'Seule une transaction confirmée peut faire l’objet d’un remboursement.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Le montant du remboursement doit être strictement positif.' };
  }

  const txTol = currencyTolerance(transaction.currency);
  const alreadyRefundedOnTx = existingRefunds
    .filter((r) => r.payment_transaction_id === transaction.id)
    .reduce((sum, r) => sum + r.amount, 0);

  const maxRefundableOnTx = roundForCurrency(
    transaction.amount - alreadyRefundedOnTx,
    transaction.currency
  );
  if (amount > maxRefundableOnTx + txTol) {
    return {
      ok: false,
      error: `Remboursement refusé : solde remboursable sur cette transaction = ${maxRefundableOnTx} ${transaction.currency}.`,
    };
  }

  const orderSummary = calculateOrderPaymentSummary(order, existingTransactions, existingRefunds);
  const lockedRate = transaction.exchange_rate_applied;
  const convertedAmountOrderCurrency = Math.min(
    orderSummary.netPaidAmount,
    convertCurrencyAmount(amount, transaction.currency, order.currency, lockedRate)
  );

  if (convertedAmountOrderCurrency <= 0) {
    return { ok: false, error: 'Aucun montant net encaissé disponible pour remboursement.' };
  }

  return {
    ok: true,
    currency: transaction.currency,
    exchangeRateApplied: lockedRate,
    convertedAmountOrderCurrency,
  };
}

export interface CashSessionSummary {
  sessionId: string;
  openingUsd: number;
  openingCdf: number;
  cashInUsd: number;
  cashInCdf: number;
  nonCashMobileMoneyUsd: number;
  nonCashMobileMoneyCdf: number;
  nonCashCardUsd: number;
  nonCashCardCdf: number;
  nonCashOtherUsd: number;
  nonCashOtherCdf: number;
  movementsInUsd: number;
  movementsInCdf: number;
  movementsOutUsd: number;
  movementsOutCdf: number;
  cashRefundsUsd: number;
  cashRefundsCdf: number;
  expectedCashUsd: number;
  expectedCashCdf: number;
  confirmedTxCount: number;
}

export function computeCashSessionSummary(params: {
  session: CashSessionRecord;
  transactions: readonly PaymentTransactionRecord[];
  movements: readonly CashMovementRecord[];
  refunds: readonly RefundRecord[];
}): CashSessionSummary {
  const { session, transactions, movements, refunds } = params;

  const sessionTxs = transactions.filter(
    (t) =>
      t.restaurant_id === session.restaurant_id &&
      t.cash_session_id === session.id &&
      t.status === 'confirmed'
  );
  const sessionMovs = movements.filter(
    (m) => m.restaurant_id === session.restaurant_id && m.cash_session_id === session.id
  );
  const sessionRefunds = refunds.filter(
    (r) => r.restaurant_id === session.restaurant_id && r.cash_session_id === session.id
  );

  let cashInUsd = 0;
  let cashInCdf = 0;
  let nonCashMobileMoneyUsd = 0;
  let nonCashMobileMoneyCdf = 0;
  let nonCashCardUsd = 0;
  let nonCashCardCdf = 0;
  let nonCashOtherUsd = 0;
  let nonCashOtherCdf = 0;

  for (const tx of sessionTxs) {
    if (tx.payment_method === 'cash_usd') {
      cashInUsd += tx.amount;
    } else if (tx.payment_method === 'cash_cdf') {
      cashInCdf += tx.amount;
    } else if (tx.payment_method === 'mobile_money') {
      if (tx.currency === 'USD') nonCashMobileMoneyUsd += tx.amount;
      else nonCashMobileMoneyCdf += tx.amount;
    } else if (tx.payment_method === 'card') {
      if (tx.currency === 'USD') nonCashCardUsd += tx.amount;
      else nonCashCardCdf += tx.amount;
    } else {
      if (tx.currency === 'USD') nonCashOtherUsd += tx.amount;
      else nonCashOtherCdf += tx.amount;
    }
  }

  let movementsInUsd = 0;
  let movementsInCdf = 0;
  let movementsOutUsd = 0;
  let movementsOutCdf = 0;

  for (const mov of sessionMovs) {
    if (mov.movement_type === 'in') {
      if (mov.currency === 'USD') movementsInUsd += mov.amount;
      else movementsInCdf += mov.amount;
    } else {
      if (mov.currency === 'USD') movementsOutUsd += mov.amount;
      else movementsOutCdf += mov.amount;
    }
  }

  let cashRefundsUsd = 0;
  let cashRefundsCdf = 0;
  for (const ref of sessionRefunds) {
    if (ref.refund_method === 'cash_usd') {
      cashRefundsUsd += ref.amount;
    } else if (ref.refund_method === 'cash_cdf') {
      cashRefundsCdf += ref.amount;
    }
  }

  const expectedCashUsd = roundForCurrency(
    session.opening_amount_usd + cashInUsd + movementsInUsd - movementsOutUsd - cashRefundsUsd,
    'USD'
  );
  const expectedCashCdf = roundForCurrency(
    session.opening_amount_cdf + cashInCdf + movementsInCdf - movementsOutCdf - cashRefundsCdf,
    'CDF'
  );

  return {
    sessionId: session.id,
    openingUsd: roundForCurrency(session.opening_amount_usd, 'USD'),
    openingCdf: roundForCurrency(session.opening_amount_cdf, 'CDF'),
    cashInUsd: roundForCurrency(cashInUsd, 'USD'),
    cashInCdf: roundForCurrency(cashInCdf, 'CDF'),
    nonCashMobileMoneyUsd: roundForCurrency(nonCashMobileMoneyUsd, 'USD'),
    nonCashMobileMoneyCdf: roundForCurrency(nonCashMobileMoneyCdf, 'CDF'),
    nonCashCardUsd: roundForCurrency(nonCashCardUsd, 'USD'),
    nonCashCardCdf: roundForCurrency(nonCashCardCdf, 'CDF'),
    nonCashOtherUsd: roundForCurrency(nonCashOtherUsd, 'USD'),
    nonCashOtherCdf: roundForCurrency(nonCashOtherCdf, 'CDF'),
    movementsInUsd: roundForCurrency(movementsInUsd, 'USD'),
    movementsInCdf: roundForCurrency(movementsInCdf, 'CDF'),
    movementsOutUsd: roundForCurrency(movementsOutUsd, 'USD'),
    movementsOutCdf: roundForCurrency(movementsOutCdf, 'CDF'),
    cashRefundsUsd: roundForCurrency(cashRefundsUsd, 'USD'),
    cashRefundsCdf: roundForCurrency(cashRefundsCdf, 'CDF'),
    expectedCashUsd,
    expectedCashCdf,
    confirmedTxCount: sessionTxs.length,
  };
}

export function evaluateClosureDiscrepancy(params: {
  expectedUsd: number;
  expectedCdf: number;
  countedUsd: number;
  countedCdf: number;
}): {
  discrepancyUsd: number;
  discrepancyCdf: number;
  status: 'closed' | 'closed_with_discrepancy';
} {
  const discrepancyUsd = roundForCurrency(params.countedUsd - params.expectedUsd, 'USD');
  const discrepancyCdf = roundForCurrency(params.countedCdf - params.expectedCdf, 'CDF');
  const hasDiscrepancy = Math.abs(discrepancyUsd) >= 0.01 || Math.abs(discrepancyCdf) >= 1;
  return {
    discrepancyUsd,
    discrepancyCdf,
    status: hasDiscrepancy ? 'closed_with_discrepancy' : 'closed',
  };
}

export interface CashReportSummary {
  collectedUsdNative: number;
  collectedCdfNative: number;
  refundedUsdNative: number;
  refundedCdfNative: number;
  netUsdNative: number;
  netCdfNative: number;
  indicativeEquivalentDisplayCurrency: number;
  displayCurrency: CurrencyCode;
  transactionsCount: number;
  partialOrdersCount: number;
  unpaidOrdersCount: number;
  remainingToCollectUsdNative: number;
  remainingToCollectCdfNative: number;
  byMethod: Array<{
    method: CashPaymentMethod;
    label: string;
    usdNative: number;
    cdfNative: number;
    txCount: number;
  }>;
  byCashier: Array<{
    cashierName: string;
    usdNative: number;
    cdfNative: number;
    txCount: number;
  }>;
  closuresCount: number;
  closuresWithDiscrepancyCount: number;
  totalDiscrepancyUsd: number;
  totalDiscrepancyCdf: number;
}

export function computeCashReports(params: {
  restaurant: RestaurantRecord;
  orders: readonly OrderRecord[];
  transactions: readonly PaymentTransactionRecord[];
  refunds: readonly RefundRecord[];
  closures: readonly CashClosureRecord[];
  period: PeriodFilter;
  customStart?: string;
  customEnd?: string;
  cashierFilter?: string;
  currencyFilter?: 'all' | CurrencyCode;
  methodFilter?: 'all' | CashPaymentMethod;
  referenceDate?: Date;
}): CashReportSummary {
  const {
    restaurant,
    orders,
    transactions,
    refunds,
    closures,
    period,
    customStart,
    customEnd,
    cashierFilter = 'all',
    currencyFilter = 'all',
    methodFilter = 'all',
    referenceDate = new Date(),
  } = params;

  const tenantTxs = transactions.filter((t) => {
    if (t.restaurant_id !== restaurant.id || t.status !== 'confirmed') return false;
    if (!isTimestampInPeriod(t.paid_at, period, customStart, customEnd, referenceDate)) return false;
    if (cashierFilter !== 'all' && t.cashier_name !== cashierFilter) return false;
    if (currencyFilter !== 'all' && t.currency !== currencyFilter) return false;
    if (methodFilter !== 'all' && t.payment_method !== methodFilter) return false;
    return true;
  });

  const tenantRefunds = refunds.filter((r) => {
    if (r.restaurant_id !== restaurant.id) return false;
    if (!isTimestampInPeriod(r.refunded_at, period, customStart, customEnd, referenceDate)) return false;
    if (cashierFilter !== 'all' && r.responsible_name !== cashierFilter) return false;
    if (currencyFilter !== 'all' && r.currency !== currencyFilter) return false;
    if (methodFilter !== 'all' && r.refund_method !== methodFilter) return false;
    return true;
  });

  const tenantClosures = closures.filter((c) => {
    if (c.restaurant_id !== restaurant.id) return false;
    if (!isTimestampInPeriod(c.closed_at, period, customStart, customEnd, referenceDate)) return false;
    if (cashierFilter !== 'all' && c.cashier_name !== cashierFilter) return false;
    return true;
  });

  let collectedUsdNative = 0;
  let collectedCdfNative = 0;
  let indicativeDisplay = 0;

  const methodMap = new Map<
    CashPaymentMethod,
    { usdNative: number; cdfNative: number; txCount: number }
  >();
  const cashierMap = new Map<
    string,
    { usdNative: number; cdfNative: number; txCount: number }
  >();

  for (const tx of tenantTxs) {
    if (tx.currency === 'USD') collectedUsdNative += tx.amount;
    else collectedCdfNative += tx.amount;

    indicativeDisplay += convertCurrencyAmount(
      tx.amount,
      tx.currency,
      restaurant.default_currency,
      tx.exchange_rate_applied
    );

    const mEntry = methodMap.get(tx.payment_method) ?? { usdNative: 0, cdfNative: 0, txCount: 0 };
    if (tx.currency === 'USD') mEntry.usdNative += tx.amount;
    else mEntry.cdfNative += tx.amount;
    mEntry.txCount += 1;
    methodMap.set(tx.payment_method, mEntry);

    const cEntry = cashierMap.get(tx.cashier_name) ?? { usdNative: 0, cdfNative: 0, txCount: 0 };
    if (tx.currency === 'USD') cEntry.usdNative += tx.amount;
    else cEntry.cdfNative += tx.amount;
    cEntry.txCount += 1;
    cashierMap.set(tx.cashier_name, cEntry);
  }

  let refundedUsdNative = 0;
  let refundedCdfNative = 0;
  for (const ref of tenantRefunds) {
    if (ref.currency === 'USD') refundedUsdNative += ref.amount;
    else refundedCdfNative += ref.amount;
    indicativeDisplay -= convertCurrencyAmount(
      ref.amount,
      ref.currency,
      restaurant.default_currency,
      ref.exchange_rate_applied
    );
  }

  // Soldes restant à payer sur les commandes actives du restaurant (toutes commandes non annulées)
  let partialOrdersCount = 0;
  let unpaidOrdersCount = 0;
  let remainingToCollectUsdNative = 0;
  let remainingToCollectCdfNative = 0;

  for (const order of orders) {
    if (order.restaurant_id !== restaurant.id || order.status === 'cancelled') continue;
    const summary = calculateOrderPaymentSummary(order, transactions, refunds);
    if (summary.paymentStatus === 'partial') {
      partialOrdersCount += 1;
    } else if (summary.paymentStatus === 'unpaid') {
      unpaidOrdersCount += 1;
    }
    if (summary.remainingAmount > 0) {
      if (order.currency === 'USD') remainingToCollectUsdNative += summary.remainingAmount;
      else remainingToCollectCdfNative += summary.remainingAmount;
    }
  }

  const closuresWithDiscrepancyCount = tenantClosures.filter(
    (c) => c.status === 'closed_with_discrepancy'
  ).length;
  const totalDiscrepancyUsd = roundForCurrency(
    tenantClosures.reduce((s, c) => s + c.discrepancy_usd, 0),
    'USD'
  );
  const totalDiscrepancyCdf = roundForCurrency(
    tenantClosures.reduce((s, c) => s + c.discrepancy_cdf, 0),
    'CDF'
  );

  return {
    collectedUsdNative: roundForCurrency(collectedUsdNative, 'USD'),
    collectedCdfNative: roundForCurrency(collectedCdfNative, 'CDF'),
    refundedUsdNative: roundForCurrency(refundedUsdNative, 'USD'),
    refundedCdfNative: roundForCurrency(refundedCdfNative, 'CDF'),
    netUsdNative: roundForCurrency(collectedUsdNative - refundedUsdNative, 'USD'),
    netCdfNative: roundForCurrency(collectedCdfNative - refundedCdfNative, 'CDF'),
    indicativeEquivalentDisplayCurrency: roundForCurrency(
      Math.max(0, indicativeDisplay),
      restaurant.default_currency
    ),
    displayCurrency: restaurant.default_currency,
    transactionsCount: tenantTxs.length,
    partialOrdersCount,
    unpaidOrdersCount,
    remainingToCollectUsdNative: roundForCurrency(remainingToCollectUsdNative, 'USD'),
    remainingToCollectCdfNative: roundForCurrency(remainingToCollectCdfNative, 'CDF'),
    byMethod: Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      label: getPaymentMethodLabel(method, restaurant.custom_payment_method_label),
      usdNative: roundForCurrency(data.usdNative, 'USD'),
      cdfNative: roundForCurrency(data.cdfNative, 'CDF'),
      txCount: data.txCount,
    })),
    byCashier: Array.from(cashierMap.entries()).map(([cashierName, data]) => ({
      cashierName,
      usdNative: roundForCurrency(data.usdNative, 'USD'),
      cdfNative: roundForCurrency(data.cdfNative, 'CDF'),
      txCount: data.txCount,
    })),
    closuresCount: tenantClosures.length,
    closuresWithDiscrepancyCount,
    totalDiscrepancyUsd,
    totalDiscrepancyCdf,
  };
}
