import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  AttendanceRecord,
  AuditLogRecord,
  CashClosureRecord,
  CashMovementRecord,
  CashPaymentMethod,
  CashRegisterRecord,
  CashSessionRecord,
  CategoryRecord,
  CommercialDocumentRecord,
  CommercialDocumentType,
  CommercialInquiryRecord,
  CurrencyCode,
  CustomerRecord,
  DeliveryZoneRecord,
  EmployeeRecord,
  ExpenseRecord,
  IngredientRecord,
  InventoryCategory,
  InventoryMovementRecord,
  LeaveRequestRecord,
  LicenseHistoryEntry,
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  MaintenanceContractRecord,
  MaintenanceContractStatus,
  MaintenancePaymentRecord,
  NotificationRecord,
  OrderItemOptionRecord,
  OrderItemRecord,
  OrderRecord,
  OrderStatusHistoryRecord,
  PaymentContext,
  PaymentRecord,
  PaymentTransactionRecord,
  PayrollRecord,
  PlanRecord,
  ProductImageRecord,
  ProductOptionRecord,
  ProductOptionValueRecord,
  ProductRecord,
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  ReceiptRecord,
  RecipeItemRecord,
  RecipeRecord,
  RefundRecord,
  ReservationRecord,
  RestaurantRecord,
  RestaurantRoleCode,
  RestaurantSlugRedirectRecord,
  RestaurantStatus,
  RestaurantTableRecord,
  SalaryPaymentRecord,
  SupplierRecord,
} from '@/src/lib/supabase/database.types';
import {
  applyInventoryMovement,
  canTransitionOrderStatus,
  computeAuthoritativeOrder,
  generateLicenseKey,
  generateOrderNumber,
  generatePurchaseOrderNumber,
  generateTrackingToken,
  hasReservationConflict,
  slugify,
  type CartOptionSelection,
  type MovementType,
  type OrderStatus,
} from '@/src/lib/domain/operations';
import {
  computeOrderStockDeduction,
  computeOrderStockReversal,
  computePayrollNet,
  computePurchaseOrderReception,
  hasDuplicateCheckIn,
} from '@/src/lib/domain/erp';
import { validateLicenseAttribution } from '@/src/lib/domain/analytics';
import { hasRolePermission } from '@/src/lib/auth/rbac';
import {
  calculateOrderPaymentSummary,
  computeCashSessionSummary,
  evaluateClosureDiscrepancy,
  getPaymentMethodLabel,
  PAYMENT_CONTEXT_LABELS,
  validateOrderPaymentInput,
  validateRefundInput,
} from '@/src/lib/domain/cashRegister';
import {
  buildCommercialDocumentSnapshot,
  sanitizeMediaUrl,
  validateDomainConfig,
  validateHexColor,
  validateMaintenanceContractInput,
  validateSlugChange,
  type PlatformCommercialConfig,
} from '@/src/lib/domain/commercial';

export interface StaffMemberAssignment {
  id: string;
  restaurant_id: string;
  full_name: string;
  email: string;
  role_code: RestaurantRoleCode;
  status: 'invited' | 'active' | 'suspended';
  invitation_code: string;
  last_reset_requested_at?: string | null;
}

export type GranularModuleKey =
  | 'dashboard'
  | 'menu'
  | 'orders'
  | 'reservations'
  | 'inventory'
  | 'finance'
  | 'employees'
  | 'settings';

export interface GranularPermissionSet {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  validate: boolean;
}

export type RolePermissionMatrix = Record<
  RestaurantRoleCode,
  Record<GranularModuleKey, GranularPermissionSet>
>;

export interface UserActivityEntry {
  id: string;
  restaurant_id: string | null;
  actor_name: string;
  action: string;
  created_at: string;
}

export type PlatformSettingsState = PlatformCommercialConfig;

const DEFAULT_ROLE_MATRIX: RolePermissionMatrix = {
  restaurant_admin: {
    dashboard: { read: true, create: true, update: true, delete: true, validate: true },
    menu: { read: true, create: true, update: true, delete: true, validate: true },
    orders: { read: true, create: true, update: true, delete: true, validate: true },
    reservations: { read: true, create: true, update: true, delete: true, validate: true },
    inventory: { read: true, create: true, update: true, delete: true, validate: true },
    finance: { read: true, create: true, update: true, delete: true, validate: true },
    employees: { read: true, create: true, update: true, delete: true, validate: true },
    settings: { read: true, create: true, update: true, delete: false, validate: true },
  },
  manager: {
    dashboard: { read: true, create: false, update: false, delete: false, validate: false },
    menu: { read: true, create: true, update: true, delete: true, validate: true },
    orders: { read: true, create: true, update: true, delete: false, validate: true },
    reservations: { read: true, create: true, update: true, delete: false, validate: true },
    inventory: { read: true, create: true, update: true, delete: false, validate: true },
    finance: { read: true, create: true, update: false, delete: false, validate: false },
    employees: { read: true, create: true, update: true, delete: false, validate: false },
    settings: { read: false, create: false, update: false, delete: false, validate: false },
  },
  cashier: {
    dashboard: { read: false, create: false, update: false, delete: false, validate: false },
    menu: { read: true, create: false, update: false, delete: false, validate: false },
    orders: { read: true, create: true, update: true, delete: false, validate: true },
    reservations: { read: true, create: false, update: false, delete: false, validate: false },
    inventory: { read: false, create: false, update: false, delete: false, validate: false },
    finance: { read: true, create: true, update: false, delete: false, validate: true },
    employees: { read: false, create: false, update: false, delete: false, validate: false },
    settings: { read: false, create: false, update: false, delete: false, validate: false },
  },
  server: {
    dashboard: { read: false, create: false, update: false, delete: false, validate: false },
    menu: { read: true, create: false, update: false, delete: false, validate: false },
    orders: { read: true, create: true, update: true, delete: false, validate: false },
    reservations: { read: true, create: true, update: true, delete: false, validate: true },
    inventory: { read: false, create: false, update: false, delete: false, validate: false },
    finance: { read: false, create: false, update: false, delete: false, validate: false },
    employees: { read: false, create: false, update: false, delete: false, validate: false },
    settings: { read: false, create: false, update: false, delete: false, validate: false },
  },
  cook: {
    dashboard: { read: false, create: false, update: false, delete: false, validate: false },
    menu: { read: true, create: false, update: false, delete: false, validate: false },
    orders: { read: true, create: false, update: true, delete: false, validate: true },
    reservations: { read: false, create: false, update: false, delete: false, validate: false },
    inventory: { read: true, create: false, update: true, delete: false, validate: false },
    finance: { read: false, create: false, update: false, delete: false, validate: false },
    employees: { read: false, create: false, update: false, delete: false, validate: false },
    settings: { read: false, create: false, update: false, delete: false, validate: false },
  },
};

interface RestoConnectState {
  plans: PlanRecord[];
  restaurants: RestaurantRecord[];
  slugRedirects: RestaurantSlugRedirectRecord[];
  licenses: LicenseRecord[];
  licenseHistory: LicenseHistoryEntry[];
  maintenanceContracts: MaintenanceContractRecord[];
  maintenancePayments: MaintenancePaymentRecord[];
  commercialDocuments: CommercialDocumentRecord[];
  commercialInquiries: CommercialInquiryRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  productImages: ProductImageRecord[];
  productOptions: ProductOptionRecord[];
  productOptionValues: ProductOptionValueRecord[];
  deliveryZones: DeliveryZoneRecord[];
  tables: RestaurantTableRecord[];
  customers: CustomerRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  orderItemOptions: OrderItemOptionRecord[];
  orderStatusHistory: OrderStatusHistoryRecord[];
  reservations: ReservationRecord[];
  suppliers: SupplierRecord[];
  ingredients: IngredientRecord[];
  inventoryMovements: InventoryMovementRecord[];
  recipes: RecipeRecord[];
  recipeItems: RecipeItemRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  purchaseOrderItems: PurchaseOrderItemRecord[];
  employees: EmployeeRecord[];
  members: StaffMemberAssignment[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequestRecord[];
  payrollRecords: PayrollRecord[];
  salaryPayments: SalaryPaymentRecord[];
  payments: PaymentRecord[];
  cashRegisters: CashRegisterRecord[];
  cashSessions: CashSessionRecord[];
  cashMovements: CashMovementRecord[];
  paymentTransactions: PaymentTransactionRecord[];
  refunds: RefundRecord[];
  receipts: ReceiptRecord[];
  cashClosures: CashClosureRecord[];
  expenses: ExpenseRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  roleMatrixByTenant: Record<string, RolePermissionMatrix>;
  userActivityLogs: UserActivityEntry[];
  platformSettings: PlatformSettingsState;
}

const INITIAL_STATE: RestoConnectState = {
  plans: [
    {
      id: 'plan-perpetual',
      code: 'rc-perpetual-core',
      name: 'Licence Perpétuelle Standard',
      description: 'Paiement unique, utilisation sans expiration, fonctionnalités complètes.',
      billing_model: 'perpetual',
      base_price_usd: 0,
      maintenance_annual_usd: 0,
      max_staff: 25,
      max_tables: 40,
      is_active: true,
    },
    {
      id: 'plan-maintenance',
      code: 'rc-perpetual-maintenance',
      name: 'Licence Perpétuelle + Maintenance',
      description: "Paiement unique avec contrat d'assistance et mises à jour optionnelles.",
      billing_model: 'perpetual_with_maintenance',
      base_price_usd: 0,
      maintenance_annual_usd: 0,
      max_staff: 100,
      max_tables: 150,
      is_active: true,
    },
  ],
  restaurants: [],
  slugRedirects: [],
  licenses: [],
  maintenanceContracts: [],
  maintenancePayments: [],
  commercialDocuments: [],
  commercialInquiries: [],
  licenseHistory: [],
  categories: [],
  products: [],
  productImages: [],
  productOptions: [],
  productOptionValues: [],
  deliveryZones: [],
  tables: [],
  customers: [],
  orders: [],
  orderItems: [],
  orderItemOptions: [],
  orderStatusHistory: [],
  reservations: [],
  suppliers: [],
  ingredients: [],
  inventoryMovements: [],
  recipes: [],
  recipeItems: [],
  purchaseOrders: [],
  purchaseOrderItems: [],
  employees: [],
  members: [],
  attendanceRecords: [],
  leaveRequests: [],
  payrollRecords: [],
  salaryPayments: [],
  payments: [],
  cashRegisters: [],
  cashSessions: [],
  cashMovements: [],
  paymentTransactions: [],
  refunds: [],
  receipts: [],
  cashClosures: [],
  expenses: [],
  notifications: [],
  auditLogs: [],
  roleMatrixByTenant: {},
  userActivityLogs: [],
  platformSettings: {
    platformName: 'RestoConnect',
    tagline: 'La gestion intelligente de votre restaurant',
    logoUrl: null,
    supportEmail: 'bonnyofficiel992@gmail.com',
    commercialPhone: '',
    commercialWhatsapp: '',
    commercialAddress: '',
    defaultCountry: 'République démocratique du Congo',
    defaultTimezone: 'Africa/Kinshasa',
    referenceCurrency: 'USD',
    defaultUsdCdfRate: 2850,
    standardLicensePriceUsd: 0,
    maintenanceAnnualPriceUsd: 0,
    maintenanceAlertDays: 30,
    commercialTerms:
      "Licence perpétuelle acquise par établissement sans expiration automatique. Le contrat de maintenance annuel est optionnel et n'affecte jamais la validité perpétuelle de la licence.",
  },
};

export interface CreateRestaurantInput {
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  commune: string;
  city: string;
  country: string;
  logo_url?: string;
  establishment_type: string;
  default_currency: CurrencyCode;
  status: RestaurantStatus;
  primary_color?: string;
  accent_color?: string;
}

export interface AttributeLicenseInput {
  restaurantId: string;
  licenseType: LicenseType;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: PaymentRecord['payment_method'];
  paymentStatus: 'pending' | 'confirmed';
  paymentReference: string;
  paymentVerified: boolean;
  saleDate?: string;
  businessClientName?: string;
  businessClientContact?: string;
  businessClientPhone?: string;
  businessClientEmail?: string;
  maintenanceExpiresAt?: string;
  notes?: string;
}

interface RestoConnectContextValue extends RestoConnectState {
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  // Super Admin actions
  createRestaurant: (
    input: CreateRestaurantInput
  ) => { ok: true; restaurant: RestaurantRecord } | { ok: false; error: string };
  updateRestaurantDetails: (
    restaurantId: string,
    updates: Partial<RestaurantRecord>
  ) => { ok: true } | { ok: false; error: string };
  updateRestaurantStatus: (restaurantId: string, status: RestaurantStatus) => void;
  attributeLicense: (
    input: AttributeLicenseInput
  ) => { ok: true; license: LicenseRecord } | { ok: false; error: string };
  issueLicense: (input: {
    restaurantId: string;
    licenseType: LicenseType;
    maintenanceExpiresAt?: string;
  }) => { ok: true; license: LicenseRecord } | { ok: false; error: string };
  updateLicenseStatus: (licenseId: string, status: LicenseStatus, reason?: string) => void;
  recordLicensePayment: (input: {
    restaurantId: string;
    licenseId: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: PaymentRecord['payment_method'];
    referenceCode: string;
    initialStatus?: 'pending' | 'confirmed';
    verifiedConfirmed?: boolean;
    adminComment?: string;
  }) => { ok: true } | { ok: false; error: string };
  verifyCommercialPayment: (input: {
    paymentId: string;
    nextStatus: 'confirmed' | 'rejected' | 'refunded';
    adminComment: string;
    verifiedConfirmed: boolean;
  }) => { ok: true } | { ok: false; error: string };
  createOwnerAccountInvitation: (input: {
    restaurantId: string;
    fullName: string;
    email: string;
    roleCode: RestaurantRoleCode;
  }) => { ok: true; invitationCode: string } | { ok: false; error: string };
  toggleMemberStatus: (memberId: string) => void;
  requestAccessReset: (memberId: string) => void;
  updatePlatformSettings: (updates: Partial<PlatformSettingsState>) => void;

  // Prompt 04 : Menu, options, photos & zones de livraison
  createCategory: (restaurantId: string, name: string, description?: string) => { ok: true } | { ok: false; error: string };
  updateCategory: (categoryId: string, updates: { name: string; description?: string; is_active?: boolean }) => { ok: true } | { ok: false; error: string };
  deleteCategory: (categoryId: string) => { ok: true } | { ok: false; error: string };
  createProduct: (input: {
    restaurantId: string;
    categoryId: string;
    name: string;
    description: string;
    priceAmount: number;
    currency: CurrencyCode;
    prepMinutes: number;
    sku?: string;
    isFeatured?: boolean;
    primaryImageUrl?: string;
  }) => { ok: true } | { ok: false; error: string };
  updateProduct: (
    productId: string,
    updates: Partial<Pick<ProductRecord, 'name' | 'category_id' | 'description' | 'price_amount' | 'currency' | 'preparation_time_min' | 'is_featured' | 'is_available' | 'is_temporarily_disabled'>>
  ) => { ok: true } | { ok: false; error: string };
  deleteProduct: (productId: string) => void;
  toggleProductAvailability: (productId: string) => void;
  toggleProductFeatured: (productId: string) => void;
  addProductImage: (input: { restaurantId: string; productId: string; imageUrl: string; isPrimary?: boolean }) => { ok: true } | { ok: false; error: string };
  removeProductImage: (imageId: string) => void;
  addProductOptionWithValues: (input: {
    restaurantId: string;
    productId: string;
    name: string;
    optionType: ProductOptionRecord['option_type'];
    isRequired: boolean;
    isMultiple: boolean;
    values: Array<{ label: string; extraPrice: number; currency: CurrencyCode }>;
  }) => { ok: true } | { ok: false; error: string };
  deleteProductOption: (optionId: string) => void;
  createDeliveryZone: (input: {
    restaurantId: string;
    zoneName: string;
    commune: string;
    feeAmount: number;
    currency: CurrencyCode;
    estimatedMinutes: number;
  }) => { ok: true } | { ok: false; error: string };
  toggleDeliveryZone: (zoneId: string) => void;

