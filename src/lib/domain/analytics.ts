import type {
  CurrencyCode,
  CustomerRecord,
  ExpenseRecord,
  LicenseRecord,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  ProductRecord,
  ReservationRecord,
  RestaurantRecord,
} from '../supabase/database.types';
import { convertCurrencyAmount } from './operations';

export type PeriodFilter = 'today' | 'week' | 'month' | 'custom';

export interface ChartDatum {
  label: string;
  value: number;
}

export interface SuperAdminMetrics {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  newRestaurants30d: number;
  totalLicensesSold: number;
  activeLicenses: number;
  revokedLicenses: number;
  pendingLicenses: number;
  suspendedLicenses: number;
  confirmedLicenseRevenueUsd: number;
  confirmedLicenseRevenueCdf: number;
  licenseStatusSeries: ChartDatum[];
  restaurantsByCitySeries: ChartDatum[];
  licenseSalesByMonthSeries: ChartDatum[];
  revenueByMethodSeries: ChartDatum[];
}

export function computeSuperAdminMetrics(
  restaurants: readonly RestaurantRecord[],
  licenses: readonly LicenseRecord[],
  payments: readonly PaymentRecord[],
  referenceDate: Date = new Date()
): SuperAdminMetrics {
  const thirtyDaysAgoMs = referenceDate.getTime() - 30 * 86400000;

  const activeRestaurants = restaurants.filter((r) => r.status === 'active').length;
  const suspendedRestaurants = restaurants.filter((r) => r.status === 'suspended').length;
  const newRestaurants30d = restaurants.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return !Number.isNaN(t) && t >= thirtyDaysAgoMs;
  }).length;

  const activeLicenses = licenses.filter((l) => l.status === 'active').length;
  const revokedLicenses = licenses.filter((l) => l.status === 'revoked').length;
  const pendingLicenses = licenses.filter((l) => l.status === 'pending').length;
  const suspendedLicenses = licenses.filter((l) => l.status === 'suspended').length;
  const totalLicensesSold = licenses.filter((l) => l.status !== 'pending').length;

  const confirmedLicensePayments = payments.filter(
    (p) => p.payment_scope === 'license' && p.status === 'confirmed'
  );

  const confirmedLicenseRevenueUsd = confirmedLicensePayments
    .filter((p) => p.currency === 'USD')
    .reduce((sum, p) => sum + p.amount, 0);

  const confirmedLicenseRevenueCdf = confirmedLicensePayments
    .filter((p) => p.currency === 'CDF')
    .reduce((sum, p) => sum + p.amount, 0);

  const cityMap = new Map<string, number>();
  for (const r of restaurants) {
    const city = r.city || 'Autre';
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
  }

  const monthMap = new Map<string, number>();
  for (const l of licenses) {
    const key = l.created_at.slice(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  const methodLabels: Record<PaymentRecord['payment_method'], string> = {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Virement',
    card: 'Carte',
    other: 'Autre mode',
  };
  const methodMap = new Map<string, number>();
  for (const p of confirmedLicensePayments) {
    const label = methodLabels[p.payment_method];
    methodMap.set(label, (methodMap.get(label) ?? 0) + p.amount);
  }

  return {
    totalRestaurants: restaurants.length,
    activeRestaurants,
    suspendedRestaurants,
    newRestaurants30d,
    totalLicensesSold,
    activeLicenses,
    revokedLicenses,
    pendingLicenses,
    suspendedLicenses,
    confirmedLicenseRevenueUsd,
    confirmedLicenseRevenueCdf,
    licenseStatusSeries: [
      { label: 'Actives', value: activeLicenses },
      { label: 'En attente', value: pendingLicenses },
      { label: 'Suspendues', value: suspendedLicenses },
      { label: 'Révoquées', value: revokedLicenses },
    ],
    restaurantsByCitySeries: Array.from(cityMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    licenseSalesByMonthSeries: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value })),
    revenueByMethodSeries: Array.from(methodMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
  };
}

