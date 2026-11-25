import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderPaymentSummary,
  computeCashReports,
  computeCashSessionSummary,
  evaluateClosureDiscrepancy,
  validateOrderPaymentInput,
  validateRefundInput,
} from './cashRegister';
import type {
  CashClosureRecord,
  CashMovementRecord,
  CashSessionRecord,
  OrderRecord,
  PaymentTransactionRecord,
  RefundRecord,
  RestaurantRecord,
} from '../supabase/database.types';

const REST_GOMBE: RestaurantRecord = {
  id: 'rest-gombe-01',
  name: 'Maison Gombe',
  slug: 'maison-gombe',
  owner_name: 'Jean-Paul Mbala',
  description: null,
  logo_url: null,
  cover_image_url: null,
  primary_color: '#163C2E',
  accent_color: '#B8923A',
  address: 'Avenue du Port 14',
  commune: 'Gombe',
  city: 'Kinshasa',
  country: 'RDC',
  phone: '+243 81 000 0101',
  whatsapp_phone: null,
  email: 'contact@maisongombe.cd',
  establishment_type: 'Restaurant',
  cuisine_type: null,
  opening_hours: null,
  default_currency: 'USD',
  secondary_currency: 'CDF',
  exchange_rate_usd_cdf: 2850,
  timezone: 'Africa/Kinshasa',
  allowed_order_modes: ['dine_in', 'takeaway', 'delivery'],
  allowed_delivery_modes: ['pickup', 'local_courier'],
  cancellation_policy: null,
  notification_email_orders: true,
  notification_low_stock: true,
  allow_partial_payments: true,
  custom_payment_method_label: 'Bon entreprise',
  additional_info: null,
  status: 'active',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

const OPEN_SESSION: CashSessionRecord = {
  id: 'sess-1',
  restaurant_id: 'rest-gombe-01',
  cash_register_id: 'reg-1',
  cashier_profile_id: null,
  cashier_name: 'Grace Mbuyi',
  opening_amount_usd: 100,
  opening_amount_cdf: 150000,
  primary_currency: 'USD',
  status: 'open',
  opened_at: '2026-11-24T08:00:00Z',
  closed_at: null,
  notes: null,
};

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'ord-1',
    restaurant_id: 'rest-gombe-01',
    order_number: 'CMD-0001',
    table_id: null,
    customer_id: null,
    customer_name: 'Patrick Ilunga',
    customer_phone: '+243 82 110 4420',
    server_id: null,
    order_type: 'dine_in',
    status: 'confirmed',
    subtotal: 50,
    tax_amount: 0,
    total_amount: 50,
    paid_amount: 0,
    currency: 'USD',
    exchange_rate_applied: 2850,
    payment_status: 'unpaid',
    notes: null,
    created_at: '2026-11-24T10:00:00Z',
    ...overrides,
  };
}

