import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCartItemSafe,
  applyInventoryMovement,
  calculateOrderTotals,
  canTransitionOrderStatus,
  computeAuthoritativeOrder,
  generateLicenseKey,
  generateOrderNumber,
  hasReservationConflict,
  isLowStock,
  slugify,
} from './operations';

test('slugify normalizes French accents and spaces into valid restaurant slugs', () => {
  assert.equal(slugify("Le Jardin d'Ébène — Gombe"), 'le-jardin-d-ebene-gombe');
  assert.equal(slugify('   '), 'etablissement');
});

test('calculateOrderTotals computes exact totals and delivery fees without float drift', () => {
  const result = calculateOrderTotals(
    [
      { unit_price: 12.5, quantity: 2 },
      { unit_price: 3.3, quantity: 3 },
    ],
    4.5
  );
  assert.equal(result.subtotal, 34.9);
  assert.equal(result.deliveryFee, 4.5);
  assert.equal(result.totalAmount, 39.4);
});

test('addCartItemSafe strictly prevents mixing products from two restaurants', () => {
  const c1 = addCartItemSafe(
    { restaurantId: null, items: [] },
    { restaurantId: 'r1', productId: 'p1', quantity: 1, selectedOptions: [] }
  );
  assert.equal(c1.ok, true);
  if (!c1.ok) return;

  const conflict = addCartItemSafe(c1.nextCart, {
    restaurantId: 'r2',
    productId: 'p2',
    quantity: 1,
    selectedOptions: [],
  });
  assert.equal(conflict.ok, false);

  const replaced = addCartItemSafe(
    c1.nextCart,
    { restaurantId: 'r2', productId: 'p2', quantity: 2, selectedOptions: [] },
    true
  );
  assert.equal(replaced.ok, true);
  if (replaced.ok) {
    assert.equal(replaced.nextCart.restaurantId, 'r2');
    assert.equal(replaced.nextCart.items.length, 1);
  }
});

test('computeAuthoritativeOrder recalculates option extras and delivery zone fee from catalog', () => {
  const res = computeAuthoritativeOrder({
    restaurantId: 'r1',
    orderType: 'delivery',
    defaultCurrency: 'USD',
    exchangeRateUsdCdf: 2850,
    products: [
      {
        id: 'p1',
        restaurant_id: 'r1',
        category_id: 'c1',
        name: 'Capitaine',
        slug: 'capitaine',
        description: null,
        price_amount: 20,
        currency: 'USD',
        is_available: true,
        preparation_time_min: 20,
        sku: null,
      },
    ],
    productOptions: [
      {
        id: 'opt1',
        restaurant_id: 'r1',
        product_id: 'p1',
        name: 'Supplément',
        option_type: 'supplement',
        is_required: false,
        is_multiple: true,
        sort_order: 1,
      },
    ],
    optionValues: [
      {
        id: 'val1',
        restaurant_id: 'r1',
        option_id: 'opt1',
        label: 'Makemba',
        extra_price: 3.5,
        currency: 'USD',
        is_available: true,
        sort_order: 1,
      },
    ],
    deliveryZones: [
      {
        id: 'dz1',
        restaurant_id: 'r1',
        zone_name: 'Gombe',
        commune: 'Gombe',
        fee_amount: 4,
        currency: 'USD',
        estimated_minutes: 30,
        is_active: true,
      },
    ],
    deliveryZoneId: 'dz1',
    requestedItems: [
      { productId: 'p1', quantity: 2, selectedOptions: [{ optionId: 'opt1', valueId: 'val1' }] },
    ],
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.subtotal, 47);
    assert.equal(res.deliveryFee, 4);
    assert.equal(res.totalAmount, 51);
  }
});

test('hasReservationConflict blocks overlapping time slot when matching capacity is full', () => {
  const conflict = hasReservationConflict({
    restaurantId: 'r1',
    reservedForIso: '2026-11-26T20:00',
    partySize: 4,
    tables: [
      {
        id: 't1',
        restaurant_id: 'r1',
        table_number: 'T-01',
        zone: 'Salle',
        capacity: 4,
        qr_code_token: null,
        status: 'available',
      },
    ],
    existingReservations: [
      {
        id: 'res1',
        restaurant_id: 'r1',
        customer_id: null,
        table_id: 't1',
        guest_name: 'Client A',
        guest_phone: '+243',
        guest_email: null,
        party_size: 4,
        reserved_for: '2026-11-26T19:30',
        duration_minutes: 90,
        status: 'confirmed',
        notes: null,
      },
    ],
  });
  assert.equal(conflict.conflict, true);
});

test('order status workflow enforces valid transitions including delivery', () => {
  assert.equal(canTransitionOrderStatus('pending', 'confirmed'), true);
  assert.equal(canTransitionOrderStatus('ready', 'out_for_delivery'), true);
  assert.equal(canTransitionOrderStatus('pending', 'completed'), false);
  assert.equal(canTransitionOrderStatus('completed', 'cancelled'), false);
});

test('applyInventoryMovement handles additions, deductions, and insufficient stock guard', () => {
  assert.deepEqual(applyInventoryMovement(10, 'purchase_in', 5.5), { ok: true, nextStock: 15.5 });
  assert.deepEqual(applyInventoryMovement(10, 'out', 4), { ok: true, nextStock: 6 });
  assert.deepEqual(applyInventoryMovement(3, 'waste', 5), {
    ok: false,
    error: 'Stock insuffisant pour cette sortie.',
  });
  assert.deepEqual(applyInventoryMovement(10, 'adjustment', 12), { ok: true, nextStock: 12 });
});

test('isLowStock detects threshold alerts accurately', () => {
  assert.equal(isLowStock({ current_stock: 5, minimum_stock: 5 }), true);
  assert.equal(isLowStock({ current_stock: 6, minimum_stock: 5 }), false);
});

test('license and order formatters produce deterministic identifiers', () => {
  assert.equal(generateLicenseKey('maison-gombe', 7), 'RC-MAIS-2026-0007');
  assert.equal(generateOrderNumber(14), 'CMD-0014');
});
