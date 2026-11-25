import { useMemo, useState, type FormEvent } from 'react';
import { Plus, AlertTriangle, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney, isLowStock, type MovementType } from '@/src/lib/domain/operations';
import {
  INVENTORY_CATEGORIES,
  computeStockValuation,
  evaluateInventoryAlerts,
} from '@/src/lib/domain/erp';
import type { CurrencyCode, IngredientRecord, InventoryCategory } from '@/src/lib/supabase/database.types';

interface InventoryModuleViewProps {
  restaurantId?: string;
  hideValuation?: boolean;
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  in: 'Entrée (+)',
  purchase_in: 'Réception achat (+)',
  out: 'Sortie (-)',
  kitchen_out: 'Sortie cuisine (-)',
  waste: 'Perte / Casse (-)',
  waste_loss: 'Péremption / Perte (-)',
  supplier_return: 'Retour fournisseur (-)',
  transfer: 'Transfert interne (-)',
  adjustment: 'Réajustement inventaire (=)',
};

export function InventoryModuleView({ restaurantId, hideValuation = false }: InventoryModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    suppliers,
    ingredients,
    inventoryMovements,
    createIngredient,
    updateIngredient,
    archiveIngredient,
    recordInventoryMovement,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const defaultCurr: CurrencyCode = restaurant?.default_currency ?? 'USD';
  const rate = restaurant?.exchange_rate_usd_cdf ?? 2850;

  const tenantSuppliers = suppliers.filter((s) => s.restaurant_id === tenantId && !s.is_archived);
  const tenantIngredients = ingredients.filter((i) => i.restaurant_id === tenantId);
  const tenantMovements = inventoryMovements.filter((m) => m.restaurant_id === tenantId);

  const [catFilter, setCatFilter] = useState<'all' | InventoryCategory>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [ingName, setIngName] = useState('');
  const [ingCategory, setIngCategory] = useState<InventoryCategory>('Ingrédients');
  const [ingUnit, setIngUnit] = useState('kg');
  const [ingStock, setIngStock] = useState('0');
  const [ingMin, setIngMin] = useState('0');
  const [ingCost, setIngCost] = useState('0');
  const [ingCurr, setIngCurr] = useState<CurrencyCode>(defaultCurr);
  const [ingSupplierId, setIngSupplierId] = useState('');
  const [ingStorage, setIngStorage] = useState('');
  const [ingExpiry, setIngExpiry] = useState('');

  const [editingIng, setEditingIng] = useState<IngredientRecord | null>(null);
  const [editMin, setEditMin] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editStorage, setEditStorage] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  const [movIngId, setMovIngId] = useState(tenantIngredients[0]?.id ?? '');
  const [movType, setMovType] = useState<MovementType>('purchase_in');
  const [movQty, setMovQty] = useState('');
  const [movReason, setMovReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const alerts = useMemo(
    () => evaluateInventoryAlerts(ingredients, tenantId),
    [ingredients, tenantId]
  );

  const totalValuation = useMemo(
    () => computeStockValuation(ingredients, tenantId, defaultCurr, rate),
    [ingredients, tenantId, defaultCurr, rate]
  );

  const filteredIngredients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tenantIngredients.filter((ing) => {
      if (!showArchived && ing.is_archived) return false;
      if (catFilter !== 'all' && (ing.category ?? 'Ingrédients') !== catFilter) return false;
      if (supplierFilter !== 'all' && ing.supplier_id !== supplierFilter) return false;
      if (
        q &&
        !ing.name.toLowerCase().includes(q) &&
        !(ing.storage_location ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tenantIngredients, showArchived, catFilter, supplierFilter, searchQuery]);

  function handleAddIngredient(e: FormEvent) {
    e.preventDefault();
    const res = createIngredient({
      restaurantId: tenantId,
      name: ingName,
      category: ingCategory,
      unit: ingUnit,
      currentStock: Number(ingStock) || 0,
      minimumStock: Number(ingMin) || 0,
      unitCost: Number(ingCost) || 0,
      currency: ingCurr,
      supplierId: ingSupplierId || null,
      storageLocation: ingStorage || null,
      expiryDate: ingExpiry || null,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setIngName('');
    setIngStorage('');
    setIngExpiry('');
    setFeedback('Article ajouté au stock.');
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingIng) return;
    const res = updateIngredient(editingIng.id, {
      minimum_stock: Math.max(0, Number(editMin) || 0),
      unit_cost: Math.max(0, Number(editCost) || 0),
      storage_location: editStorage.trim() || null,
      expiry_date: editExpiry || null,
    });
    if (res.ok) {
      setEditingIng(null);
      setFeedback('Fiche article mise à jour.');
    }
  }

  function handleRecordMovement(e: FormEvent) {
    e.preventDefault();
    const activeOnes = tenantIngredients.filter((i) => !i.is_archived);
    const targetIng = movIngId || activeOnes[0]?.id;
    if (!targetIng) {
      setFeedback('Sélectionnez un article actif.');
      return;
    }
    const res = recordInventoryMovement({
      restaurantId: tenantId,
      ingredientId: targetIng,
      movementType: movType,
      quantity: Number(movQty),
      reason: movReason,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setMovQty('');
    setMovReason('');
    setFeedback('Mouvement de stock journalisé (historique immuable).');
  }

  return (
    <div className="space-y-6">
      {/* KPI & Alertes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Articles suivis</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {tenantIngredients.filter((i) => !i.is_archived).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--rc-muted)]">6 catégories gérées · Multi-emplacements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alertes actives</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums text-[var(--rc-danger-fg)]">
              {alerts.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--rc-muted)]">Ruptures, seuils bas &amp; péremptions ≤ 7 j</p>
          </CardContent>
        </Card>
        {!hideValuation && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Valeur du stock ({defaultCurr})</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">
                {formatMoney(totalValuation, defaultCurr)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--rc-muted)]">Valorisation au coût unitaire réel</p>
            </CardContent>
          </Card>
        )}
      </div>

      {alerts.length > 0 && (
        <Card className="border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)]">
          <CardContent className="pt-4 space-y-1.5 text-xs text-[var(--rc-warn-fg)]">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Alertes de stock prioritaires ({alerts.length})</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {alerts.slice(0, 6).map((a, idx) => (
                <span key={`${a.ingredientId}-${a.alertType}-${idx}`}>
                  <strong>{a.ingredientName}</strong> :{' '}
                  {a.alertType === 'out_of_stock'
                    ? 'Rupture totale'
                    : a.alertType === 'low_stock'
                      ? `Sous seuil (${a.currentStock}/${a.minimumStock} ${a.unit})`
                      : `Expiration proche (${a.expiryDate})`}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Nouvel article de stock</CardTitle>
            <CardDescription>Catégorie, coût unitaire, fournisseur et emplacement.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddIngredient} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label htmlFor="ing-name">Nom *</Label>
                <Input
                  id="ing-name"
                  placeholder="Nom de l'article"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label htmlFor="ing-cat">Catégorie</Label>
                <select
                  id="ing-cat"
                  value={ingCategory}
                  onChange={(e) => setIngCategory(e.target.value as InventoryCategory)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                >
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-unit">Unité</Label>
                <Input id="ing-unit" value={ingUnit} onChange={(e) => setIngUnit(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-cost">Coût unitaire</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="ing-cost"
                    type="number"
                    step="0.01"
                    value={ingCost}
                    onChange={(e) => setIngCost(e.target.value)}
                  />
                  <select
                    aria-label="Devise coût"
                    value={ingCurr}
                    onChange={(e) => setIngCurr(e.target.value as CurrencyCode)}
                    className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-stock">Stock initial</Label>
                <Input
                  id="ing-stock"
                  type="number"
                  step="0.1"
                  value={ingStock}
                  onChange={(e) => setIngStock(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-min">Seuil d&apos;alerte</Label>
                <Input
                  id="ing-min"
                  type="number"
                  step="0.1"
                  value={ingMin}
                  onChange={(e) => setIngMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-sup">Fournisseur</Label>
                <select
                  id="ing-sup"
                  value={ingSupplierId}
                  onChange={(e) => setIngSupplierId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                >
                  <option value="">Non rattaché</option>
                  {tenantSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ing-exp">Date péremption</Label>
                <Input
                  id="ing-exp"
                  type="date"
                  value={ingExpiry}
                  onChange={(e) => setIngExpiry(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="ing-loc">Emplacement de stockage</Label>
                <Input
                  id="ing-loc"
                  placeholder="Chambre froide, Réserve sèche..."
                  value={ingStorage}
                  onChange={(e) => setIngStorage(e.target.value)}
                />
              </div>
              <div className="col-span-2 pt-1">
                <Button type="submit" size="sm" className="w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Ajouter l&apos;article</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enregistrer un mouvement de stock</CardTitle>
            <CardDescription>Journal immuable : achats, sorties cuisine, pertes, retours, transferts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordMovement} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="mov-ing">Article</Label>
                <select
                  id="mov-ing"
                  value={movIngId || tenantIngredients.filter((i) => !i.is_archived)[0]?.id || ''}
                  onChange={(e) => setMovIngId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  {tenantIngredients.filter((i) => !i.is_archived).length === 0 ? (
                    <option value="">Aucun article actif</option>
                  ) : (
                    tenantIngredients
                      .filter((i) => !i.is_archived)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.current_stock} {i.unit})
                        </option>
                      ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mov-type">Type de mouvement</Label>
                <select
                  id="mov-type"
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as MovementType)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                >
                  {(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((k) => (
                    <option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mov-qty">Quantité</Label>
                <Input
                  id="mov-qty"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="2"
                  value={movQty}
                  onChange={(e) => setMovQty(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="mov-reason">Motif obligatoire *</Label>
                <Input
                  id="mov-reason"
                  placeholder="Service du midi, casse, inventaire physique..."
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 flex items-center justify-between gap-4 pt-1">
                <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback ?? ''}</span>
                <Button type="submit" size="sm">Valider le mouvement</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {editingIng && (
        <Card className="border-[var(--rc-gold)]">
          <CardHeader>
            <CardTitle className="text-base">Modifier : {editingIng.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="ed-ing-min">Seuil alerte</Label>
                <Input id="ed-ing-min" type="number" step="0.1" value={editMin} onChange={(e) => setEditMin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-ing-cost">Coût ({editingIng.currency ?? defaultCurr})</Label>
                <Input id="ed-ing-cost" type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-ing-loc">Emplacement</Label>
                <Input id="ed-ing-loc" value={editStorage} onChange={(e) => setEditStorage(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-ing-exp">Péremption</Label>
                <Input id="ed-ing-exp" type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
              </div>
              <div className="sm:col-span-4 flex gap-2">
                <Button type="submit" size="sm">Enregistrer</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingIng(null)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle>État des stocks ({filteredIngredients.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Nom ou emplacement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-44 text-xs"
            />
            <select
              aria-label="Filtrer par catégorie stock"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as 'all' | InventoryCategory)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Toutes catégories</option>
              {INVENTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Filtrer par fournisseur"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Tous fournisseurs</option>
              {tenantSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[var(--rc-muted)] px-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-[var(--rc-gold)]"
              />
              <span>Archivés</span>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Article &amp; Emplacement</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Seuil</th>
                  {!hideValuation && <th className="px-4 py-3 text-right">Coût unit.</th>}
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {filteredIngredients.map((i) => {
                  const low = isLowStock(i);
                  const out = i.current_stock <= 0;
                  return (
                    <tr key={i.id} className={`hover:bg-[var(--rc-card-elevated)] ${i.is_archived ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{i.name}</p>
                        <p className="text-xs text-[var(--rc-muted)]">
                          {i.storage_location ?? 'Emplacement non précisé'}
                          {i.expiry_date ? ` · Exp: ${i.expiry_date}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                        {i.category ?? 'Ingrédients'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {i.current_stock} {i.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[var(--rc-muted)] tabular-nums whitespace-nowrap">
                        {i.minimum_stock} {i.unit}
                      </td>
                      {!hideValuation && (
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          {formatMoney(i.unit_cost, i.currency ?? defaultCurr)}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusLabel
                          label={i.is_archived ? 'Archivé' : out ? 'Rupture' : low ? 'Stock bas' : 'Nominal'}
                          tone={i.is_archived ? 'neutral' : out ? 'crimson' : low ? 'amber' : 'emerald'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Modifier ${i.name}`}
                          onClick={() => {
                            setEditingIng(i);
                            setEditMin(String(i.minimum_stock));
                            setEditCost(String(i.unit_cost));
                            setEditStorage(i.storage_location ?? '');
                            setEditExpiry(i.expiry_date ?? '');
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={i.is_archived ? `Restaurer ${i.name}` : `Archiver ${i.name}`}
                          onClick={() => archiveIngredient(i.id, !i.is_archived)}
                        >
                          {i.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {tenantMovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Journal immuable des mouvements ({tenantMovements.length})</CardTitle>
            <CardDescription>Aucune modification ou suppression rétroactive autorisée.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Article</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3">Motif &amp; Auteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rc-border)]">
                  {tenantMovements.map((m) => {
                    const ing = ingredients.find((i) => i.id === m.ingredient_id);
                    return (
                      <tr key={m.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                          {m.created_at.replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className="px-4 py-3 font-medium">{ing?.name ?? m.ingredient_id}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {MOVEMENT_LABELS[m.movement_type as MovementType] ?? m.movement_type}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{m.quantity}</td>
                        <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">
                          {m.reason ?? '—'} {m.performed_by_label ? `(${m.performed_by_label})` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
