import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { convertCurrencyAmount, formatMoney } from '@/src/lib/domain/operations';
import { computeRecipeUnitCost } from '@/src/lib/domain/erp';

interface RecipesModuleViewProps {
  restaurantId?: string;
}

export function RecipesModuleView({ restaurantId }: RecipesModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    products,
    ingredients,
    recipes,
    recipeItems,
    saveRecipeForProduct,
    deleteRecipe,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const currency = restaurant?.default_currency ?? 'USD';
  const rate = restaurant?.exchange_rate_usd_cdf ?? 2850;

  const tenantProducts = products.filter((p) => p.restaurant_id === tenantId);
  const tenantIngredients = ingredients.filter((i) => i.restaurant_id === tenantId && !i.is_archived);
  const tenantRecipes = recipes.filter((r) => r.restaurant_id === tenantId);

  const [selectedProductId, setSelectedProductId] = useState(tenantProducts[0]?.id ?? '');
  const [draftLines, setDraftLines] = useState<Array<{ ingredientId: string; qty: string }>>([
    { ingredientId: tenantIngredients[0]?.id ?? '', qty: '0.25' },
  ]);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  function addDraftLine() {
    setDraftLines((prev) => [
      ...prev,
      { ingredientId: tenantIngredients[0]?.id ?? '', qty: '0.1' },
    ]);
  }

  function handleSaveRecipe(e: FormEvent) {
    e.preventDefault();
    const targetProd = selectedProductId || tenantProducts[0]?.id;
    if (!targetProd) {
      setFeedback('Aucun plat disponible.');
      return;
    }
    const items = draftLines
      .filter((l) => l.ingredientId)
      .map((l) => {
        const ing = tenantIngredients.find((i) => i.id === l.ingredientId);
        return {
          ingredientId: l.ingredientId,
          quantityPerUnit: Number(l.qty) || 0,
          unit: ing?.unit ?? 'kg',
        };
      });

    const res = saveRecipeForProduct({
      restaurantId: tenantId,
      productId: targetProd,
      notes,
      items,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setNotes('');
    setFeedback('Fiche recette BOM enregistrée. Les commandes confirmées déduiront automatiquement ces quantités.');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurer une fiche recette (Nomenclature BOM)</CardTitle>
          <CardDescription>
            Associez les ingrédients exacts par portion vendue pour automatiser les sorties cuisine et calculer le coût matière.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveRecipe} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rec-prod">Plat du menu</Label>
                <select
                  id="rec-prod"
                  value={selectedProductId || tenantProducts[0]?.id || ''}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  {tenantProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatMoney(p.price_amount, p.currency)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-notes">Notes fiche technique</Label>
                <Input
                  id="rec-notes"
                  placeholder="Portion 1 assiette..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--rc-fg)]">Ingrédients par portion</span>
                <Button type="button" size="sm" variant="outline" onClick={addDraftLine}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ajouter un ingrédient</span>
                </Button>
              </div>
              {draftLines.map((line, idx) => {
                const ing = tenantIngredients.find((i) => i.id === line.ingredientId);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      aria-label={`Ingrédient ligne ${idx + 1}`}
                      value={line.ingredientId}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, ingredientId: e.target.value } : row))
                        )
                      }
                      className="col-span-7 h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                    >
                      {tenantIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      aria-label={`Quantité ligne ${idx + 1}`}
                      value={line.qty}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, qty: e.target.value } : row))
                        )
                      }
                      className="col-span-3 h-9 text-xs font-mono"
                    />
                    <span className="col-span-1 text-xs text-[var(--rc-muted)]">{ing?.unit ?? ''}</span>
                    <button
                      type="button"
                      aria-label={`Retirer ligne ${idx + 1}`}
                      onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 text-[var(--rc-danger-fg)] flex justify-center cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback ?? ''}</span>
              <Button type="submit" size="sm">Enregistrer la recette</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coûts matière &amp; Marges par plat ({tenantRecipes.length})</CardTitle>
          <CardDescription>
            Ratio Food Cost et marge brute unitaire calculés sur les coûts réels des ingrédients ({currency}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Plat</th>
                  <th className="px-4 py-3">Composition</th>
                  <th className="px-4 py-3 text-right">Prix vente</th>
                  <th className="px-4 py-3 text-right">Coût matière</th>
                  <th className="px-4 py-3 text-right">Marge brute</th>
                  <th className="px-4 py-3 text-right">Food Cost</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {tenantRecipes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                      Aucune fiche recette configurée.
                    </td>
                  </tr>
                ) : (
                  tenantRecipes.map((rec) => {
                    const prod = tenantProducts.find((p) => p.id === rec.product_id);
                    const lines = recipeItems.filter((ri) => ri.recipe_id === rec.id);
                    const cogs = computeRecipeUnitCost(rec.id, recipeItems, ingredients, currency, rate);
                    const sellPrice = prod
                      ? convertCurrencyAmount(prod.price_amount, prod.currency, currency, rate)
                      : 0;
                    const margin = Math.round((sellPrice - cogs) * 100) / 100;
                    const foodCostPct = sellPrice > 0 ? Math.round((cogs / sellPrice) * 1000) / 10 : 0;

                    return (
                      <tr key={rec.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-4 py-3 font-medium">{prod?.name ?? rec.product_id}</td>
                        <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">
                          {lines
                            .map((l) => {
                              const ing = ingredients.find((i) => i.id === l.ingredient_id);
                              return `${l.quantity_per_unit} ${l.unit} ${ing?.name ?? l.ingredient_id}`;
                            })
                            .join(' · ')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatMoney(sellPrice, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatMoney(cogs, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-[var(--rc-gold-text)]">
                          {formatMoney(margin, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          {foodCostPct}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Supprimer recette ${prod?.name ?? rec.id}`}
                            onClick={() => deleteRecipe(rec.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--rc-danger-fg)]" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
