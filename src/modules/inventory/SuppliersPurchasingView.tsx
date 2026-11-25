import { useState, type FormEvent } from 'react';
import { Plus, PackageCheck, Archive, ArchiveRestore } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import type { CurrencyCode, PurchaseOrderRecord } from '@/src/lib/supabase/database.types';

interface SuppliersPurchasingViewProps {
  restaurantId?: string;
}

const PO_STATUS_META: Record<
  PurchaseOrderRecord['status'],
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  pending: { label: 'En attente', tone: 'amber' },
  ordered: { label: 'Commandé', tone: 'neutral' },
  partially_received: { label: 'Reçu partiellement', tone: 'amber' },
  received: { label: 'Réceptionné', tone: 'emerald' },
  cancelled: { label: 'Annulé', tone: 'crimson' },
};

export function SuppliersPurchasingView({ restaurantId }: SuppliersPurchasingViewProps) {
  const {
    activeTenantId,
    restaurants,
    suppliers,
    ingredients,
    purchaseOrders,
    purchaseOrderItems,
    createSupplier,
    archiveSupplier,
    createPurchaseOrder,
    receivePurchaseOrderItems,
    recordPurchaseOrderPayment,
    cancelPurchaseOrder,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const defaultCurr: CurrencyCode = restaurant?.default_currency ?? 'USD';

  const tenantSuppliers = suppliers.filter((s) => s.restaurant_id === tenantId);
  const activeSuppliers = tenantSuppliers.filter((s) => !s.is_archived);
  const tenantIngredients = ingredients.filter((i) => i.restaurant_id === tenantId && !i.is_archived);
  const tenantPOs = purchaseOrders.filter((po) => po.restaurant_id === tenantId);

  const [tab, setTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Formulaire fournisseur
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCategory, setSupCategory] = useState('Produits alimentaires');
  const [supAddress, setSupAddress] = useState('');

  // Formulaire bon d'approvisionnement
  const [poSupplierId, setPoSupplierId] = useState(activeSuppliers[0]?.id ?? '');
  const [poCurr, setPoCurr] = useState<CurrencyCode>(defaultCurr);
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [poRef, setPoRef] = useState('');
  const [poIngId, setPoIngId] = useState(tenantIngredients[0]?.id ?? '');
  const [poQty, setPoQty] = useState('0');
  const [poUnitCost, setPoUnitCost] = useState('0');

  // Réception partielle/complète
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);
  const [recvMap, setRecvMap] = useState<Record<string, string>>({});
  const [payDelta, setPayDelta] = useState('');

  function handleAddSupplier(e: FormEvent) {
    e.preventDefault();
    const res = createSupplier({
      restaurantId: tenantId,
      name: supName,
      contactName: supContact,
      phone: supPhone,
      category: supCategory,
      address: supAddress,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupAddress('');
    setFeedback('Fournisseur enregistré.');
  }

  function handleCreatePO(e: FormEvent) {
    e.preventDefault();
    const supId = poSupplierId || activeSuppliers[0]?.id;
    const ingId = poIngId || tenantIngredients[0]?.id;
    if (!supId || !ingId) {
      setFeedback('Sélectionnez un fournisseur et un article.');
      return;
    }
    const res = createPurchaseOrder({
      restaurantId: tenantId,
      supplierId: supId,
      orderDate: poDate,
      currency: poCurr,
      attachmentRef: poRef,
      items: [
        {
          ingredientId: ingId,
          quantityOrdered: Number(poQty) || 0,
          unitCost: Number(poUnitCost) || 0,
        },
      ],
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setPoRef('');
    setFeedback(`Bon ${res.po.order_number} créé (le stock s'incrémentera uniquement à la réception).`);
  }

  function openReceiveModal(poId: string) {
    const lines = purchaseOrderItems.filter((li) => li.purchase_order_id === poId);
    const initial: Record<string, string> = {};
    for (const li of lines) {
      const remaining = Math.max(0, li.quantity_ordered - li.quantity_received);
      initial[li.id] = String(remaining);
    }
    setRecvMap(initial);
    setReceivingPoId(poId);
    requestAnimationFrame(() => {
      document.getElementById('po-reception-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function handleConfirmReceive(e: FormEvent) {
    e.preventDefault();
    if (!receivingPoId) return;
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(recvMap)) {
      numeric[k] = Number(v) || 0;
    }
    const res = receivePurchaseOrderItems(receivingPoId, numeric);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setReceivingPoId(null);
    setFeedback('Réception validée et ajoutée au stock physique.');
  }

  const receivingPO = tenantPOs.find((p) => p.id === receivingPoId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setTab('purchases')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'purchases'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Approvisionnements ({tenantPOs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('suppliers')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'suppliers'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Fournisseurs ({activeSuppliers.length})
          </button>
        </div>
        {feedback && <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback}</span>}
      </div>

      {tab === 'suppliers' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Nouveau fournisseur</CardTitle>
              <CardDescription>Répertoire isolé par établissement.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSupplier} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sup-name">Raison sociale *</Label>
                  <Input id="sup-name" value={supName} onChange={(e) => setSupName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-cat">Catégorie</Label>
                  <Input id="sup-cat" value={supCategory} onChange={(e) => setSupCategory(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-contact">Contact principal</Label>
                  <Input id="sup-contact" value={supContact} onChange={(e) => setSupContact(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-phone">Téléphone</Label>
                  <Input id="sup-phone" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sup-addr">Adresse</Label>
                  <Input id="sup-addr" value={supAddress} onChange={(e) => setSupAddress(e.target.value)} />
                </div>
                <Button type="submit" size="sm" className="w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Ajouter le fournisseur</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Fournisseurs &amp; Encours ({tenantSuppliers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Fournisseur</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Total achats</th>
                      <th className="px-4 py-3 text-right">Solde dû</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantSuppliers.map((sup) => {
                      const pos = tenantPOs.filter((p) => p.supplier_id === sup.id && p.status !== 'cancelled');
                      const orderedTotal = pos.reduce((s, p) => s + p.total_amount, 0);
                      const paidTotal = pos.reduce((s, p) => s + p.amount_paid, 0);
                      const balance = Math.max(0, orderedTotal - paidTotal);
                      return (
                        <tr key={sup.id} className={`hover:bg-[var(--rc-card-elevated)] ${sup.is_archived ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{sup.name}</p>
                            <p className="text-xs text-[var(--rc-muted)]">{sup.category}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">
                            <p>{sup.contact_name ?? '—'}</p>
                            <p className="font-mono">{sup.phone ?? ''}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatMoney(orderedTotal, defaultCurr)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-[var(--rc-danger-fg)]">
                            {formatMoney(balance, defaultCurr)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={sup.is_archived ? `Restaurer ${sup.name}` : `Archiver ${sup.name}`}
                              onClick={() => archiveSupplier(sup.id, !sup.is_archived)}
                            >
                              {sup.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
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
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Créer un bon d&apos;approvisionnement</CardTitle>
              <CardDescription>
                Le stock physique augmente uniquement lors de la réception confirmée.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePO} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="po-sup">Fournisseur</Label>
                  <select
                    id="po-sup"
                    value={poSupplierId || activeSuppliers[0]?.id || ''}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                  >
                    {activeSuppliers.length === 0 ? (
                      <option value="">Aucun fournisseur actif</option>
                    ) : (
                      activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-ing">Article</Label>
                  <select
                    id="po-ing"
                    value={poIngId || tenantIngredients[0]?.id || ''}
                    onChange={(e) => setPoIngId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                  >
                    {tenantIngredients.length === 0 ? (
                      <option value="">Aucun article actif</option>
                    ) : (
                      tenantIngredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-qty">Quantité</Label>
                  <Input id="po-qty" type="number" step="0.1" min="0.1" value={poQty} onChange={(e) => setPoQty(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-cost">Coût unit.</Label>
                  <div className="flex gap-1">
                    <Input id="po-cost" type="number" step="0.01" min="0" value={poUnitCost} onChange={(e) => setPoUnitCost(e.target.value)} />
                    <select
                      aria-label="Devise bon"
                      value={poCurr}
                      onChange={(e) => setPoCurr(e.target.value as CurrencyCode)}
                      className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-1.5 text-xs"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-date">Date</Label>
                  <Input id="po-date" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-ref">N° Facture / Réf.</Label>
                  <Input id="po-ref" placeholder="FAC-..." value={poRef} onChange={(e) => setPoRef(e.target.value)} />
                </div>
                <div className="sm:col-span-2 lg:col-span-6 flex justify-end">
                  <Button type="submit" size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Émettre le bon d&apos;achat</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {receivingPO && (
            <Card id="po-reception-card" className="border-[var(--rc-gold)]">
              <CardHeader>
                <CardTitle className="text-base font-mono">
                  Réception physique — {receivingPO.order_number}
                </CardTitle>
                <CardDescription>
                  Saisissez les quantités réellement livrées (réception partielle ou complète).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfirmReceive} className="space-y-3">
                  {purchaseOrderItems
                    .filter((li) => li.purchase_order_id === receivingPO.id)
                    .map((li) => {
                      const ing = ingredients.find((i) => i.id === li.ingredient_id);
                      const remaining = Math.max(0, li.quantity_ordered - li.quantity_received);
                      return (
                        <div key={li.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--rc-border)] p-3 text-xs">
                          <div>
                            <p className="font-semibold">{ing?.name ?? li.ingredient_id}</p>
                            <p className="text-[var(--rc-muted)]">
                              Commandé : {li.quantity_ordered} · Déjà reçu : {li.quantity_received} · Reliquat : {remaining}
                            </p>
                          </div>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max={remaining}
                            aria-label={`Quantité reçue pour ${ing?.name}`}
                            value={recvMap[li.id] ?? '0'}
                            onChange={(e) =>
                              setRecvMap((prev) => ({ ...prev, [li.id]: e.target.value }))
                            }
                            className="w-28 h-9 font-mono text-xs"
                          />
                        </div>
                      );
                    })}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Valider la réception en stock</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setReceivingPoId(null)}>
                      Fermer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Bons d&apos;approvisionnement ({tenantPOs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">N° Bon</th>
                      <th className="px-4 py-3">Fournisseur</th>
                      <th className="px-4 py-3">Statut réception</th>
                      <th className="px-4 py-3 text-right">Montant / Payé</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantPOs.map((po) => {
                      const sup = suppliers.find((s) => s.id === po.supplier_id);
                      const meta = PO_STATUS_META[po.status];
                      return (
                        <tr key={po.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                            <p>{po.order_number}</p>
                            <p className="text-[11px] text-[var(--rc-muted)] font-normal">{po.order_date}</p>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className="font-medium text-[var(--rc-fg)]">{sup?.name ?? po.supplier_id}</p>
                            {po.attachment_ref && <p className="font-mono text-[var(--rc-muted)]">{po.attachment_ref}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusLabel label={meta.label} tone={meta.tone} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                            <p>{formatMoney(po.total_amount, po.currency)}</p>
                            <p className="text-[var(--rc-muted)]">
                              Payé : {formatMoney(po.amount_paid, po.currency)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                            {po.status !== 'received' && po.status !== 'cancelled' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openReceiveModal(po.id)}
                              >
                                <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Réceptionner</span>
                              </Button>
                            )}
                            {po.payment_status !== 'paid' && po.status !== 'cancelled' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const rem = Math.max(0, po.total_amount - po.amount_paid);
                                  const amount = Number(payDelta) > 0 ? Number(payDelta) : rem;
                                  const res = recordPurchaseOrderPayment(po.id, amount);
                                  if (!res.ok) setFeedback(res.error);
                                  else {
                                    setPayDelta('');
                                    setFeedback(`Règlement fournisseur enregistré sur ${po.order_number}.`);
                                  }
                                }}
                              >
                                Solder
                              </Button>
                            )}
                            {(po.status === 'ordered' || po.status === 'pending' || po.status === 'draft') && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const r = cancelPurchaseOrder(po.id);
                                  if (!r.ok) setFeedback(r.error);
                                }}
                              >
                                Annuler
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
