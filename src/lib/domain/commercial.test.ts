import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommercialDocumentSnapshot,
  escapeHtml,
  resolveRestaurantSlugOrRedirect,
  sanitizeMediaUrl,
  validateDomainConfig,
  validateMaintenanceContractInput,
  validateSlugChange,
} from './commercial';
import type { LicenseRecord, PaymentRecord, RestaurantRecord } from '../supabase/database.types';

const RESTAURANTS: RestaurantRecord[] = [
  {
    id: 'rest-1',
    name: 'Maison Gombe',
    slug: 'maison-gombe',
    owner_name: 'Jean-Paul Mbala',
    description: null,
    logo_url: null,
    cover_image_url: null,
    primary_color: '#163C2E',
    accent_color: '#B8923A',
    subdomain_prefix: 'maison-gombe',
    custom_domain: 'maison-gombe.cd',
    address: 'Av du Port 14',
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
    allowed_order_modes: ['dine_in'],
    allowed_delivery_modes: ['pickup'],
    cancellation_policy: null,
    notification_email_orders: true,
    notification_low_stock: true,
    additional_info: null,
    status: 'active',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'rest-2',
    name: 'Terrasse Lubumbashi',
    slug: 'terrasse-lubumbashi',
    owner_name: 'Chantal Kalonji',
    description: null,
    logo_url: null,
    cover_image_url: null,
    primary_color: '#1E3A34',
    accent_color: '#B8923A',
    address: null,
    commune: 'Lubumbashi',
    city: 'Lubumbashi',
    country: 'RDC',
    phone: null,
    whatsapp_phone: null,
    email: null,
    establishment_type: 'Bistro',
    cuisine_type: null,
    opening_hours: null,
    default_currency: 'CDF',
    secondary_currency: 'USD',
    exchange_rate_usd_cdf: 2850,
    timezone: 'Africa/Lubumbashi',
    allowed_order_modes: ['dine_in'],
    allowed_delivery_modes: ['pickup'],
    cancellation_policy: null,
    notification_email_orders: true,
    notification_low_stock: true,
    additional_info: null,
    status: 'active',
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
  },
];

const PLATFORM = {
  platformName: 'RestoConnect',
  tagline: 'La gestion intelligente de votre restaurant',
  logoUrl: null,
  supportEmail: 'contact@restoconnect.cd',
  commercialPhone: '+243 81 000 0000',
  commercialWhatsapp: '+243 81 000 0000',
  commercialAddress: 'Kinshasa, RDC',
  defaultCountry: 'RDC',
  defaultTimezone: 'Africa/Kinshasa',
  referenceCurrency: 'USD' as const,
  defaultUsdCdfRate: 2850,
  standardLicensePriceUsd: 350,
  maintenanceAnnualPriceUsd: 150,
  maintenanceAlertDays: 30,
  commercialTerms: 'Licence perpétuelle sans expiration automatique.',
};

test('Slug validation prevents duplicates, reserved platform routes, and resolves historical redirects', () => {
  const dup = validateSlugChange(RESTAURANTS, [], 'rest-2', 'maison-gombe');
  assert.equal(dup.valid, false);

  const reserved = validateSlugChange(RESTAURANTS, [], 'rest-2', 'super-admin');
  assert.equal(reserved.valid, false);

  const ok = validateSlugChange(RESTAURANTS, [], 'rest-2', 'Terrasse Katanga!');
  assert.equal(ok.valid, true);
  if (ok.valid) assert.equal(ok.normalizedSlug, 'terrasse-katanga');

  const redirects = [
    {
      id: 'red-1',
      restaurant_id: 'rest-1',
      old_slug: 'gombe-bistro',
      created_at: '2026-11-10T00:00:00Z',
    },
  ];
  const resolved = resolveRestaurantSlugOrRedirect(RESTAURANTS, redirects, 'gombe-bistro');
  assert.equal(resolved.restaurant?.id, 'rest-1');
  assert.equal(resolved.redirectedFrom, 'gombe-bistro');
});

test('Domain validation and URL sanitization block dangerous schemes and duplicate domains', () => {
  assert.equal(sanitizeMediaUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeMediaUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeMediaUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(sanitizeMediaUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
  assert.equal(sanitizeMediaUrl('/assets/custom-logo.png'), '/assets/custom-logo.png');
  assert.equal(sanitizeMediaUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');

  const dupDomain = validateDomainConfig(
    { customDomain: 'maison-gombe.cd', subdomainPrefix: 'autre-resto' },
    RESTAURANTS,
    'rest-2'
  );
  assert.equal(dupDomain.valid, false);
});

test('Commercial documents refuse fake receipts/invoices without real stored records and escape HTML', () => {
  const missingPay = buildCommercialDocumentSnapshot({
    documentType: 'payment_receipt',
    sequence: 1,
    platform: PLATFORM,
    restaurant: RESTAURANTS[0],
  });
  assert.equal(missingPay.ok, false);

  const license: LicenseRecord = {
    id: 'lic-1',
    restaurant_id: 'rest-1',
    plan_id: 'plan-1',
    license_key: 'RC-MAIS-2026-0001',
    license_type: 'perpetual',
    amount: 350,
    currency: 'USD',
    status: 'active',
    issued_at: '2026-11-01T00:00:00Z',
    activated_at: '2026-11-01T00:00:00Z',
    sale_date: '2026-11-01',
    business_client_name: 'Maison Gombe SARL',
    maintenance_expires_at: null,
    suspended_reason: null,
    revoked_reason: null,
    notes: null,
    issued_by: 'super-admin',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
  const payment: PaymentRecord = {
    id: 'pay-1',
    restaurant_id: 'rest-1',
    order_id: null,
    license_id: 'lic-1',
    payment_scope: 'license',
    amount: 350,
    currency: 'USD',
    payment_method: 'bank_transfer',
    status: 'confirmed',
    reference_code: 'VIR-2026-01',
    admin_comment: null,
    verified_at: '2026-11-01T00:00:00Z',
    recorded_by: 'super-admin',
    paid_at: '2026-11-01T00:00:00Z',
    created_at: '2026-11-01T00:00:00Z',
  };

  const receipt = buildCommercialDocumentSnapshot({
    documentType: 'payment_receipt',
    sequence: 1,
    platform: PLATFORM,
    restaurant: RESTAURANTS[0],
    license,
    payment,
  });
  assert.equal(receipt.ok, true);
  if (receipt.ok) {
    assert.equal(receipt.snapshot.amount, 350);
    assert.equal(receipt.snapshot.businessClientName, 'Maison Gombe SARL');
  }

  assert.equal(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');

  const badContract = validateMaintenanceContractInput({
    restaurantId: 'rest-1',
    licenseId: 'lic-1',
    durationMonths: 12,
    priceAmount: 150,
    includedServices: 'Support',
    startDate: '2026-12-01',
    endDate: '2026-11-01',
  });
  assert.equal(badContract.valid, false);
});