test('Cash USD & CDF payments: partial accumulation, conversion, double-collection & overpayment guards', () => {
  const order = makeOrder({ total_amount: 50, currency: 'USD' });

  // 1. Paiement partiel de 20 USD en espèces USD
  const step1 = validateOrderPaymentInput({
    restaurant: REST_GOMBE,
    order,
    paymentTransactions: [],
    refunds: [],
    activeSession: OPEN_SESSION,
    amount: 20,
    currency: 'USD',
    paymentMethod: 'cash_usd',
    paymentContext: 'counter',
    requireOpenSession: true,
  });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  assert.equal(step1.nextPaidAmount, 20);
  assert.equal(step1.nextRemainingAmount, 30);
  assert.equal(step1.nextPaymentStatus, 'partial');
  assert.equal(step1.exchangeRateApplied, 2850);

  const tx1: PaymentTransactionRecord = {
    id: 'tx-1',
    restaurant_id: 'rest-gombe-01',
    order_id: 'ord-1',
    cash_session_id: 'sess-1',
    transaction_number: 'TXN-0001',
    amount: 20,
    currency: 'USD',
    exchange_rate_applied: 2850,
    converted_amount_order_currency: 20,
    order_currency: 'USD',
    payment_method: 'cash_usd',
    payment_context: 'counter',
    status: 'confirmed',
    reference_code: null,
    note: null,
    void_or_correction_reason: null,
    cashier_name: 'Grace Mbuyi',
    paid_at: '2026-11-24T10:15:00Z',
    created_at: '2026-11-24T10:15:00Z',
  };

  // 2. Tentative de dépassement (40 USD alors qu'il reste 30 USD) -> refusée
  const overpay = validateOrderPaymentInput({
    restaurant: REST_GOMBE,
    order,
    paymentTransactions: [tx1],
    refunds: [],
    activeSession: OPEN_SESSION,
    amount: 40,
    currency: 'USD',
    paymentMethod: 'cash_usd',
    paymentContext: 'counter',
  });
  assert.equal(overpay.ok, false);

  // 3. Paiement du solde restant (30 USD = 85 500 CDF) en espèces CDF
  const step2 = validateOrderPaymentInput({
    restaurant: REST_GOMBE,
    order,
    paymentTransactions: [tx1],
    refunds: [],
    activeSession: OPEN_SESSION,
    amount: 85500,
    currency: 'CDF',
    paymentMethod: 'cash_cdf',
    paymentContext: 'table',
    requireOpenSession: true,
  });
  assert.equal(step2.ok, true);
  if (!step2.ok) return;
  assert.equal(step2.convertedAmountOrderCurrency, 30);
  assert.equal(step2.nextPaidAmount, 50);
  assert.equal(step2.nextRemainingAmount, 0);
  assert.equal(step2.nextPaymentStatus, 'paid');

  const tx2: PaymentTransactionRecord = {
    ...tx1,
    id: 'tx-2',
    transaction_number: 'TXN-0002',
    amount: 85500,
    currency: 'CDF',
    converted_amount_order_currency: 30,
    payment_method: 'cash_cdf',
    payment_context: 'table',
    paid_at: '2026-11-24T10:30:00Z',
  };

  // 4. Double encaissement sur commande déjà payée -> bloqué
  const doublePay = validateOrderPaymentInput({
    restaurant: REST_GOMBE,
    order,
    paymentTransactions: [tx1, tx2],
    refunds: [],
    activeSession: OPEN_SESSION,
    amount: 5,
    currency: 'USD',
    paymentMethod: 'cash_usd',
    paymentContext: 'counter',
  });
  assert.equal(doublePay.ok, false);
});

test('Partial payments disabled rejects partial settlement & rate changes preserve historical transactions', () => {
  const strictRestaurant: RestaurantRecord = { ...REST_GOMBE, allow_partial_payments: false };
  const order = makeOrder({ total_amount: 40, currency: 'USD' });

  const partialBlocked = validateOrderPaymentInput({
    restaurant: strictRestaurant,
    order,
    paymentTransactions: [],
    refunds: [],
    activeSession: OPEN_SESSION,
    amount: 15,
    currency: 'USD',
    paymentMethod: 'cash_usd',
    paymentContext: 'counter',
  });
  assert.equal(partialBlocked.ok, false);

  // Taux verrouillé sur historique : si le restaurant passe à 3000 CDF, tx2 reste à 2850 -> 30 USD
  const historicalTx: PaymentTransactionRecord = {
    id: 'tx-hist',
    restaurant_id: 'rest-gombe-01',
    order_id: 'ord-1',
    cash_session_id: 'sess-1',
    transaction_number: 'TXN-HIST',
    amount: 85500,
    currency: 'CDF',
    exchange_rate_applied: 2850,
    converted_amount_order_currency: 30,
    order_currency: 'USD',
    payment_method: 'cash_cdf',
    payment_context: 'counter',
    status: 'confirmed',
    reference_code: null,
    note: null,
    void_or_correction_reason: null,
    cashier_name: 'Grace Mbuyi',
    paid_at: '2026-11-24T10:30:00Z',
    created_at: '2026-11-24T10:30:00Z',
  };
  const updatedRestaurant = { ...REST_GOMBE, exchange_rate_usd_cdf: 3000 };
  const reportAfterRateChange = computeCashReports({
    restaurant: updatedRestaurant,
    orders: [makeOrder({ total_amount: 30 })],
    transactions: [historicalTx],
    refunds: [],
    closures: [],
    period: 'today',
    referenceDate: new Date('2026-11-24T14:00:00Z'),
  });
  assert.equal(reportAfterRateChange.collectedCdfNative, 85500);
  assert.equal(reportAfterRateChange.indicativeEquivalentDisplayCurrency, 30);
});

