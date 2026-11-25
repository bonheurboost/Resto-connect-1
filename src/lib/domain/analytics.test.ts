import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRestaurantMetrics,
  computeSuperAdminMetrics,
  validateLicenseAttribution,
} from './analytics';
import type { LicenseRecord, PaymentRecord, RestaurantRecord } from '../supabase/database.types';

const SAMPLE_RESTAURANTS: RestaurantRecord[] = [
  {
    id: 'r1',
    name: 'Maison Gombe',
    slug: 'maison-gombe',
    owner_name: 'Owner 1',
    description: null,
    logo_url: null,
    cover_image_url: null,
    primary_color: '#163C2E',
    accent_color: '#B8923A',
    address: null,
    commune: 'Gombe',
    city: 'Kinshasa',
    country: 'CD',
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
    allowed_order_modes: ['dine_in'],
    allowed_delivery_modes: ['pickup'],
    cancellation_policy: null,
    notification_email_orders: true,
    notification_low_stock: true,
    additional_info: null,
    status: 'active',
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
  },
];

const SAMPLE_LICENSES: LicenseRecord[] = [
  {
    id: 'l1',
    restaurant_id: 'r1',
    plan_id: 'p1',
    license_key: 'RC-MAIS-2026-0001',
    license_type: 'perpetual',
    amount: 450,
    currency: 'USD',
    status: 'active',
    issued_at: '2026-11-20T10:00:00Z',
    activated_at: '2026-11-20T10:05:00Z',
    maintenance_expires_at: null,
    suspended_reason: null,
    revoked_reason: null,
    notes: null,
    issued_by: null,
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
  },
];

test('validateLicenseAttribution blocks assigning a second active license to the same restaurant', () => {
  const blocked = validateLicenseAttribution(SAMPLE_LICENSES, 'r1', 300);
  assert.equal(blocked.valid, false);

  const allowedOther = validateLicenseAttribution(SAMPLE_LICENSES, 'r2', 300);
  assert.equal(allowedOther.valid, true);
});

test('computeSuperAdminMetrics counts only confirmed license payments as revenue', () => {
  const payments: PaymentRecord[] = [
    {
      id: 'p1',
      restaurant_id: 'r1',
      order_id: null,
      license_id: 'l1',
      payment_scope: 'license',
      amount: 450,
      currency: 'USD',
      payment_method: 'bank_transfer',
      status: 'confirmed',
      reference_code: 'VIR-01',
      admin_comment: null,
      verified_at: '2026-11-20T10:05:00Z',
      recorded_by: null,
      paid_at: '2026-11-20T10:05:00Z',
      created_at: '2026-11-20T10:05:00Z',
    },
    {
      id: 'p2',
      restaurant_id: 'r1',
      order_id: null,
      license_id: 'l1',
      payment_scope: 'license',
      amount: 999,
      currency: 'USD',
      payment_method: 'cash',
      status: 'pending',
      reference_code: 'UNVERIFIED',
      admin_comment: null,
      verified_at: null,
      recorded_by: null,
      paid_at: null,
      created_at: '2026-11-21T10:00:00Z',
    },
  ];

  const metrics = computeSuperAdminMetrics(
    SAMPLE_RESTAURANTS,
    SAMPLE_LICENSES,
    payments,
    new Date('2026-11-24T12:00:00Z')
  );
  assert.equal(metrics.confirmedLicenseRevenueUsd, 450);
  assert.equal(metrics.activeLicenses, 1);
  assert.equal(metrics.totalRestaurants, 1);
});

test('computeRestaurantMetrics scopes calculations strictly by restaurant and period', () => {
  const metrics = computeRestaurantMetrics({
    restaurant: SAMPLE_RESTAURANTS[0],
    orders: [
      {
        id: 'o1',
        restaurant_id: 'r1',
        order_number: 'CMD-0001',
        table_id: null,
        customer_id: null,
        server_id: null,
        order_type: 'dine_in',
        status: 'preparing',
        subtotal: 24,
        tax_amount: 0,
        total_amount: 24,
        currency: 'USD',
        notes: null,
        created_at: '2026-11-24T10:00:00Z',
      },
      {
        id: 'o2',
        restaurant_id: 'r2',
        order_number: 'CMD-0002',
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
    ],
    orderItems: [],
    products: [],
    reservations: [],
    customers: [],
    payments: [],
    expenses: [],
    period: 'today',
    referenceDate: new Date('2026-11-24T14:00:00Z'),
  });

  assert.equal(metrics.ordersCount, 1);
  assert.equal(metrics.preparingOrders, 1);
  assert.equal(metrics.revenueAmount, 0);
});
