import type { PlatformRole, RestaurantRoleCode } from '../supabase/database.types';

export type WorkspaceSpace = 'super_admin' | 'restaurant_admin' | 'staff' | 'public';

export type PermissionCode =
  | 'dashboard.view'
  | 'menu.read'
  | 'menu.write'
  | 'orders.read'
  | 'orders.create'
  | 'orders.kitchen'
  | 'payments.collect'
  | 'payments.confirm'
  | 'payments.refund'
  | 'cash.open'
  | 'cash.close'
  | 'cash.reports'
  | 'cash.correct'
  | 'finance.view'
  | 'reservations.manage'
  | 'inventory.manage'
  | 'employees.manage'
  | 'payroll.manage'
  | 'suppliers.manage'
  | 'settings.customize';

export const ROLE_PERMISSIONS_MAP: Record<RestaurantRoleCode, readonly PermissionCode[]> = {
  restaurant_admin: [
    'dashboard.view',
    'menu.read',
    'menu.write',
    'orders.read',
    'orders.create',
    'orders.kitchen',
    'payments.collect',
    'payments.confirm',
    'payments.refund',
    'cash.open',
    'cash.close',
    'cash.reports',
    'cash.correct',
    'finance.view',
    'reservations.manage',
    'inventory.manage',
    'employees.manage',
    'payroll.manage',
    'suppliers.manage',
    'settings.customize',
  ],
  manager: [
    'dashboard.view',
    'menu.read',
    'menu.write',
    'orders.read',
    'orders.create',
    'orders.kitchen',
    'payments.collect',
    'payments.confirm',
    'payments.refund',
    'cash.open',
    'cash.close',
    'cash.reports',
    'cash.correct',
    'finance.view',
    'reservations.manage',
    'inventory.manage',
    'employees.manage',
    'payroll.manage',
    'suppliers.manage',
  ],
  cashier: [
    'orders.read',
    'orders.create',
    'payments.collect',
    'payments.confirm',
    'cash.open',
    'cash.close',
    'menu.read',
  ],
  server: [
    'menu.read',
    'orders.read',
    'orders.create',
    'reservations.manage',
  ],
  cook: [
    'menu.read',
    'orders.read',
    'orders.kitchen',
    'inventory.manage',
  ],
};

export const ROLE_LABELS_FR: Record<RestaurantRoleCode, string> = {
  restaurant_admin: 'Administrateur du restaurant',
  manager: 'Gestionnaire',
  cashier: 'Caissier',
  server: 'Serveur',
  cook: 'Cuisinier',
};

export interface AuthAccessContext {
  isAuthenticated: boolean;
  isActiveProfile: boolean;
  platformRole: PlatformRole | null;
  activeRestaurantRole: RestaurantRoleCode | null;
  hasActiveLicense: boolean;
}

export function hasRolePermission(
  role: RestaurantRoleCode | null | undefined,
  permission: PermissionCode
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS_MAP[role].includes(permission);
}

export function canAccessWorkspace(
  context: AuthAccessContext,
  targetSpace: WorkspaceSpace
): { allowed: boolean; reason?: string } {
  if (targetSpace === 'public') {
    return { allowed: true };
  }

  if (!context.isAuthenticated) {
    return { allowed: false, reason: 'Authentification requise.' };
  }

  if (!context.isActiveProfile) {
    return { allowed: false, reason: 'Profil utilisateur désactivé.' };
  }

  if (targetSpace === 'super_admin') {
    if (context.platformRole !== 'super_admin') {
      return { allowed: false, reason: 'Accès réservé au Super Administrateur.' };
    }
    return { allowed: true };
  }

  if (context.platformRole === 'super_admin') {
    return { allowed: true };
  }

  if (!context.activeRestaurantRole) {
    return { allowed: false, reason: 'Aucun établissement actif rattaché à ce compte.' };
  }

  if (!context.hasActiveLicense) {
    return { allowed: false, reason: 'La licence de cet établissement n\'est pas active.' };
  }

  if (targetSpace === 'restaurant_admin') {
    if (context.activeRestaurantRole !== 'restaurant_admin') {
      return { allowed: false, reason: 'Espace réservé à l\'administrateur du restaurant.' };
    }
    return { allowed: true };
  }

  if (targetSpace === 'staff') {
    const staffRoles: RestaurantRoleCode[] = ['manager', 'cashier', 'server', 'cook'];
    if (!staffRoles.includes(context.activeRestaurantRole)) {
      return { allowed: false, reason: 'Rôle personnel requis pour cet espace.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Espace inconnu.' };
}

export function resolveDefaultWorkspaceRoute(context: AuthAccessContext): string {
  if (!context.isAuthenticated || !context.isActiveProfile) {
    return '/login';
  }
  if (context.platformRole === 'super_admin') {
    return '/super-admin';
  }
  if (context.activeRestaurantRole === 'restaurant_admin') {
    return '/admin';
  }
  if (context.activeRestaurantRole) {
    return '/staff';
  }
  return '/login';
}

export interface ControlledSignupInput {
  fullName: string;
  email: string;
  password: string;
  restaurantSlug: string;
  invitationCode: string;
  requestedRole?: string;
}

export function validateControlledSignup(input: ControlledSignupInput): {
  valid: boolean;
  error?: string;
} {
  if (input.requestedRole === 'super_admin') {
    return {
      valid: false,
      error: 'La création d\'un compte Super Administrateur depuis l\'inscription publique est strictement interdite.',
    };
  }
  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    return { valid: false, error: 'Le nom complet est requis (2 caractères minimum).' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { valid: false, error: 'Adresse e-mail professionnelle invalide.' };
  }
  if (input.password.length < 10) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins 10 caractères.' };
  }
  if (!/^[a-z0-9-]+$/.test(input.restaurantSlug.trim().toLowerCase())) {
    return { valid: false, error: 'Identifiant (slug) de restaurant invalide.' };
  }
  if (!input.invitationCode.trim() || input.invitationCode.trim().length < 6) {
    return { valid: false, error: 'Code d\'invitation établissement requis (6 caractères minimum).' };
  }
  return { valid: true };
}
