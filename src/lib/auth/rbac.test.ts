import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessWorkspace,
  hasRolePermission,
  resolveDefaultWorkspaceRoute,
  validateControlledSignup,
} from './rbac';

test('RBAC: restaurant_admin has full tenant permissions while cook is scoped to kitchen and stock', () => {
  assert.equal(hasRolePermission('restaurant_admin', 'settings.customize'), true);
  assert.equal(hasRolePermission('restaurant_admin', 'finance.view'), true);
  assert.equal(hasRolePermission('restaurant_admin', 'cash.correct'), true);
  assert.equal(hasRolePermission('manager', 'payments.refund'), true);
  assert.equal(hasRolePermission('manager', 'cash.reports'), true);
  assert.equal(hasRolePermission('cook', 'orders.kitchen'), true);
  assert.equal(hasRolePermission('cook', 'inventory.manage'), true);
  assert.equal(hasRolePermission('cook', 'finance.view'), false);
  assert.equal(hasRolePermission('cook', 'payments.collect'), false);
  assert.equal(hasRolePermission('cashier', 'payments.collect'), true);
  assert.equal(hasRolePermission('cashier', 'payments.confirm'), true);
  assert.equal(hasRolePermission('cashier', 'cash.open'), true);
  assert.equal(hasRolePermission('cashier', 'cash.close'), true);
  assert.equal(hasRolePermission('cashier', 'payments.refund'), false);
  assert.equal(hasRolePermission('cashier', 'cash.correct'), false);
  assert.equal(hasRolePermission('cashier', 'cash.reports'), false);
  assert.equal(hasRolePermission('server', 'payments.collect'), false);
  assert.equal(hasRolePermission('server', 'cash.open'), false);
});

test('Route guard: unauthenticated users are blocked from all private spaces', () => {
  const guest = {
    isAuthenticated: false,
    isActiveProfile: false,
    platformRole: null,
    activeRestaurantRole: null,
    hasActiveLicense: false,
  };
  assert.equal(canAccessWorkspace(guest, 'public').allowed, true);
  assert.equal(canAccessWorkspace(guest, 'super_admin').allowed, false);
  assert.equal(canAccessWorkspace(guest, 'restaurant_admin').allowed, false);
  assert.equal(canAccessWorkspace(guest, 'staff').allowed, false);
});

test('Route guard: super_admin access requires platform_role === super_admin', () => {
  const tenantAdmin = {
    isAuthenticated: true,
    isActiveProfile: true,
    platformRole: 'standard_user' as const,
    activeRestaurantRole: 'restaurant_admin' as const,
    hasActiveLicense: true,
  };
  assert.equal(canAccessWorkspace(tenantAdmin, 'super_admin').allowed, false);
  assert.equal(canAccessWorkspace(tenantAdmin, 'restaurant_admin').allowed, true);

  const superAdmin = {
    isAuthenticated: true,
    isActiveProfile: true,
    platformRole: 'super_admin' as const,
    activeRestaurantRole: null,
    hasActiveLicense: false,
  };
  assert.equal(canAccessWorkspace(superAdmin, 'super_admin').allowed, true);
  assert.equal(resolveDefaultWorkspaceRoute(superAdmin), '/super-admin');
});

test('Route guard: suspended/missing license blocks restaurant_admin and staff workspaces', () => {
  const suspendedTenant = {
    isAuthenticated: true,
    isActiveProfile: true,
    platformRole: 'standard_user' as const,
    activeRestaurantRole: 'manager' as const,
    hasActiveLicense: false,
  };
  assert.equal(canAccessWorkspace(suspendedTenant, 'staff').allowed, false);
});

test('Controlled signup: strictly rejects any attempt to request super_admin role', () => {
  const result = validateControlledSignup({
    fullName: 'Test Admin',
    email: 'test@restaurant.cd',
    password: 'StrongPassword123',
    restaurantSlug: 'bistro-gombe',
    invitationCode: 'INV-9021',
    requestedRole: 'super_admin',
  });
  assert.equal(result.valid, false);
});
