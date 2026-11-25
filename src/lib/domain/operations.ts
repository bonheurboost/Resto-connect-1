import type {
  CurrencyCode,
  DeliveryZoneRecord,
  IngredientRecord,
  OrderItemRecord,
  OrderRecord,
  OrderStatusCode,
  ProductOptionRecord,
  ProductOptionValueRecord,
  ProductRecord,
  ReservationRecord,
  RestaurantTableRecord,
} from '../supabase/database.types';

export type OrderStatus = OrderStatusCode;
export type MovementType =
  | 'in'
  | 'out'
  | 'adjustment'
  | 'waste'
  | 'purchase_in'
  | 'kitchen_out'
  | 'waste_loss'
  | 'supplier_return'
  | 'transfer';

export interface OrderLineInput {
  unit_price: number;
  quantity: number;
}

export interface CartOptionSelection {
  optionId: string;
  valueId: string;
}

export interface CartItem {
  cartKey: string;
  restaurantId: string;
  productId: string;
  quantity: number;
  selectedOptions: CartOptionSelection[];
  specialInstructions?: string;
}

export interface CartState {
  restaurantId: string | null;
  items: CartItem[];
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'etablissement'
  );
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (currency === 'USD') {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  }
  return `${Math.round(amount).toLocaleString('fr-FR')} CDF`;
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRateUsdCdf: number
): number {
  if (!Number.isFinite(amount)) return 0;
  if (fromCurrency === toCurrency) return Math.round(amount * 100) / 100;
  const safeRate = exchangeRateUsdCdf > 0 ? exchangeRateUsdCdf : 2850;
  if (fromCurrency === 'USD' && toCurrency === 'CDF') {
    return Math.round(amount * safeRate);
  }
  return Math.round((amount / safeRate) * 100) / 100;
}

export function calculateOrderTotals(
  items: readonly OrderLineInput[],
  deliveryFee: number = 0
): {
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
} {
  const subtotalCents = items.reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(item.quantity));
    const unitCents = Math.round(Math.max(0, item.unit_price) * 100);
    return sum + unitCents * qty;
  }, 0);

  const feeCents = Math.round(Math.max(0, deliveryFee) * 100);
  const subtotal = Math.round(subtotalCents) / 100;
  const normalizedFee = Math.round(feeCents) / 100;
  return {
    subtotal,
    deliveryFee: normalizedFee,
    taxAmount: 0,
    totalAmount: Math.round((subtotal + normalizedFee) * 100) / 100,
  };
}

export function buildCartKey(
  productId: string,
  selectedOptions: readonly CartOptionSelection[],
  specialInstructions?: string
): string {
  const opts = [...selectedOptions]
    .sort((a, b) => `${a.optionId}:${a.valueId}`.localeCompare(`${b.optionId}:${b.valueId}`))
    .map((o) => `${o.optionId}=${o.valueId}`)
    .join('|');
  return `${productId}::${opts}::${(specialInstructions ?? '').trim()}`;
}

export function addCartItemSafe(
  cart: CartState,
  item: Omit<CartItem, 'cartKey'>,
  replaceIfDifferentRestaurant = false
):
  | { ok: true; nextCart: CartState }
  | { ok: false; conflictRestaurantId: string; error: string } {
  if (item.quantity <= 0) {
    return { ok: true, nextCart: cart };
  }

  if (cart.restaurantId && cart.restaurantId !== item.restaurantId && cart.items.length > 0) {
    if (!replaceIfDifferentRestaurant) {
      return {
        ok: false,
        conflictRestaurantId: cart.restaurantId,
        error:
          'Votre panier contient déjà des plats d’un autre établissement. Videz le panier pour commander ici.',
      };
    }
    const key = buildCartKey(item.productId, item.selectedOptions, item.specialInstructions);
    return {
      ok: true,
      nextCart: {
        restaurantId: item.restaurantId,
        items: [{ ...item, cartKey: key }],
      },
    };
  }

  const key = buildCartKey(item.productId, item.selectedOptions, item.specialInstructions);
  const existing = cart.items.find((i) => i.cartKey === key);
  const nextItems = existing
    ? cart.items.map((i) =>
        i.cartKey === key ? { ...i, quantity: i.quantity + item.quantity } : i
      )
    : [...cart.items, { ...item, cartKey: key }];

  return {
    ok: true,
    nextCart: {
      restaurantId: item.restaurantId,
      items: nextItems,
    },
  };
}

export interface AuthoritativeOrderLineResult {
  product: ProductRecord;
  quantity: number;
  baseUnitPrice: number;
  optionsUnitExtra: number;
  finalUnitPrice: number;
  lineTotal: number;
  optionsSummary: string | null;
  optionSnapshots: Array<{
    optionName: string;
    valueLabel: string;
    extraPrice: number;
  }>;
  specialInstructions: string | null;
}

