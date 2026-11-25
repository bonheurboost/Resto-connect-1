import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  Clock,
  CheckCircle2,
  MapPin,
  Package,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { BrandMark } from '@/src/components/layout/BrandMark';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { SiteAttributionBar } from '@/src/components/layout/SiteAttributionBar';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney, type OrderStatus } from '@/src/lib/domain/operations';
import {
  calculateOrderPaymentSummary,
  getOrderPaymentStatusLabel,
  getPaymentMethodLabel,
} from '@/src/lib/domain/cashRegister';

const STATUS_DISPLAY: Record<
  OrderStatus,
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  pending: { label: 'En attente de validation', tone: 'amber' },
  confirmed: { label: 'Confirmée par le restaurant', tone: 'neutral' },
  preparing: { label: 'En cours de préparation', tone: 'amber' },
  ready: { label: 'Prête', tone: 'emerald' },
  out_for_delivery: { label: 'En livraison', tone: 'amber' },
  delivered: { label: 'Livrée', tone: 'emerald' },
  picked_up: { label: 'Retirée au comptoir', tone: 'emerald' },
  served: { label: 'Servie à table', tone: 'emerald' },
  completed: { label: 'Terminée', tone: 'emerald' },
  cancelled: { label: 'Annulée', tone: 'crimson' },
};