test('Refunds & voided transactions enforce strict bounds and update order payment status', () => {
  const order = makeOrder({ total_amount: 50, currency: 'USD' });
  const tx: PaymentTransactionRecord = {
    id: 'tx-10',
    restaurant_id: 'rest-gombe-01',
    order_id: 'ord-1',
    cash_session_id: 'sess-1',
    transaction_number: 'TXN-0010',
    amount: 50,
    currency: 'USD',
    exchange_rate_applied: 2850,
    converted_amount_order_currency: 50,
    order_currency: 'USD',
    payment_method: 'cash_usd',
    payment_context: 'counter',
    status: 'confirmed',
    reference_code: null,
    note: null,
    void_or_correction_reason: null,
    cashier_name: 'Grace Mbuyi',
    paid_at: '2026-11-24T11:00:00Z',
    created_at: '2026-11-24T11:00:00Z',
  };

  // Remboursement sans motif -> refusé
  const noReason = validateRefundInput({
    restaurant: REST_GOMBE,
    order,
    transaction: tx,
    existingTransactions: [tx],
    existingRefunds: [],
    amount: 10,
    reason: '   ',
  });
  assert.equal(noReason.ok, false);

  // Remboursement partiel valide de 20 USD
  const okPartial = validateRefundInput({
    restaurant: REST_GOMBE,
    order,
    transaction: tx,
    existingTransactions: [tx],
    existingRefunds: [],
    amount: 20,
    reason: 'Plat manquant annulé',
  });
  assert.equal(okPartial.ok, true);

  const refund1: RefundRecord = {
    id: 'ref-1',
    restaurant_id: 'rest-gombe-01',
    order_id: 'ord-1',
    payment_transaction_id: 'tx-10',
    cash_session_id: 'sess-1',
    refund_number: 'RMB-0001',
    amount: 20,
    currency: 'USD',
    exchange_rate_applied: 2850,
    converted_amount_order_currency: 20,
    refund_method: 'cash_usd',
    reason: 'Plat manquant annulé',
    responsible_name: 'Nadine Lukusa',
    refunded_at: '2026-11-24T11:20:00Z',
    created_at: '2026-11-24T11:20:00Z',
  };

  // Tentative de sur-remboursement (35 USD alors qu'il reste 30 USD remboursables) -> refusée
  const overRefund = validateRefundInput({
    restaurant: REST_GOMBE,
    order,
    transaction: tx,
    existingTransactions: [tx],
    existingRefunds: [refund1],
    amount: 35,
    reason: 'Doublon',
  });
  assert.equal(overRefund.ok, false);

  // Remboursement du solde (30 USD) -> statut commande passe à 'refunded'
  const refund2: RefundRecord = { ...refund1, id: 'ref-2', refund_number: 'RMB-0002', amount: 30, converted_amount_order_currency: 30 };
  const fullRefundSummary = calculateOrderPaymentSummary(order, [tx], [refund1, refund2]);
  assert.equal(fullRefundSummary.paymentStatus, 'refunded');
  assert.equal(fullRefundSummary.netPaidAmount, 0);

  // Transaction annulée (voided) -> reste à payer revient à 50 USD
  const voidedSummary = calculateOrderPaymentSummary(
    order,
    [{ ...tx, status: 'voided', void_or_correction_reason: 'Erreur saisie montant' }],
    []
  );
  assert.equal(voidedSummary.paymentStatus, 'unpaid');
  assert.equal(voidedSummary.remainingAmount, 50);
});