  // Prompt 04 : Commandes, paiements, suivi & réservations
  createOrder: (input: {
    restaurantId: string;
    orderType: OrderRecord['order_type'];
    tableId?: string | null;
    customerName?: string;
    customerPhone?: string;
    deliveryZoneId?: string | null;
    deliveryCommune?: string;
    deliveryQuartier?: string;
    deliveryAddress?: string;
    deliveryInstructions?: string;
    paymentMethod?: 'cash' | 'mobile_money' | 'card';
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      selectedOptions?: CartOptionSelection[];
      specialInstructions?: string;
    }>;
  }) => { ok: true; order: OrderRecord } | { ok: false; error: string };
  advanceOrderStatus: (orderId: string, nextStatus: OrderStatus, note?: string) => { ok: true; warning?: string } | { ok: false; error: string };
  confirmOrderPaymentStatus: (
    orderId: string,
    status: 'confirmed' | 'failed' | 'refunded',
    referenceCode?: string
  ) => { ok: true } | { ok: false; error: string };
  createTable: (input: {
    restaurantId: string;
    tableNumber: string;
    zone: string;
    capacity: number;
  }) => { ok: true } | { ok: false; error: string };
  updateTableStatus: (tableId: string, status: RestaurantTableRecord['status']) => void;
  createReservation: (input: {
    restaurantId: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    partySize: number;
    reservedFor: string;
    notes?: string;
  }) => { ok: true; reservation: ReservationRecord } | { ok: false; error: string };
  updateReservationStatus: (reservationId: string, status: ReservationRecord['status']) => void;
  updateReservationDetails: (
    reservationId: string,
    updates: { tableId: string | null; partySize: number; reservedFor: string; notes?: string }
  ) => { ok: true } | { ok: false; error: string };

  // Prompt 05 : Inventaire, Recettes & Fournisseurs
  createIngredient: (input: {
    restaurantId: string;
    name: string;
    category?: InventoryCategory;
    description?: string;
    unit: string;
    currentStock: number;
    minimumStock: number;
    unitCost: number;
    currency?: CurrencyCode;
    supplierId?: string | null;
    expiryDate?: string | null;
    storageLocation?: string | null;
  }) => { ok: true } | { ok: false; error: string };
  updateIngredient: (
    ingredientId: string,
    updates: Partial<Omit<IngredientRecord, 'id' | 'restaurant_id'>>
  ) => { ok: true } | { ok: false; error: string };
  archiveIngredient: (ingredientId: string, archived: boolean) => void;
  recordInventoryMovement: (input: {
    restaurantId: string;
    ingredientId: string;
    movementType: MovementType;
    quantity: number;
    reason: string;
    performedByLabel?: string;
  }) => { ok: true } | { ok: false; error: string };
  saveRecipeForProduct: (input: {
    restaurantId: string;
    productId: string;
    notes?: string;
    items: Array<{ ingredientId: string; quantityPerUnit: number; unit: string }>;
  }) => { ok: true } | { ok: false; error: string };
  deleteRecipe: (recipeId: string) => void;
  createSupplier: (input: {
    restaurantId: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    category: string;
    notes?: string;
  }) => { ok: true } | { ok: false; error: string };
  archiveSupplier: (supplierId: string, archived: boolean) => void;
  createPurchaseOrder: (input: {
    restaurantId: string;
    supplierId: string;
    orderDate: string;
    expectedDate?: string;
    currency: CurrencyCode;
    attachmentRef?: string;
    notes?: string;
    items: Array<{ ingredientId: string; quantityOrdered: number; unitCost: number }>;
  }) => { ok: true; po: PurchaseOrderRecord } | { ok: false; error: string };
  receivePurchaseOrderItems: (
    purchaseOrderId: string,
    receivedQuantities: Record<string, number>
  ) => { ok: true } | { ok: false; error: string };
  recordPurchaseOrderPayment: (
    purchaseOrderId: string,
    amountPaidDelta: number
  ) => { ok: true } | { ok: false; error: string };
  cancelPurchaseOrder: (purchaseOrderId: string) => { ok: true } | { ok: false; error: string };

  // Prompt 05 : RH, Présences, Paie & Finances
  createEmployee: (input: {
    restaurantId: string;
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    address?: string;
    roleCode: RestaurantRoleCode;
    contractType: EmployeeRecord['contract_type'];
    salaryAmount?: number;
    salaryCurrency?: CurrencyCode;
  }) => { ok: true; invitationCode: string } | { ok: false; error: string };
  updateEmployeeDetails: (
    employeeId: string,
    updates: {
      fullName: string;
      jobTitle: string;
      phone: string;
      email: string;
      address?: string;
      roleCode: RestaurantRoleCode;
      contractType: EmployeeRecord['contract_type'];
      salaryAmount?: number;
      salaryCurrency?: CurrencyCode;
      employmentStatus?: EmployeeRecord['employment_status'];
    }
  ) => { ok: true } | { ok: false; error: string };
  toggleEmployeeActive: (employeeId: string) => void;
  recordCheckIn: (input: {
    restaurantId: string;
    employeeId: string;
    attendanceDate: string;
    status: AttendanceRecord['status'];
    delayMinutes?: number;
    note?: string;
  }) => { ok: true } | { ok: false; error: string };
  recordCheckOut: (attendanceId: string) => { ok: true } | { ok: false; error: string };
  createLeaveRequest: (input: {
    restaurantId: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    leaveType: string;
    reason?: string;
  }) => { ok: true } | { ok: false; error: string };
  updateLeaveStatus: (leaveId: string, status: LeaveRequestRecord['status']) => void;
  generatePayrollRecord: (input: {
    restaurantId: string;
    employeeId: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    bonuses: number;
    advances: number;
    deductions: number;
    currency: CurrencyCode;
    notes?: string;
  }) => { ok: true; payroll: PayrollRecord } | { ok: false; error: string };
  recordSalaryPayment: (input: {
    restaurantId: string;
    payrollId: string;
    amountPaid: number;
    paymentMethod: SalaryPaymentRecord['payment_method'];
    referenceCode: string;
    notes?: string;
  }) => { ok: true } | { ok: false; error: string };
  getRoleMatrixForTenant: (restaurantId: string) => RolePermissionMatrix;
  updateRolePermission: (
    restaurantId: string,
    role: RestaurantRoleCode,
    moduleKey: GranularModuleKey,
    action: keyof GranularPermissionSet,
    allowed: boolean
  ) => void;
  createCustomer: (input: {
    restaurantId: string;
    fullName: string;
    phone: string;
    email?: string;
    notes?: string;
  }) => { ok: true } | { ok: false; error: string };
  recordOrderSettlement: (input: {
    restaurantId: string;
    orderId: string;
    paymentMethod: PaymentRecord['payment_method'];
    referenceCode?: string;
  }) => { ok: true } | { ok: false; error: string };
  // Prompt 06 : Caisse, paiements multi-devises, sessions, remboursements, clôtures & reçus
  createCashRegister: (input: {
    restaurantId: string;
    name: string;
    code: string;
  }) => { ok: true; register: CashRegisterRecord } | { ok: false; error: string };
  openCashSession: (input: {
    restaurantId: string;
    cashRegisterId: string;
    cashierName: string;
    actorRole: RestaurantRoleCode;
    openingAmountUsd: number;
    openingAmountCdf: number;
    notes?: string;
  }) => { ok: true; session: CashSessionRecord } | { ok: false; error: string };
  recordCashMovement: (input: {
    restaurantId: string;
    cashSessionId: string;
    movementType: 'in' | 'out';
    amount: number;
    currency: CurrencyCode;
    reason: string;
    actorName: string;
    actorRole: RestaurantRoleCode;
  }) => { ok: true; movement: CashMovementRecord } | { ok: false; error: string };
  recordCashPayment: (input: {
    restaurantId: string;
    orderId: string;
    cashSessionId?: string | null;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: CashPaymentMethod;
    paymentContext: PaymentContext;
    referenceCode?: string;
    note?: string;
    cashierName: string;
    actorRole: RestaurantRoleCode;
  }) =>
    | { ok: true; transaction: PaymentTransactionRecord; receipt: ReceiptRecord }
    | { ok: false; error: string };
  voidOrCorrectPaymentTransaction: (input: {
    restaurantId: string;
    transactionId: string;
    reason: string;
    actorName: string;
    actorRole: RestaurantRoleCode;
  }) => { ok: true } | { ok: false; error: string };
  recordRefund: (input: {
    restaurantId: string;
    orderId: string;
    paymentTransactionId: string;
    cashSessionId?: string | null;
    amount: number;
    refundMethod: CashPaymentMethod;
    reason: string;
    responsibleName: string;
    actorRole: RestaurantRoleCode;
  }) => { ok: true; refund: RefundRecord; receipt: ReceiptRecord } | { ok: false; error: string };
  closeCashSession: (input: {
    restaurantId: string;
    cashSessionId: string;
    countedUsd: number;
    countedCdf: number;
    notes?: string;
    actorName: string;
    actorRole: RestaurantRoleCode;
  }) => { ok: true; closure: CashClosureRecord } | { ok: false; error: string };
  adjustLockedClosure: (input: {
    restaurantId: string;
    closureId: string;
    countedUsd: number;
    countedCdf: number;
    correctionReason: string;
    actorName: string;
    actorRole: RestaurantRoleCode;
  }) => { ok: true } | { ok: false; error: string };
  recordExpense: (input: {
    restaurantId: string;
    category: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    expenseDate: string;
    paymentMethod?: ExpenseRecord['payment_method'];
    beneficiary?: string;
  }) => { ok: true } | { ok: false; error: string };
  archiveExpense: (expenseId: string, reason: string) => { ok: true } | { ok: false; error: string };
  markNotificationRead: (notificationId: string) => void;
  updateRestaurantSettings: (
    restaurantId: string,
    updates: Partial<Omit<RestaurantRecord, 'id' | 'slug' | 'status' | 'created_at' | 'updated_at'>>
  ) => void;
  // Prompt 07 : Slugs, domaines, maintenance, documents commerciaux & prospects
  updateRestaurantSlugAndDomain: (
    restaurantId: string,
    input: { slug: string; subdomainPrefix?: string; customDomain?: string }
  ) => { ok: true; slug: string; redirectedOldSlug: string | null } | { ok: false; error: string };
  createMaintenanceContract: (input: {
    restaurantId: string;
    licenseId: string;
    durationMonths: number;
    priceAmount: number;
    currency: CurrencyCode;
    includedServices: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }) => { ok: true; contract: MaintenanceContractRecord } | { ok: false; error: string };
  updateMaintenanceContractStatus: (
    contractId: string,
    status: MaintenanceContractStatus
  ) => void;
  recordMaintenancePayment: (input: {
    restaurantId: string;
    contractId: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: MaintenancePaymentRecord['payment_method'];
    referenceCode: string;
    adminComment?: string;
  }) => { ok: true; payment: MaintenancePaymentRecord } | { ok: false; error: string };
  generateCommercialDocument: (input: {
    documentType: CommercialDocumentType;
    restaurantId: string;
    licenseId?: string;
    paymentId?: string;
    maintenanceContractId?: string;
  }) => { ok: true; document: CommercialDocumentRecord } | { ok: false; error: string };
  submitCommercialInquiry: (input: {
    fullName: string;
    restaurantName: string;
    city: string;
    phone: string;
    email: string;
    message: string;
  }) => { ok: true; inquiry: CommercialInquiryRecord } | { ok: false; error: string };
  updateCommercialInquiryStatus: (
    inquiryId: string,
    status: CommercialInquiryRecord['status']
  ) => void;
}