export function OrderTrackingPage() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const {
    orders,
    orderItems,
    orderItemOptions,
    orderStatusHistory,
    paymentTransactions,
    refunds,
    restaurants,
  } = useRestoStore();

  const [lookupInput, setLookupInput] = useState(token ?? '');

  const normalizedToken = (token ?? '').trim().toUpperCase();
  const matchedOrder = normalizedToken
    ? orders.find((o) => (o.tracking_token ?? '').toUpperCase() === normalizedToken)
    : undefined;

  const restaurant = matchedOrder
    ? restaurants.find((r) => r.id === matchedOrder.restaurant_id)
    : undefined;

  const items = matchedOrder
    ? orderItems.filter((oi) => oi.order_id === matchedOrder.id)
    : [];

  const history = matchedOrder
    ? orderStatusHistory.filter((h) => h.order_id === matchedOrder.id)
    : [];

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    if (!cleaned) return;
    navigate(`/suivi/${encodeURIComponent(cleaned)}`);
  }

  return (
    <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex flex-col">
      <header className="border-b border-[var(--rc-border)] bg-[var(--rc-header)] backdrop-blur-md">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="compact" />
            <Button asChild variant="outline" size="sm">
              <Link to={restaurant ? `/restaurant/${restaurant.slug}` : '/'}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>{restaurant ? `Retour à ${restaurant.name}` : 'Retour vitrine'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[960px] w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
            Suivi sécurisé de commande client
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
            Suivre votre commande en temps réel
          </h1>
          <p className="text-sm text-[var(--rc-muted)]">
            Saisissez le jeton unique remis lors de la confirmation de votre commande.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full space-y-1.5">
                <Label htmlFor="tracking-token-input">Jeton de suivi (TRK-...)</Label>
                <Input
                  id="tracking-token-input"
                  placeholder="TRK-..."
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Consulter le suivi</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {normalizedToken && !matchedOrder && (
          <Card className="border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)]">
            <CardContent className="pt-6 flex items-start gap-3 text-sm text-[var(--rc-danger-fg)]">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Aucune commande trouvée pour ce jeton</p>
                <p className="text-xs mt-1">
                  Vérifiez l&apos;orthographe exacte du jeton <span className="font-mono">{normalizedToken}</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {matchedOrder && restaurant && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardDescription>{restaurant.name} · {restaurant.city}</CardDescription>
                  <CardTitle className="font-mono text-xl mt-1">
                    Commande {matchedOrder.order_number}
                  </CardTitle>
                  <p className="text-xs text-[var(--rc-muted)] mt-1 font-mono">
                    Jeton : {matchedOrder.tracking_token}
                  </p>
                </div>
                <StatusLabel
                  label={STATUS_DISPLAY[matchedOrder.status].label}
                  tone={STATUS_DISPLAY[matchedOrder.status].tone}
                />
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[var(--rc-border)] pt-5">
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--rc-muted)] flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Articles commandés</span>
                  </h2>
                  <div className="divide-y divide-[var(--rc-border)] rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)]">
                    {items.map((item) => {
                      const opts = orderItemOptions.filter((o) => o.order_item_id === item.id);
                      return (
                        <div key={item.id} className="p-3 text-sm space-y-1">
                          <div className="flex justify-between gap-3">
                            <span className="font-medium text-[var(--rc-fg)]">
                              {item.quantity}× {item.product_name_snapshot ?? item.product_id}
                            </span>
                            <span className="font-mono tabular-nums whitespace-nowrap">
                              {formatMoney(item.line_total, matchedOrder.currency)}
                            </span>
                          </div>
                          {opts.length > 0 && (
                            <p className="text-xs text-[var(--rc-muted)]">
                              {opts.map((o) => `${o.option_name_snapshot}: ${o.value_label_snapshot}`).join(' · ')}
                            </p>
                          )}
                          {item.special_instructions && (
                            <p className="text-xs text-[var(--rc-gold-text)]">Note : {item.special_instructions}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1 text-sm pt-2">
                    <div className="flex justify-between text-[var(--rc-muted)]">
                      <span>Sous-total</span>
                      <span className="font-mono tabular-nums">
                        {formatMoney(matchedOrder.subtotal, matchedOrder.currency)}
                      </span>
                    </div>
                    {(matchedOrder.delivery_fee ?? 0) > 0 && (
                      <div className="flex justify-between text-[var(--rc-muted)]">
                        <span>Frais de livraison</span>
                        <span className="font-mono tabular-nums">
                          {formatMoney(matchedOrder.delivery_fee ?? 0, matchedOrder.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-[var(--rc-border)] pt-2">
                      <span>Total</span>
                      <span className="font-mono tabular-nums text-[var(--rc-gold-text)]">
                        {formatMoney(matchedOrder.total_amount, matchedOrder.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3.5 space-y-1.5 text-xs">
                    <p className="font-semibold text-[var(--rc-fg)] flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                      <span>Mode &amp; Coordonnées</span>
                    </p>
                    <p>
                      Service :{' '}
                      <strong>
                        {matchedOrder.order_type === 'delivery'
                          ? 'Livraison à domicile'
                          : matchedOrder.order_type === 'takeaway'
                            ? 'Retrait sur place'
                            : 'Service à table'}
                      </strong>
                    </p>
                    {matchedOrder.customer_name && <p>Client : {matchedOrder.customer_name}</p>}
                    {matchedOrder.delivery_address && (
                      <p>
                        Adresse : {matchedOrder.delivery_commune ?? ''}
                        {matchedOrder.delivery_quartier ? `, ${matchedOrder.delivery_quartier}` : ''} —{' '}
                        {matchedOrder.delivery_address}
                      </p>
                    )}
                    {(() => {
                      const paySum = calculateOrderPaymentSummary(
                        matchedOrder,
                        paymentTransactions,
                        refunds
                      );
                      const payMeta = getOrderPaymentStatusLabel(paySum.paymentStatus);
                      return (
                        <div className="pt-1 space-y-1">
                          <p>
                            Paiement :{' '}
                            <span className="font-medium">
                              {getPaymentMethodLabel(
                                matchedOrder.payment_method ?? 'cash',
                                restaurant.custom_payment_method_label
                              )}
                            </span>{' '}
                            — <strong>{payMeta.label}</strong>
                          </p>
                          <p className="font-mono text-[11px] text-[var(--rc-muted)]">
                            Payé : {formatMoney(paySum.paidAmount, paySum.currency)} · Reste à payer :{' '}
                            {formatMoney(paySum.remainingAmount, paySum.currency)}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--rc-muted)] flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Historique d&apos;avancement</span>
                    </h2>
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-start gap-2.5 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] p-2.5 text-xs"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[var(--rc-gold)] shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[var(--rc-fg)]">
                              {STATUS_DISPLAY[h.new_status].label}
                            </p>
                            {h.note && <p className="text-[var(--rc-muted)]">{h.note}</p>}
                            <p className="font-mono text-[11px] text-[var(--rc-muted)] mt-0.5">
                              {h.created_at.replace('T', ' ').slice(0, 16)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <SiteAttributionBar />
    </div>
  );
}
