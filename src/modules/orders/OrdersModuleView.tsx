import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney, getAllowedOrderTransitions, type OrderStatus } from '@/src/lib/domain/operations';
import {
  calculateOrderPaymentSummary,
  getOrderPaymentStatusLabel,
  getPaymentMethodLabel,
} from '@/src/lib/domain/cashRegister';
import type { OrderRecord } from '@/src/lib/supabase/database.types';

const ORDER_STATUS_LABELS: Record<
  OrderStatus,
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  pending: { label: 'En attente', tone: 'amber' },
  confirmed: { label: 'Confirmée', tone: 'neutral' },
  preparing: { label: 'En cuisine', tone: 'amber' },
  ready: { label: 'Prête', tone: 'emerald' },
  out_for_delivery: { label: 'En livraison', tone: 'amber' },
  delivered: { label: 'Livrée', tone: 'emerald' },
  picked_up: { label: 'Retirée', tone: 'emerald' },
  served: { label: 'Servie', tone: 'emerald' },
  completed: { label: 'Clôturée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'crimson' },
};

interface OrdersModuleViewProps {
  restaurantId?: string;
  kitchenOnly?: boolean;
  canCreate?: boolean;
}

export function OrdersModuleView({
  restaurantId,
  kitchenOnly = false,
  canCreate = true,
}: OrdersModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    orders,
    orderItems,
    orderItemOptions,
    orderStatusHistory,
    paymentTransactions,
    refunds,
    products,
    tables,
    createOrder,
    advanceOrderStatus,
    confirmOrderPaymentStatus,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const tenantProducts = products.filter((p) => p.restaurant_id === tenantId && p.is_available);
  const tenantTables = tables.filter((t) => t.restaurant_id === tenantId);
  const tenantOrders = orders.filter((o) => o.restaurant_id === tenantId);

  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [inspectedOrderId, setInspectedOrderId] = useState<string | null>(null);
  const [payRefInput, setPayRefInput] = useState('');

  const [orderType, setOrderType] = useState<OrderRecord['order_type']>('dine_in');
  const [tableId, setTableId] = useState(tenantTables[0]?.id ?? '');
  const [selectedProdId, setSelectedProdId] = useState(tenantProducts[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredOrders = tenantOrders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (dateFilter && !o.created_at.startsWith(dateFilter)) return false;
    return true;
  });

  const inspectedOrder = tenantOrders.find((o) => o.id === inspectedOrderId);

  function handleCreateOrder(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const prodId = selectedProdId || tenantProducts[0]?.id;
    if (!prodId) {
      setFeedback({ type: 'error', text: 'Aucun produit disponible dans ce restaurant.' });
      return;
    }
    const res = createOrder({
      restaurantId: tenantId,
      orderType,
      tableId: orderType === 'dine_in' ? tableId || tenantTables[0]?.id || null : null,
      notes,
      items: [{ productId: prodId, quantity: Math.max(1, Number(quantity) || 1) }],
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setNotes('');
    setQuantity('1');
    setFeedback({
      type: 'success',
      text: `Commande ${res.order.order_number} créée (Jeton : ${res.order.tracking_token}).`,
    });
  }

  function handleAdvanceStatus(orderId: string, nextStatus: OrderStatus) {
    const res = advanceOrderStatus(orderId, nextStatus);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    if (res.warning) {
      setFeedback({ type: 'success', text: `Statut mis à jour. ${res.warning}` });
    } else {
      setFeedback({
        type: 'success',
        text: `Statut mis à jour : ${ORDER_STATUS_LABELS[nextStatus].label}.`,
      });
    }
  }

  return (
    <div className="space-y-6">
      {canCreate && !kitchenOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Prendre une nouvelle commande</CardTitle>
            <CardDescription>
              Saisie salle ou retrait avec tarification catalogue et suivi automatique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrder} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="ord-type">Service</Label>
                <select
                  id="ord-type"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderRecord['order_type'])}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="dine_in">Sur place</option>
                  <option value="takeaway">À emporter</option>
                </select>
              </div>
              {orderType === 'dine_in' && (
                <div className="space-y-1.5">
                  <Label htmlFor="ord-table">Table</Label>
                  <select
                    id="ord-table"
                    value={tableId || tenantTables[0]?.id || ''}
                    onChange={(e) => setTableId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                  >
                    {tenantTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.table_number} ({t.zone})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ord-prod">Plat / Article</Label>
                <select
                  id="ord-prod"
                  value={selectedProdId || tenantProducts[0]?.id || ''}
                  onChange={(e) => setSelectedProdId(e.target.value)}
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
                <Label htmlFor="ord-qty">Quantité</Label>
                <Input
                  id="ord-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ord-notes">Note cuisine</Label>
                <Input
                  id="ord-notes"
                  placeholder="Sans piment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-[var(--rc-gold-text)]" />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Valider la commande</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
            feedback.type === 'error'
              ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
              : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {inspectedOrder && (
        <Card className="border-[var(--rc-gold)]">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base font-mono">
                Détails commande {inspectedOrder.order_number}
              </CardTitle>
              <CardDescription>
                {inspectedOrder.customer_name ?? 'Client'} ·{' '}
                {inspectedOrder.customer_phone ?? 'Sans téléphone'} · Mode : {inspectedOrder.order_type}
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setInspectedOrderId(null)}>
              Fermer
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <p className="font-semibold text-[var(--rc-fg)]">Lignes &amp; Options</p>
              <div className="divide-y divide-[var(--rc-border)] rounded border border-[var(--rc-border)]">
                {orderItems
                  .filter((oi) => oi.order_id === inspectedOrder.id)
                  .map((oi) => {
                    const opts = orderItemOptions.filter((o) => o.order_item_id === oi.id);
                    return (
                      <div key={oi.id} className="p-2.5 space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>
                            {oi.quantity}× {oi.product_name_snapshot ?? oi.product_id}
                          </span>
                          <span className="font-mono">
                            {formatMoney(oi.line_total, inspectedOrder.currency)}
                          </span>
                        </div>
                        {opts.length > 0 && (
                          <p className="text-[var(--rc-muted)]">
                            {opts.map((o) => `${o.option_name_snapshot}: ${o.value_label_snapshot}`).join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
              {inspectedOrder.delivery_address && (
                <div className="rounded border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-2.5 space-y-1">
                  <p className="font-semibold">Livraison</p>
                  <p>
                    {inspectedOrder.delivery_commune ?? ''}{' '}
                    {inspectedOrder.delivery_quartier ? `(${inspectedOrder.delivery_quartier})` : ''} —{' '}
                    {inspectedOrder.delivery_address}
                  </p>
                  {inspectedOrder.delivery_instructions && (
                    <p className="text-[var(--rc-muted)]">Note : {inspectedOrder.delivery_instructions}</p>
                  )}
                </div>
              )}
              {!kitchenOnly && (() => {
                const inspectedPaySummary = calculateOrderPaymentSummary(
                  inspectedOrder,
                  paymentTransactions,
                  refunds
                );
                const payMeta = getOrderPaymentStatusLabel(inspectedPaySummary.paymentStatus);
                return (
                  <div className="rounded border border-[var(--rc-border)] p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        Paiement ({getPaymentMethodLabel(inspectedOrder.payment_method ?? 'cash', restaurant?.custom_payment_method_label)})
                      </p>
                      <StatusLabel label={payMeta.label} tone={payMeta.tone} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-[var(--rc-muted)]">Total :</span>{' '}
                        {formatMoney(inspectedPaySummary.totalAmount, inspectedPaySummary.currency)}
                      </div>
                      <div className="text-[var(--rc-success-fg)]">
                        Payé : {formatMoney(inspectedPaySummary.paidAmount, inspectedPaySummary.currency)}
                      </div>
                      <div className="text-[var(--rc-warn-fg)] font-semibold">
                        Reste : {formatMoney(inspectedPaySummary.remainingAmount, inspectedPaySummary.currency)}
                      </div>
                    </div>
                    {inspectedPaySummary.remainingAmount > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="Référence transaction..."
                          value={payRefInput}
                          onChange={(e) => setPayRefInput(e.target.value)}
                          className="h-8 text-xs flex-1 min-w-[140px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const r = confirmOrderPaymentStatus(inspectedOrder.id, 'confirmed', payRefInput);
                            setFeedback(
                              r.ok
                                ? { type: 'success', text: 'Solde confirmé.' }
                                : { type: 'error', text: r.error }
                            );
                          }}
                        >
                          Confirmer solde
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[var(--rc-fg)]">Historique &amp; Suivi</p>
                {inspectedOrder.tracking_token && (
                  <Link
                    to={`/suivi/${inspectedOrder.tracking_token}`}
                    className="font-mono underline text-[var(--rc-gold-text)]"
                  >
                    {inspectedOrder.tracking_token}
                  </Link>
                )}
              </div>
              <div className="space-y-1.5">
                {orderStatusHistory
                  .filter((h) => h.order_id === inspectedOrder.id)
                  .map((h) => (
                    <div key={h.id} className="rounded border border-[var(--rc-border)] p-2 flex justify-between gap-2">
                      <div>
                        <span className="font-semibold">{ORDER_STATUS_LABELS[h.new_status].label}</span>
                        {h.note && <p className="text-[var(--rc-muted)]">{h.note}</p>}
                      </div>
                      <span className="font-mono text-[11px] text-[var(--rc-muted)] whitespace-nowrap">
                        {h.created_at.replace('T', ' ').slice(0, 16)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>
              {kitchenOnly ? 'File de préparation cuisine' : "Commandes de l'établissement"} ({filteredOrders.length})
            </CardTitle>
            <CardDescription>
              Déduction automatique des recettes à la confirmation · Restauration si annulation.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Tous statuts</option>
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_LABELS[st].label}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Filtrer par date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3 whitespace-nowrap">N°</th>
                  <th className="px-4 py-3 whitespace-nowrap">Détails</th>
                  <th className="px-4 py-3 whitespace-nowrap">Service / Paiement</th>
                  <th className="px-4 py-3 whitespace-nowrap">Statut &amp; Stock</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Total</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                      Aucune commande correspondant aux filtres.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const lines = orderItems.filter((oi) => oi.order_id === order.id);
                    const tbl = tables.find((t) => t.id === order.table_id);
                    const statusMeta = ORDER_STATUS_LABELS[order.status];
                    const paySummary = calculateOrderPaymentSummary(order, paymentTransactions, refunds);
                    const payStatusMeta = getOrderPaymentStatusLabel(paySummary.paymentStatus);
                    const nextSteps = getAllowedOrderTransitions(order.status).filter((s) => {
                      if (order.order_type !== 'delivery' && (s === 'out_for_delivery' || s === 'delivered')) {
                        return false;
                      }
                      if (order.order_type !== 'takeaway' && s === 'picked_up') {
                        return false;
                      }
                      if (order.order_type !== 'dine_in' && s === 'served') {
                        return false;
                      }
                      return true;
                    });

                    return (
                      <tr key={order.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                          {order.order_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-[var(--rc-fg)] space-y-0.5">
                            {lines.map((l) => {
                              const p = products.find((pr) => pr.id === l.product_id);
                              return (
                                <p key={l.id}>
                                  {l.quantity}× {l.product_name_snapshot ?? p?.name ?? l.product_id}
                                  {l.options_summary ? ` (${l.options_summary})` : ''}
                                </p>
                              );
                            })}
                            {order.customer_name && (
                              <p className="text-[var(--rc-muted)]">Client : {order.customer_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap space-y-1">
                          <p>{tbl ? `${tbl.table_number} · ${tbl.zone}` : order.order_type}</p>
                          <div className="flex items-center gap-1.5">
                            <StatusLabel label={payStatusMeta.label} tone={payStatusMeta.tone} />
                            {paySummary.remainingAmount > 0 && paySummary.paidAmount > 0 && (
                              <span className="font-mono text-[11px] text-[var(--rc-warn-fg)]">
                                Reste {formatMoney(paySummary.remainingAmount, paySummary.currency)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap space-y-1">
                          <div>
                            <StatusLabel label={statusMeta.label} tone={statusMeta.tone} />
                          </div>
                          {order.stock_deducted && (
                            <p className="text-[11px] font-medium text-[var(--rc-gold-text)]">Stock déduit</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <p>{formatMoney(order.total_amount, order.currency)}</p>
                          {paySummary.paidAmount > 0 && (
                            <p className="text-[11px] text-[var(--rc-success-fg)]">
                              Payé : {formatMoney(paySummary.paidAmount, paySummary.currency)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Détails ${order.order_number}`}
                              onClick={() => setInspectedOrderId(order.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {nextSteps.map((next) => (
                              <Button
                                key={next}
                                type="button"
                                size="sm"
                                variant={next === 'cancelled' ? 'outline' : 'secondary'}
                                onClick={() => handleAdvanceStatus(order.id, next)}
                              >
                                {ORDER_STATUS_LABELS[next].label}
                              </Button>
                            ))}
                          </div>
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
