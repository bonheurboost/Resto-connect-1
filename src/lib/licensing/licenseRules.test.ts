import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLicenseOperational,
  isMaintenanceContractActive,
  validateTenantAccess,
} from './licenseRules';

test('Licensing: perpetual active license stays operational regardless of maintenance date', () => {
  assert.equal(
    isLicenseOperational({
      status: 'active',
      license_type: 'perpetual',
      maintenance_expires_at: null,
    }),
    true
  );
});

test('Licensing: pending, suspended, and revoked licenses are never operational', () => {
  for (const status of ['pending', 'suspended', 'revoked'] as const) {
    assert.equal(
      isLicenseOperational({
        status,
        license_type: 'perpetual',
        maintenance_expires_at: null,
      }),
      false
    );
  }
});

test('Licensing: expired maintenance never deactivates a perpetual license (only maintenance flag expires)', () => {
  const ref = new Date('2026-11-24T12:00:00Z');
  assert.equal(
    isLicenseOperational({
      status: 'active',
      license_type: 'perpetual_with_maintenance',
      maintenance_expires_at: '2026-01-01T00:00:00Z',
    }),
    true
  );

  assert.equal(
    isMaintenanceContractActive(
      { status: 'active', end_date: '2027-01-01' },
      ref
    ),
    true
  );
  assert.equal(
    isMaintenanceContractActive(
      { status: 'active', end_date: '2026-01-01' },
      ref
    ),
    false
  );
});

test('Multi-tenant isolation: standard users can only access assigned restaurant_id', () => {
  assert.equal(validateTenantAccess(['rest-1'], 'rest-1', false), true);
  assert.equal(validateTenantAccess(['rest-1'], 'rest-2', false), false);
  assert.equal(validateTenantAccess([], 'rest-2', true), true);
});
