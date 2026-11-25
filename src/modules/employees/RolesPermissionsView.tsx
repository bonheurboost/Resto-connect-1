import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { ROLE_LABELS_FR } from '@/src/lib/auth/rbac';
import {
  useRestoStore,
  type GranularModuleKey,
  type GranularPermissionSet,
} from '@/src/lib/store/RestoConnectStore';
import type { RestaurantRoleCode } from '@/src/lib/supabase/database.types';

interface RolesPermissionsViewProps {
  restaurantId: string;
}

const ROLES_ORDER: RestaurantRoleCode[] = [
  'restaurant_admin',
  'manager',
  'cashier',
  'server',
  'cook',
];

const MODULE_LABELS: Record<GranularModuleKey, string> = {
  dashboard: 'Tableau de bord',
  menu: 'Menu & Catégories',
  orders: 'Commandes & Cuisine',
  reservations: 'Réservations & Tables',
  inventory: 'Stocks & Mouvements',
  finance: 'Finances & Caisse',
  employees: 'Personnel',
  settings: 'Profil & Paramètres',
};

const ACTION_LABELS: Array<{ key: keyof GranularPermissionSet; label: string }> = [
  { key: 'read', label: 'Consultation' },
  { key: 'create', label: 'Création' },
  { key: 'update', label: 'Modification' },
  { key: 'delete', label: 'Suppression' },
  { key: 'validate', label: 'Validation' },
];

export function RolesPermissionsView({ restaurantId }: RolesPermissionsViewProps) {
  const { getRoleMatrixForTenant, updateRolePermission } = useRestoStore();
  const [selectedRole, setSelectedRole] = useState<RestaurantRoleCode>('manager');
  const matrix = getRoleMatrixForTenant(restaurantId);
  const currentRolePerms = matrix[selectedRole];
  const isOwnerRole = selectedRole === 'restaurant_admin';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[var(--rc-gold)]" aria-hidden="true" />
            <span>Rôles et permissions granulaires (RBAC)</span>
          </CardTitle>
          <CardDescription>
            Définissez les droits de consultation, création, modification, suppression et validation appliqués côté PostgreSQL RLS. Aucun rôle restaurant ne peut accéder au Super Administrateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {ROLES_ORDER.map((role) => {
              const active = role === selectedRole;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`rounded-md px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--rc-gold)] text-[#0B0B0B] border-[var(--rc-gold)] font-semibold'
                      : 'bg-[var(--rc-card)] text-[var(--rc-fg)] border-[var(--rc-border)] hover:bg-[var(--rc-card-elevated)]'
                  }`}
                >
                  {role === 'restaurant_admin' ? 'Propriétaire / Admin' : ROLE_LABELS_FR[role]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] px-4 py-3 text-xs">
            <span>
              Rôle sélectionné :{' '}
              <strong>
                {selectedRole === 'restaurant_admin'
                  ? 'Propriétaire / Administrateur du restaurant'
                  : ROLE_LABELS_FR[selectedRole]}
              </strong>
            </span>
            <StatusLabel
              label={
                isOwnerRole
                  ? 'Droits complets établissement (verrouillés)'
                  : 'Personnalisable par établissement'
              }
              tone={isOwnerRole ? 'emerald' : 'amber'}
            />
          </div>

          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Module métier</th>
                  {ACTION_LABELS.map((act) => (
                    <th key={act.key} className="px-4 py-3 text-center">
                      {act.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {(Object.keys(MODULE_LABELS) as GranularModuleKey[]).map((modKey) => {
                  const row = currentRolePerms[modKey];
                  return (
                    <tr key={modKey} className="hover:bg-[var(--rc-card-elevated)]">
                      <td className="px-4 py-3 font-medium text-[var(--rc-fg)] whitespace-nowrap">
                        {MODULE_LABELS[modKey]}
                      </td>
                      {ACTION_LABELS.map((act) => (
                        <td key={act.key} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${ROLE_LABELS_FR[selectedRole]} · ${MODULE_LABELS[modKey]} · ${act.label}`}
                            checked={row[act.key]}
                            disabled={isOwnerRole}
                            onChange={(e) =>
                              updateRolePermission(
                                restaurantId,
                                selectedRole,
                                modKey,
                                act.key,
                                e.target.checked
                              )
                            }
                            className="h-4 w-4 accent-[var(--rc-gold)] cursor-pointer disabled:opacity-60"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