test('Cash session summary separates USD/CDF, includes movements/refunds, and detects closure discrepancies', () => {
  const txs: PaymentTransactionRecord[] = [
    {
      id: 't1',
      restaurant_id: 'rest-gombe-01',
      order_id: 'o1',
      cash_session_id: 'sess-1',
      transaction_number: 'TXN-1',
      amount: 45,
      currency: 'USD',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 45,
      order_currency: 'USD',
      payment_method: 'cash_usd',
      payment_context: 'counter',
      status: 'confirmed',
      reference_code: null,
      note: null,
      void_or_correction_reason: null,
      cashier_name: 'Grace Mbuyi',
      paid_at: '2026-11-24T10:00:00Z',
      created_at: '2026-11-24T10:00:00Z',
    },
    {
      id: 't2',
      restaurant_id: 'rest-gombe-01',
      order_id: 'o2',
      cash_session_id: 'sess-1',
      transaction_number: 'TXN-2',
      amount: 57000,
      currency: 'CDF',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 20,
      order_currency: 'USD',
      payment_method: 'cash_cdf',
      payment_context: 'delivery',
      status: 'confirmed',
      reference_code: null,
      note: null,
      void_or_correction_reason: null,
      cashier_name: 'Grace Mbuyi',
      paid_at: '2026-11-24T11:00:00Z',
      created_at: '2026-11-24T11:00:00Z',
    },
    {
      id: 't3',
      restaurant_id: 'rest-gombe-01',
      order_id: 'o3',
      cash_session_id: 'sess-1',
      transaction_number: 'TXN-3',
      amount: 30,
      currency: 'USD',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 30,
      order_currency: 'USD',
      payment_method: 'mobile_money',
      payment_context: 'takeaway',
      status: 'confirmed',
      reference_code: 'MPESA-99',
      note: null,
      void_or_correction_reason: null,
      cashier_name: 'Grace Mbuyi',
      paid_at: '2026-11-24T12:00:00Z',
      created_at: '2026-11-24T12:00:00Z',
    },
  ];
  const movements: CashMovementRecord[] = [
    {
      id: 'mov-1',
      restaurant_id: 'rest-gombe-01',
      cash_session_id: 'sess-1',
      movement_type: 'out',
      amount: 15,
      currency: 'USD',
      reason: 'Achat glace urgence',
      performed_by_label: 'Grace Mbuyi',
      created_at: '2026-11-24T12:30:00Z',
    },
    {
      id: 'mov-2',
      restaurant_id: 'rest-gombe-01',
      cash_session_id: 'sess-1',
      movement_type: 'in',
      amount: 50000,
      currency: 'CDF',
      reason: 'Apport monnaie petite coupure',
      performed_by_label: 'Nadine Lukusa',
      created_at: '2026-11-24T12:40:00Z',
    },
  ];
  const refunds: RefundRecord[] = [
    {
      id: 'r1',
      restaurant_id: 'rest-gombe-01',
      order_id: 'o1',
      payment_transaction_id: 't1',
      cash_session_id: 'sess-1',
      refund_number: 'RMB-1',
      amount: 5,
      currency: 'USD',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 5,
      refund_method: 'cash_usd',
      reason: 'Erreur boisson',
      responsible_name: 'Nadine Lukusa',
      refunded_at: '2026-11-24T13:00:00Z',
      created_at: '2026-11-24T13:00:00Z',
    },
  ];

  const summary = computeCashSessionSummary({
    session: OPEN_SESSION,
    transactions: txs,
    movements,
    refunds,
  });

  // Expected USD = 100 (open) + 45 (cash_usd) - 15 (out) - 5 (cash refund) = 125
  assert.equal(summary.expectedCashUsd, 125);
  // Expected CDF = 150000 (open) + 57000 (cash_cdf) + 50000 (in) = 257000
  assert.equal(summary.expectedCashCdf, 257000);
  // Non-cash Mobile Money USD = 30
  assert.equal(summary.nonCashMobileMoneyUsd, 30);

  const exactClose = evaluateClosureDiscrepancy({
    expectedUsd: summary.expectedCashUsd,
    expectedCdf: summary.expectedCashCdf,
    countedUsd: 125,
    countedCdf: 257000,
  });
  assert.equal(exactClose.status, 'closed');
  assert.equal(exactClose.discrepancyUsd, 0);

  const gapClose = evaluateClosureDiscrepancy({
    expectedUsd: summary.expectedCashUsd,
    expectedCdf: summary.expectedCashCdf,
    countedUsd: 120,
    countedCdf: 257000,
  });
  assert.equal(gapClose.status, 'closed_with_discrepancy');
  assert.equal(gapClose.discrepancyUsd, -5);
});

