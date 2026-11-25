import { KeyRound, Lock, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import {
  isMaintenanceContractActive,
  LICENSE_STATUS_META,
  LICENSE_TYPE_LABELS,
} from '@/src/lib/licensing/licenseRules';
import { formatMoney } from '@/src/lib/domain/operations';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';

interface TenantLicenseViewProps {
  restaurantId: string;
}

export function TenantLicenseView({ restaurantId }: TenantLicenseViewProps) {
  const { licenses, restaurants, maintenanceContracts } = useRestoStore();
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const license =
    licenses.find((l) => l.restaurant_id === restaurantId && l.status === 'active') ??
    licenses.find((l) => l.restaurant_id === restaurantId) ??
    null;

  const tenantContracts = maintenanceContracts.filter((c) => c.restaurant_id === restaurantId);
  const activeContract = tenantContracts.find((c) => isMaintenanceContractActive(c)) ?? null;

  if (!license) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ma licence RestoConnect</CardTitle>
          <CardDescription>Aucune licence active n&apos;est actuellement liée à cet établissement.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--rc-muted)]">
          Veuillez contacter l&apos;équipe RestoConnect pour l&apos;émission et l&apos;activation de votre licence commerciale.
        </CardContent>
      </Card>
    );
  }

  const meta = LICENSE_STATUS_META[license.status];
  const includedFeatures = [
    'Menu numérique & catégories illimitées',
    'Gestion des commandes en salle, à emporter et livraison',
    'Plan de tables & réservations clients',
    'Suivi des stocks, recettes & fournisseurs',
    'Caisse physique USD / CDF & reçus A4 / 80 mm',
    'Vitrine publique personnalisée (/restaurant/slug)',
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[var(--rc-gold)]" aria-hidden="true" />
              <span>Ma licence · {restaurant?.name}</span>
            </CardTitle>
            <CardDescription>
              Consultation en lecture seule. Votre licence perpétuelle n&apos;expire jamais automatiquement.
            </CardDescription>
          </div>
          <StatusLabel label={meta.label} tone={meta.tone} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4">
              <p className="text-xs text-[var(--rc-muted)]">Numéro de licence</p>
              <p className="mt-1 font-mono font-semibold text-[var(--rc-fg)]">{license.license_key}</p>
            </div>
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4">
              <p className="text-xs text-[var(--rc-muted)]">Modèle</p>
              <p className="mt-1 font-medium text-[var(--rc-fg)]">
                {LICENSE_TYPE_LABELS[license.license_type]}
              </p>
            </div>
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4">
              <p className="text-xs text-[var(--rc-muted)]">Date de vente / activation</p>
              <p className="mt-1 font-mono text-[var(--rc-fg)]">
                {license.sale_date ?? (license.activated_at ? license.activated_at.slice(0, 10) : 'En attente')}
              </p>
            </div>
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4">
              <p className="text-xs text-[var(--rc-muted)]">Maintenance optionnelle</p>
              <p className="mt-1 font-mono text-[var(--rc-fg)]">
                {activeContract
                  ? `Active jusqu'au ${activeContract.end_date}`
                  : 'Aucune couverture active (licence reste valide)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--rc-fg)]">Fonctionnalités incluses</h3>
              <ul className="space-y-1.5 text-xs text-[var(--rc-muted)]">
                {includedFeatures.map((feat) => (
                  <li key={feat}>• {feat}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-4 space-y-2 text-xs text-[var(--rc-muted)]">
              <p className="flex items-center gap-2 font-semibold text-[var(--rc-fg)]">
                <Lock className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Protection contractuelle</span>
              </p>
              <p>
                Montant enregistré :{' '}
                <span className="font-mono text-[var(--rc-fg)]">
                  {formatMoney(license.amount, license.currency)}
                </span>
              </p>
              <p>
                Entité titulaire :{' '}
                <strong className="text-[var(--rc-fg)]">
                  {license.business_client_name ?? restaurant?.name}
                </strong>
              </p>
              <p>
                L&apos;administrateur du restaurant ne peut pas modifier la clé ni le statut de la licence depuis cet
                espace.
              </p>
            </div>
          </div>

          {tenantContracts.length > 0 && (
            <div className="rounded-md border border-[var(--rc-border)] bg-[var(--rc-card)] p-4 space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold text-[var(--rc-fg)]">
                <Wrench className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Historique des contrats de maintenance optionnels ({tenantContracts.length})</span>
              </p>
              <div className="space-y-1.5 text-xs text-[var(--rc-muted)]">
                {tenantContracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rc-border)] pt-1.5"
                  >
                    <span className="font-mono text-[var(--rc-fg)]">{c.contract_number}</span>
                    <span>
                      {c.start_date} → {c.end_date}
                    </span>
                    <span className="font-mono">{formatMoney(c.price_amount, c.currency)}</span>
                    <span>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