const RestoConnectContext = createContext<RestoConnectContextValue | null>(null);

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function RestoConnectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestoConnectState>(INITIAL_STATE);
  const [activeTenantId, setActiveTenantId] = useState<string>(INITIAL_STATE.restaurants[0]?.id ?? '');

  const appendAudit = useCallback(
    (
      prev: RestoConnectState,
      entry: Omit<AuditLogRecord, 'id' | 'created_at' | 'actor_profile_id' | 'old_data' | 'new_data'> & {
        new_data?: Record<string, unknown> | null;
      }
    ): AuditLogRecord[] => {
      const log: AuditLogRecord = {
        id: nextId('audit'),
        restaurant_id: entry.restaurant_id,
        actor_profile_id: null,
        actor_label: entry.actor_label ?? 'Super Administrateur',
        action: entry.action,
        entity_table: entry.entity_table,
        entity_id: entry.entity_id,
        old_data: null,
        new_data: entry.new_data ?? null,
        created_at: new Date().toISOString(),
      };
      return [log, ...prev.auditLogs];
    },
    []
  );

  // ---------------- SUPER ADMIN ACTIONS ----------------
  const createRestaurant: RestoConnectContextValue['createRestaurant'] = (input) => {
    const cleanName = input.name.trim();
    if (cleanName.length < 2) {
      return { ok: false, error: 'Le nom commercial du restaurant est requis.' };
    }
    if (!input.owner_name.trim()) {
      return { ok: false, error: 'Le nom du propriétaire est requis.' };
    }
    if (!input.email.trim()) {
      return { ok: false, error: "L'adresse e-mail professionnelle est requise." };
    }
    const baseSlug = slugify(cleanName);
    const slugExists = state.restaurants.some((r) => r.slug === baseSlug);
    const slug = slugExists ? `${baseSlug}-${state.restaurants.length + 1}` : baseSlug;
    const now = new Date().toISOString();

    const created: RestaurantRecord = {
      id: nextId('rest'),
      name: cleanName,
      slug,
      owner_name: input.owner_name.trim(),
      description: null,
      logo_url: input.logo_url?.trim() || null,
      cover_image_url: null,
      primary_color: input.primary_color ?? '#163C2E',
      accent_color: input.accent_color ?? '#B8923A',
      address: input.address.trim() || null,
      commune: input.commune.trim() || null,
      city: input.city.trim() || 'Kinshasa',
      country: input.country.trim() || 'République démocratique du Congo',
      phone: input.phone.trim() || null,
      whatsapp_phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      establishment_type: input.establishment_type.trim() || 'Restaurant',
      cuisine_type: null,
      opening_hours: 'Lun - Dim · 11h00 - 22h30',
      default_currency: input.default_currency,
      secondary_currency: input.default_currency === 'CDF' ? 'USD' : 'CDF',
      exchange_rate_usd_cdf: state.platformSettings.defaultUsdCdfRate,
      timezone: state.platformSettings.defaultTimezone,
      allowed_order_modes: ['dine_in', 'takeaway', 'delivery'],
      allowed_delivery_modes: ['pickup', 'local_courier'],
      cancellation_policy: null,
      notification_email_orders: true,
      notification_low_stock: true,
      additional_info: null,
      status: input.status,
      created_at: now,
      updated_at: now,
    };

    const ownerInviteCode = `RC-${slug.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ownerMember: StaffMemberAssignment = {
      id: nextId('mem'),
      restaurant_id: created.id,
      full_name: input.owner_name.trim(),
      email: input.email.trim(),
      role_code: 'restaurant_admin',
      status: 'invited',
      invitation_code: ownerInviteCode,
      last_reset_requested_at: null,
    };

    setState((prev) => ({
      ...prev,
      restaurants: [created, ...prev.restaurants],
      members: [ownerMember, ...prev.members],
      auditLogs: appendAudit(prev, {
        restaurant_id: created.id,
        action: 'CREATE_RESTAURANT',
        entity_table: 'restaurants',
        entity_id: created.id,
        new_data: {
          name: created.name,
          owner_name: created.owner_name,
          city: created.city,
          commune: created.commune,
          status: created.status,
        },
      }),
    }));

    setActiveTenantId((prev) => prev || created.id);
    return { ok: true, restaurant: created };
  };

  const updateRestaurantDetails: RestoConnectContextValue['updateRestaurantDetails'] = (
    restaurantId,
    updates
  ) => {
    const target = state.restaurants.find((r) => r.id === restaurantId);
    if (!target) return { ok: false, error: 'Établissement introuvable.' };
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      restaurants: prev.restaurants.map((r) =>
        r.id === restaurantId ? { ...r, ...updates, updated_at: now } : r
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: restaurantId,
        action: 'UPDATE_RESTAURANT_DETAILS',
        entity_table: 'restaurants',
        entity_id: restaurantId,
        new_data: updates as Record<string, unknown>,
      }),
    }));
    return { ok: true };
  };

  const updateRestaurantStatus: RestoConnectContextValue['updateRestaurantStatus'] = (restaurantId, status) => {
    setState((prev) => ({
      ...prev,
      restaurants: prev.restaurants.map((r) =>
        r.id === restaurantId ? { ...r, status, updated_at: new Date().toISOString() } : r
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: restaurantId,
        action: `RESTAURANT_STATUS_${status.toUpperCase()}`,
        entity_table: 'restaurants',
        entity_id: restaurantId,
        new_data: { status },
      }),
    }));
  };

  const attributeLicense: RestoConnectContextValue['attributeLicense'] = (input) => {
    const targetRestaurant = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!targetRestaurant) return { ok: false, error: 'Restaurant introuvable.' };
    const validation = validateLicenseAttribution(state.licenses, targetRestaurant.id, input.amount);
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Attribution impossible.' };
    }
    if (input.paymentStatus === 'confirmed' && !input.paymentVerified) {
      return {
        ok: false,
        error: "Cochez la confirmation de vérification réelle avant d'activer la licence.",
      };
    }
    if (input.amount > 0 && !input.paymentReference.trim()) {
      return { ok: false, error: 'Saisissez une référence de pièce justificative pour ce paiement.' };
    }

    const plan = state.plans.find((p) => p.billing_model === input.licenseType) ?? state.plans[0];
    const now = new Date().toISOString();
    const shouldActivate = input.paymentStatus === 'confirmed' && input.paymentVerified;
    const licStatus: LicenseStatus = shouldActivate ? 'active' : 'pending';

    const newLicense: LicenseRecord = {
      id: nextId('lic'),
      restaurant_id: targetRestaurant.id,
      plan_id: plan.id,
      license_key: generateLicenseKey(targetRestaurant.slug, state.licenses.length + 1),
      license_type: input.licenseType,
      amount: input.amount,
      currency: input.currency,
      status: licStatus,
      issued_at: now,
      activated_at: shouldActivate ? now : null,
      sale_date: input.saleDate || now.slice(0, 10),
      business_client_name: input.businessClientName?.trim() || targetRestaurant.name,
      business_client_contact:
        input.businessClientContact?.trim() || targetRestaurant.owner_name || null,
      business_client_phone: input.businessClientPhone?.trim() || targetRestaurant.phone || null,
      business_client_email: input.businessClientEmail?.trim() || targetRestaurant.email || null,
      payment_method: input.paymentMethod,
      maintenance_expires_at:
        input.licenseType === 'perpetual_with_maintenance'
          ? input.maintenanceExpiresAt || new Date(Date.now() + 365 * 86400000).toISOString()
          : null,
      suspended_reason: null,
      revoked_reason: null,
      notes: input.notes?.trim() || null,
      issued_by: 'super-admin',
      created_at: now,
      updated_at: now,
    };

    const paymentRecord: PaymentRecord | null =
      input.amount > 0
        ? {
            id: nextId('pay'),
            restaurant_id: targetRestaurant.id,
            order_id: null,
            license_id: newLicense.id,
            payment_scope: 'license',
            amount: input.amount,
            currency: input.currency,
            payment_method: input.paymentMethod,
            status: shouldActivate ? 'confirmed' : 'pending',
            reference_code: input.paymentReference.trim(),
            admin_comment: shouldActivate
              ? "Paiement vérifié lors de l'attribution de licence."
              : 'En attente de confirmation comptable.',
            verified_at: shouldActivate ? now : null,
            recorded_by: 'super-admin',
            paid_at: shouldActivate ? now : null,
            created_at: now,
          }
        : null;

    const histEntry: LicenseHistoryEntry = {
      id: nextId('lh'),
      license_id: newLicense.id,
      restaurant_id: targetRestaurant.id,
      previous_status: null,
      new_status: licStatus,
      changed_by_label: 'Super Administrateur',
      reason: shouldActivate
        ? 'Attribution et activation après vérification du paiement'
        : 'Attribution en attente de confirmation de paiement',
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      licenses: [newLicense, ...prev.licenses],
      licenseHistory: [histEntry, ...prev.licenseHistory],
      payments: paymentRecord ? [paymentRecord, ...prev.payments] : prev.payments,
      restaurants: shouldActivate
        ? prev.restaurants.map((r) =>
            r.id === targetRestaurant.id ? { ...r, status: 'active', updated_at: now } : r
          )
        : prev.restaurants,
      auditLogs: appendAudit(prev, {
        restaurant_id: targetRestaurant.id,
        action: shouldActivate ? 'ATTRIBUTE_AND_ACTIVATE_LICENSE' : 'ISSUE_PENDING_LICENSE',
        entity_table: 'licenses',
        entity_id: newLicense.id,
        new_data: {
          license_key: newLicense.license_key,
          license_type: newLicense.license_type,
          amount: newLicense.amount,
          currency: newLicense.currency,
          status: licStatus,
        },
      }),
    }));

    return { ok: true, license: newLicense };
  };

  const issueLicense: RestoConnectContextValue['issueLicense'] = (input) => {
    return attributeLicense({
      restaurantId: input.restaurantId,
      licenseType: input.licenseType,
      amount: 0,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'confirmed',
      paymentReference: 'OFFRE-DIRECTE',
      paymentVerified: true,
      maintenanceExpiresAt: input.maintenanceExpiresAt,
    });
  };

  const updateLicenseStatus: RestoConnectContextValue['updateLicenseStatus'] = (licenseId, status, reason) => {
    const now = new Date().toISOString();
    setState((prev) => {
      const target = prev.licenses.find((l) => l.id === licenseId);
      const nextRestaurants = target
        ? prev.restaurants.map((r) =>
            r.id === target.restaurant_id
              ? {
                  ...r,
                  status:
                    status === 'active'
                      ? ('active' as const)
                      : status === 'pending'
                        ? ('pending' as const)
                        : ('suspended' as const),
                  updated_at: now,
                }
              : r
          )
        : prev.restaurants;

      const histEntry: LicenseHistoryEntry | null = target
        ? {
            id: nextId('lh'),
            license_id: target.id,
            restaurant_id: target.restaurant_id,
            previous_status: target.status,
            new_status: status,
            changed_by_label: 'Super Administrateur',
            reason: reason ?? `Changement de statut vers ${status}`,
            created_at: now,
          }
        : null;

      return {
        ...prev,
        licenses: prev.licenses.map((l) =>
          l.id === licenseId
            ? {
                ...l,
                status,
                activated_at: status === 'active' ? l.activated_at ?? now : l.activated_at,
                suspended_reason: status === 'suspended' ? reason ?? l.suspended_reason : l.suspended_reason,
                revoked_reason: status === 'revoked' ? reason ?? l.revoked_reason : l.revoked_reason,
                updated_at: now,
              }
            : l
        ),
        licenseHistory: histEntry ? [histEntry, ...prev.licenseHistory] : prev.licenseHistory,
        restaurants: nextRestaurants,
        auditLogs: appendAudit(prev, {
          restaurant_id: target?.restaurant_id ?? null,
          action: `LICENSE_STATUS_${status.toUpperCase()}`,
          entity_table: 'licenses',
          entity_id: licenseId,
          new_data: { status, reason: reason ?? null },
        }),
      };
    });
  };

  const recordLicensePayment: RestoConnectContextValue['recordLicensePayment'] = (input) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: 'Le montant doit être supérieur à zéro.' };
    }
    if (!input.referenceCode.trim()) {
      return { ok: false, error: 'Référence justificative requise.' };
    }
    const targetStatus = input.initialStatus ?? 'pending';
    if (targetStatus === 'confirmed' && !input.verifiedConfirmed) {
      return { ok: false, error: 'La confirmation exige une vérification explicite du justificatif.' };
    }

    const now = new Date().toISOString();
    const record: PaymentRecord = {
      id: nextId('pay'),
      restaurant_id: input.restaurantId,
      order_id: null,
      license_id: input.licenseId,
      payment_scope: 'license',
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethod,
      status: targetStatus,
      reference_code: input.referenceCode.trim(),
      admin_comment: input.adminComment?.trim() || null,
      verified_at: targetStatus === 'confirmed' ? now : null,
      recorded_by: 'super-admin',
      paid_at: targetStatus === 'confirmed' ? now : null,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      payments: [record, ...prev.payments],
      licenses:
        targetStatus === 'confirmed'
          ? prev.licenses.map((l) =>
              l.id === input.licenseId && l.status === 'pending'
                ? { ...l, status: 'active', activated_at: now, updated_at: now }
                : l
            )
          : prev.licenses,
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        action:
          targetStatus === 'confirmed' ? 'RECORD_CONFIRMED_LICENSE_PAYMENT' : 'RECORD_PENDING_LICENSE_PAYMENT',
        entity_table: 'payments',
        entity_id: record.id,
        new_data: {
          amount: record.amount,
          currency: record.currency,
          status: record.status,
          reference_code: record.reference_code,
        },
      }),
    }));
    return { ok: true };
  };

  const verifyCommercialPayment: RestoConnectContextValue['verifyCommercialPayment'] = (input) => {
    const targetPayment = state.payments.find((p) => p.id === input.paymentId);
    if (!targetPayment) return { ok: false, error: 'Paiement introuvable.' };
    if (input.nextStatus === 'confirmed' && !input.verifiedConfirmed) {
      return { ok: false, error: 'Cochez la confirmation de vérification réelle avant validation.' };
    }
    if ((input.nextStatus === 'rejected' || input.nextStatus === 'refunded') && !input.adminComment.trim()) {
      return { ok: false, error: 'Un commentaire administratif est requis pour rejeter ou rembourser.' };
    }

    const now = new Date().toISOString();
    setState((prev) => {
      const updatedPayments = prev.payments.map((p) =>
        p.id === input.paymentId
          ? {
              ...p,
              status: input.nextStatus,
              admin_comment: input.adminComment.trim() || p.admin_comment,
              verified_at: input.nextStatus === 'confirmed' ? now : p.verified_at,
              paid_at: input.nextStatus === 'confirmed' ? now : p.paid_at,
            }
          : p
      );

      let updatedLicenses = prev.licenses;
      let updatedRestaurants = prev.restaurants;
      let updatedHistory = prev.licenseHistory;

      if (input.nextStatus === 'confirmed' && targetPayment.license_id) {
        const linked = prev.licenses.find((l) => l.id === targetPayment.license_id);
        if (linked && linked.status === 'pending') {
          updatedLicenses = prev.licenses.map((l) =>
            l.id === linked.id ? { ...l, status: 'active', activated_at: now, updated_at: now } : l
          );
          updatedRestaurants = prev.restaurants.map((r) =>
            r.id === linked.restaurant_id ? { ...r, status: 'active', updated_at: now } : r
          );
          updatedHistory = [
            {
              id: nextId('lh'),
              license_id: linked.id,
              restaurant_id: linked.restaurant_id,
              previous_status: 'pending',
              new_status: 'active',
              changed_by_label: 'Super Administrateur',
              reason: `Activation suite à confirmation paiement ${targetPayment.reference_code ?? targetPayment.id}`,
              created_at: now,
            },
            ...prev.licenseHistory,
          ];
        }
      }

      return {
        ...prev,
        payments: updatedPayments,
        licenses: updatedLicenses,
        restaurants: updatedRestaurants,
        licenseHistory: updatedHistory,
        auditLogs: appendAudit(prev, {
          restaurant_id: targetPayment.restaurant_id,
          action: `PAYMENT_${input.nextStatus.toUpperCase()}`,
          entity_table: 'payments',
          entity_id: targetPayment.id,
          new_data: {
            status: input.nextStatus,
            admin_comment: input.adminComment.trim() || null,
          },
        }),
      };
    });

    return { ok: true };
  };

  const createOwnerAccountInvitation: RestoConnectContextValue['createOwnerAccountInvitation'] = (input) => {
    if (!input.fullName.trim() || !input.email.trim()) {
      return { ok: false, error: 'Nom complet et e-mail professionnel requis.' };
    }
    const code = `RC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const member: StaffMemberAssignment = {
      id: nextId('mem'),
      restaurant_id: input.restaurantId,
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      role_code: input.roleCode,
      status: 'invited',
      invitation_code: code,
      last_reset_requested_at: null,
    };
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      members: [member, ...prev.members],
      userActivityLogs: [
        {
          id: nextId('ua'),
          restaurant_id: input.restaurantId,
          actor_name: input.fullName.trim(),
          action: `Invitation créée (${input.roleCode})`,
          created_at: now,
        },
        ...prev.userActivityLogs,
      ],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        action: 'CREATE_USER_INVITATION',
        entity_table: 'restaurant_invitations',
        entity_id: member.id,
        new_data: { email: member.email, role_code: member.role_code },
      }),
    }));
    return { ok: true, invitationCode: code };
  };

  const toggleMemberStatus: RestoConnectContextValue['toggleMemberStatus'] = (memberId) => {
    const target = state.members.find((m) => m.id === memberId);
    if (!target) return;
    const nextStatus: StaffMemberAssignment['status'] =
      target.status === 'suspended' ? 'active' : 'suspended';
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === memberId ? { ...m, status: nextStatus } : m)),
      userActivityLogs: [
        {
          id: nextId('ua'),
          restaurant_id: target.restaurant_id,
          actor_name: target.full_name,
          action: nextStatus === 'suspended' ? 'Compte suspendu' : 'Compte réactivé',
          created_at: now,
        },
        ...prev.userActivityLogs,
      ],
      auditLogs: appendAudit(prev, {
        restaurant_id: target.restaurant_id,
        action: `MEMBER_${nextStatus.toUpperCase()}`,
        entity_table: 'restaurant_members',
        entity_id: memberId,
        new_data: { status: nextStatus, email: target.email },
      }),
    }));
  };

  const requestAccessReset: RestoConnectContextValue['requestAccessReset'] = (memberId) => {
    const target = state.members.find((m) => m.id === memberId);
    if (!target) return;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === memberId ? { ...m, last_reset_requested_at: now } : m
      ),
      userActivityLogs: [
        {
          id: nextId('ua'),
          restaurant_id: target.restaurant_id,
          actor_name: target.full_name,
          action: 'Lien de réinitialisation sécurisé émis (Supabase Auth)',
          created_at: now,
        },
        ...prev.userActivityLogs,
      ],
      auditLogs: appendAudit(prev, {
        restaurant_id: target.restaurant_id,
        action: 'REQUEST_PASSWORD_RESET',
        entity_table: 'profiles',
        entity_id: memberId,
        new_data: { email: target.email },
      }),
    }));
  };

  const updatePlatformSettings: RestoConnectContextValue['updatePlatformSettings'] = (updates) => {
    setState((prev) => ({
      ...prev,
      platformSettings: { ...prev.platformSettings, ...updates },
      auditLogs: appendAudit(prev, {
        restaurant_id: null,
        action: 'UPDATE_PLATFORM_SETTINGS',
        entity_table: 'platform_settings',
        entity_id: 'global',
        new_data: updates as Record<string, unknown>,
      }),
    }));
  };

  // ---------------- PROMPT 04 : MENU, OPTIONS, ZONES ----------------
  const createCategory: RestoConnectContextValue['createCategory'] = (restaurantId, name, description) => {
    if (!name.trim()) return { ok: false, error: 'Le nom de catégorie est requis.' };
    const created: CategoryRecord = {
      id: nextId('cat'),
      restaurant_id: restaurantId,
      name: name.trim(),
      slug: slugify(name),
      description: description?.trim() || null,
      sort_order: state.categories.filter((c) => c.restaurant_id === restaurantId).length + 1,
      is_active: true,
    };
    setState((prev) => ({ ...prev, categories: [...prev.categories, created] }));
    return { ok: true };
  };

  const updateCategory: RestoConnectContextValue['updateCategory'] = (categoryId, updates) => {
    if (!updates.name.trim()) return { ok: false, error: 'Nom de catégorie requis.' };
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              name: updates.name.trim(),
              slug: slugify(updates.name),
              description: updates.description?.trim() ?? c.description,
              is_active: updates.is_active ?? c.is_active,
            }
          : c
      ),
    }));
    return { ok: true };
  };

  const deleteCategory: RestoConnectContextValue['deleteCategory'] = (categoryId) => {
    const hasProducts = state.products.some((p) => p.category_id === categoryId);
    if (hasProducts) {
      return { ok: false, error: 'Réassignez ou supprimez les plats de cette catégorie avant suppression.' };
    }
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== categoryId),
    }));
    return { ok: true };
  };

  const createProduct: RestoConnectContextValue['createProduct'] = (input) => {
    if (!input.name.trim()) return { ok: false, error: 'Le nom du produit est requis.' };
    if (!Number.isFinite(input.priceAmount) || input.priceAmount < 0) {
      return { ok: false, error: 'Prix invalide.' };
    }
    const prodId = nextId('prod');
    const created: ProductRecord = {
      id: prodId,
      restaurant_id: input.restaurantId,
      category_id: input.categoryId,
      name: input.name.trim(),
      slug: `${slugify(input.name)}-${Date.now().toString(36).slice(-3)}`,
      description: input.description.trim() || null,
      price_amount: input.priceAmount,
      currency: input.currency,
      is_available: true,
      is_featured: Boolean(input.isFeatured),
      is_temporarily_disabled: false,
      sort_order: state.products.filter((p) => p.restaurant_id === input.restaurantId).length + 1,
      preparation_time_min: input.prepMinutes || 15,
      sku: input.sku?.trim() || null,
    };

    const initialImage: ProductImageRecord | null = input.primaryImageUrl?.trim()
      ? {
          id: nextId('pimg'),
          restaurant_id: input.restaurantId,
          product_id: prodId,
          storage_path: input.primaryImageUrl.trim(),
          public_url: input.primaryImageUrl.trim(),
          is_primary: true,
          sort_order: 1,
        }
      : null;

    setState((prev) => ({
      ...prev,
      products: [created, ...prev.products],
      productImages: initialImage ? [initialImage, ...prev.productImages] : prev.productImages,
    }));
    return { ok: true };
  };

  const updateProduct: RestoConnectContextValue['updateProduct'] = (productId, updates) => {
    if (updates.name !== undefined && !updates.name.trim()) {
      return { ok: false, error: 'Le nom du plat est requis.' };
    }
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === productId ? { ...p, ...updates } : p)),
    }));
    return { ok: true };
  };

  const deleteProduct: RestoConnectContextValue['deleteProduct'] = (productId) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
      productImages: prev.productImages.filter((pi) => pi.product_id !== productId),
      productOptions: prev.productOptions.filter((po) => po.product_id !== productId),
    }));
  };

  const toggleProductAvailability: RestoConnectContextValue['toggleProductAvailability'] = (productId) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, is_available: !p.is_available } : p
      ),
    }));
  };

  const toggleProductFeatured: RestoConnectContextValue['toggleProductFeatured'] = (productId) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, is_featured: !p.is_featured } : p
      ),
    }));
  };

  const addProductImage: RestoConnectContextValue['addProductImage'] = (input) => {
    if (!input.imageUrl.trim()) return { ok: false, error: "URL ou chemin d'image requis." };
    const existingCount = state.productImages.filter((i) => i.product_id === input.productId).length;
    const isPrim = input.isPrimary ?? existingCount === 0;
    const img: ProductImageRecord = {
      id: nextId('pimg'),
      restaurant_id: input.restaurantId,
      product_id: input.productId,
      storage_path: input.imageUrl.trim(),
      public_url: input.imageUrl.trim(),
      is_primary: isPrim,
      sort_order: existingCount + 1,
    };
    setState((prev) => ({
      ...prev,
      productImages: [
        ...(isPrim
          ? prev.productImages.map((pi) =>
              pi.product_id === input.productId ? { ...pi, is_primary: false } : pi
            )
          : prev.productImages),
        img,
      ],
    }));
    return { ok: true };
  };

  const removeProductImage: RestoConnectContextValue['removeProductImage'] = (imageId) => {
    setState((prev) => ({
      ...prev,
      productImages: prev.productImages.filter((pi) => pi.id !== imageId),
    }));
  };

  const addProductOptionWithValues: RestoConnectContextValue['addProductOptionWithValues'] = (input) => {
    if (!input.name.trim()) return { ok: false, error: "Nom du groupe d'options requis." };
    if (input.values.length === 0) return { ok: false, error: 'Ajoutez au moins un choix.' };
    const optId = nextId('popt');
    const option: ProductOptionRecord = {
      id: optId,
      restaurant_id: input.restaurantId,
      product_id: input.productId,
      name: input.name.trim(),
      option_type: input.optionType,
      is_required: input.isRequired,
      is_multiple: input.isMultiple,
      sort_order: state.productOptions.filter((o) => o.product_id === input.productId).length + 1,
    };
    const vals: ProductOptionValueRecord[] = input.values.map((v, idx) => ({
      id: nextId('pval'),
      restaurant_id: input.restaurantId,
      option_id: optId,
      label: v.label.trim(),
      extra_price: Math.max(0, v.extraPrice),
      currency: v.currency,
      is_available: true,
      sort_order: idx + 1,
    }));
    setState((prev) => ({
      ...prev,
      productOptions: [...prev.productOptions, option],
      productOptionValues: [...prev.productOptionValues, ...vals],
    }));
    return { ok: true };
  };

  const deleteProductOption: RestoConnectContextValue['deleteProductOption'] = (optionId) => {
    setState((prev) => ({
      ...prev,
      productOptions: prev.productOptions.filter((o) => o.id !== optionId),
      productOptionValues: prev.productOptionValues.filter((v) => v.option_id !== optionId),
    }));
  };

  const createDeliveryZone: RestoConnectContextValue['createDeliveryZone'] = (input) => {
    if (!input.zoneName.trim() || !input.commune.trim()) {
      return { ok: false, error: 'Nom de zone et commune requis.' };
    }
    const zone: DeliveryZoneRecord = {
      id: nextId('dz'),
      restaurant_id: input.restaurantId,
      zone_name: input.zoneName.trim(),
      commune: input.commune.trim(),
      fee_amount: Math.max(0, input.feeAmount),
      currency: input.currency,
      estimated_minutes: Math.max(10, input.estimatedMinutes),
      is_active: true,
    };
    setState((prev) => ({ ...prev, deliveryZones: [...prev.deliveryZones, zone] }));
    return { ok: true };
  };

  const toggleDeliveryZone: RestoConnectContextValue['toggleDeliveryZone'] = (zoneId) => {
    setState((prev) => ({
      ...prev,
      deliveryZones: prev.deliveryZones.map((z) =>
        z.id === zoneId ? { ...z, is_active: !z.is_active } : z
      ),
    }));
  };

  // ---------------- PROMPT 04 + 05 : COMMANDES, STOCK RECETTES, RESERVATIONS ----------------
  const createOrder: RestoConnectContextValue['createOrder'] = (input) => {
    const restaurant = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!restaurant) return { ok: false, error: 'Établissement introuvable.' };

    if (input.orderType === 'delivery') {
      if (!input.deliveryAddress?.trim() || !input.deliveryCommune?.trim()) {
        return { ok: false, error: 'Commune et adresse de livraison requises.' };
      }
      if (!input.customerPhone?.trim()) {
        return { ok: false, error: 'Numéro de téléphone requis pour la livraison.' };
      }
    }

    const authCalc = computeAuthoritativeOrder({
      restaurantId: input.restaurantId,
      orderType: input.orderType,
      defaultCurrency: restaurant.default_currency,
      exchangeRateUsdCdf: restaurant.exchange_rate_usd_cdf,
      products: state.products,
      productOptions: state.productOptions,
      optionValues: state.productOptionValues,
      deliveryZones: state.deliveryZones,
      deliveryZoneId: input.deliveryZoneId ?? null,
      requestedItems: input.items,
    });

    if (!authCalc.ok) {
      return { ok: false, error: authCalc.error };
    }

    const orderId = nextId('ord');
    const orderNum = generateOrderNumber(state.orders.length + 1);
    const trackingToken = generateTrackingToken(restaurant.slug);
    const now = new Date().toISOString();

    const newOrder: OrderRecord = {
      id: orderId,
      restaurant_id: input.restaurantId,
      order_number: orderNum,
      tracking_token: trackingToken,
      table_id: input.tableId ?? null,
      customer_id: null,
      customer_name: input.customerName?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      server_id: null,
      order_type: input.orderType,
      status: 'pending',
      subtotal: authCalc.subtotal,
      delivery_zone_id: authCalc.resolvedZone?.id ?? null,
      delivery_fee: authCalc.deliveryFee,
      delivery_commune: input.deliveryCommune?.trim() || authCalc.resolvedZone?.commune || null,
      delivery_quartier: input.deliveryQuartier?.trim() || null,
      delivery_address: input.deliveryAddress?.trim() || null,
      delivery_instructions: input.deliveryInstructions?.trim() || null,
      tax_amount: 0,
      total_amount: authCalc.totalAmount,
      currency: authCalc.currency,
      exchange_rate_applied: restaurant.exchange_rate_usd_cdf,
      paid_amount: 0,
      payment_method: input.paymentMethod ?? 'cash',
      payment_status: 'unpaid',
      stock_deducted: false,
      stock_deducted_at: null,
      cancellation_reason: null,
      notes: input.notes?.trim() || null,
      created_at: now,
    };

    const newLines: OrderItemRecord[] = [];
    const newItemOptions: OrderItemOptionRecord[] = [];

    for (const line of authCalc.lines) {
      const oiId = nextId('oi');
      newLines.push({
        id: oiId,
        restaurant_id: input.restaurantId,
        order_id: orderId,
        product_id: line.product.id,
        product_name_snapshot: line.product.name,
        unit_price_snapshot: line.finalUnitPrice,
        options_summary: line.optionsSummary,
        quantity: line.quantity,
        unit_price: line.finalUnitPrice,
        line_total: line.lineTotal,
        special_instructions: line.specialInstructions,
        kitchen_status: 'queued',
      });
      for (const snap of line.optionSnapshots) {
        newItemOptions.push({
          id: nextId('oio'),
          restaurant_id: input.restaurantId,
          order_item_id: oiId,
          option_name_snapshot: snap.optionName,
          value_label_snapshot: snap.valueLabel,
          extra_price_snapshot: snap.extraPrice,
        });
      }
    }

    const histEntry: OrderStatusHistoryRecord = {
      id: nextId('osh'),
      restaurant_id: input.restaurantId,
      order_id: orderId,
      previous_status: null,
      new_status: 'pending',
      changed_by_label: input.customerName?.trim() ? `Client (${input.customerName.trim()})` : 'Prise de commande',
      note: 'Commande enregistrée avec tarification catalogue vérifiée.',
      created_at: now,
    };

    const notif: NotificationRecord = {
      id: nextId('ntf'),
      restaurant_id: input.restaurantId,
      recipient_profile_id: 'restaurant-admin',
      title: `Nouvelle commande ${orderNum}`,
      message: `${input.customerName?.trim() || 'Client'} · ${input.orderType} · ${authCalc.totalAmount} ${authCalc.currency}`,
      channel: 'in_app',
      event_type: 'new_order',
      related_entity_id: orderId,
      is_read: false,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
      orderItems: [...newLines, ...prev.orderItems],
      orderItemOptions: [...newItemOptions, ...prev.orderItemOptions],
      orderStatusHistory: [histEntry, ...prev.orderStatusHistory],
      notifications: [notif, ...prev.notifications],
    }));

    return { ok: true, order: newOrder };
  };

  const advanceOrderStatus: RestoConnectContextValue['advanceOrderStatus'] = (orderId, nextStatus, note) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      return { ok: false, error: 'Transition de statut non autorisée.' };
    }

    const now = new Date().toISOString();
    let updatedIngredients = state.ingredients;
    let addedMovements: InventoryMovementRecord[] = [];
    let stockDeductedFlag = Boolean(order.stock_deducted);
    let stockDeductedAt = order.stock_deducted_at ?? null;
    let warning: string | undefined;

    // Déduction unique du stock lors du passage à confirmée ou en préparation si pas encore déduite
    if ((nextStatus === 'confirmed' || nextStatus === 'preparing') && !order.stock_deducted) {
      const deductionRes = computeOrderStockDeduction({
        order,
        orderItems: state.orderItems,
        recipes: state.recipes,
        recipeItems: state.recipeItems,
        ingredients: state.ingredients,
      });
      if (!deductionRes.ok) {
        return { ok: false, error: deductionRes.error ?? 'Stock insuffisant pour confirmer cette commande.' };
      }
      if (!deductionRes.alreadyDeducted && deductionRes.deductions.length > 0) {
        stockDeductedFlag = true;
        stockDeductedAt = now;
        const mapNext = new Map(deductionRes.deductions.map((d) => [d.ingredientId, d]));
        updatedIngredients = state.ingredients.map((ing) => {
          const d = mapNext.get(ing.id);
          return d ? { ...ing, current_stock: d.nextStock } : ing;
        });
        addedMovements = deductionRes.deductions.map((d) => ({
          id: nextId('mov'),
          restaurant_id: order.restaurant_id,
          ingredient_id: d.ingredientId,
          movement_type: 'kitchen_out',
          quantity: d.quantity,
          unit_cost_snapshot: d.unitCostSnapshot,
          reference_type: 'order',
          reference_id: order.id,
          reason: `Déduction recette automatique — Commande ${order.order_number}`,
          performed_by: null,
          performed_by_label: 'Système Recettes BOM',
          created_at: now,
        }));
      }
      if (deductionRes.skippedProductsWithoutRecipe.length > 0) {
        warning = `Plats sans fiche recette (non déduits) : ${deductionRes.skippedProductsWithoutRecipe.join(', ')}`;
      }
    }

    // Restauration du stock en cas d'annulation après déduction
    if (nextStatus === 'cancelled' && order.stock_deducted) {
      const reversals = computeOrderStockReversal({
        order,
        movements: state.inventoryMovements,
        ingredients: state.ingredients,
      });
      if (reversals.length > 0) {
        const revMap = new Map(reversals.map((r) => [r.ingredientId, r]));
        updatedIngredients = state.ingredients.map((ing) => {
          const r = revMap.get(ing.id);
          return r ? { ...ing, current_stock: r.nextStock } : ing;
        });
        addedMovements = reversals.map((r) => ({
          id: nextId('mov'),
          restaurant_id: order.restaurant_id,
          ingredient_id: r.ingredientId,
          movement_type: 'in',
          quantity: r.quantityRestored,
          reference_type: 'order_reversal',
          reference_id: order.id,
          reason: `Annulation commande ${order.order_number} — réintégration stock`,
          performed_by: null,
          performed_by_label: 'Système Annulation',
          created_at: now,
        }));
      }
    }

    const histEntry: OrderStatusHistoryRecord = {
      id: nextId('osh'),
      restaurant_id: order.restaurant_id,
      order_id: order.id,
      previous_status: order.status,
      new_status: nextStatus,
      changed_by_label: 'Équipe Restaurant',
      note: note?.trim() || (nextStatus === 'cancelled' ? 'Annulée depuis le module commandes' : null),
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              stock_deducted: stockDeductedFlag,
              stock_deducted_at: stockDeductedAt,
              cancellation_reason: nextStatus === 'cancelled' ? note?.trim() || 'Annulation' : o.cancellation_reason,
            }
          : o
      ),
      ingredients: updatedIngredients,
      inventoryMovements: [...addedMovements, ...prev.inventoryMovements],
      orderStatusHistory: [histEntry, ...prev.orderStatusHistory],
    }));

    return { ok: true, warning };
  };

  const confirmOrderPaymentStatus: RestoConnectContextValue['confirmOrderPaymentStatus'] = (
    orderId,
    status,
    referenceCode
  ) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (status === 'confirmed' && !referenceCode?.trim() && order.payment_method !== 'cash' && order.payment_method !== 'cash_usd' && order.payment_method !== 'cash_cdf') {
      return { ok: false, error: 'Référence transaction requise pour valider un paiement Mobile Money ou Carte.' };
    }
    if (status === 'confirmed') {
      const cashMethod: CashPaymentMethod =
        order.payment_method === 'mobile_money'
          ? 'mobile_money'
          : order.payment_method === 'card'
            ? 'card'
            : order.payment_method === 'other'
              ? 'other'
              : order.currency === 'CDF'
                ? 'cash_cdf'
                : 'cash_usd';
      const summary = calculateOrderPaymentSummary(order, state.paymentTransactions, state.refunds);
      const remaining = summary.remainingAmount;
      if (remaining <= 0) return { ok: false, error: 'Cette commande est déjà intégralement payée.' };
      const res = recordCashPayment({
        restaurantId: order.restaurant_id,
        orderId: order.id,
        cashSessionId: state.cashSessions.find((s) => s.restaurant_id === order.restaurant_id && s.status === 'open')?.id ?? null,
        amount: remaining,
        currency: order.currency,
        paymentMethod: cashMethod,
        paymentContext: order.order_type === 'delivery' ? 'delivery' : order.order_type === 'takeaway' ? 'takeaway' : 'counter',
        referenceCode: referenceCode?.trim() || order.order_number,
        cashierName: 'Administration / Caisse',
        actorRole: 'restaurant_admin',
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    }

    const mappedOrderPayStatus = status === 'refunded' ? 'refunded' : 'unpaid';
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === order.id ? { ...o, payment_status: mappedOrderPayStatus } : o
      ),
    }));
    return { ok: true };
  };

  const createTable: RestoConnectContextValue['createTable'] = (input) => {
    if (!input.tableNumber.trim() || input.capacity <= 0) {
      return { ok: false, error: 'Numéro de table et capacité requis.' };
    }
    const created: RestaurantTableRecord = {
      id: nextId('tbl'),
      restaurant_id: input.restaurantId,
      table_number: input.tableNumber.trim(),
      zone: input.zone.trim() || 'Salle principale',
      capacity: input.capacity,
      qr_code_token: `qr-${slugify(input.tableNumber)}-${Date.now().toString(36).slice(-3)}`,
      status: 'available',
    };
    setState((prev) => ({ ...prev, tables: [...prev.tables, created] }));
    return { ok: true };
  };

  const updateTableStatus: RestoConnectContextValue['updateTableStatus'] = (tableId, status) => {
    setState((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, status } : t)),
    }));
  };

  const createReservation: RestoConnectContextValue['createReservation'] = (input) => {
    if (!input.guestName.trim() || !input.guestPhone.trim() || !input.reservedFor) {
      return { ok: false, error: 'Nom, téléphone et date de réservation requis.' };
    }
    const partySize = Math.max(1, input.partySize);
    const conflictCheck = hasReservationConflict({
      restaurantId: input.restaurantId,
      reservedForIso: input.reservedFor,
      partySize,
      existingReservations: state.reservations,
      tables: state.tables,
    });
    if (conflictCheck.conflict) {
      return { ok: false, error: conflictCheck.reason ?? 'Créneau indisponible.' };
    }

    const created: ReservationRecord = {
      id: nextId('res'),
      restaurant_id: input.restaurantId,
      customer_id: null,
      table_id: conflictCheck.suggestedTableId ?? null,
      guest_name: input.guestName.trim(),
      guest_phone: input.guestPhone.trim(),
      guest_email: input.guestEmail?.trim() || null,
      party_size: partySize,
      reserved_for: input.reservedFor,
      duration_minutes: 90,
      status: 'pending',
      notes: input.notes?.trim() || null,
    };
    setState((prev) => ({ ...prev, reservations: [created, ...prev.reservations] }));
    return { ok: true, reservation: created };
  };

  const updateReservationStatus: RestoConnectContextValue['updateReservationStatus'] = (
    reservationId,
    status
  ) => {
    setState((prev) => ({
      ...prev,
      reservations: prev.reservations.map((r) => (r.id === reservationId ? { ...r, status } : r)),
    }));
  };

  const updateReservationDetails: RestoConnectContextValue['updateReservationDetails'] = (
    reservationId,
    updates
  ) => {
    const existing = state.reservations.find((r) => r.id === reservationId);
    if (!existing) return { ok: false, error: 'Réservation introuvable.' };
    const conflictCheck = hasReservationConflict({
      restaurantId: existing.restaurant_id,
      reservedForIso: updates.reservedFor,
      partySize: Math.max(1, updates.partySize),
      existingReservations: state.reservations,
      tables: state.tables,
      excludeReservationId: reservationId,
    });
    if (conflictCheck.conflict) {
      return { ok: false, error: conflictCheck.reason ?? 'Conflit horaire détecté.' };
    }
    setState((prev) => ({
      ...prev,
      reservations: prev.reservations.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              table_id: updates.tableId ?? conflictCheck.suggestedTableId ?? null,
              party_size: Math.max(1, updates.partySize),
              reserved_for: updates.reservedFor,
              notes: updates.notes?.trim() ?? r.notes,
            }
          : r
      ),
    }));
    return { ok: true };
  };

  // ---------------- PROMPT 05 : INVENTAIRE, RECETTES & FOURNISSEURS ----------------
  const createIngredient: RestoConnectContextValue['createIngredient'] = (input) => {
    if (!input.name.trim() || !input.unit.trim()) {
      return { ok: false, error: 'Nom et unité requis.' };
    }
    const created: IngredientRecord = {
      id: nextId('ing'),
      restaurant_id: input.restaurantId,
      name: input.name.trim(),
      category: input.category ?? 'Ingrédients',
      description: input.description?.trim() || null,
      unit: input.unit.trim(),
      current_stock: Math.max(0, input.currentStock),
      minimum_stock: Math.max(0, input.minimumStock),
      unit_cost: Math.max(0, input.unitCost),
      currency: input.currency ?? 'USD',
      supplier_id: input.supplierId ?? null,
      expiry_date: input.expiryDate || null,
      storage_location: input.storageLocation?.trim() || null,
      is_archived: false,
    };
    setState((prev) => ({ ...prev, ingredients: [created, ...prev.ingredients] }));
    return { ok: true };
  };

  const updateIngredient: RestoConnectContextValue['updateIngredient'] = (ingredientId, updates) => {
    if (updates.name !== undefined && !updates.name.trim()) {
      return { ok: false, error: 'Nom requis.' };
    }
    setState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => (i.id === ingredientId ? { ...i, ...updates } : i)),
    }));
    return { ok: true };
  };

  const archiveIngredient: RestoConnectContextValue['archiveIngredient'] = (ingredientId, archived) => {
    setState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.id === ingredientId ? { ...i, is_archived: archived } : i
      ),
    }));
  };

  const recordInventoryMovement: RestoConnectContextValue['recordInventoryMovement'] = (input) => {
    const ing = state.ingredients.find(
      (i) => i.id === input.ingredientId && i.restaurant_id === input.restaurantId
    );
    if (!ing) return { ok: false, error: 'Ingrédient introuvable.' };
    if (!input.reason.trim()) return { ok: false, error: 'Un motif de mouvement est obligatoire.' };

    const result = applyInventoryMovement(ing.current_stock, input.movementType, input.quantity);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const movement: InventoryMovementRecord = {
      id: nextId('mov'),
      restaurant_id: input.restaurantId,
      ingredient_id: ing.id,
      movement_type: input.movementType,
      quantity: input.quantity,
      unit_cost_snapshot: ing.unit_cost,
      reference_type: 'manual',
      reference_id: null,
      reason: input.reason.trim(),
      performed_by: null,
      performed_by_label: input.performedByLabel ?? 'Équipe Stock',
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.id === ing.id ? { ...i, current_stock: result.nextStock } : i
      ),
      inventoryMovements: [movement, ...prev.inventoryMovements],
    }));

    return { ok: true };
  };

  const saveRecipeForProduct: RestoConnectContextValue['saveRecipeForProduct'] = (input) => {
    if (input.items.length === 0) {
      return { ok: false, error: 'Ajoutez au moins un ingrédient à la fiche recette.' };
    }
    if (input.items.some((i) => i.quantityPerUnit <= 0)) {
      return { ok: false, error: 'Toutes les quantités doivent être strictement positives.' };
    }

    const existing = state.recipes.find(
      (r) => r.restaurant_id === input.restaurantId && r.product_id === input.productId
    );
    const recipeId = existing?.id ?? nextId('rec');

    const recipe: RecipeRecord = {
      id: recipeId,
      restaurant_id: input.restaurantId,
      product_id: input.productId,
      yield_portions: 1,
      notes: input.notes?.trim() || null,
      is_active: true,
    };

    const newLines: RecipeItemRecord[] = input.items.map((i) => ({
      id: nextId('ri'),
      restaurant_id: input.restaurantId,
      recipe_id: recipeId,
      ingredient_id: i.ingredientId,
      quantity_per_unit: i.quantityPerUnit,
      unit: i.unit,
    }));

    setState((prev) => ({
      ...prev,
      recipes: existing
        ? prev.recipes.map((r) => (r.id === recipeId ? recipe : r))
        : [recipe, ...prev.recipes],
      recipeItems: [
        ...prev.recipeItems.filter((ri) => ri.recipe_id !== recipeId),
        ...newLines,
      ],
    }));
    return { ok: true };
  };

  const deleteRecipe: RestoConnectContextValue['deleteRecipe'] = (recipeId) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((r) => r.id !== recipeId),
      recipeItems: prev.recipeItems.filter((ri) => ri.recipe_id !== recipeId),
    }));
  };

  const createSupplier: RestoConnectContextValue['createSupplier'] = (input) => {
    if (!input.name.trim()) return { ok: false, error: 'Raison sociale du fournisseur requise.' };
    const sup: SupplierRecord = {
      id: nextId('sup'),
      restaurant_id: input.restaurantId,
      name: input.name.trim(),
      contact_name: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      category: input.category.trim() || 'Général',
      notes: input.notes?.trim() || null,
      is_archived: false,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, suppliers: [sup, ...prev.suppliers] }));
    return { ok: true };
  };

  const archiveSupplier: RestoConnectContextValue['archiveSupplier'] = (supplierId, archived) => {
    setState((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((s) => (s.id === supplierId ? { ...s, is_archived: archived } : s)),
    }));
  };

  const createPurchaseOrder: RestoConnectContextValue['createPurchaseOrder'] = (input) => {
    const rest = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!rest) return { ok: false, error: 'Établissement introuvable.' };
    if (!input.supplierId || input.items.length === 0) {
      return { ok: false, error: 'Sélectionnez un fournisseur et au moins une ligne.' };
    }
    const validLines = input.items.filter((i) => i.quantityOrdered > 0 && i.unitCost >= 0);
    if (validLines.length === 0) return { ok: false, error: 'Quantités invalides.' };

    const poId = nextId('po');
    const totalAmount = Math.round(
      validLines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0) * 100
    ) / 100;

    const po: PurchaseOrderRecord = {
      id: poId,
      restaurant_id: input.restaurantId,
      supplier_id: input.supplierId,
      order_number: generatePurchaseOrderNumber(state.purchaseOrders.length + 1),
      status: 'ordered',
      order_date: input.orderDate || new Date().toISOString().slice(0, 10),
      expected_date: input.expectedDate || null,
      received_date: null,
      total_amount: totalAmount,
      currency: input.currency,
      exchange_rate_applied: rest.exchange_rate_usd_cdf,
      amount_paid: 0,
      payment_status: 'unpaid',
      attachment_ref: input.attachmentRef?.trim() || null,
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const poItems: PurchaseOrderItemRecord[] = validLines.map((l) => ({
      id: nextId('poi'),
      restaurant_id: input.restaurantId,
      purchase_order_id: poId,
      ingredient_id: l.ingredientId,
      quantity_ordered: l.quantityOrdered,
      quantity_received: 0,
      unit_cost: l.unitCost,
      line_total: Math.round(l.quantityOrdered * l.unitCost * 100) / 100,
    }));

    setState((prev) => ({
      ...prev,
      purchaseOrders: [po, ...prev.purchaseOrders],
      purchaseOrderItems: [...poItems, ...prev.purchaseOrderItems],
    }));

    return { ok: true, po };
  };

  const receivePurchaseOrderItems: RestoConnectContextValue['receivePurchaseOrderItems'] = (
    purchaseOrderId,
    receivedQuantities
  ) => {
    const po = state.purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (!po) return { ok: false, error: "Bon d'approvisionnement introuvable." };

    const check = computePurchaseOrderReception({
      po,
      poItems: state.purchaseOrderItems,
      receivedQuantities,
    });
    if (!check.ok) return { ok: false, error: check.error };

    const now = new Date().toISOString();
    const updMap = new Map(check.itemUpdates.map((u) => [u.itemId, u]));
    const ingDeltaMap = new Map<string, { delta: number; unitCost: number }>();
    for (const u of check.itemUpdates) {
      const prevEntry = ingDeltaMap.get(u.ingredientId);
      ingDeltaMap.set(u.ingredientId, {
        delta: (prevEntry?.delta ?? 0) + u.qtyDelta,
        unitCost: u.unitCost,
      });
    }

    const movements: InventoryMovementRecord[] = check.itemUpdates.map((u) => ({
      id: nextId('mov'),
      restaurant_id: po.restaurant_id,
      ingredient_id: u.ingredientId,
      movement_type: 'purchase_in',
      quantity: u.qtyDelta,
      unit_cost_snapshot: u.unitCost,
      reference_type: 'purchase_order',
      reference_id: po.id,
      reason: `Réception physique ${po.order_number}`,
      performed_by: null,
      performed_by_label: 'Réception Stocks',
      created_at: now,
    }));

    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === po.id
          ? {
              ...p,
              status: check.nextStatus,
              received_date: check.nextStatus === 'received' ? now.slice(0, 10) : p.received_date,
            }
          : p
      ),
      purchaseOrderItems: prev.purchaseOrderItems.map((li) => {
        const u = updMap.get(li.id);
        return u ? { ...li, quantity_received: u.nextReceived } : li;
      }),
      ingredients: prev.ingredients.map((ing) => {
        const d = ingDeltaMap.get(ing.id);
        return d
          ? {
              ...ing,
              current_stock: Math.round((ing.current_stock + d.delta) * 1000) / 1000,
              unit_cost: d.unitCost > 0 ? d.unitCost : ing.unit_cost,
            }
          : ing;
      }),
      inventoryMovements: [...movements, ...prev.inventoryMovements],
    }));

    return { ok: true };
  };

  const recordPurchaseOrderPayment: RestoConnectContextValue['recordPurchaseOrderPayment'] = (
    purchaseOrderId,
    amountPaidDelta
  ) => {
    const po = state.purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (!po) return { ok: false, error: 'Bon introuvable.' };
    if (!Number.isFinite(amountPaidDelta) || amountPaidDelta <= 0) {
      return { ok: false, error: 'Montant réglé invalide.' };
    }
    const nextPaid = Math.min(po.total_amount, Math.round((po.amount_paid + amountPaidDelta) * 100) / 100);
    const nextPayStatus: PurchaseOrderRecord['payment_status'] =
      nextPaid >= po.total_amount - 0.01 ? 'paid' : nextPaid > 0 ? 'partial' : 'unpaid';

    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === po.id ? { ...p, amount_paid: nextPaid, payment_status: nextPayStatus } : p
      ),
    }));
    return { ok: true };
  };

  const cancelPurchaseOrder: RestoConnectContextValue['cancelPurchaseOrder'] = (purchaseOrderId) => {
    const po = state.purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (!po) return { ok: false, error: 'Bon introuvable.' };
    if (po.status === 'received' || po.status === 'partially_received') {
      return { ok: false, error: 'Impossible d’annuler un bon ayant déjà fait l’objet d’une réception en stock.' };
    }
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === po.id ? { ...p, status: 'cancelled' } : p
      ),
    }));
    return { ok: true };
  };

  // ---------------- PROMPT 05 : RH, PRÉSENCES, CONGÉS, PAIE, FINANCES ----------------
  const createEmployee: RestoConnectContextValue['createEmployee'] = (input) => {
    if (!input.fullName.trim() || !input.jobTitle.trim() || !input.email.trim()) {
      return { ok: false, error: 'Nom, poste et e-mail professionnel requis.' };
    }
    const rest = state.restaurants.find((r) => r.id === input.restaurantId);
    const invitationCode = `RC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const memberId = nextId('mem');
    const member: StaffMemberAssignment = {
      id: memberId,
      restaurant_id: input.restaurantId,
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      role_code: input.roleCode,
      status: 'invited',
      invitation_code: invitationCode,
      last_reset_requested_at: null,
    };
    const emp: EmployeeRecord = {
      id: nextId('emp'),
      restaurant_id: input.restaurantId,
      member_id: memberId,
      full_name: input.fullName.trim(),
      job_title: input.jobTitle.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim(),
      address: input.address?.trim() || null,
      hire_date: new Date().toISOString().slice(0, 10),
      contract_type: input.contractType,
      salary_amount: Math.max(0, input.salaryAmount ?? 0),
      salary_currency: input.salaryCurrency ?? rest?.default_currency ?? 'USD',
      employment_status: 'active',
      is_active: true,
    };
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      members: [member, ...prev.members],
      employees: [emp, ...prev.employees],
      userActivityLogs: [
        {
          id: nextId('ua'),
          restaurant_id: input.restaurantId,
          actor_name: emp.full_name,
          action: `Collaborateur ajouté (${input.roleCode})`,
          created_at: now,
        },
        ...prev.userActivityLogs,
      ],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: 'Admin Restaurant',
        action: 'CREATE_EMPLOYEE',
        entity_table: 'employees',
        entity_id: emp.id,
        new_data: { full_name: emp.full_name, role_code: input.roleCode },
      }),
    }));
    return { ok: true, invitationCode };
  };

  const updateEmployeeDetails: RestoConnectContextValue['updateEmployeeDetails'] = (
    employeeId,
    updates
  ) => {
    const emp = state.employees.find((e) => e.id === employeeId);
    if (!emp) return { ok: false, error: 'Collaborateur introuvable.' };
    if (!updates.fullName.trim() || !updates.jobTitle.trim()) {
      return { ok: false, error: 'Nom et poste requis.' };
    }
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) =>
        e.id === employeeId
          ? {
              ...e,
              full_name: updates.fullName.trim(),
              job_title: updates.jobTitle.trim(),
              phone: updates.phone.trim() || null,
              email: updates.email.trim() || e.email,
              address: updates.address?.trim() ?? e.address,
              contract_type: updates.contractType,
              salary_amount: updates.salaryAmount ?? e.salary_amount,
              salary_currency: updates.salaryCurrency ?? e.salary_currency,
              employment_status: updates.employmentStatus ?? e.employment_status,
            }
          : e
      ),
      members: prev.members.map((m) =>
        m.id === emp.member_id
          ? {
              ...m,
              full_name: updates.fullName.trim(),
              email: updates.email.trim() || m.email,
              role_code: updates.roleCode,
            }
          : m
      ),
      userActivityLogs: [
        {
          id: nextId('ua'),
          restaurant_id: emp.restaurant_id,
          actor_name: updates.fullName.trim(),
          action: `Fiche et rôle mis à jour (${updates.roleCode})`,
          created_at: now,
        },
        ...prev.userActivityLogs,
      ],
      auditLogs: appendAudit(prev, {
        restaurant_id: emp.restaurant_id,
        actor_label: 'Admin Restaurant',
        action: 'UPDATE_EMPLOYEE_ROLE',
        entity_table: 'employees',
        entity_id: employeeId,
        new_data: { role_code: updates.roleCode, job_title: updates.jobTitle },
      }),
    }));
    return { ok: true };
  };

  const toggleEmployeeActive: RestoConnectContextValue['toggleEmployeeActive'] = (employeeId) => {
    const target = state.employees.find((e) => e.id === employeeId);
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) =>
        e.id === employeeId
          ? {
              ...e,
              is_active: !e.is_active,
              employment_status: !e.is_active ? 'active' : 'suspended',
            }
          : e
      ),
      members: target?.member_id
        ? prev.members.map((m) =>
            m.id === target.member_id
              ? { ...m, status: target.is_active ? 'suspended' : 'active' }
              : m
          )
        : prev.members,
      userActivityLogs: target
        ? [
            {
              id: nextId('ua'),
              restaurant_id: target.restaurant_id,
              actor_name: target.full_name,
              action: target.is_active ? 'Accès désactivé' : 'Accès réactivé',
              created_at: now,
            },
            ...prev.userActivityLogs,
          ]
        : prev.userActivityLogs,
    }));
  };

  const recordCheckIn: RestoConnectContextValue['recordCheckIn'] = (input) => {
    if (
      (input.status === 'present' || input.status === 'late') &&
      hasDuplicateCheckIn(state.attendanceRecords, input.restaurantId, input.employeeId, input.attendanceDate)
    ) {
      return { ok: false, error: 'Cet employé a déjà un pointage d’entrée enregistré pour cette date.' };
    }
    const existingForDate = state.attendanceRecords.find(
      (a) =>
        a.restaurant_id === input.restaurantId &&
        a.employee_id === input.employeeId &&
        a.attendance_date === input.attendanceDate
    );
    if (existingForDate) {
      return { ok: false, error: 'Une fiche de présence existe déjà pour cet employé à cette date.' };
    }
    const now = new Date().toISOString();
    const rec: AttendanceRecord = {
      id: nextId('att'),
      restaurant_id: input.restaurantId,
      employee_id: input.employeeId,
      attendance_date: input.attendanceDate,
      check_in_at: input.status === 'absent' || input.status === 'leave' ? null : now,
      check_out_at: null,
      status: input.status,
      delay_minutes: Math.max(0, input.delayMinutes ?? 0),
      note: input.note?.trim() || null,
      created_at: now,
    };
    setState((prev) => ({ ...prev, attendanceRecords: [rec, ...prev.attendanceRecords] }));
    return { ok: true };
  };

  const recordCheckOut: RestoConnectContextValue['recordCheckOut'] = (attendanceId) => {
    const target = state.attendanceRecords.find((a) => a.id === attendanceId);
    if (!target) return { ok: false, error: 'Pointage introuvable.' };
    if (!target.check_in_at) return { ok: false, error: "Aucune heure d'arrivée enregistrée." };
    if (target.check_out_at) return { ok: false, error: 'Sortie déjà pointée.' };
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.map((a) =>
        a.id === attendanceId ? { ...a, check_out_at: now } : a
      ),
    }));
    return { ok: true };
  };

  const createLeaveRequest: RestoConnectContextValue['createLeaveRequest'] = (input) => {
    if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
      return { ok: false, error: 'Dates de congé invalides.' };
    }
    const lr: LeaveRequestRecord = {
      id: nextId('lv'),
      restaurant_id: input.restaurantId,
      employee_id: input.employeeId,
      start_date: input.startDate,
      end_date: input.endDate,
      leave_type: input.leaveType.trim() || 'Congé annuel',
      reason: input.reason?.trim() || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, leaveRequests: [lr, ...prev.leaveRequests] }));
    return { ok: true };
  };

  const updateLeaveStatus: RestoConnectContextValue['updateLeaveStatus'] = (leaveId, status) => {
    setState((prev) => ({
      ...prev,
      leaveRequests: prev.leaveRequests.map((l) => (l.id === leaveId ? { ...l, status } : l)),
    }));
  };

  const generatePayrollRecord: RestoConnectContextValue['generatePayrollRecord'] = (input) => {
    const rest = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!rest) return { ok: false, error: 'Établissement introuvable.' };
    const netCheck = computePayrollNet({
      baseSalary: input.baseSalary,
      bonuses: input.bonuses,
      advances: input.advances,
      deductions: input.deductions,
    });
    if (!netCheck.ok) return { ok: false, error: netCheck.error };

    const rec: PayrollRecord = {
      id: nextId('payr'),
      restaurant_id: input.restaurantId,
      employee_id: input.employeeId,
      period_label: input.periodLabel.trim(),
      period_start: input.periodStart,
      period_end: input.periodEnd,
      base_salary: Math.max(0, input.baseSalary),
      bonuses: Math.max(0, input.bonuses),
      advances: Math.max(0, input.advances),
      deductions: Math.max(0, input.deductions),
      net_salary: netCheck.netSalary,
      currency: input.currency,
      exchange_rate_applied: rest.exchange_rate_usd_cdf,
      status: 'validated',
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, payrollRecords: [rec, ...prev.payrollRecords] }));
    return { ok: true, payroll: rec };
  };

  const recordSalaryPayment: RestoConnectContextValue['recordSalaryPayment'] = (input) => {
    const payroll = state.payrollRecords.find(
      (p) => p.id === input.payrollId && p.restaurant_id === input.restaurantId
    );
    if (!payroll) return { ok: false, error: 'Fiche de paie introuvable.' };
    if (!input.referenceCode.trim()) return { ok: false, error: 'Référence de justificatif requise.' };
    if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
      return { ok: false, error: 'Montant versé invalide.' };
    }
    const alreadyPaid = state.salaryPayments
      .filter((sp) => sp.payroll_id === payroll.id)
      .reduce((sum, sp) => sum + sp.amount_paid, 0);
    if (alreadyPaid + input.amountPaid > payroll.net_salary + 0.01) {
      return { ok: false, error: `Le cumul versé dépasserait le salaire net (${payroll.net_salary} ${payroll.currency}).` };
    }

    const now = new Date().toISOString();
    const sp: SalaryPaymentRecord = {
      id: nextId('salp'),
      restaurant_id: input.restaurantId,
      payroll_id: payroll.id,
      employee_id: payroll.employee_id,
      amount_paid: input.amountPaid,
      currency: payroll.currency,
      payment_method: input.paymentMethod,
      reference_code: input.referenceCode.trim(),
      paid_at: now,
      notes: input.notes?.trim() || null,
    };

    const isFullyPaid = alreadyPaid + input.amountPaid >= payroll.net_salary - 0.01;
    setState((prev) => ({
      ...prev,
      salaryPayments: [sp, ...prev.salaryPayments],
      payrollRecords: prev.payrollRecords.map((p) =>
        p.id === payroll.id ? { ...p, status: isFullyPaid ? 'paid' : p.status } : p
      ),
    }));
    return { ok: true };
  };

  const getRoleMatrixForTenant = useCallback(
    (restaurantId: string): RolePermissionMatrix => {
      return state.roleMatrixByTenant[restaurantId] ?? DEFAULT_ROLE_MATRIX;
    },
    [state.roleMatrixByTenant]
  );

  const updateRolePermission: RestoConnectContextValue['updateRolePermission'] = (
    restaurantId,
    role,
    moduleKey,
    action,
    allowed
  ) => {
    if (role === 'restaurant_admin') return;
    setState((prev) => {
      const current = prev.roleMatrixByTenant[restaurantId] ?? DEFAULT_ROLE_MATRIX;
      const nextMatrix: RolePermissionMatrix = {
        ...current,
        [role]: {
          ...current[role],
          [moduleKey]: {
            ...current[role][moduleKey],
            [action]: allowed,
          },
        },
      };
      return {
        ...prev,
        roleMatrixByTenant: {
          ...prev.roleMatrixByTenant,
          [restaurantId]: nextMatrix,
        },
        auditLogs: appendAudit(prev, {
          restaurant_id: restaurantId,
          actor_label: 'Admin Restaurant',
          action: 'UPDATE_RBAC_MATRIX',
          entity_table: 'role_permissions',
          entity_id: `${restaurantId}:${role}:${moduleKey}`,
          new_data: { role, module: moduleKey, action, allowed },
        }),
      };
    });
  };

  const createCustomer: RestoConnectContextValue['createCustomer'] = (input) => {
    if (!input.fullName.trim() || !input.phone.trim()) {
      return { ok: false, error: 'Nom et téléphone du client requis.' };
    }
    const created: CustomerRecord = {
      id: nextId('cust'),
      restaurant_id: input.restaurantId,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
    };
    setState((prev) => ({ ...prev, customers: [created, ...prev.customers] }));
    return { ok: true };
  };

  const createCashRegister: RestoConnectContextValue['createCashRegister'] = (input) => {
    if (!input.name.trim() || !input.code.trim()) {
      return { ok: false, error: 'Nom et code de caisse requis.' };
    }
    const created: CashRegisterRecord = {
      id: nextId('reg'),
      restaurant_id: input.restaurantId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      cashRegisters: [...prev.cashRegisters, created],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: 'Admin Restaurant',
        action: 'CREATE_CASH_REGISTER',
        entity_table: 'cash_registers',
        entity_id: created.id,
        new_data: { name: created.name, code: created.code },
      }),
    }));
    return { ok: true, register: created };
  };

  const openCashSession: RestoConnectContextValue['openCashSession'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'cash.open')) {
      return { ok: false, error: "Permission refusée : vous n'êtes pas autorisé à ouvrir une caisse." };
    }
    const rest = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!rest) return { ok: false, error: 'Établissement introuvable.' };
    const reg = state.cashRegisters.find(
      (r) => r.id === input.cashRegisterId && r.restaurant_id === input.restaurantId && r.is_active
    );
    if (!reg) return { ok: false, error: 'Caisse introuvable ou inactive pour ce restaurant.' };

    const alreadyOpen = state.cashSessions.find(
      (s) =>
        s.restaurant_id === input.restaurantId &&
        s.cash_register_id === input.cashRegisterId &&
        s.status === 'open'
    );
    if (alreadyOpen) {
      return {
        ok: false,
        error: `La caisse « ${reg.name} » possède déjà une session ouverte par ${alreadyOpen.cashier_name}.`,
      };
    }

    if (
      !Number.isFinite(input.openingAmountUsd) ||
      input.openingAmountUsd < 0 ||
      !Number.isFinite(input.openingAmountCdf) ||
      input.openingAmountCdf < 0
    ) {
      return { ok: false, error: 'Les fonds de caisse initiaux doivent être positifs ou nuls.' };
    }

    const now = new Date().toISOString();
    const session: CashSessionRecord = {
      id: nextId('sess'),
      restaurant_id: input.restaurantId,
      cash_register_id: input.cashRegisterId,
      cashier_profile_id: null,
      cashier_name: input.cashierName.trim() || 'Caissier',
      opening_amount_usd: Math.round(input.openingAmountUsd * 100) / 100,
      opening_amount_cdf: Math.round(input.openingAmountCdf),
      primary_currency: rest.default_currency,
      status: 'open',
      opened_at: now,
      closed_at: null,
      notes: input.notes?.trim() || null,
    };

    setState((prev) => ({
      ...prev,
      cashSessions: [session, ...prev.cashSessions],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: session.cashier_name,
        action: 'OPEN_CASH_SESSION',
        entity_table: 'cash_sessions',
        entity_id: session.id,
        new_data: {
          register: reg.name,
          opening_usd: session.opening_amount_usd,
          opening_cdf: session.opening_amount_cdf,
        },
      }),
    }));
    return { ok: true, session };
  };

  const recordCashMovement: RestoConnectContextValue['recordCashMovement'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'payments.collect')) {
      return { ok: false, error: 'Permission insuffisante pour enregistrer un mouvement de caisse.' };
    }
    const session = state.cashSessions.find(
      (s) => s.id === input.cashSessionId && s.restaurant_id === input.restaurantId
    );
    if (!session || session.status !== 'open') {
      return { ok: false, error: 'Aucune session de caisse ouverte correspondante.' };
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: 'Le montant du mouvement doit être strictement positif.' };
    }
    if (!input.reason.trim()) {
      return { ok: false, error: 'Un motif justificatif est obligatoire pour tout mouvement de caisse.' };
    }

    const movement: CashMovementRecord = {
      id: nextId('cmov'),
      restaurant_id: input.restaurantId,
      cash_session_id: session.id,
      movement_type: input.movementType,
      amount: input.currency === 'CDF' ? Math.round(input.amount) : Math.round(input.amount * 100) / 100,
      currency: input.currency,
      reason: input.reason.trim(),
      performed_by_label: input.actorName.trim() || 'Caissier',
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      cashMovements: [movement, ...prev.cashMovements],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: movement.performed_by_label,
        action: input.movementType === 'in' ? 'CASH_MOVEMENT_IN' : 'CASH_MOVEMENT_OUT',
        entity_table: 'cash_movements',
        entity_id: movement.id,
        new_data: { amount: movement.amount, currency: movement.currency, reason: movement.reason },
      }),
    }));
    return { ok: true, movement };
  };

  const recordCashPayment: RestoConnectContextValue['recordCashPayment'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'payments.collect')) {
      return { ok: false, error: "Permission refusée : vous n'êtes pas autorisé à encaisser." };
    }
    const restaurant = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!restaurant) return { ok: false, error: 'Établissement introuvable.' };
    const order = state.orders.find(
      (o) => o.id === input.orderId && o.restaurant_id === input.restaurantId
    );
    if (!order) return { ok: false, error: 'Commande introuvable pour cet établissement.' };

    const activeSession = input.cashSessionId
      ? state.cashSessions.find(
          (s) => s.id === input.cashSessionId && s.restaurant_id === input.restaurantId
        ) ?? null
      : null;

    const validation = validateOrderPaymentInput({
      restaurant,
      order,
      paymentTransactions: state.paymentTransactions,
      refunds: state.refunds,
      activeSession,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      paymentContext: input.paymentContext,
      referenceCode: input.referenceCode,
      requireOpenSession: Boolean(input.cashSessionId),
    });

    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const txId = nextId('txn');
    const payId = nextId('pay');
    const txSeq = String(state.paymentTransactions.length + 1).padStart(4, '0');
    const recSeq = String(state.receipts.length + 1).padStart(4, '0');
    const txNumber = `TXN-${txSeq}`;
    const receiptNumber = `REC-${recSeq}`;
    const normalizedAmount =
      input.currency === 'CDF' ? Math.round(input.amount) : Math.round(input.amount * 100) / 100;

    const tx: PaymentTransactionRecord = {
      id: txId,
      restaurant_id: restaurant.id,
      order_id: order.id,
      cash_session_id: activeSession?.id ?? null,
      payment_id: payId,
      transaction_number: txNumber,
      amount: normalizedAmount,
      currency: input.currency,
      exchange_rate_applied: validation.exchangeRateApplied,
      converted_amount_order_currency: validation.convertedAmountOrderCurrency,
      order_currency: order.currency,
      payment_method: input.paymentMethod,
      payment_context: input.paymentContext,
      status: 'confirmed',
      reference_code: input.referenceCode?.trim() || txNumber,
      note: input.note?.trim() || null,
      void_or_correction_reason: null,
      cashier_name: input.cashierName.trim() || 'Caissier',
      paid_at: now,
      created_at: now,
    };

    const mappedLegacyMethod: PaymentRecord['payment_method'] =
      input.paymentMethod === 'cash_usd' || input.paymentMethod === 'cash_cdf'
        ? 'cash'
        : input.paymentMethod;

    const canonicalPayment: PaymentRecord = {
      id: payId,
      restaurant_id: restaurant.id,
      order_id: order.id,
      license_id: null,
      payment_scope: 'order',
      amount: normalizedAmount,
      currency: input.currency,
      exchange_rate_applied: validation.exchangeRateApplied,
      payment_method: mappedLegacyMethod,
      status: 'confirmed',
      reference_code: tx.reference_code,
      admin_comment: `${PAYMENT_CONTEXT_LABELS[input.paymentContext]} · ${txNumber}`,
      verified_at: now,
      recorded_by: tx.cashier_name,
      paid_at: now,
      created_at: now,
    };

    const itemsForOrder = state.orderItems.filter((oi) => oi.order_id === order.id);
    const receipt: ReceiptRecord = {
      id: nextId('recp'),
      restaurant_id: restaurant.id,
      order_id: order.id,
      payment_transaction_id: tx.id,
      receipt_number: receiptNumber,
      receipt_type: validation.isPartial ? 'partial' : 'standard',
      cashier_name: tx.cashier_name,
      issued_at: now,
      created_at: now,
      snapshot_json: {
        restaurantName: restaurant.name,
        restaurantLogoUrl: restaurant.logo_url,
        restaurantAddress: [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(', ') || null,
        restaurantPhone: restaurant.phone,
        receiptNumber,
        orderNumber: order.order_number,
        orderType: order.order_type,
        issuedAt: now,
        customerName: order.customer_name?.trim() || 'Client comptoir',
        customerPhone: order.customer_phone ?? null,
        lines: itemsForOrder.map((oi) => ({
          productName: oi.product_name_snapshot ?? oi.product_id,
          quantity: oi.quantity,
          unitPrice: oi.unit_price_snapshot ?? oi.unit_price,
          optionsSummary: oi.options_summary ?? null,
          lineTotal: oi.line_total,
        })),
        subtotal: order.subtotal,
        deliveryFee: order.delivery_fee ?? 0,
        totalAmount: order.total_amount,
        amountPaidThisReceipt: normalizedAmount,
        paymentCurrency: input.currency,
        exchangeRateApplied: validation.exchangeRateApplied,
        totalPaidOrderCurrency: validation.nextPaidAmount,
        remainingBalanceOrderCurrency: validation.nextRemainingAmount,
        orderCurrency: order.currency,
        paymentMethodLabel: getPaymentMethodLabel(
          input.paymentMethod,
          restaurant.custom_payment_method_label
        ),
        paymentContextLabel: PAYMENT_CONTEXT_LABELS[input.paymentContext],
        cashierName: tx.cashier_name,
        isPartialPayment: validation.isPartial,
      },
    };

    setState((prev) => ({
      ...prev,
      paymentTransactions: [tx, ...prev.paymentTransactions],
      payments: [canonicalPayment, ...prev.payments],
      receipts: [receipt, ...prev.receipts],
      orders: prev.orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              paid_amount: validation.nextPaidAmount,
              payment_status: validation.nextPaymentStatus,
              payment_method: input.paymentMethod,
            }
          : o
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: restaurant.id,
        actor_label: tx.cashier_name,
        action: validation.isPartial ? 'RECORD_PARTIAL_CASH_PAYMENT' : 'RECORD_FULL_CASH_PAYMENT',
        entity_table: 'payment_transactions',
        entity_id: tx.id,
        new_data: {
          transaction_number: txNumber,
          order_number: order.order_number,
          amount: normalizedAmount,
          currency: input.currency,
          exchange_rate_applied: validation.exchangeRateApplied,
          next_status: validation.nextPaymentStatus,
        },
      }),
    }));

    return { ok: true, transaction: tx, receipt };
  };

  const voidOrCorrectPaymentTransaction: RestoConnectContextValue['voidOrCorrectPaymentTransaction'] = (
    input
  ) => {
    if (!hasRolePermission(input.actorRole, 'cash.correct')) {
      return {
        ok: false,
        error: 'Action réservée aux responsables autorisés (permission cash.correct requise).',
      };
    }
    if (!input.reason.trim()) {
      return { ok: false, error: 'Un motif justificatif est obligatoire pour annuler ou corriger un encaissement.' };
    }
    const tx = state.paymentTransactions.find(
      (t) => t.id === input.transactionId && t.restaurant_id === input.restaurantId
    );
    if (!tx) return { ok: false, error: 'Transaction introuvable.' };
    if (tx.status !== 'confirmed') {
      return { ok: false, error: 'Cette transaction a déjà été corrigée ou annulée.' };
    }
    const hasRefunds = state.refunds.some((r) => r.payment_transaction_id === tx.id);
    if (hasRefunds) {
      return {
        ok: false,
        error: 'Impossible d’annuler une transaction ayant déjà fait l’objet d’un remboursement.',
      };
    }

    const updatedTxs = state.paymentTransactions.map((t) =>
      t.id === tx.id
        ? { ...t, status: 'voided' as const, void_or_correction_reason: input.reason.trim() }
        : t
    );

    const order = state.orders.find((o) => o.id === tx.order_id);
    const recalculated = order
      ? calculateOrderPaymentSummary(order, updatedTxs, state.refunds)
      : null;

    setState((prev) => ({
      ...prev,
      paymentTransactions: updatedTxs,
      payments: tx.payment_id
        ? prev.payments.map((p) =>
            p.id === tx.payment_id
              ? { ...p, status: 'rejected', admin_comment: `Annulé (${input.reason.trim()})` }
              : p
          )
        : prev.payments,
      orders:
        order && recalculated
          ? prev.orders.map((o) =>
              o.id === order.id
                ? {
                    ...o,
                    paid_amount: recalculated.paidAmount,
                    payment_status: recalculated.paymentStatus,
                  }
                : o
            )
          : prev.orders,
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: input.actorName.trim() || 'Manager',
        action: 'VOID_PAYMENT_TRANSACTION',
        entity_table: 'payment_transactions',
        entity_id: tx.id,
        new_data: { transaction_number: tx.transaction_number, reason: input.reason.trim() },
      }),
    }));
    return { ok: true };
  };

  const recordRefund: RestoConnectContextValue['recordRefund'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'payments.refund')) {
      return {
        ok: false,
        error: 'Permission refusée : seul un responsable autorisé (payments.refund) peut effectuer un remboursement.',
      };
    }
    const restaurant = state.restaurants.find((r) => r.id === input.restaurantId);
    if (!restaurant) return { ok: false, error: 'Établissement introuvable.' };
    const order = state.orders.find(
      (o) => o.id === input.orderId && o.restaurant_id === input.restaurantId
    );
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    const tx = state.paymentTransactions.find(
      (t) =>
        t.id === input.paymentTransactionId &&
        t.restaurant_id === input.restaurantId &&
        t.order_id === order.id
    );
    if (!tx) return { ok: false, error: 'Transaction d’origine introuvable.' };

    const check = validateRefundInput({
      restaurant,
      order,
      transaction: tx,
      existingTransactions: state.paymentTransactions,
      existingRefunds: state.refunds,
      amount: input.amount,
      reason: input.reason,
    });
    if (!check.ok) return { ok: false, error: check.error };

    const now = new Date().toISOString();
    const refSeq = String(state.refunds.length + 1).padStart(4, '0');
    const recSeq = String(state.receipts.length + 1).padStart(4, '0');
    const refundNumber = `RMB-${refSeq}`;
    const receiptNumber = `REC-${recSeq}`;
    const normalizedAmt =
      check.currency === 'CDF' ? Math.round(input.amount) : Math.round(input.amount * 100) / 100;

    const refund: RefundRecord = {
      id: nextId('ref'),
      restaurant_id: restaurant.id,
      order_id: order.id,
      payment_transaction_id: tx.id,
      cash_session_id: input.cashSessionId ?? tx.cash_session_id,
      refund_number: refundNumber,
      amount: normalizedAmt,
      currency: check.currency,
      exchange_rate_applied: check.exchangeRateApplied,
      converted_amount_order_currency: check.convertedAmountOrderCurrency,
      refund_method: input.refundMethod,
      reason: input.reason.trim(),
      responsible_name: input.responsibleName.trim() || 'Manager',
      refunded_at: now,
      created_at: now,
    };

    const nextRefunds = [refund, ...state.refunds];
    const nextSummary = calculateOrderPaymentSummary(order, state.paymentTransactions, nextRefunds);

    const itemsForOrder = state.orderItems.filter((oi) => oi.order_id === order.id);
    const receipt: ReceiptRecord = {
      id: nextId('recp'),
      restaurant_id: restaurant.id,
      order_id: order.id,
      payment_transaction_id: tx.id,
      receipt_number: receiptNumber,
      receipt_type: 'refund',
      cashier_name: refund.responsible_name,
      issued_at: now,
      created_at: now,
      snapshot_json: {
        restaurantName: restaurant.name,
        restaurantLogoUrl: restaurant.logo_url,
        restaurantAddress: [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(', ') || null,
        restaurantPhone: restaurant.phone,
        receiptNumber,
        orderNumber: order.order_number,
        orderType: order.order_type,
        issuedAt: now,
        customerName: order.customer_name?.trim() || 'Client comptoir',
        customerPhone: order.customer_phone ?? null,
        lines: itemsForOrder.map((oi) => ({
          productName: oi.product_name_snapshot ?? oi.product_id,
          quantity: oi.quantity,
          unitPrice: oi.unit_price_snapshot ?? oi.unit_price,
          optionsSummary: oi.options_summary ?? null,
          lineTotal: oi.line_total,
        })),
        subtotal: order.subtotal,
        deliveryFee: order.delivery_fee ?? 0,
        totalAmount: order.total_amount,
        amountPaidThisReceipt: normalizedAmt,
        paymentCurrency: check.currency,
        exchangeRateApplied: check.exchangeRateApplied,
        totalPaidOrderCurrency: nextSummary.netPaidAmount,
        remainingBalanceOrderCurrency: nextSummary.remainingAmount,
        orderCurrency: order.currency,
        paymentMethodLabel: getPaymentMethodLabel(
          input.refundMethod,
          restaurant.custom_payment_method_label
        ),
        paymentContextLabel: 'Remboursement caisse',
        cashierName: refund.responsible_name,
        isPartialPayment: false,
        isRefundReceipt: true,
        refundReason: refund.reason,
      },
    };

    setState((prev) => {
      // Synchronisation sans double comptage dans public.payments
      let updatedPayments = prev.payments;
      if (tx.payment_id) {
        const linkedPay = prev.payments.find((p) => p.id === tx.payment_id);
        if (linkedPay) {
          const remainingOnPay =
            check.currency === 'CDF'
              ? Math.round(linkedPay.amount - normalizedAmt)
              : Math.round((linkedPay.amount - normalizedAmt) * 100) / 100;
          if (remainingOnPay <= (check.currency === 'CDF' ? 1 : 0.01)) {
            updatedPayments = prev.payments.map((p) =>
              p.id === linkedPay.id
                ? { ...p, status: 'refunded', admin_comment: `Remboursé : ${refund.reason}` }
                : p
            );
          } else {
            const refundSummaryPay: PaymentRecord = {
              ...linkedPay,
              id: nextId('payref'),
              amount: normalizedAmt,
              status: 'refunded',
              reference_code: refundNumber,
              admin_comment: `Remboursement partiel : ${refund.reason}`,
              created_at: now,
            };
            updatedPayments = [
              refundSummaryPay,
              ...prev.payments.map((p) =>
                p.id === linkedPay.id ? { ...p, amount: remainingOnPay } : p
              ),
            ];
          }
        }
      }

      return {
        ...prev,
        refunds: nextRefunds,
        receipts: [receipt, ...prev.receipts],
        payments: updatedPayments,
        orders: prev.orders.map((o) =>
          o.id === order.id
            ? {
                ...o,
                paid_amount: nextSummary.netPaidAmount,
                payment_status: nextSummary.paymentStatus,
              }
            : o
        ),
        auditLogs: appendAudit(prev, {
          restaurant_id: restaurant.id,
          actor_label: refund.responsible_name,
          action: 'RECORD_REFUND',
          entity_table: 'refunds',
          entity_id: refund.id,
          new_data: {
            refund_number: refundNumber,
            order_number: order.order_number,
            amount: normalizedAmt,
            currency: check.currency,
            reason: refund.reason,
          },
        }),
      };
    });

    return { ok: true, refund, receipt };
  };

  const closeCashSession: RestoConnectContextValue['closeCashSession'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'cash.close')) {
      return { ok: false, error: "Permission refusée : vous n'êtes pas autorisé à clôturer une caisse." };
    }
    const session = state.cashSessions.find(
      (s) => s.id === input.cashSessionId && s.restaurant_id === input.restaurantId
    );
    if (!session) return { ok: false, error: 'Session de caisse introuvable.' };
    if (session.status !== 'open') {
      return { ok: false, error: 'Cette session est déjà clôturée et verrouillée.' };
    }
    if (
      !Number.isFinite(input.countedUsd) ||
      input.countedUsd < 0 ||
      !Number.isFinite(input.countedCdf) ||
      input.countedCdf < 0
    ) {
      return { ok: false, error: 'Les montants comptés en caisse doivent être positifs ou nuls.' };
    }

    const summary = computeCashSessionSummary({
      session,
      transactions: state.paymentTransactions,
      movements: state.cashMovements,
      refunds: state.refunds,
    });
    const evalRes = evaluateClosureDiscrepancy({
      expectedUsd: summary.expectedCashUsd,
      expectedCdf: summary.expectedCashCdf,
      countedUsd: input.countedUsd,
      countedCdf: input.countedCdf,
    });

    const now = new Date().toISOString();
    const closure: CashClosureRecord = {
      id: nextId('clos'),
      restaurant_id: input.restaurantId,
      cash_session_id: session.id,
      cash_register_id: session.cash_register_id,
      cashier_name: session.cashier_name,
      expected_usd: summary.expectedCashUsd,
      expected_cdf: summary.expectedCashCdf,
      counted_usd: Math.round(input.countedUsd * 100) / 100,
      counted_cdf: Math.round(input.countedCdf),
      discrepancy_usd: evalRes.discrepancyUsd,
      discrepancy_cdf: evalRes.discrepancyCdf,
      non_cash_mobile_money_usd: summary.nonCashMobileMoneyUsd,
      non_cash_mobile_money_cdf: summary.nonCashMobileMoneyCdf,
      non_cash_card_usd: summary.nonCashCardUsd,
      non_cash_card_cdf: summary.nonCashCardCdf,
      non_cash_other_usd: summary.nonCashOtherUsd,
      non_cash_other_cdf: summary.nonCashOtherCdf,
      status: evalRes.status,
      notes: input.notes?.trim() || null,
      is_locked: true,
      validated_by_name: input.actorName.trim() || session.cashier_name,
      correction_reason: null,
      closed_at: now,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      cashClosures: [closure, ...prev.cashClosures],
      cashSessions: prev.cashSessions.map((s) =>
        s.id === session.id ? { ...s, status: evalRes.status, closed_at: now } : s
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: closure.validated_by_name,
        action:
          evalRes.status === 'closed_with_discrepancy'
            ? 'CLOSE_CASH_SESSION_WITH_DISCREPANCY'
            : 'CLOSE_CASH_SESSION',
        entity_table: 'cash_closures',
        entity_id: closure.id,
        new_data: {
          expected_usd: closure.expected_usd,
          counted_usd: closure.counted_usd,
          discrepancy_usd: closure.discrepancy_usd,
          expected_cdf: closure.expected_cdf,
          counted_cdf: closure.counted_cdf,
          discrepancy_cdf: closure.discrepancy_cdf,
        },
      }),
    }));
    return { ok: true, closure };
  };

  const adjustLockedClosure: RestoConnectContextValue['adjustLockedClosure'] = (input) => {
    if (!hasRolePermission(input.actorRole, 'cash.correct')) {
      return { ok: false, error: 'Permission cash.correct requise pour rectifier une clôture verrouillée.' };
    }
    if (!input.correctionReason.trim()) {
      return { ok: false, error: 'Un motif de rectification est obligatoire.' };
    }
    const closure = state.cashClosures.find(
      (c) => c.id === input.closureId && c.restaurant_id === input.restaurantId
    );
    if (!closure) return { ok: false, error: 'Clôture introuvable.' };

    const evalRes = evaluateClosureDiscrepancy({
      expectedUsd: closure.expected_usd,
      expectedCdf: closure.expected_cdf,
      countedUsd: input.countedUsd,
      countedCdf: input.countedCdf,
    });

    setState((prev) => ({
      ...prev,
      cashClosures: prev.cashClosures.map((c) =>
        c.id === closure.id
          ? {
              ...c,
              counted_usd: Math.round(input.countedUsd * 100) / 100,
              counted_cdf: Math.round(input.countedCdf),
              discrepancy_usd: evalRes.discrepancyUsd,
              discrepancy_cdf: evalRes.discrepancyCdf,
              status: evalRes.status,
              correction_reason: input.correctionReason.trim(),
            }
          : c
      ),
      cashSessions: prev.cashSessions.map((s) =>
        s.id === closure.cash_session_id ? { ...s, status: evalRes.status } : s
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        actor_label: input.actorName.trim() || 'Manager',
        action: 'ADJUST_LOCKED_CASH_CLOSURE',
        entity_table: 'cash_closures',
        entity_id: closure.id,
        new_data: {
          counted_usd: input.countedUsd,
          counted_cdf: input.countedCdf,
          reason: input.correctionReason.trim(),
        },
      }),
    }));
    return { ok: true };
  };

  const recordOrderSettlement: RestoConnectContextValue['recordOrderSettlement'] = (input) => {
    const order = state.orders.find(
      (o) => o.id === input.orderId && o.restaurant_id === input.restaurantId
    );
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    const mappedMethod: CashPaymentMethod =
      input.paymentMethod === 'mobile_money'
        ? 'mobile_money'
        : input.paymentMethod === 'card'
          ? 'card'
          : input.paymentMethod === 'bank_transfer' || input.paymentMethod === 'other'
            ? 'other'
            : order.currency === 'CDF'
              ? 'cash_cdf'
              : 'cash_usd';
    const summary = calculateOrderPaymentSummary(order, state.paymentTransactions, state.refunds);
    const res = recordCashPayment({
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      cashSessionId:
        state.cashSessions.find((s) => s.restaurant_id === input.restaurantId && s.status === 'open')
          ?.id ?? null,
      amount: summary.remainingAmount,
      currency: order.currency,
      paymentMethod: mappedMethod,
      paymentContext: 'counter',
      referenceCode: input.referenceCode,
      cashierName: 'Caisse',
      actorRole: 'restaurant_admin',
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  };

  const recordExpense: RestoConnectContextValue['recordExpense'] = (input) => {
    if (!input.description.trim() || !Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: 'Libellé et montant positif requis.' };
    }
    const rest = state.restaurants.find((r) => r.id === input.restaurantId);
    const created: ExpenseRecord = {
      id: nextId('exp'),
      restaurant_id: input.restaurantId,
      category: input.category.trim() || 'Autres dépenses',
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency,
      exchange_rate_applied: rest?.exchange_rate_usd_cdf ?? 2850,
      payment_method: input.paymentMethod ?? 'cash',
      beneficiary: input.beneficiary?.trim() || null,
      expense_date: input.expenseDate || new Date().toISOString().slice(0, 10),
      recorded_by: null,
      receipt_storage_path: null,
      status: 'active',
    };
    setState((prev) => ({ ...prev, expenses: [created, ...prev.expenses] }));
    return { ok: true };
  };

  const archiveExpense: RestoConnectContextValue['archiveExpense'] = (expenseId, reason) => {
    if (!reason.trim()) return { ok: false, error: "Motif obligatoire pour annuler ou archiver une dépense." };
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === expenseId
          ? { ...e, status: 'archived', archived_reason: reason.trim(), archived_at: now }
          : e
      ),
    }));
    return { ok: true };
  };

  const markNotificationRead: RestoConnectContextValue['markNotificationRead'] = (notificationId) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
    }));
  };

  const updateRestaurantSettings: RestoConnectContextValue['updateRestaurantSettings'] = (
    restaurantId,
    updates
  ) => {
    const sanitizedUpdates = { ...updates };
    if ('logo_url' in sanitizedUpdates) {
      sanitizedUpdates.logo_url = sanitizeMediaUrl(sanitizedUpdates.logo_url);
    }
    if ('cover_image_url' in sanitizedUpdates) {
      sanitizedUpdates.cover_image_url = sanitizeMediaUrl(sanitizedUpdates.cover_image_url);
    }
    if (Array.isArray(sanitizedUpdates.gallery_urls)) {
      sanitizedUpdates.gallery_urls = sanitizedUpdates.gallery_urls
        .map((u) => sanitizeMediaUrl(u))
        .filter((u): u is string => Boolean(u));
    }
    if (sanitizedUpdates.primary_color) {
      sanitizedUpdates.primary_color = validateHexColor(sanitizedUpdates.primary_color, '#163C2E');
    }
    if (sanitizedUpdates.accent_color) {
      sanitizedUpdates.accent_color = validateHexColor(sanitizedUpdates.accent_color, '#B8923A');
    }

    setState((prev) => ({
      ...prev,
      restaurants: prev.restaurants.map((r) =>
        r.id === restaurantId ? { ...r, ...sanitizedUpdates, updated_at: new Date().toISOString() } : r
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: restaurantId,
        actor_label: 'Admin Restaurant',
        action: 'UPDATE_RESTAURANT_SETTINGS',
        entity_table: 'restaurants',
        entity_id: restaurantId,
        new_data: sanitizedUpdates as Record<string, unknown>,
      }),
    }));
  };

  const updateRestaurantSlugAndDomain: RestoConnectContextValue['updateRestaurantSlugAndDomain'] = (
    restaurantId,
    input
  ) => {
    const target = state.restaurants.find((r) => r.id === restaurantId);
    if (!target) return { ok: false, error: 'Établissement introuvable.' };

    const slugRes = validateSlugChange(state.restaurants, state.slugRedirects, restaurantId, input.slug);
    if (!slugRes.valid) return { ok: false, error: slugRes.error };

    const domRes = validateDomainConfig(
      { subdomainPrefix: input.subdomainPrefix, customDomain: input.customDomain },
      state.restaurants,
      restaurantId
    );
    if (!domRes.valid) return { ok: false, error: domRes.error };

    const oldSlug = target.slug;
    const slugChanged = oldSlug !== slugRes.normalizedSlug;
    const now = new Date().toISOString();

    setState((prev) => {
      const cleanedRedirects = prev.slugRedirects.filter(
        (red) => red.old_slug !== slugRes.normalizedSlug
      );
      const nextRedirects =
        slugChanged && !cleanedRedirects.some((red) => red.old_slug === oldSlug)
          ? [
              {
                id: nextId('redir'),
                restaurant_id: restaurantId,
                old_slug: oldSlug,
                created_at: now,
              },
              ...cleanedRedirects,
            ]
          : cleanedRedirects;

      return {
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          r.id === restaurantId
            ? {
                ...r,
                slug: slugRes.normalizedSlug,
                subdomain_prefix: domRes.subdomainPrefix,
                custom_domain: domRes.customDomain,
                domain_verification_status: domRes.customDomain ? 'pending_dns' : 'not_configured',
                updated_at: now,
              }
            : r
        ),
        slugRedirects: nextRedirects,
        auditLogs: appendAudit(prev, {
          restaurant_id: restaurantId,
          actor_label: 'Admin Restaurant',
          action: 'UPDATE_RESTAURANT_SLUG_AND_DOMAIN',
          entity_table: 'restaurants',
          entity_id: restaurantId,
          new_data: {
            old_slug: slugChanged ? oldSlug : null,
            new_slug: slugRes.normalizedSlug,
            subdomain_prefix: domRes.subdomainPrefix,
            custom_domain: domRes.customDomain,
          },
        }),
      };
    });

    return {
      ok: true,
      slug: slugRes.normalizedSlug,
      redirectedOldSlug: slugChanged ? oldSlug : null,
    };
  };

  const createMaintenanceContract: RestoConnectContextValue['createMaintenanceContract'] = (input) => {
    const check = validateMaintenanceContractInput(input);
    if (!check.valid) return { ok: false, error: check.error };

    const license = state.licenses.find(
      (l) => l.id === input.licenseId && l.restaurant_id === input.restaurantId
    );
    if (!license) return { ok: false, error: 'Licence associée introuvable pour ce restaurant.' };

    const now = new Date().toISOString();
    const contractNumber = `MNT-${now.slice(0, 4)}-${String(state.maintenanceContracts.length + 1).padStart(4, '0')}`;
    const contract: MaintenanceContractRecord = {
      id: nextId('mc'),
      restaurant_id: input.restaurantId,
      license_id: input.licenseId,
      contract_number: contractNumber,
      duration_months: input.durationMonths,
      price_amount: input.priceAmount,
      currency: input.currency,
      included_services: input.includedServices.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'active',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };

    setState((prev) => ({
      ...prev,
      maintenanceContracts: [contract, ...prev.maintenanceContracts],
      licenses: prev.licenses.map((l) =>
        l.id === license.id
          ? {
              ...l,
              license_type: 'perpetual_with_maintenance',
              maintenance_expires_at: `${input.endDate}T23:59:59Z`,
              updated_at: now,
            }
          : l
      ),
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        action: 'CREATE_MAINTENANCE_CONTRACT',
        entity_table: 'maintenance_contracts',
        entity_id: contract.id,
        new_data: {
          contract_number: contractNumber,
          duration_months: contract.duration_months,
          price_amount: contract.price_amount,
          currency: contract.currency,
          end_date: contract.end_date,
        },
      }),
    }));

    return { ok: true, contract };
  };

  const updateMaintenanceContractStatus: RestoConnectContextValue['updateMaintenanceContractStatus'] = (
    contractId,
    status
  ) => {
    const now = new Date().toISOString();
    setState((prev) => {
      const target = prev.maintenanceContracts.find((c) => c.id === contractId);
      // IMPORTANT : L'expiration ou l'annulation du contrat de maintenance ne désactive JAMAIS la licence perpétuelle.
      return {
        ...prev,
        maintenanceContracts: prev.maintenanceContracts.map((c) =>
          c.id === contractId ? { ...c, status, updated_at: now } : c
        ),
        auditLogs: appendAudit(prev, {
          restaurant_id: target?.restaurant_id ?? null,
          action: `MAINTENANCE_CONTRACT_${status.toUpperCase()}`,
          entity_table: 'maintenance_contracts',
          entity_id: contractId,
          new_data: { status, license_remains_perpetual: true },
        }),
      };
    });
  };

  const recordMaintenancePayment: RestoConnectContextValue['recordMaintenancePayment'] = (input) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: 'Le montant du paiement de maintenance doit être positif.' };
    }
    if (!input.referenceCode.trim()) {
      return { ok: false, error: 'La référence du justificatif est requise.' };
    }
    const contract = state.maintenanceContracts.find(
      (c) => c.id === input.contractId && c.restaurant_id === input.restaurantId
    );
    if (!contract) return { ok: false, error: 'Contrat de maintenance introuvable.' };

    const now = new Date().toISOString();
    const payment: MaintenancePaymentRecord = {
      id: nextId('mpay'),
      restaurant_id: input.restaurantId,
      contract_id: contract.id,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethod,
      reference_code: input.referenceCode.trim(),
      status: 'confirmed',
      admin_comment: input.adminComment?.trim() || 'Paiement maintenance validé par Super Admin.',
      paid_at: now,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      maintenancePayments: [payment, ...prev.maintenancePayments],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        action: 'RECORD_MAINTENANCE_PAYMENT',
        entity_table: 'maintenance_payments',
        entity_id: payment.id,
        new_data: {
          contract_number: contract.contract_number,
          amount: payment.amount,
          currency: payment.currency,
          reference_code: payment.reference_code,
        },
      }),
    }));

    return { ok: true, payment };
  };

  const generateCommercialDocument: RestoConnectContextValue['generateCommercialDocument'] = (input) => {
    const restaurant = state.restaurants.find((r) => r.id === input.restaurantId);
    const license = input.licenseId
      ? state.licenses.find((l) => l.id === input.licenseId && l.restaurant_id === input.restaurantId)
      : state.licenses.find((l) => l.restaurant_id === input.restaurantId && l.status === 'active') ??
        state.licenses.find((l) => l.restaurant_id === input.restaurantId);

    const payment = input.paymentId
      ? state.payments.find(
          (p) => p.id === input.paymentId && p.restaurant_id === input.restaurantId && p.payment_scope === 'license'
        )
      : state.payments.find(
          (p) =>
            p.restaurant_id === input.restaurantId &&
            p.payment_scope === 'license' &&
            p.status === 'confirmed' &&
            (!license || p.license_id === license.id)
        );

    const maintenanceContract = input.maintenanceContractId
      ? state.maintenanceContracts.find(
          (c) => c.id === input.maintenanceContractId && c.restaurant_id === input.restaurantId
        )
      : state.maintenanceContracts.find((c) => c.restaurant_id === input.restaurantId);

    const built = buildCommercialDocumentSnapshot({
      documentType: input.documentType,
      sequence: state.commercialDocuments.length + 1,
      platform: state.platformSettings,
      restaurant,
      license,
      payment,
      maintenanceContract,
    });

    if (!built.ok) return { ok: false, error: built.error };

    const now = built.snapshot.issuedAt;
    const docRecord: CommercialDocumentRecord = {
      id: nextId('cdoc'),
      restaurant_id: input.restaurantId,
      license_id: license?.id ?? null,
      maintenance_contract_id: maintenanceContract?.id ?? null,
      payment_id: payment?.id ?? null,
      document_type: input.documentType,
      document_number: built.documentNumber,
      issued_at: now,
      snapshot_json: built.snapshot,
      created_at: now,
    };

    setState((prev) => ({
      ...prev,
      commercialDocuments: [docRecord, ...prev.commercialDocuments],
      auditLogs: appendAudit(prev, {
        restaurant_id: input.restaurantId,
        action: `GENERATE_${input.documentType.toUpperCase()}`,
        entity_table: 'commercial_documents',
        entity_id: docRecord.id,
        new_data: { document_number: docRecord.document_number, document_type: docRecord.document_type },
      }),
    }));

    return { ok: true, document: docRecord };
  };

  const submitCommercialInquiry: RestoConnectContextValue['submitCommercialInquiry'] = (input) => {
    if (input.fullName.trim().length < 2 || input.restaurantName.trim().length < 2) {
      return { ok: false, error: 'Votre nom et le nom de votre restaurant sont requis.' };
    }
    if (input.phone.trim().length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      return { ok: false, error: 'Numéro de téléphone et e-mail professionnel valides requis.' };
    }
    if (input.message.trim().length < 5) {
      return { ok: false, error: 'Merci de préciser votre besoin en quelques mots.' };
    }

    const inquiry: CommercialInquiryRecord = {
      id: nextId('inq'),
      full_name: input.fullName.trim(),
      restaurant_name: input.restaurantName.trim(),
      city: input.city.trim() || 'Kinshasa',
      phone: input.phone.trim(),
      email: input.email.trim(),
      message: input.message.trim(),
      status: 'new',
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      commercialInquiries: [inquiry, ...prev.commercialInquiries],
    }));

    return { ok: true, inquiry };
  };

  const updateCommercialInquiryStatus: RestoConnectContextValue['updateCommercialInquiryStatus'] = (
    inquiryId,
    status
  ) => {
    setState((prev) => ({
      ...prev,
      commercialInquiries: prev.commercialInquiries.map((i) =>
        i.id === inquiryId ? { ...i, status } : i
      ),
    }));
  };

  return (
    <RestoConnectContext.Provider
      value={{
        ...state,
        activeTenantId,
        setActiveTenantId,
        createRestaurant,
        updateRestaurantDetails,
        updateRestaurantStatus,
        attributeLicense,
        issueLicense,
        updateLicenseStatus,
        recordLicensePayment,
        verifyCommercialPayment,
        createOwnerAccountInvitation,
        toggleMemberStatus,
        requestAccessReset,
        updatePlatformSettings,
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
        createOrder,
        advanceOrderStatus,
        confirmOrderPaymentStatus,
        createTable,
        updateTableStatus,
        createReservation,
        updateReservationStatus,
        updateReservationDetails,
        createIngredient,
        updateIngredient,
        archiveIngredient,
        recordInventoryMovement,
        saveRecipeForProduct,
        deleteRecipe,
        createSupplier,
        archiveSupplier,
        createPurchaseOrder,
        receivePurchaseOrderItems,
        recordPurchaseOrderPayment,
        cancelPurchaseOrder,
        createEmployee,
        updateEmployeeDetails,
        toggleEmployeeActive,
        recordCheckIn,
        recordCheckOut,
        createLeaveRequest,
        updateLeaveStatus,
        generatePayrollRecord,
        recordSalaryPayment,
        getRoleMatrixForTenant,
        updateRolePermission,
        createCustomer,
        recordOrderSettlement,
        createCashRegister,
        openCashSession,
        recordCashMovement,
        recordCashPayment,
        voidOrCorrectPaymentTransaction,
        recordRefund,
        closeCashSession,
        adjustLockedClosure,
        recordExpense,
        archiveExpense,
        markNotificationRead,
        updateRestaurantSettings,
        updateRestaurantSlugAndDomain,
        createMaintenanceContract,
        updateMaintenanceContractStatus,
        recordMaintenancePayment,
        generateCommercialDocument,
        submitCommercialInquiry,
        updateCommercialInquiryStatus,
      }}
    >
      {children}
    </RestoConnectContext.Provider>
  );
}

export function useRestoStore(): RestoConnectContextValue {
  const ctx = useContext(RestoConnectContext);
  if (!ctx) {
    throw new Error("useRestoStore doit être utilisé à l'intérieur de RestoConnectProvider.");
  }
  return ctx;
}
