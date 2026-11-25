import type {
  AttendanceRecord,
  CurrencyCode,
  ExpenseRecord,
  IngredientRecord,
  InventoryCategory,
  InventoryMovementRecord,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  RecipeItemRecord,
  RecipeRecord,
  RestaurantRecord,
  SalaryPaymentRecord,
} from '../supabase/database.types';
import { convertCurrencyAmount } from './operations';
import { isTimestampInPeriod, type PeriodFilter } from './analytics';

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
  'Ingrédients',
  'Boissons',
  'Produits alimentaires',
  'Emballages',
  "Produits d'entretien",
  'Autres',
];

export const EXPENSE_CATEGORIES: readonly string[] = [
  'Achats alimentaires',
  'Boissons',
  'Salaires',
  'Loyer',
  'Électricité / Eau',
  'Gaz / Carburant / Groupe électrogène',
  'Transport / Livraison',
  'Maintenance / Réparation',
  'Communication / Internet',
  'Marketing',
  'Taxes / Frais administratifs',
  'Autres dépenses',
];

export type StockAlertType = 'out_of_stock' | 'low_stock' | 'expiring_soon';

export interface InventoryAlertSummary {
  ingredientId: string;
  ingredientName: string;
  alertType: StockAlertType;
  currentStock: number;
  minimumStock: number;
  unit: string;
  expiryDate: string | null;
}

export function evaluateInventoryAlerts(
  ingredients: readonly IngredientRecord[],
  restaurantId: string,
  referenceDate: Date = new Date()
): InventoryAlertSummary[] {
  const alerts: InventoryAlertSummary[] = [];
  const sevenDaysMs = 7 * 86400000;
  const refMs = referenceDate.getTime();

  for (const ing of ingredients) {
    if (ing.restaurant_id !== restaurantId || ing.is_archived) continue;

    if (ing.current_stock <= 0) {
      alerts.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        alertType: 'out_of_stock',
        currentStock: ing.current_stock,
        minimumStock: ing.minimum_stock,
        unit: ing.unit,
        expiryDate: ing.expiry_date ?? null,
      });
    } else if (ing.current_stock <= ing.minimum_stock) {
      alerts.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        alertType: 'low_stock',
        currentStock: ing.current_stock,
        minimumStock: ing.minimum_stock,
        unit: ing.unit,
        expiryDate: ing.expiry_date ?? null,
      });
    }

    if (ing.expiry_date) {
      const expMs = new Date(`${ing.expiry_date}T23:59:59Z`).getTime();
      if (!Number.isNaN(expMs) && expMs - refMs <= sevenDaysMs) {
        alerts.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          alertType: 'expiring_soon',
          currentStock: ing.current_stock,
          minimumStock: ing.minimum_stock,
          unit: ing.unit,
          expiryDate: ing.expiry_date,
        });
      }
    }
  }

  return alerts;
}

export function computeStockValuation(
  ingredients: readonly IngredientRecord[],
  restaurantId: string,
  targetCurrency: CurrencyCode,
  exchangeRateUsdCdf: number
): number {
  let total = 0;
  for (const ing of ingredients) {
    if (ing.restaurant_id !== restaurantId || ing.is_archived) continue;
    const ingCurr: CurrencyCode = ing.currency ?? 'USD';
    const unitCostConverted = convertCurrencyAmount(
      ing.unit_cost,
      ingCurr,
      targetCurrency,
      exchangeRateUsdCdf
    );
    total += Math.max(0, ing.current_stock) * Math.max(0, unitCostConverted);
  }
  return Math.round(total * 100) / 100;
}

export function computeRecipeUnitCost(
  recipeId: string,
  recipeItems: readonly RecipeItemRecord[],
  ingredients: readonly IngredientRecord[],
  targetCurrency: CurrencyCode,
  exchangeRateUsdCdf: number
): number {
  const lines = recipeItems.filter((ri) => ri.recipe_id === recipeId);
  let total = 0;
  for (const line of lines) {
    const ing = ingredients.find((i) => i.id === line.ingredient_id);
    if (!ing) continue;
    const costConverted = convertCurrencyAmount(
      ing.unit_cost,
      ing.currency ?? 'USD',
      targetCurrency,
      exchangeRateUsdCdf
    );
    total += line.quantity_per_unit * costConverted;
  }
  return Math.round(total * 100) / 100;
}

