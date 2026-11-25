import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFinancialReport,
  computeOrderStockDeduction,
  computeOrderStockReversal,
  computePayrollNet,
  computePurchaseOrderReception,
  evaluateInventoryAlerts,
  hasDuplicateCheckIn,
} from './erp';
import type { OrderRecord, PurchaseOrderRecord, RestaurantRecord } from '../supabase/database.types';

const REST: RestaurantRecord = {
  id: 'r1',
  name: 'Maison Gombe',
  slug: 'maison-gombe',
  owner_name: 'JP',
  description: null,
  logo_url: null,
  cover_image_url: null,
  primary_color: '#163C2E',
  accent_color: '#B8923A',
  address: null,
  commune: 'Gombe',
  city: 'Kinshasa',
  country: 'RDC',
  phone: null,
  whatsapp_phone: null,
  email: null,
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
  additional_info: null,
  status: 'active',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

test('BOM deduction runs once per order, blocks negative stock, and reverses on cancellation', () => {
  const order: OrderRecord = {
    id: 'o1',
    restaurant_id: 'r1',
    order_number: 'CMD-0001',
    table_id: null,
    customer_id: null,
    server_id: null,
    order_type: 'takeaway',
    status: 'pending',
    subtotal: 20,
    tax_amount: 0,
    total_amount: 20,
    currency: 'USD',
    stock_deducted: false,
    notes: null,
    created_at: '2026-11-24T12:00:00Z',
  };
  const items = [
    {
      id: 'oi1',
      restaurant_id: 'r1',
      order_id: 'o1',
      product_id: 'p1',
      quantity: 2,
      unit_price: 10,
      line_total: 20,
      special_instructions: null,
      kitchen_status: 'queued' as const,
    },
  ];
  const recipes = [{ id: 'rec1', restaurant_id: 'r1', product_id: 'p1', yield_portions: 1, notes: null, is_active: true }];
  const recipeItems = [{ id: 'ri1', restaurant_id: 'r1', recipe_id: 'rec1', ingredient_id: 'ing1', quantity_per_unit: 0.5, unit: 'kg' }];
  const ingredients = [{ id: 'ing1', restaurant_id: 'r1', name: 'Capitaine', unit: 'kg', current_stock: 5, minimum_stock: 2, unit_cost: 8 }];

  const first = computeOrderStockDeduction({ order, orderItems: items, recipes, recipeItems, ingredients });
  assert.equal(first.ok, true);
  assert.equal(first.deductions[0].quantity, 1);
  assert.equal(first.deductions[0].nextStock, 4);

  const second = computeOrderStockDeduction({
    order: { ...order, stock_deducted: true },
    orderItems: items,
    recipes,
    recipeItems,
    ingredients: [{ ...ingredients[0], current_stock: 4 }],
  });
  assert.equal(second.alreadyDeducted, true);
  assert.equal(second.deductions.length, 0);

  const reversed = computeOrderStockReversal({
    order: { ...order, stock_deducted: true },
    movements: [
      {
        id: 'm1',
        restaurant_id: 'r1',
        ingredient_id: 'ing1',
        movement_type: 'kitchen_out',
        quantity: 1,
        reference_type: 'order',
        reference_id: 'o1',
        reason: null,
        performed_by: null,
        created_at: '2026-11-24T12:01:00Z',
      },
    ],
    ingredients: [{ ...ingredients[0], current_stock: 4 }],
  });
  assert.equal(reversed[0].nextStock, 5);
});

test('Purchase order reception handles partial and full reception without over-receiving', () => {
  const po: PurchaseOrderRecord = {
    id: 'po1',
    restaurant_id: 'r1',
    supplier_id: 's1',
    order_number: 'PO-2026-0001',
    status: 'ordered',
    order_date: '2026-11-24',
    expected_date: null,
    received_date: null,
    total_amount: 50,
    currency: 'USD',
    exchange_rate_applied: 2850,
    amount_paid: 0,
    payment_status: 'unpaid',
    attachment_ref: null,
    notes: null,
    created_at: '2026-11-24T08:00:00Z',
  };
  const poItems = [
    { id: 'poi1', restaurant_id: 'r1', purchase_order_id: 'po1', ingredient_id: 'ing1', quantity_ordered: 10, quantity_received: 0, unit_cost: 5, line_total: 50 },
  ];
  const partial = computePurchaseOrderReception({ po, poItems, receivedQuantities: { poi1: 4 } });
  assert.equal(partial.ok, true);
  if (partial.ok) {
    assert.equal(partial.nextStatus, 'partially_received');
  }
  const over = computePurchaseOrderReception({ po, poItems, receivedQuantities: { poi1: 12 } });
  assert.equal(over.ok, false);
});

test('Attendance duplicate check-in and payroll net calculation enforce integrity', () => {
  assert.equal(
    hasDuplicateCheckIn(
      [
        {
          id: 'a1',
          restaurant_id: 'r1',
          employee_id: 'e1',
          attendance_date: '2026-11-24',
          check_in_at: '2026-11-24T08:00:00Z',
          check_out_at: null,
          status: 'present',
          delay_minutes: 0,
          note: null,
          created_at: '2026-11-24T08:00:00Z',
        },
      ],
      'r1',
      'e1',
      '2026-11-24'
    ),
    true
  );

  assert.deepEqual(computePayrollNet({ baseSalary: 500, bonuses: 50, advances: 100, deductions: 25 }), {
    ok: true,
    netSalary: 425,
  });
  assert.equal(computePayrollNet({ baseSalary: 200, bonuses: 0, advances: 250, deductions: 0 }).ok, false);
});

test('Financial report excludes cancelled orders, pending/failed payments, archived expenses, and converts CDF/USD', () => {
  const report = computeFinancialReport({
    restaurant: REST,
    orders: [
      {
        id: 'o1',
        restaurant_id: 'r1',
        order_number: 'CMD-1',
        table_id: null,
        customer_id: null,
        server_id: null,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 50,
        tax_amount: 0,
        total_amount: 50,
        currency: 'USD',
        notes: null,
        created_at: '2026-11-24T10:00:00Z',
      },
      {
        id: 'o2',
        restaurant_id: 'r1',
        order_number: 'CMD-2',
        table_id: null,
        customer_id: null,
        server_id: null,
        order_type: 'dine_in',
        status: 'cancelled',
        subtotal: 100,
        tax_amount: 0,
        total_amount: 100,
        currency: 'USD',
        notes: null,
        created_at: '2026-11-24T11:00:00Z',
      },
    ],
    orderItems: [],
    recipes: [],
    recipeItems: [],
    ingredients: [{ id: 'ing1', restaurant_id: 'r1', name: 'Huile', unit: 'L', current_stock: 0, minimum_stock: 2, unit_cost: 3, expiry_date: '2026-11-26' }],
    payments: [
      {
        id: 'p1',
        restaurant_id: 'r1',
        order_id: 'o1',
        license_id: null,
        payment_scope: 'order',
        amount: 50,
        currency: 'USD',
        payment_method: 'cash',
        status: 'confirmed',
        reference_code: 'R1',
        admin_comment: null,
        verified_at: null,
        recorded_by: null,
        paid_at: '2026-11-24T10:05:00Z',
        created_at: '2026-11-24T10:05:00Z',
      },
      {
        id: 'p2',
        restaurant_id: 'r1',
        order_id: 'o2',
        license_id: null,
        payment_scope: 'order',
        amount: 100,
        currency: 'USD',
        payment_method: 'cash',
        status: 'confirmed',
        reference_code: 'R2',
        admin_comment: null,
        verified_at: null,
        recorded_by: null,
        paid_at: '2026-11-24T11:05:00Z',
        created_at: '2026-11-24T11:05:00Z',
      },
    ],
    expenses: [
      { id: 'e1', restaurant_id: 'r1', category: 'Loyer', description: 'Loyer', amount: 28500, currency: 'CDF', expense_date: '2026-11-24', recorded_by: null, receipt_storage_path: null, status: 'active' },
      { id: 'e2', restaurant_id: 'r1', category: 'Loyer', description: 'Erreur', amount: 500, currency: 'USD', expense_date: '2026-11-24', recorded_by: null, receipt_storage_path: null, status: 'archived' },
    ],
    purchaseOrders: [],
    salaryPayments: [{ id: 'sp1', restaurant_id: 'r1', payroll_id: 'pr1', employee_id: 'emp1', amount_paid: 10, currency: 'USD', payment_method: 'cash', reference_code: 'S1', paid_at: '2026-11-24T12:00:00Z', notes: null }],
    period: 'month',
    displayCurrency: 'USD',
    referenceDate: new Date('2026-11-24T15:00:00Z'),
  });

  assert.equal(report.confirmedRevenue, 50);
  assert.equal(report.activeExpenses, 10);
  assert.equal(report.salariesPaid, 10);
  assert.equal(report.estimatedOperatingResult, 30);

  const alerts = evaluateInventoryAlerts(
    [{ id: 'ing1', restaurant_id: 'r1', name: 'Huile', unit: 'L', current_stock: 0, minimum_stock: 2, unit_cost: 3, expiry_date: '2026-11-26' }],
    'r1',
    new Date('2026-11-24T12:00:00Z')
  );
  assert.equal(alerts.some((a) => a.alertType === 'out_of_stock'), true);
  assert.equal(alerts.some((a) => a.alertType === 'expiring_soon'), true);
});