test('Multi-tenant cash reports isolate restaurants, separate USD/CDF, and report remaining receivables & discrepancies', () => {
  const orders: OrderRecord[] = [
    makeOrder({ id: 'o1', restaurant_id: 'rest-gombe-01', total_amount: 100, currency: 'USD' }),
    makeOrder({ id: 'o2', restaurant_id: 'rest-lubum-02', total_amount: 50000, currency: 'CDF' }),
  ];
  const txs: PaymentTransactionRecord[] = [
    {
      id: 'tx-a',
      restaurant_id: 'rest-gombe-01',
      order_id: 'o1',
      cash_session_id: 'sess-1',
      transaction_number: 'TXN-A',
      amount: 40,
      currency: 'USD',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 40,
      order_currency: 'USD',
      payment_method: 'cash_usd',
      payment_context: 'counter',
      status: 'confirmed',
      reference_code: null,
      note: null,
      void_or_correction_reason: null,
      cashier_name: 'Grace Mbuyi',
      paid_at: '2026-11-24T10:00:00Z',
      created_at: '2026-11-24T10:00:00Z',
    },
    {
      id: 'tx-b',
      restaurant_id: 'rest-lubum-02',
      order_id: 'o2',
      cash_session_id: 'sess-other',
      transaction_number: 'TXN-B',
      amount: 50000,
      currency: 'CDF',
      exchange_rate_applied: 2850,
      converted_amount_order_currency: 50000,
      order_currency: 'CDF',
      payment_method: 'cash_cdf',
      payment_context: 'counter',
      status: 'confirmed',
      reference_code: null,
      note: null,
      void_or_correction_reason: null,
      cashier_name: 'Autre Caissier',
      paid_at: '2026-11-24T10:00:00Z',
      created_at: '2026-11-24T10:00:00Z',
    },
  ];
  const closures: CashClosureRecord[] = [
    {
      id: 'cl-1',
      restaurant_id: 'rest-gombe-01',
      cash_session_id: 'sess-1',
      cash_register_id: 'reg-1',
      cashier_name: 'Grace Mbuyi',
      expected_usd: 140,
      expected_cdf: 150000,
      counted_usd: 138,
      counted_cdf: 150000,
      discrepancy_usd: -2,
      discrepancy_cdf: 0,
      non_cash_mobile_money_usd: 0,
      non_cash_mobile_money_cdf: 0,
      non_cash_card_usd: 0,
      non_cash_card_cdf: 0,
      non_cash_other_usd: 0,
      non_cash_other_cdf: 0,
      status: 'closed_with_discrepancy',
      notes: 'Manque 2 USD',
      is_locked: true,
      validated_by_name: 'Grace Mbuyi',
      correction_reason: null,
      closed_at: '2026-11-24T18:00:00Z',
      created_at: '2026-11-24T18:00:00Z',
    },
  ];

  const report = computeCashReports({
    restaurant: REST_GOMBE,
    orders,
    transactions: txs,
    refunds: [],
    closures,
    period: 'today',
    referenceDate: new Date('2026-11-24T19:00:00Z'),
  });

  assert.equal(report.collectedUsdNative, 40);
  assert.equal(report.collectedCdfNative, 0);
  assert.equal(report.partialOrdersCount, 1);
  assert.equal(report.remainingToCollectUsdNative, 60);
  assert.equal(report.closuresWithDiscrepancyCount, 1);
  assert.equal(report.totalDiscrepancyUsd, -2);
  assert.equal(report.byCashier.length, 1);
  assert.equal(report.byCashier[0].cashierName, 'Grace Mbuyi');
});