export function computeAuthoritativeOrder(params: {
  restaurantId: string;
  orderType: OrderRecord['order_type'];
  defaultCurrency: CurrencyCode;
  exchangeRateUsdCdf: number;
  products: readonly ProductRecord[];
  productOptions: readonly ProductOptionRecord[];
  optionValues: readonly ProductOptionValueRecord[];
  deliveryZones: readonly DeliveryZoneRecord[];
  deliveryZoneId?: string | null;
  requestedItems: readonly {
    productId: string;
    quantity: number;
    selectedOptions?: readonly CartOptionSelection[];
    specialInstructions?: string;
  }[];
}):
  | {
      ok: true;
      currency: CurrencyCode;
      subtotal: number;
      deliveryFee: number;
      totalAmount: number;
      resolvedZone: DeliveryZoneRecord | null;
      lines: AuthoritativeOrderLineResult[];
    }
  | { ok: false; error: string } {
  const {
    restaurantId,
    orderType,
    defaultCurrency,
    exchangeRateUsdCdf,
    products,
    productOptions,
    optionValues,
    deliveryZones,
    deliveryZoneId,
    requestedItems,
  } = params;

  if (requestedItems.length === 0) {
    return { ok: false, error: 'Le panier est vide.' };
  }

  const lines: AuthoritativeOrderLineResult[] = [];
  for (const req of requestedItems) {
    const qty = Math.floor(req.quantity);
    if (qty <= 0) {
      return { ok: false, error: 'Les quantités doivent être strictement positives.' };
    }
    const product = products.find(
      (p) =>
        p.id === req.productId &&
        p.restaurant_id === restaurantId &&
        p.is_available &&
        !p.is_temporarily_disabled
    );
    if (!product) {
      return {
        ok: false,
        error: 'Un plat sélectionné est indisponible ou n’appartient pas à cet établissement.',
      };
    }

    const basePrice = convertCurrencyAmount(
      product.price_amount,
      product.currency,
      defaultCurrency,
      exchangeRateUsdCdf
    );

    const optionSnapshots: AuthoritativeOrderLineResult['optionSnapshots'] = [];
    let optionsExtra = 0;

    for (const sel of req.selectedOptions ?? []) {
      const opt = productOptions.find(
        (o) => o.id === sel.optionId && o.product_id === product.id && o.restaurant_id === restaurantId
      );
      const val = optionValues.find(
        (v) =>
          v.id === sel.valueId &&
          v.option_id === sel.optionId &&
          v.restaurant_id === restaurantId &&
          v.is_available
      );
      if (!opt || !val) {
        return { ok: false, error: `Option invalide ou indisponible pour ${product.name}.` };
      }
      const extraConv = convertCurrencyAmount(
        val.extra_price,
        val.currency,
        defaultCurrency,
        exchangeRateUsdCdf
      );
      optionsExtra += extraConv;
      optionSnapshots.push({
        optionName: opt.name,
        valueLabel: val.label,
        extraPrice: extraConv,
      });
    }

    const finalUnitPrice = Math.round((basePrice + optionsExtra) * 100) / 100;
    const lineTotal = Math.round(finalUnitPrice * qty * 100) / 100;
    const optionsSummary =
      optionSnapshots.length > 0
        ? optionSnapshots.map((s) => `${s.optionName}: ${s.valueLabel}`).join(' · ')
        : null;

    lines.push({
      product,
      quantity: qty,
      baseUnitPrice: basePrice,
      optionsUnitExtra: Math.round(optionsExtra * 100) / 100,
      finalUnitPrice,
      lineTotal,
      optionsSummary,
      optionSnapshots,
      specialInstructions: req.specialInstructions?.trim() || null,
    });
  }

  let resolvedZone: DeliveryZoneRecord | null = null;
  let deliveryFee = 0;
  if (orderType === 'delivery') {
    if (!deliveryZoneId) {
      return { ok: false, error: 'Sélectionnez une zone de livraison.' };
    }
    const zone = deliveryZones.find(
      (z) => z.id === deliveryZoneId && z.restaurant_id === restaurantId && z.is_active
    );
    if (!zone) {
      return { ok: false, error: 'Zone de livraison inactive ou introuvable.' };
    }
    resolvedZone = zone;
    deliveryFee = convertCurrencyAmount(
      zone.fee_amount,
      zone.currency,
      defaultCurrency,
      exchangeRateUsdCdf
    );
  }

  const totals = calculateOrderTotals(
    lines.map((l) => ({ unit_price: l.finalUnitPrice, quantity: l.quantity })),
    deliveryFee
  );

  return {
    ok: true,
    currency: defaultCurrency,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.totalAmount,
    resolvedZone,
    lines,
  };
}

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'picked_up', 'out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['delivered', 'completed', 'cancelled'],
  delivered: ['completed'],
  picked_up: ['completed'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

export function getAllowedOrderTransitions(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function hasReservationConflict(params: {
  restaurantId: string;
  reservedForIso: string;
  partySize: number;
  existingReservations: readonly ReservationRecord[];
  tables: readonly RestaurantTableRecord[];
  durationMinutes?: number;
  excludeReservationId?: string;
}): { conflict: boolean; reason?: string; suggestedTableId?: string | null } {
  const {
    restaurantId,
    reservedForIso,
    partySize,
    existingReservations,
    tables,
    durationMinutes = 90,
    excludeReservationId,
  } = params;

  const reqStart = new Date(reservedForIso).getTime();
  if (Number.isNaN(reqStart)) {
    return { conflict: true, reason: 'Date et heure de réservation invalides.' };
  }
  const reqEnd = reqStart + durationMinutes * 60000;

  const restaurantTables = tables.filter(
    (t) => t.restaurant_id === restaurantId && t.status !== 'inactive'
  );
  const overlapping = existingReservations.filter((r) => {
    if (r.restaurant_id !== restaurantId) return false;
    if (excludeReservationId && r.id === excludeReservationId) return false;
    if (r.status === 'cancelled' || r.status === 'rejected' || r.status === 'completed' || r.status === 'no_show') {
      return false;
    }
    const rStart = new Date(r.reserved_for).getTime();
    if (Number.isNaN(rStart)) return false;
    const rEnd = rStart + (r.duration_minutes ?? 90) * 60000;
    return reqStart < rEnd && reqEnd > rStart;
  });

  if (restaurantTables.length === 0) {
    // Aucun plan de salle configuré : seuil générique max 5 réservations simultanées
    if (overlapping.length >= 5) {
      return {
        conflict: true,
        reason: 'Créneau complet : trop de réservations simultanées sur cette tranche horaire.',
      };
    }
    return { conflict: false, suggestedTableId: null };
  }

  const busyTableIds = new Set(overlapping.map((r) => r.table_id).filter(Boolean));
  const candidateTables = restaurantTables
    .filter((t) => !busyTableIds.has(t.id) && t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity);

  if (candidateTables.length > 0) {
    return { conflict: false, suggestedTableId: candidateTables[0].id };
  }

  // Vérifie si la somme des couverts déjà engagés dépasse la capacité totale
  const totalCapacity = restaurantTables.reduce((s, t) => s + t.capacity, 0);
  const bookedSeats = overlapping.reduce((s, r) => s + r.party_size, 0);
  if (bookedSeats + partySize > totalCapacity) {
    return {
      conflict: true,
      reason: `Capacité insuffisante sur ce créneau (${bookedSeats}/${totalCapacity} couverts déjà réservés).`,
    };
  }

  return {
    conflict: true,
    reason: `Aucune table de ${partySize} couverts ou plus disponible sur ce créneau horaire.`,
  };
}

export function applyInventoryMovement(
  currentStock: number,
  movementType: MovementType,
  quantity: number
): { ok: true; nextStock: number } | { ok: false; error: string } {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'La quantité doit être strictement positive.' };
  }

  if (movementType === 'in' || movementType === 'purchase_in') {
    return { ok: true, nextStock: Math.round((currentStock + quantity) * 1000) / 1000 };
  }

  if (movementType === 'adjustment') {
    return { ok: true, nextStock: Math.round(quantity * 1000) / 1000 };
  }

  const next = Math.round((currentStock - quantity) * 1000) / 1000;
  if (next < 0) {
    return { ok: false, error: 'Stock insuffisant pour cette sortie.' };
  }
  return { ok: true, nextStock: next };
}

export function isLowStock(ingredient: Pick<IngredientRecord, 'current_stock' | 'minimum_stock'>): boolean {
  return ingredient.current_stock <= ingredient.minimum_stock;
}

export function generateLicenseKey(restaurantSlug: string, sequence: number): string {
  const prefix = restaurantSlug
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');
  const seq = String(sequence).padStart(4, '0');
  return `RC-${prefix}-2026-${seq}`;
}

export function generateOrderNumber(sequence: number): string {
  return `CMD-${String(sequence).padStart(4, '0')}`;
}

export function generatePurchaseOrderNumber(sequence: number): string {
  return `PO-2026-${String(sequence).padStart(4, '0')}`;
}

export function generateTrackingToken(restaurantSlug: string): string {
  const prefix = restaurantSlug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'RST';
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `TRK-${prefix}-${stamp}${rand}`;
}

export function computeOrderTotalFromSnapshots(items: readonly OrderItemRecord[], deliveryFee = 0): number {
  return calculateOrderTotals(
    items.map((i) => ({ unit_price: i.unit_price_snapshot ?? i.unit_price, quantity: i.quantity })),
    deliveryFee
  ).totalAmount;
}