export interface OrderStockDeductionResult {
  ok: boolean;
  alreadyDeducted?: boolean;
  error?: string;
  deductions: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    nextStock: number;
    unitCostSnapshot: number;
  }>;
  skippedProductsWithoutRecipe: string[];
}

export function computeOrderStockDeduction(params: {
  order: OrderRecord;
  orderItems: readonly OrderItemRecord[];
  recipes: readonly RecipeRecord[];
  recipeItems: readonly RecipeItemRecord[];
  ingredients: readonly IngredientRecord[];
  allowNegative?: boolean;
}): OrderStockDeductionResult {
  const { order, orderItems, recipes, recipeItems, ingredients, allowNegative = false } = params;

  if (order.stock_deducted) {
    return {
      ok: true,
      alreadyDeducted: true,
      deductions: [],
      skippedProductsWithoutRecipe: [],
    };
  }

  const lines = orderItems.filter((oi) => oi.order_id === order.id);
  const requiredByIngredient = new Map<string, number>();
  const skippedProductsWithoutRecipe: string[] = [];

  for (const line of lines) {
    const recipe = recipes.find(
      (r) =>
        r.restaurant_id === order.restaurant_id &&
        r.product_id === line.product_id &&
        r.is_active
    );
    if (!recipe) {
      skippedProductsWithoutRecipe.push(line.product_name_snapshot ?? line.product_id);
      continue;
    }
    const itemsForRecipe = recipeItems.filter((ri) => ri.recipe_id === recipe.id);
    if (itemsForRecipe.length === 0) {
      skippedProductsWithoutRecipe.push(line.product_name_snapshot ?? line.product_id);
      continue;
    }

    for (const ri of itemsForRecipe) {
      const totalNeeded = Math.round(ri.quantity_per_unit * line.quantity * 10000) / 10000;
      requiredByIngredient.set(
        ri.ingredient_id,
        Math.round(((requiredByIngredient.get(ri.ingredient_id) ?? 0) + totalNeeded) * 10000) / 10000
      );
    }
  }

  const deductions: OrderStockDeductionResult['deductions'] = [];
  for (const [ingredientId, requiredQty] of requiredByIngredient.entries()) {
    const ing = ingredients.find(
      (i) => i.id === ingredientId && i.restaurant_id === order.restaurant_id
    );
    if (!ing) {
      return {
        ok: false,
        error: `Ingrédient manquant dans l'inventaire (${ingredientId}).`,
        deductions: [],
        skippedProductsWithoutRecipe,
      };
    }
    const nextStock = Math.round((ing.current_stock - requiredQty) * 1000) / 1000;
    if (nextStock < 0 && !allowNegative) {
      return {
        ok: false,
        error: `Stock insuffisant pour « ${ing.name} » (disponible : ${ing.current_stock} ${ing.unit}, requis : ${requiredQty} ${ing.unit}).`,
        deductions: [],
        skippedProductsWithoutRecipe,
      };
    }
    deductions.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantity: requiredQty,
      nextStock: Math.max(0, nextStock),
      unitCostSnapshot: ing.unit_cost,
    });
  }

  return {
    ok: true,
    alreadyDeducted: false,
    deductions,
    skippedProductsWithoutRecipe,
  };
}

export function computeOrderStockReversal(params: {
  order: OrderRecord;
  movements: readonly InventoryMovementRecord[];
  ingredients: readonly IngredientRecord[];
}): Array<{ ingredientId: string; quantityRestored: number; nextStock: number }> {
  if (!params.order.stock_deducted) return [];

  const orderDeductions = params.movements.filter(
    (m) =>
      m.restaurant_id === params.order.restaurant_id &&
      m.reference_type === 'order' &&
      m.reference_id === params.order.id &&
      (m.movement_type === 'kitchen_out' || m.movement_type === 'out')
  );

  const restored: Array<{ ingredientId: string; quantityRestored: number; nextStock: number }> = [];
  for (const mov of orderDeductions) {
    const ing = params.ingredients.find((i) => i.id === mov.ingredient_id);
    if (!ing) continue;
    restored.push({
      ingredientId: ing.id,
      quantityRestored: mov.quantity,
      nextStock: Math.round((ing.current_stock + mov.quantity) * 1000) / 1000,
    });
  }
  return restored;
}

