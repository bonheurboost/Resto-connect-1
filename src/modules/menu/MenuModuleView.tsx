import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Star, Image as ImageIcon, SlidersHorizontal, Truck, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import { readImageFileAsDataUrl } from '@/src/lib/media/imageUpload';
import type { CurrencyCode, ProductOptionRecord, ProductRecord } from '@/src/lib/supabase/database.types';

interface MenuModuleViewProps {
  restaurantId?: string;
  readOnly?: boolean;
}

export function MenuModuleView({ restaurantId, readOnly = false }: MenuModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    categories,
    products,
    productImages,
    productOptions,
    productOptionValues,
    deliveryZones,
    createCategory,
    updateCategory,
    deleteCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductAvailability,
    toggleProductFeatured,
    addProductImage,
    removeProductImage,
    addProductOptionWithValues,
    deleteProductOption,
    createDeliveryZone,
    toggleDeliveryZone,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const tenantCategories = categories.filter((c) => c.restaurant_id === tenantId);
  const tenantProducts = products.filter((p) => p.restaurant_id === tenantId);
  const tenantZones = deliveryZones.filter((z) => z.restaurant_id === tenantId);

  const [tab, setTab] = useState<'catalog' | 'delivery_zones'>('catalog');
  const [catName, setCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  const [prodName, setProdName] = useState('');
  const [prodCatId, setProdCatId] = useState(tenantCategories[0]?.id ?? '');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCurrency, setProdCurrency] = useState<CurrencyCode>(
    restaurant?.default_currency ?? 'CDF'
  );
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrep, setProdPrep] = useState('20');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodPhotoUrl, setProdPhotoUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Édition rapide plat & gestionnaire photos/options
  const [selectedProdForDetail, setSelectedProdForDetail] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');

  // Ajout photo
  const [newImgUrl, setNewImgUrl] = useState('');

  // Ajout groupe d'options
  const [optName, setOptName] = useState('');
  const [optType, setOptType] = useState<ProductOptionRecord['option_type']>('supplement');
  const [optRequired, setOptRequired] = useState(false);
  const [optMultiple, setOptMultiple] = useState(true);
  const [optChoicesText, setOptChoicesText] = useState('');

  // Zones de livraison
  const [zoneName, setZoneName] = useState('');
  const [zoneCommune, setZoneCommune] = useState('');
  const [zoneFee, setZoneFee] = useState('0');
  const [zoneCurr, setZoneCurr] = useState<CurrencyCode>(restaurant?.default_currency ?? 'USD');
  const [zoneEta, setZoneEta] = useState('30');

  function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const res = createCategory(tenantId, catName);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setCatName('');
    setFeedback('Catégorie ajoutée au menu.');
  }

  function handleSaveCatEdit(catId: string) {
    const res = updateCategory(catId, { name: editCatName });
    if (res.ok) {
      setEditingCatId(null);
      setFeedback('Catégorie renommée.');
    } else {
      setFeedback(res.error);
    }
  }

  function handleAddProduct(e: FormEvent) {
    e.preventDefault();
    const categoryId = prodCatId || tenantCategories[0]?.id;
    if (!categoryId) {
      setFeedback("Créez d'abord une catégorie.");
      return;
    }
    const res = createProduct({
      restaurantId: tenantId,
      categoryId,
      name: prodName,
      description: prodDesc,
      priceAmount: Number(prodPrice),
      currency: prodCurrency,
      prepMinutes: Number(prodPrep) || 15,
      isFeatured: prodFeatured,
      primaryImageUrl: prodPhotoUrl.trim() || undefined,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setProdName('');
    setProdPrice('');
    setProdDesc('');
    setProdPhotoUrl('');
    setProdFeatured(false);
    setFeedback('Plat ajouté au catalogue.');
  }

  function handleSaveProductEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    const res = updateProduct(editingProduct.id, {
      name: editProdName,
      price_amount: Number(editProdPrice) || 0,
      description: editProdDesc.trim() || null,
    });
    if (res.ok) {
      setEditingProduct(null);
      setFeedback('Plat mis à jour.');
    } else {
      setFeedback(res.error);
    }
  }

  function handleAddOption(productId: string, e: FormEvent) {
    e.preventDefault();
    const parsedChoices = optChoicesText
      .split(',')
      .map((chunk) => {
        const [labelRaw, priceRaw] = chunk.split(':');
        return {
          label: (labelRaw ?? '').trim(),
          extraPrice: Math.max(0, Number(priceRaw ?? 0) || 0),
          currency: restaurant?.default_currency ?? 'USD',
        };
      })
      .filter((c) => c.label.length > 0);

    const res = addProductOptionWithValues({
      restaurantId: tenantId,
      productId,
      name: optName,
      optionType: optType,
      isRequired: optRequired,
      isMultiple: optMultiple,
      values: parsedChoices,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setOptName('');
    setFeedback("Groupe d'options ajouté au plat.");
  }

  function handleAddZone(e: FormEvent) {
    e.preventDefault();
    const res = createDeliveryZone({
      restaurantId: tenantId,
      zoneName,
      commune: zoneCommune,
      feeAmount: Number(zoneFee) || 0,
      currency: zoneCurr,
      estimatedMinutes: Number(zoneEta) || 30,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setZoneName('');
    setFeedback('Zone de livraison enregistrée.');
  }

  const activeDetailProduct = tenantProducts.find((p) => p.id === selectedProdForDetail);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'catalog'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold shadow-xs'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Catégories, Plats &amp; Options ({tenantProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('delivery_zones')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'delivery_zones'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold shadow-xs'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Zones de livraison ({tenantZones.length})
          </button>
        </div>
        {feedback && <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback}</span>}
      </div>

      {tab === 'delivery_zones' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {!readOnly && (
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                  <span>Nouvelle zone de livraison</span>
                </CardTitle>
                <CardDescription>Tarification claire par commune ou secteur.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddZone} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dz-name">Libellé de la zone</Label>
                    <Input
                      id="dz-name"
                      placeholder="Nom de la zone ou secteur"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dz-commune">Commune</Label>
                      <Input
                        id="dz-commune"
                        value={zoneCommune}
                        onChange={(e) => setZoneCommune(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dz-eta">Délai estimé (min)</Label>
                      <Input
                        id="dz-eta"
                        type="number"
                        min={10}
                        value={zoneEta}
                        onChange={(e) => setZoneEta(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dz-fee">Frais livraison</Label>
                      <Input
                        id="dz-fee"
                        type="number"
                        step="0.01"
                        min={0}
                        value={zoneFee}
                        onChange={(e) => setZoneFee(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dz-curr">Devise</Label>
                      <select
                        id="dz-curr"
                        value={zoneCurr}
                        onChange={(e) => setZoneCurr(e.target.value as CurrencyCode)}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-sm"
                      >
                        <option value="USD">USD</option>
                        <option value="CDF">CDF</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Ajouter la zone
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={readOnly ? 'lg:col-span-12' : 'lg:col-span-7'}>
            <CardHeader>
              <CardTitle>Zones configurées ({tenantZones.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-[var(--rc-border)] rounded-md border border-[var(--rc-border)]">
                {tenantZones.length === 0 ? (
                  <p className="p-6 text-xs text-center text-[var(--rc-muted)]">
                    Aucune zone de livraison configurée pour cet établissement.
                  </p>
                ) : (
                  tenantZones.map((z) => (
                    <div key={z.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--rc-fg)]">{z.zone_name}</p>
                        <p className="text-xs text-[var(--rc-muted)]">
                          Commune : {z.commune} · ~{z.estimated_minutes} min ·{' '}
                          <span className="font-mono font-semibold text-[var(--rc-gold-text)]">
                            {formatMoney(z.fee_amount, z.currency)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusLabel
                          label={z.is_active ? 'Active' : 'Inactive'}
                          tone={z.is_active ? 'emerald' : 'neutral'}
                        />
                        {!readOnly && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleDeliveryZone(z.id)}
                          >
                            {z.is_active ? 'Désactiver' : 'Activer'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {!readOnly && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Catégories ({tenantCategories.length})</CardTitle>
                  <CardDescription>Organisation structurée du menu client.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleAddCategory} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-name">Nom de catégorie</Label>
                      <Input
                        id="cat-name"
                        placeholder="Nom de la catégorie"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" size="sm" className="w-full">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>Ajouter la catégorie</span>
                    </Button>
                  </form>

                  <div className="divide-y divide-[var(--rc-border)] border-t border-[var(--rc-border)] pt-2">
                    {tenantCategories.map((c) => (
                      <div key={c.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        {editingCatId === c.id ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <Input
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              className="h-7 text-xs"
                            />
                            <Button type="button" size="sm" onClick={() => handleSaveCatEdit(c.id)}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-[var(--rc-fg)] truncate">{c.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                aria-label={`Renommer ${c.name}`}
                                onClick={() => {
                                  setEditingCatId(c.id);
                                  setEditCatName(c.name);
                                }}
                                className="p-1 text-[var(--rc-muted)] hover:text-[var(--rc-fg)]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Supprimer ${c.name}`}
                                onClick={() => {
                                  const res = deleteCategory(c.id);
                                  if (!res.ok) setFeedback(res.error);
                                }}
                                className="p-1 text-[var(--rc-danger-fg)] hover:opacity-80"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-8">
                <CardHeader>
                  <CardTitle>Ajouter un produit au menu</CardTitle>
                  <CardDescription>
                    Publié sur <code className="font-mono">/restaurant/{restaurant?.slug}</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-name">Nom du plat ou boisson</Label>
                      <Input
                        id="prod-name"
                        placeholder="Nom du plat ou boisson"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-cat">Catégorie</Label>
                      <select
                        id="prod-cat"
                        value={prodCatId || tenantCategories[0]?.id || ''}
                        onChange={(e) => setProdCatId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                      >
                        {tenantCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-price">Tarif</Label>
                      <div className="flex gap-2">
                        <Input
                          id="prod-price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={prodPrice}
                          onChange={(e) => setProdPrice(e.target.value)}
                          required
                        />
                        <select
                          aria-label="Devise du produit"
                          value={prodCurrency}
                          onChange={(e) => setProdCurrency(e.target.value as CurrencyCode)}
                          className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-sm"
                        >
                          <option value="USD">USD</option>
                          <option value="CDF">CDF</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-prep">Temps de préparation (min)</Label>
                      <Input
                        id="prod-prep"
                        type="number"
                        min="1"
                        value={prodPrep}
                        onChange={(e) => setProdPrep(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-desc">Description</Label>
                      <Input
                        id="prod-desc"
                        placeholder="Ingrédients et accompagnements..."
                        value={prodDesc}
                        onChange={(e) => setProdDesc(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-photo">Photo principale (URL ou fichier)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="prod-photo"
                          placeholder="https://... ou importer une photo"
                          value={prodPhotoUrl}
                          onChange={(e) => setProdPhotoUrl(e.target.value)}
                        />
                        <label className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs font-medium text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] cursor-pointer shrink-0">
                          <Upload className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                          <span>Importer</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="sr-only"
                            onChange={async (ev) => {
                              const file = ev.target.files?.[0];
                              if (!file) return;
                              try {
                                const dataUrl = await readImageFileAsDataUrl(file);
                                setProdPhotoUrl(dataUrl);
                                setFeedback('Photo importée.');
                              } catch (err) {
                                setFeedback(err instanceof Error ? err.message : 'Erreur import photo.');
                              }
                              ev.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--rc-fg)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodFeatured}
                          onChange={(e) => setProdFeatured(e.target.checked)}
                        />
                        <span>Mettre en avant (Plat populaire / recommandé)</span>
                      </label>
                      <Button type="submit" size="sm">Enregistrer le produit</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {editingProduct && (
            <Card className="border-[var(--rc-gold)]">
              <CardHeader>
                <CardTitle className="text-base">Modifier : {editingProduct.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProductEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="ed-prod-name">Nom</Label>
                    <Input id="ed-prod-name" value={editProdName} onChange={(e) => setEditProdName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ed-prod-price">Prix ({editingProduct.currency})</Label>
                    <Input
                      id="ed-prod-price"
                      type="number"
                      step="0.01"
                      value={editProdPrice}
                      onChange={(e) => setEditProdPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ed-prod-desc">Description</Label>
                    <Input id="ed-prod-desc" value={editProdDesc} onChange={(e) => setEditProdDesc(e.target.value)} />
                  </div>
                  <div className="sm:col-span-3 flex gap-2">
                    <Button type="submit" size="sm">Enregistrer</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingProduct(null)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {activeDetailProduct && !readOnly && (
            <Card className="border-[var(--rc-gold)]">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    Photos &amp; Options — {activeDetailProduct.name}
                  </CardTitle>
                  <CardDescription>
                    Multi-photos, tailles, suppléments et variantes facturables.
                  </CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedProdForDetail(null)}>
                  Fermer
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-[var(--rc-gold-text)]">
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Galerie photos</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      aria-label="URL de photo du plat"
                      value={newImgUrl}
                      onChange={(e) => setNewImgUrl(e.target.value)}
                      placeholder="https://... ou importer une photo"
                      className="flex-1 min-w-[180px]"
                    />
                    <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-xs font-medium text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] cursor-pointer shrink-0">
                      <Upload className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                      <span>Fichier</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={async (ev) => {
                          const file = ev.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await readImageFileAsDataUrl(file);
                            const res = addProductImage({
                              restaurantId: tenantId,
                              productId: activeDetailProduct.id,
                              imageUrl: dataUrl,
                            });
                            if (!res.ok) setFeedback(res.error);
                            else setFeedback('Photo importée dans la galerie du plat.');
                          } catch (err) {
                            setFeedback(err instanceof Error ? err.message : 'Erreur import photo.');
                          }
                          ev.target.value = '';
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const res = addProductImage({
                          restaurantId: tenantId,
                          productId: activeDetailProduct.id,
                          imageUrl: newImgUrl,
                        });
                        if (!res.ok) setFeedback(res.error);
                        else setNewImgUrl('');
                      }}
                    >
                      Ajouter URL
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {productImages
                      .filter((pi) => pi.product_id === activeDetailProduct.id)
                      .map((pi) => (
                        <div key={pi.id} className="rounded border border-[var(--rc-border)] p-2 space-y-1.5">
                          <img
                            src={pi.public_url ?? pi.storage_path}
                            alt={activeDetailProduct.name}
                            className="h-20 w-full object-cover rounded"
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <span>{pi.is_primary ? 'Principale' : `Photo #${pi.sort_order}`}</span>
                            <button
                              type="button"
                              onClick={() => removeProductImage(pi.id)}
                              className="text-[var(--rc-danger-fg)] underline"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-[var(--rc-gold-text)]">
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tailles, suppléments &amp; accompagnements</span>
                  </p>
                  <form onSubmit={(e) => handleAddOption(activeDetailProduct.id, e)} className="space-y-2.5 rounded border border-[var(--rc-border)] p-3 bg-[var(--rc-bg-subtle)]">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Nom groupe (ex: Suppléments)"
                        value={optName}
                        onChange={(e) => setOptName(e.target.value)}
                        required
                      />
                      <select
                        aria-label="Type d'option"
                        value={optType}
                        onChange={(e) => setOptType(e.target.value as ProductOptionRecord['option_type'])}
                        className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                      >
                        <option value="size">Taille</option>
                        <option value="supplement">Supplément</option>
                        <option value="side">Accompagnement</option>
                        <option value="variant">Variante</option>
                      </select>
                    </div>
                    <Input
                      placeholder="Choix:Prix (ex: Standard:0)"
                      value={optChoicesText}
                      onChange={(e) => setOptChoicesText(e.target.value)}
                      required
                    />
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={optRequired} onChange={(e) => setOptRequired(e.target.checked)} />
                          <span>Obligatoire</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={optMultiple} onChange={(e) => setOptMultiple(e.target.checked)} />
                          <span>Multiple</span>
                        </label>
                      </div>
                      <Button type="submit" size="sm">Créer option</Button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {productOptions
                      .filter((o) => o.product_id === activeDetailProduct.id)
                      .map((opt) => {
                        const vals = productOptionValues.filter((v) => v.option_id === opt.id);
                        return (
                          <div key={opt.id} className="rounded border border-[var(--rc-border)] p-2.5 text-xs flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[var(--rc-fg)]">{opt.name}</p>
                              <p className="text-[var(--rc-muted)]">
                                {vals.map((v) => `${v.label} (+${formatMoney(v.extra_price, v.currency)})`).join(' · ')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteProductOption(opt.id)}
                              className="text-[var(--rc-danger-fg)] underline shrink-0"
                            >
                              Retirer
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Catalogue du restaurant ({tenantProducts.length})</CardTitle>
              <CardDescription>
                Catégories actives : {tenantCategories.map((c) => c.name).join(' · ') || 'Aucune'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Produit</th>
                      <th className="px-4 py-3">Catégorie</th>
                      <th className="px-4 py-3 text-right">Prix</th>
                      <th className="px-4 py-3 text-center">Vedette</th>
                      <th className="px-4 py-3">Statut</th>
                      {!readOnly && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantProducts.length === 0 ? (
                      <tr>
                        <td colSpan={readOnly ? 5 : 6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                          Aucun produit enregistré pour cet établissement.
                        </td>
                      </tr>
                    ) : (
                      tenantProducts.map((p) => {
                        const cat = tenantCategories.find((c) => c.id === p.category_id);
                        const optsCount = productOptions.filter((o) => o.product_id === p.id).length;
                        const imgsCount = productImages.filter((pi) => pi.product_id === p.id).length;
                        return (
                          <tr key={p.id} className="hover:bg-[var(--rc-card-elevated)]">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[var(--rc-fg)]">{p.name}</p>
                              <p className="text-xs text-[var(--rc-muted)]">
                                {optsCount} option(s) · {imgsCount} photo(s) · {p.preparation_time_min ?? 15} min
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                              {cat?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                              {formatMoney(p.price_amount, p.currency)}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                disabled={readOnly}
                                aria-label={`Mettre en avant ${p.name}`}
                                onClick={() => toggleProductFeatured(p.id)}
                                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs cursor-pointer ${
                                  p.is_featured
                                    ? 'bg-[var(--rc-gold-tint)] text-[var(--rc-gold-text)] font-medium'
                                    : 'text-[var(--rc-muted)] hover:bg-[var(--rc-surface-muted)]'
                                }`}
                              >
                                <Star className="h-3.5 w-3.5" />
                                <span>{p.is_featured ? 'Oui' : 'Non'}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusLabel
                                label={p.is_available ? 'Disponible' : 'Rupture'}
                                tone={p.is_available ? 'emerald' : 'amber'}
                              />
                            </td>
                            {!readOnly && (
                              <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedProdForDetail(p.id)}
                                >
                                  Options &amp; Photos
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Modifier ${p.name}`}
                                  onClick={() => {
                                    setEditingProduct(p);
                                    setEditProdName(p.name);
                                    setEditProdPrice(String(p.price_amount));
                                    setEditProdDesc(p.description ?? '');
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleProductAvailability(p.id)}
                                >
                                  {p.is_available ? 'Désactiver' : 'Réactiver'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Supprimer ${p.name}`}
                                  onClick={() => deleteProduct(p.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-[var(--rc-danger-fg)]" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