export function validateLicenseAttribution(
  existingLicenses: readonly LicenseRecord[],
  restaurantId: string,
  amount: number
): { valid: boolean; error?: string } {
  if (!restaurantId) {
    return { valid: false, error: 'Sélectionnez un restaurant.' };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { valid: false, error: 'Le montant de la licence doit être positif ou nul.' };
  }
  const hasIncompatibleActive = existingLicenses.some(
    (l) => l.restaurant_id === restaurantId && l.status === 'active'
  );
  if (hasIncompatibleActive) {
    return {
      valid: false,
      error:
        'Ce restaurant possède déjà une licence active. Révoquez ou suspendez la licence existante avant d\'en attribuer une nouvelle.',
    };
  }
  return { valid: true };
}

export interface RestaurantDashboardMetrics {
  revenueAmount: number;
  currency: CurrencyCode;
  ordersCount: number;
  pendingOrders: number;
  preparingOrders: number;
  completedOrders: number;
  reservationsCount: number;
  customersCount: number;
  expensesAmount: number;
  ordersByStatusSeries: ChartDatum[];
  topProductsSeries: ChartDatum[];
  paymentMethodsSeries: ChartDatum[];
  salesTimelineSeries: ChartDatum[];
}

export function isTimestampInPeriod(
  isoString: string,
  period: PeriodFilter,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): boolean {
  const dateMs = new Date(isoString).getTime();
  if (Number.isNaN(dateMs)) return false;

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  if (period === 'today') {
    const start = Date.UTC(refYear, refMonth, refDay, 0, 0, 0);
    const end = Date.UTC(refYear, refMonth, refDay, 23, 59, 59, 999);
    return dateMs >= start && dateMs <= end;
  }

  if (period === 'week') {
    const start = referenceDate.getTime() - 7 * 86400000;
    return dateMs >= start;
  }

  if (period === 'month') {
    const start = Date.UTC(refYear, refMonth, 1, 0, 0, 0);
    return dateMs >= start;
  }

  if (period === 'custom') {
    const startMs = customStart ? new Date(`${customStart}T00:00:00Z`).getTime() : -Infinity;
    const endMs = customEnd ? new Date(`${customEnd}T23:59:59Z`).getTime() : Infinity;
    return dateMs >= startMs && dateMs <= endMs;
  }

  return true;
}