export function computePurchaseOrderReception(params: {
  po: PurchaseOrderRecord;
  poItems: readonly PurchaseOrderItemRecord[];
  receivedQuantities: Record<string, number>;
}):
  | {
      ok: true;
      nextStatus: 'partially_received' | 'received';
      itemUpdates: Array<{
        itemId: string;
        ingredientId: string;
        qtyDelta: number;
        nextReceived: number;
        unitCost: number;
      }>;
    }
  | { ok: false; error: string } {
  if (params.po.status === 'cancelled') {
    return { ok: false, error: 'Impossible de réceptionner un bon annulé.' };
  }
  if (params.po.status === 'received') {
    return { ok: false, error: 'Ce bon d’approvisionnement est déjà entièrement réceptionné.' };
  }

  const lines = params.poItems.filter((li) => li.purchase_order_id === params.po.id);
  const itemUpdates: Array<{
    itemId: string;
    ingredientId: string;
    qtyDelta: number;
    nextReceived: number;
    unitCost: number;
  }> = [];

  for (const line of lines) {
    const delta = Math.max(0, Number(params.receivedQuantities[line.id] ?? 0));
    const remaining = Math.round((line.quantity_ordered - line.quantity_received) * 1000) / 1000;
    if (delta > remaining + 0.0001) {
      return {
        ok: false,
        error: `Quantité reçue supérieure au reliquat commandé (${remaining}).`,
      };
    }
    if (delta > 0) {
      itemUpdates.push({
        itemId: line.id,
        ingredientId: line.ingredient_id,
        qtyDelta: delta,
        nextReceived: Math.round((line.quantity_received + delta) * 1000) / 1000,
        unitCost: line.unit_cost,
      });
    }
  }

  if (itemUpdates.length === 0) {
    return { ok: false, error: 'Saisissez au moins une quantité réceptionnée supérieure à zéro.' };
  }

  const allComplete = lines.every((line) => {
    const upd = itemUpdates.find((u) => u.itemId === line.id);
    const totalRecv = upd ? upd.nextReceived : line.quantity_received;
    return totalRecv >= line.quantity_ordered - 0.0001;
  });

  return {
    ok: true,
    nextStatus: allComplete ? 'received' : 'partially_received',
    itemUpdates,
  };
}

export function hasDuplicateCheckIn(
  records: readonly AttendanceRecord[],
  restaurantId: string,
  employeeId: string,
  attendanceDate: string
): boolean {
  return records.some(
    (r) =>
      r.restaurant_id === restaurantId &&
      r.employee_id === employeeId &&
      r.attendance_date === attendanceDate &&
      r.check_in_at !== null
  );
}

export function computePayrollNet(input: {
  baseSalary: number;
  bonuses: number;
  advances: number;
  deductions: number;
}): { ok: true; netSalary: number } | { ok: false; error: string } {
  const base = Math.max(0, input.baseSalary);
  const bonuses = Math.max(0, input.bonuses);
  const advances = Math.max(0, input.advances);
  const deductions = Math.max(0, input.deductions);

  const gross = base + bonuses;
  const totalWithheld = advances + deductions;
  if (totalWithheld > gross) {
    return {
      ok: false,
      error: 'Le total des avances et retenues dépasse le salaire brut (base + primes).',
    };
  }
  return {
    ok: true,
    netSalary: Math.round((gross - totalWithheld) * 100) / 100,
  };
}

