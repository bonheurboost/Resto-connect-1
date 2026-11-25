import type {
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  MaintenanceContractRecord,
} from '../supabase/database.types';

export interface LicenseStatusMeta {
  code: LicenseStatus;
  label: string;
  description: string;
  isOperational: boolean;
  tone: 'emerald' | 'amber' | 'crimson' | 'neutral';
}

export const LICENSE_STATUS_META: Record<LicenseStatus, LicenseStatusMeta> = {
  pending: {
    code: 'pending',
    label: 'En attente',
    description: "Licence émise en attente de validation et d'activation par le Super Administrateur.",
    isOperational: false,
    tone: 'amber',
  },
  active: {
    code: 'active',
    label: 'Active',
    description: 'Établissement autorisé à exploiter les modules RestoConnect (modèle perpétuel).',
    isOperational: true,
    tone: 'emerald',
  },
  suspended: {
    code: 'suspended',
    label: 'Suspendue',
    description: 'Accès temporairement suspendu par le Super Administrateur.',
    isOperational: false,
    tone: 'amber',
  },
  revoked: {
    code: 'revoked',
    label: 'Révoquée',
    description: 'Licence définitivement révoquée. Données conservées en lecture restreinte Super Admin.',
    isOperational: false,
    tone: 'crimson',
  },
};

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  perpetual: 'Licence perpétuelle',
  perpetual_with_maintenance: 'Licence perpétuelle + maintenance optionnelle',
};

/**
 * Règle commerciale fondamentale RestoConnect :
 * Toute licence active est perpétuelle. La fin ou l'absence d'un contrat de maintenance
 * optionnel ne doit JAMAIS désactiver une licence perpétuelle.
 * Seul le Super Administrateur peut suspendre ou révoquer une licence (status !== 'active').
 */
export function isLicenseOperational(
  license: Pick<LicenseRecord, 'status' | 'license_type' | 'maintenance_expires_at'>
): boolean {
  return license.status === 'active';
}

/**
 * Évalue uniquement si le contrat de maintenance optionnel est en cours de validité.
 */
export function isMaintenanceContractActive(
  contract: Pick<MaintenanceContractRecord, 'status' | 'end_date'>,
  referenceDate: Date = new Date()
): boolean {
  if (contract.status !== 'active') return false;
  if (!contract.end_date) return true;
  const endMs = new Date(`${contract.end_date}T23:59:59Z`).getTime();
  return !Number.isNaN(endMs) && endMs >= referenceDate.getTime();
}

export function validateTenantAccess(
  userRestaurantIds: readonly string[],
  targetRestaurantId: string,
  isSuperAdmin: boolean
): boolean {
  if (isSuperAdmin) return true;
  if (!targetRestaurantId) return false;
  return userRestaurantIds.includes(targetRestaurantId);
}