export function computeRestaurantMetrics(params: {
  restaurant: RestaurantRecord;
  orders: readonly OrderRecord[];
  orderItems: readonly OrderItemRecord[];
  products: readonly ProductRecord[];
  reservations: readonly ReservationRecord[];
  customers: readonly CustomerRecord[];
  payments: readonly PaymentRecord[];
  expenses: readonly ExpenseRecord[];
  period: PeriodFilter;
  customStart?: string;
  customEnd?: string;
  referenceDate?: Date;
}): RestaurantDashboardMetrics {
  const {
    restaurant,
    orders,
    orderItems,
    products,
    reservations,
    customers,
    payments,
    expenses,
    period,
    customStart,
    customEnd,
    referenceDate = new Date(),
  } = params;

  const rate = restaurant.exchange_rate_usd_cdf > 0 ? restaurant.exchange_rate_usd_cdf : 2850;
  const filteredOrders = orders.filter(
    (o) =>
      o.restaurant_id === restaurant.id &&
      o.status !== 'cancelled' &&
      isTimestampInPeriod(o.created_at, period, customStart, customEnd, referenceDate)
  );
  const filteredOrderIds = new Set(filteredOrders.map((o) => o.id));
  const cancelledOrderIds = new Set(
    orders.filter((o) => o.restaurant_id === restaurant.id && o.status === 'cancelled').map((o) => o.id)
  );

  const filteredPayments = payments.filter(
    (p) =>
      p.restaurant_id === restaurant.id &&
      p.payment_scope === 'order' &&
      p.status === 'confirmed' &&
      (!p.order_id || !cancelledOrderIds.has(p.order_id)) &&
      isTimestampInPeriod(p.paid_at ?? p.created_at, period, customStart, customEnd, referenceDate)
  );

  const filteredExpenses = expenses.filter(
    (e) =>
      e.restaurant_id === restaurant.id &&
      (e.status ?? 'active') === 'active' &&
      isTimestampInPeriod(`${e.expense_date}T12:00:00Z`, period, customStart, customEnd, referenceDate)
  );

  const filteredReservations = reservations.filter(
    (r) =>
      r.restaurant_id === restaurant.id &&
      r.status !== 'cancelled' &&
      r.status !== 'rejected' &&
      isTimestampInPeriod(r.reserved_for, period, customStart, customEnd, referenceDate)
  );

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing').length;
  const completedOrders = filteredOrders.filter(
    (o) =>
      o.status === 'completed' ||
      o.status === 'served' ||
      o.status === 'delivered' ||
      o.status === 'picked_up'
  ).length;

  const revenueAmount =
    Math.round(
      filteredPayments.reduce(
        (sum, p) =>
          sum + convertCurrencyAmount(p.amount, p.currency, restaurant.default_currency, p.exchange_rate_applied ?? rate),
        0
      ) * 100
    ) / 100;
  const expensesAmount =
    Math.round(
      filteredExpenses.reduce(
        (sum, e) =>
          sum + convertCurrencyAmount(e.amount, e.currency, restaurant.default_currency, e.exchange_rate_applied ?? rate),
        0
      ) * 100
    ) / 100;

  const productQtyMap = new Map<string, number>();
  for (const item of orderItems) {
    if (filteredOrderIds.has(item.order_id)) {
      const prod = products.find((p) => p.id === item.product_id);
      const name = item.product_name_snapshot ?? prod?.name ?? item.product_id;
      productQtyMap.set(name, (productQtyMap.get(name) ?? 0) + item.quantity);
    }
  }

  const methodLabels: Record<PaymentRecord['payment_method'], string> = {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    card: 'Carte',
    bank_transfer: 'Virement',
    other: restaurant.custom_payment_method_label?.trim() || 'Autre mode',
  };
  const methodMap = new Map<string, number>();
  for (const p of filteredPayments) {
    const label = methodLabels[p.payment_method];
    const amt = convertCurrencyAmount(
      p.amount,
      p.currency,
      restaurant.default_currency,
      p.exchange_rate_applied ?? rate
    );
    methodMap.set(label, Math.round(((methodMap.get(label) ?? 0) + amt) * 100) / 100);
  }

  const timelineMap = new Map<string, number>();
  for (const p of filteredPayments) {
    const dayKey = (p.paid_at ?? p.created_at).slice(0, 10);
    const amt = convertCurrencyAmount(
      p.amount,
      p.currency,
      restaurant.default_currency,
      p.exchange_rate_applied ?? rate
    );
    timelineMap.set(dayKey, Math.round(((timelineMap.get(dayKey) ?? 0) + amt) * 100) / 100);
  }

  return {
    revenueAmount,
    currency: restaurant.default_currency,
    ordersCount: filteredOrders.length,
    pendingOrders,
    preparingOrders,
    completedOrders,
    reservationsCount: filteredReservations.length,
    customersCount: customers.filter((c) => c.restaurant_id === restaurant.id).length,
    expensesAmount,
    ordersByStatusSeries: [
      { label: 'En attente', value: pendingOrders },
      { label: 'Préparation', value: preparingOrders },
      { label: 'Terminées', value: completedOrders },
    ],
    topProductsSeries: Array.from(productQtyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value })),
    paymentMethodsSeries: Array.from(methodMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    salesTimelineSeries: Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value })),
  };
}
