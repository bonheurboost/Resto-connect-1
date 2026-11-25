import { useMemo, useState, type FormEvent } from 'react';
import {
  Plus,
  ExternalLink,
  Search,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { CommercialDocumentDialog } from '@/src/modules/licenses/CommercialDocumentDialog';
import { readImageFileAsDataUrl } from '@/src/lib/media/imageUpload';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import type {
  CommercialDocumentRecord,
  CurrencyCode,
  RestaurantRecord,
  RestaurantStatus,
} from '@/src/lib/supabase/database.types';

const RESTAURANT_STATUS_META: Record<
  RestaurantStatus,
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  active: { label: 'Actif', tone: 'emerald' },
  pending: { label: 'En attente', tone: 'amber' },
  suspended: { label: 'Suspendu', tone: 'crimson' },
  archived: { label: 'Archivé', tone: 'neutral' },
};

const ESTABLISHMENT_TYPES = [
  'Restaurant gastronomique',
  'Bistro & Terrasse',
  'Grillades & Maquis',
  'Restauration rapide',
  'Salon de thé & Pâtisserie',
  'Hôtel-Restaurant',
];

const PAGE_SIZE = 6;

export function RestaurantsRegistryView() {
  const {
    restaurants,
    licenses,
    createRestaurant,
    updateRestaurantDetails,
    updateRestaurantStatus,
    setActiveTenantId,
    generateCommercialDocument,
  } = useRestoStore();
  const [activeDoc, setActiveDoc] = useState<CommercialDocumentRecord | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RestaurantStatus>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);

  // 12-field creation state
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('République démocratique du Congo');
  const [logoUrl, setLogoUrl] = useState('');
  const [establishmentType, setEstablishmentType] = useState(ESTABLISHMENT_TYPES[0]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [initialStatus, setInitialStatus] = useState<RestaurantStatus>('pending');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Detail & Edit drawer/panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditingSelected, setIsEditingSelected] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<RestaurantRecord>>({});

  const cities = useMemo(
    () => Array.from(new Set(restaurants.map((r) => r.city))).sort(),
    [restaurants]
  );

  const filteredRestaurants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return restaurants.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (cityFilter !== 'all' && r.city !== cityFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.owner_name ?? '').toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        (r.commune ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [restaurants, searchQuery, statusFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRestaurants.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRestaurants = filteredRestaurants.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const selectedRestaurant = restaurants.find((r) => r.id === selectedId) ?? null;
  const selectedLicense = selectedRestaurant
    ? licenses.find((l) => l.restaurant_id === selectedRestaurant.id && l.status === 'active') ??
      licenses.find((l) => l.restaurant_id === selectedRestaurant.id) ??
      null
    : null;

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const res = createRestaurant({
      name,
      owner_name: ownerName,
      email,
      phone,
      address,
      commune,
      city,
      country,
      logo_url: logoUrl,
      establishment_type: establishmentType,
      default_currency: currency,
      status: initialStatus,
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCommune('');
    setLogoUrl('');
    setShowCreateForm(false);
    setSelectedId(res.restaurant.id);
    setFormSuccess(`Établissement "${res.restaurant.name}" enregistré (ID ${res.restaurant.id}).`);
  }

  function startEditing(rest: RestaurantRecord) {
    setSelectedId(rest.id);
    setIsEditingSelected(true);
    setEditDraft({
      name: rest.name,
      owner_name: rest.owner_name ?? '',
      email: rest.email ?? '',
      phone: rest.phone ?? '',
      address: rest.address ?? '',
      commune: rest.commune ?? '',
      city: rest.city,
      country: rest.country,
      establishment_type: rest.establishment_type,
      default_currency: rest.default_currency,
    });
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selectedRestaurant) return;
    updateRestaurantDetails(selectedRestaurant.id, editDraft);
    setIsEditingSelected(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Gestion des restaurants (Multi-tenant)</CardTitle>
            <CardDescription>
              Enregistrez, modifiez, activez ou suspendez les établissements de la plateforme RestoConnect.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => setShowCreateForm((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{showCreateForm ? 'Fermer le formulaire' : 'Nouveau restaurant'}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {formSuccess && (
            <div className="rounded-md border border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] px-4 py-2.5 text-xs font-medium text-[var(--rc-success-fg)]">
              {formSuccess}
            </div>
          )}

          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-5 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[var(--rc-border)] pb-3">
                <p className="text-sm font-semibold text-[var(--rc-fg)]">
                  Enregistrer un nouvel établissement (12 champs)
                </p>
                <span className="text-xs text-[var(--rc-muted)]">Identifiant unique généré automatiquement</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-name">1. Nom commercial *</Label>
                  <Input
                    id="new-rest-name"
                    placeholder="Nom commercial"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-owner">2. Nom du propriétaire *</Label>
                  <Input
                    id="new-rest-owner"
                    placeholder="Nom du propriétaire"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-email">3. Adresse e-mail *</Label>
                  <Input
                    id="new-rest-email"
                    type="email"
                    placeholder="direction@restaurant.cd"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-phone">4. Numéro de téléphone</Label>
                  <Input
                    id="new-rest-phone"
                    placeholder="+243 ..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-address">5. Adresse physique</Label>
                  <Input
                    id="new-rest-address"
                    placeholder="Avenue, n° parcelle"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-commune">6. Commune</Label>
                  <Input
                    id="new-rest-commune"
                    placeholder="ex: Gombe, Lingwala, Limete"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-city">7. Ville *</Label>
                  <Input
                    id="new-rest-city"
                    placeholder="Kinshasa, Lubumbashi, Goma..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-country">8. Pays</Label>
                  <Input
                    id="new-rest-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-logo">9. Logo (URL ou fichier local)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-rest-logo"
                      placeholder="https://..."
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                    <label className="inline-flex items-center px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                      <span>Importer</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void readImageFileAsDataUrl(file)
                            .then((url) => setLogoUrl(url))
                            .catch((err) =>
                              setFormError(err instanceof Error ? err.message : "Erreur d'importation.")
                            );
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-type">10. Type d&apos;établissement</Label>
                  <select
                    id="new-rest-type"
                    value={establishmentType}
                    onChange={(e) => setEstablishmentType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                  >
                    {ESTABLISHMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-currency">11. Devise principale</Label>
                  <select
                    id="new-rest-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                  >
                    <option value="USD">Dollar américain (USD)</option>
                    <option value="CDF">Franc congolais (CDF)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rest-status">12. Statut initial</Label>
                  <select
                    id="new-rest-status"
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as RestaurantStatus)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                  >
                    <option value="pending">En attente (avant licence)</option>
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              </div>

              {formError && <p className="text-xs font-medium text-[var(--rc-danger-fg)]">{formError}</p>}

              <div className="flex items-center gap-3">
                <Button type="submit" size="sm">
                  Enregistrer l&apos;établissement
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search
                className="h-4 w-4 text-[var(--rc-muted)] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                aria-label="Rechercher un restaurant"
                placeholder="Rechercher par nom, propriétaire, commune ou ville..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | RestaurantStatus);
                setPage(1);
              }}
              className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="pending">En attente</option>
              <option value="suspended">Suspendus</option>
              <option value="archived">Archivés</option>
            </select>
            <select
              aria-label="Filtrer par ville"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
            >
              <option value="all">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3 whitespace-nowrap">Établissement</th>
                  <th className="px-4 py-3 whitespace-nowrap">Propriétaire</th>
                  <th className="px-4 py-3 whitespace-nowrap">Localisation</th>
                  <th className="px-4 py-3 whitespace-nowrap">Devise</th>
                  <th className="px-4 py-3 whitespace-nowrap">Licence</th>
                  <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {paginatedRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                      Aucun établissement ne correspond aux critères de recherche.
                    </td>
                  </tr>
                ) : (
                  paginatedRestaurants.map((rest) => {
                    const lic =
                      licenses.find((l) => l.restaurant_id === rest.id && l.status === 'active') ??
                      licenses.find((l) => l.restaurant_id === rest.id);
                    const meta = RESTAURANT_STATUS_META[rest.status];
                    return (
                      <tr key={rest.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-[var(--rc-fg)]">{rest.name}</p>
                          <p className="font-mono text-[11px] text-[var(--rc-muted)]">{rest.establishment_type}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--rc-fg)]">
                          <p>{rest.owner_name ?? '—'}</p>
                          <p className="text-[var(--rc-muted)]">{rest.email ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                          {rest.commune ? `${rest.commune}, ` : ''}
                          {rest.city}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {rest.default_currency}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                          {lic ? lic.license_key : 'Aucune'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusLabel label={meta.label} tone={meta.tone} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Consulter la fiche de ${rest.name}`}
                              onClick={() => {
                                setSelectedId(rest.id);
                                setIsEditingSelected(false);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Modifier ${rest.name}`}
                              onClick={() => startEditing(rest)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateRestaurantStatus(
                                  rest.id,
                                  rest.status === 'active' ? 'suspended' : 'active'
                                )
                              }
                            >
                              {rest.status === 'active'
                                ? 'Suspendre'
                                : rest.status === 'suspended'
                                  ? 'Réactiver'
                                  : 'Activer'}
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link
                                to={`/r/${rest.slug}`}
                                onClick={() => setActiveTenantId(rest.id)}
                                aria-label={`Ouvrir la vitrine de ${rest.name}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-[var(--rc-muted)]">
            <span>
              {filteredRestaurants.length} établissement(s) · Page {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fiche détaillée / Édition */}
      {selectedRestaurant && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Fiche établissement : {selectedRestaurant.name}</CardTitle>
              <CardDescription>
                ID unique : <code className="font-mono">{selectedRestaurant.id}</code> · Enregistré le{' '}
                <span className="font-mono">{selectedRestaurant.created_at.slice(0, 10)}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const res = generateCommercialDocument({
                    documentType: 'restaurant_sheet',
                    restaurantId: selectedRestaurant.id,
                    licenseId: selectedLicense?.id,
                  });
                  if (res.ok) setActiveDoc(res.document);
                }}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Fiche officielle</span>
              </Button>
              {!isEditingSelected && (
                <Button type="button" variant="outline" size="sm" onClick={() => startEditing(selectedRestaurant)}>
                  Modifier les informations
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isEditingSelected ? (
              <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-name">Nom commercial</Label>
                  <Input
                    id="edit-rest-name"
                    value={editDraft.name ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-owner">Propriétaire</Label>
                  <Input
                    id="edit-rest-owner"
                    value={editDraft.owner_name ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, owner_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-email">E-mail</Label>
                  <Input
                    id="edit-rest-email"
                    type="email"
                    value={editDraft.email ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-phone">Téléphone</Label>
                  <Input
                    id="edit-rest-phone"
                    value={editDraft.phone ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-commune">Commune</Label>
                  <Input
                    id="edit-rest-commune"
                    value={editDraft.commune ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, commune: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-city">Ville</Label>
                  <Input
                    id="edit-rest-city"
                    value={editDraft.city ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-rest-address">Adresse physique</Label>
                  <Input
                    id="edit-rest-address"
                    value={editDraft.address ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rest-currency">Devise principale</Label>
                  <select
                    id="edit-rest-currency"
                    value={editDraft.default_currency ?? 'USD'}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, default_currency: e.target.value as CurrencyCode }))
                    }
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-2">
                  <Button type="submit" size="sm">
                    Enregistrer les modifications
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingSelected(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--rc-muted)]">Propriétaire</p>
                  <p className="font-medium mt-0.5">{selectedRestaurant.owner_name ?? 'Non renseigné'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--rc-muted)]">Contact</p>
                  <p className="font-medium mt-0.5">{selectedRestaurant.phone ?? '—'}</p>
                  <p className="text-xs text-[var(--rc-muted)]">{selectedRestaurant.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--rc-muted)]">Adresse complète</p>
                  <p className="font-medium mt-0.5">
                    {selectedRestaurant.address ?? '—'} · {selectedRestaurant.commune ?? '—'},{' '}
                    {selectedRestaurant.city}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--rc-muted)]">Licence associée</p>
                  <p className="font-mono text-xs font-medium mt-0.5">
                    {selectedLicense ? `${selectedLicense.license_key} (${selectedLicense.status})` : 'Aucune licence'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CommercialDocumentDialog document={activeDoc} onClose={() => setActiveDoc(null)} />
    </div>
  );
}