export interface FinancialReportSummary {
  displayCurrency: CurrencyCode;
  exchangeRateUsed: number;
  confirmedRevenue: number;
  confirmedRevenueUsdNative: number;
  confirmedRevenueCdfNative: number;
  pendingPaymentsAmount: number;
  failedPaymentsAmount: number;
  refundedPaymentsAmount: number;
  cancelledOrdersCount: number;
  estimatedCogs: number;
  estimatedGrossMargin: number;
  activeExpenses: number;
  activeExpensesUsdNative: number;
  activeExpensesCdfNative: number;
  salariesPaid: number;
  purchasesPaid: number;
  estimatedOperatingResult: number;
  stockValue: number;
  expensesByCategory: Array<{ category: string; amount: number }>;
  revenueByMethod: Array<{ method: string; amount: number }>;
}

export function computeFinancialReport(params: {
  restaurant: RestaurantRecord;
  orders: readonly OrderRecord[];
  orderItems: readonly OrderItemRecord[];
  recipes: readonly RecipeRecord[];
  recipeItems: readonly RecipeItemRecord[];
  ingredients: readonly IngredientRecord[];
  payments: readonly PaymentRecord[];
  expenses: readonly ExpenseRecord[];
  purchaseOrders: readonly PurchaseOrderRecord[];
  salaryPayments: readonly SalaryPaymentRecord[];
  period: PeriodFilter;
  customStart?: string;
  customEnd?: string;
  displayCurrency?: CurrencyCode;
  referenceDate?: Date;
}): FinancialReportSummary {
  const {
    restaurant,
    orders,
    orderItems,
    recipes,
    recipeItems,
    ingredients,
    payments,
    expenses,
    purchaseOrders,
    salaryPayments,
    period,
    customStart,
    customEnd,
    referenceDate = new Date(),
  } = params;

  const displayCurrency = params.displayCurrency ?? restaurant.default_currency;
  const rate = restaurant.exchange_rate_usd_cdf > 0 ? restaurant.exchange_rate_usd_cdf : 2850;

  const periodOrders = orders.filter(
    (o) =>
      o.restaurant_id === restaurant.id &&
      isTimestampInPeriod(o.created_at, period, customStart, customEnd, referenceDate)
  );
  const cancelledOrderIds = new Set(
    periodOrders.filter((o) => o.status === 'cancelled').map((o) => o.id)
  );
  const nonCancelledOrderIds = new Set(
    periodOrders.filter((o) => o.status !== 'cancelled').map((o) => o.id)
  );

  const periodOrderPayments = payments.filter(
    (p) =>
      p.restaurant_id === restaurant.id &&
      p.payment_scope === 'order' &&
      isTimestampInPeriod(p.paid_at ?? p.created_at, period, customStart, customEnd, referenceDate)
  );

  const confirmedPayments = periodOrderPayments.filter(
    (p) => p.status === 'confirmed' && (!p.order_id || !cancelledOrderIds.has(p.order_id))
  );
  const pendingPayments = periodOrderPayments.filter((p) => p.status === 'pending');
  const failedPayments = periodOrderPayments.filter(
    (p) => p.status === 'failed' || p.status === 'rejected'
  );
  const refundedPayments = periodOrderPayments.filter((p) => p.status === 'refunded');

  let confirmedRevenue = 0;
  let confirmedRevenueUsdNative = 0;
  let confirmedRevenueCdfNative = 0;
  const methodTotals = new Map<string, number>();

  for (const p of confirmedPayments) {
    const pRate = p.exchange_rate_applied ?? rate;
    const conv = convertCurrencyAmount(p.amount, p.currency, displayCurrency, pRate);
    confirmedRevenue += conv;
    if (p.currency === 'USD') confirmedRevenueUsdNative += p.amount;
    if (p.currency === 'CDF') confirmedRevenueCdfNative += p.amount;
    methodTotals.set(p.payment_method, (methodTotals.get(p.payment_method) ?? 0) + conv);
  }

  const sumConverted = (list: readonly PaymentRecord[]) =>
    Math.round(
      list.reduce(
        (sum, p) =>
          sum + convertCurrencyAmount(p.amount, p.currency, displayCurrency, p.exchange_rate_applied ?? rate),
        0
      ) * 100
    ) / 100;

  let estimatedCogs = 0;
  for (const item of orderItems) {
    if (!nonCancelledOrderIds.has(item.order_id)) continue;
    const recipe = recipes.find(
      (r) => r.restaurant_id === restaurant.id && r.product_id === item.product_id && r.is_active
    );
    if (!recipe) continue;
    const unitCogs = computeRecipeUnitCost(recipe.id, recipeItems, ingredients, displayCurrency, rate);
    estimatedCogs += unitCogs * item.quantity;
  }
  estimatedCogs = Math.round(estimatedCogs * 100) / 100;

  const periodActiveExpenses = expenses.filter(
    (e) =>
      e.restaurant_id === restaurant.id &&
      (e.status ?? 'active') === 'active' &&
      isTimestampInPeriod(`${e.expense_date}T12:00:00Z`, period, customStart, customEnd, referenceDate)
  );

  let activeExpenses = 0;
  let activeExpensesUsdNative = 0;
  let activeExpensesCdfNative = 0;
  const expByCat = new Map<string, number>();

  for (const e of periodActiveExpenses) {
    const eRate = e.exchange_rate_applied ?? rate;
    const conv = convertCurrencyAmount(e.amount, e.currency, displayCurrency, eRate);
    activeExpenses += conv;
    if (e.currency === 'USD') activeExpensesUsdNative += e.amount;
    if (e.currency === 'CDF') activeExpensesCdfNative += e.amount;
    expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + conv);
  }

  const periodSalaries = salaryPayments.filter(
    (sp) =>
      sp.restaurant_id === restaurant.id &&
      isTimestampInPeriod(sp.paid_at, period, customStart, customEnd, referenceDate)
  );
  const salariesPaid =
    Math.round(
      periodSalaries.reduce(
        (sum, sp) => sum + convertCurrencyAmount(sp.amount_paid, sp.currency, displayCurrency, rate),
        0
      ) * 100
    ) / 100;

  const periodPos = purchaseOrders.filter(
    (po) =>
      po.restaurant_id === restaurant.id &&
      po.status !== 'cancelled' &&
      isTimestampInPeriod(`${po.order_date}T12:00:00Z`, period, customStart, customEnd, referenceDate)
  );
  const purchasesPaid =
    Math.round(
      periodPos.reduce(
        (sum, po) =>
          sum + convertCurrencyAmount(po.amount_paid, po.currency, displayCurrency, po.exchange_rate_applied || rate),
        0
      ) * 100
    ) / 100;

  const roundedRevenue = Math.round(confirmedRevenue * 100) / 100;
  const roundedExpenses = Math.round(activeExpenses * 100) / 100;
  const estimatedGrossMargin = Math.round((roundedRevenue - estimatedCogs) * 100) / 100;
  const estimatedOperatingResult =
    Math.round((roundedRevenue - estimatedCogs - roundedExpenses - salariesPaid) * 100) / 100;

  return {
    displayCurrency,
    exchangeRateUsed: rate,
    confirmedRevenue: roundedRevenue,
    confirmedRevenueUsdNative: Math.round(confirmedRevenueUsdNative * 100) / 100,
    confirmedRevenueCdfNative: Math.round(confirmedRevenueCdfNative),
    pendingPaymentsAmount: sumConverted(pendingPayments),
    failedPaymentsAmount: sumConverted(failedPayments),
    refundedPaymentsAmount: sumConverted(refundedPayments),
    cancelledOrdersCount: cancelledOrderIds.size,
    estimatedCogs,
    estimatedGrossMargin,
    activeExpenses: roundedExpenses,
    activeExpensesUsdNative: Math.round(activeExpensesUsdNative * 100) / 100,
    activeExpensesCdfNative: Math.round(activeExpensesCdfNative),
    salariesPaid,
    purchasesPaid,
    estimatedOperatingResult,
    stockValue: computeStockValuation(ingredients, restaurant.id, displayCurrency, rate),
    expensesByCategory: Array.from(expByCat.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    revenueByMethod: Array.from(methodTotals.entries()).map(([method, amount]) => ({
      method,
      amount: Math.round(amount * 100) / 100,
    })),
  };
}
