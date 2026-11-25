export type PlatformRole = 'super_admin' | 'standard_user';

export type RestaurantRoleCode =
  | 'restaurant_admin'
  | 'manager'
  | 'cashier'
  | 'server'
  | 'cook';

export type LicenseType = 'perpetual' | 'perpetual_with_maintenance';
export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type RestaurantStatus = 'pending' | 'active' | 'suspended' | 'archived';
export type MemberStatus = 'invited' | 'active' | 'suspended';
export type CurrencyCode = 'CDF' | 'USD';

export type InventoryCategory =
  | 'Ingrédients'
  | 'Boissons'
  | 'Produits alimentaires'
  | 'Emballages'
  | "Produits d'entretien"
  | 'Autres';

export type ExtendedMovementType =
  | 'in'
  | 'out'
  | 'adjustment'
  | 'waste'
  | 'purchase_in'
  | 'kitchen_out'
  | 'waste_loss'
  | 'supplier_return'
  | 'transfer';

export interface RestaurantRecord {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls?: string[];
  primary_color: string;
  accent_color: string;
  subdomain_prefix?: string | null;
  custom_domain?: string | null;
  domain_verification_status?: 'not_configured' | 'pending_dns' | 'verified';
  address: string | null;
  commune: string | null;
  city: string;
  country: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  establishment_type: string;
  cuisine_type: string | null;
  opening_hours: string | null;
  default_currency: CurrencyCode;
  secondary_currency: CurrencyCode | null;
  exchange_rate_usd_cdf: number;
  timezone: string;
  allowed_order_modes: Array<'dine_in' | 'takeaway' | 'delivery'>;
  allowed_delivery_modes: Array<'pickup' | 'local_courier'>;
  cancellation_policy: string | null;
  notification_email_orders: boolean;
  notification_low_stock: boolean;
  allow_partial_payments?: boolean;
  custom_payment_method_label?: string | null;
  additional_info: string | null;
  status: RestaurantStatus;
  created_at: string;
  updated_at: string;
}

export interface RestaurantSlugRedirectRecord {
  id: string;
  restaurant_id: string;
  old_slug: string;
  created_at: string;
}

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  platform_role: PlatformRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleRecord {
  id: string;
  code: RestaurantRoleCode;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

export interface RestaurantMemberRecord {
  id: string;
  restaurant_id: string;
  profile_id: string;
  role_id: string;
  status: MemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_model: LicenseType;
  base_price_usd: number;
  maintenance_annual_usd: number;
  max_staff: number;
  max_tables: number;
  is_active: boolean;
}

export interface LicenseRecord {
  id: string;
  restaurant_id: string;
  plan_id: string;
  license_key: string;
  license_type: LicenseType;
  amount: number;
  currency: CurrencyCode;
  status: LicenseStatus;
  issued_at: string | null;
  activated_at: string | null;
  sale_date?: string | null;
  business_client_name?: string | null;
  business_client_contact?: string | null;
  business_client_phone?: string | null;
  business_client_email?: string | null;
  payment_method?: 'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'other' | null;
  maintenance_expires_at: string | null;
  suspended_reason: string | null;
  revoked_reason: string | null;
  notes: string | null;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseHistoryEntry {
  id: string;
  license_id: string;
  restaurant_id: string;
  previous_status: LicenseStatus | null;
  new_status: LicenseStatus;
  changed_by_label: string;
  reason: string | null;
  created_at: string;
}

export interface CategoryRecord {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductRecord {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price_amount: number;
  currency: CurrencyCode;
  is_available: boolean;
  is_featured?: boolean;
  is_temporarily_disabled?: boolean;
  sort_order?: number;
  preparation_time_min: number | null;
  sku: string | null;
}

export interface ProductImageRecord {
  id: string;
  restaurant_id: string;
  product_id: string;
  storage_path: string;
  public_url: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductOptionRecord {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  option_type: 'size' | 'supplement' | 'variant' | 'side';
  is_required: boolean;
  is_multiple: boolean;
  sort_order: number;
}

export interface ProductOptionValueRecord {
  id: string;
  restaurant_id: string;
  option_id: string;
  label: string;
  extra_price: number;
  currency: CurrencyCode;
  is_available: boolean;
  sort_order: number;
}

export interface DeliveryZoneRecord {
  id: string;
  restaurant_id: string;
  zone_name: string;
  commune: string;
  fee_amount: number;
  currency: CurrencyCode;
  estimated_minutes: number;
  is_active: boolean;
}

export interface RestaurantTableRecord {
  id: string;
  restaurant_id: string;
  table_number: string;
  zone: string;
  capacity: number;
  qr_code_token: string | null;
  status: 'available' | 'occupied' | 'reserved' | 'inactive';
}

export interface CustomerRecord {
  id: string;
  restaurant_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export type OrderStatusCode =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'picked_up'
  | 'served'
  | 'completed'
  | 'cancelled';

export type OrderPaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'refunded'
  | 'cancelled'
  | 'pending'
  | 'confirmed'
  | 'failed';

export type CashPaymentMethod =
  | 'cash_usd'
  | 'cash_cdf'
  | 'mobile_money'
  | 'card'
  | 'other';

export type PaymentContext = 'counter' | 'takeaway' | 'delivery' | 'table';

export interface OrderRecord {
  id: string;
  restaurant_id: string;
  order_number: string;
  tracking_token?: string | null;
  table_id: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  server_id: string | null;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  status: OrderStatusCode;
  subtotal: number;
  delivery_zone_id?: string | null;
  delivery_fee?: number;
  delivery_commune?: string | null;
  delivery_quartier?: string | null;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  tax_amount: number;
  total_amount: number;
  paid_amount?: number;
  currency: CurrencyCode;
  exchange_rate_applied?: number;
  payment_method?: 'cash' | CashPaymentMethod;
  payment_status?: OrderPaymentStatus;
  stock_deducted?: boolean;
  stock_deducted_at?: string | null;
  cancellation_reason?: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderItemRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot?: string;
  unit_price_snapshot?: number;
  options_summary?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
  kitchen_status: 'queued' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface OrderItemOptionRecord {
  id: string;
  restaurant_id: string;
  order_item_id: string;
  option_name_snapshot: string;
  value_label_snapshot: string;
  extra_price_snapshot: number;
}

export interface OrderStatusHistoryRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  previous_status: OrderStatusCode | null;
  new_status: OrderStatusCode;
  changed_by_label: string;
  note: string | null;
  created_at: string;
}

export interface ReservationRecord {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  table_id: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  party_size: number;
  reserved_for: string;
  duration_minutes?: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
}

export interface PaymentRecord {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  license_id: string | null;
  payment_scope: 'order' | 'license';
  amount: number;
  currency: CurrencyCode;
  exchange_rate_applied?: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'other';
  status: 'pending' | 'confirmed' | 'rejected' | 'failed' | 'refunded';
  reference_code: string | null;
  admin_comment: string | null;
  verified_at: string | null;
  recorded_by: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface CashRegisterRecord {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface CashSessionRecord {
  id: string;
  restaurant_id: string;
  cash_register_id: string;
  cashier_profile_id: string | null;
  cashier_name: string;
  opening_amount_usd: number;
  opening_amount_cdf: number;
  primary_currency: CurrencyCode;
  status: 'open' | 'closed' | 'closed_with_discrepancy';
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

export interface CashMovementRecord {
  id: string;
  restaurant_id: string;
  cash_session_id: string;
  movement_type: 'in' | 'out';
  amount: number;
  currency: CurrencyCode;
  reason: string;
  performed_by_label: string;
  created_at: string;
}

export interface PaymentTransactionRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  cash_session_id: string | null;
  payment_id?: string | null;
  transaction_number: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate_applied: number;
  converted_amount_order_currency: number;
  order_currency: CurrencyCode;
  payment_method: CashPaymentMethod;
  payment_context: PaymentContext;
  status: 'confirmed' | 'voided' | 'corrected';
  reference_code: string | null;
  note: string | null;
  void_or_correction_reason: string | null;
  cashier_name: string;
  paid_at: string;
  created_at: string;
}

export interface RefundRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  payment_transaction_id: string;
  cash_session_id: string | null;
  refund_number: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate_applied: number;
  converted_amount_order_currency: number;
  refund_method: CashPaymentMethod;
  reason: string;
  responsible_name: string;
  refunded_at: string;
  created_at: string;
}

export interface ReceiptLineSnapshot {
  productName: string;
  quantity: number;
  unitPrice: number;
  optionsSummary: string | null;
  lineTotal: number;
}

export interface ReceiptSnapshotData {
  restaurantName: string;
  restaurantLogoUrl: string | null;
  restaurantAddress: string | null;
  restaurantPhone: string | null;
  receiptNumber: string;
  orderNumber: string;
  orderType: OrderRecord['order_type'];
  issuedAt: string;
  customerName: string;
  customerPhone: string | null;
  lines: ReceiptLineSnapshot[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  amountPaidThisReceipt: number;
  paymentCurrency: CurrencyCode;
  exchangeRateApplied: number;
  totalPaidOrderCurrency: number;
  remainingBalanceOrderCurrency: number;
  orderCurrency: CurrencyCode;
  paymentMethodLabel: string;
  paymentContextLabel: string;
  cashierName: string;
  isPartialPayment: boolean;
  isRefundReceipt?: boolean;
  refundReason?: string | null;
}

export interface ReceiptRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  payment_transaction_id: string | null;
  receipt_number: string;
  receipt_type: 'standard' | 'partial' | 'refund';
  cashier_name: string;
  snapshot_json: ReceiptSnapshotData;
  issued_at: string;
  created_at: string;
}

export interface CashClosureRecord {
  id: string;
  restaurant_id: string;
  cash_session_id: string;
  cash_register_id: string;
  cashier_name: string;
  expected_usd: number;
  expected_cdf: number;
  counted_usd: number;
  counted_cdf: number;
  discrepancy_usd: number;
  discrepancy_cdf: number;
  non_cash_mobile_money_usd: number;
  non_cash_mobile_money_cdf: number;
  non_cash_card_usd: number;
  non_cash_card_cdf: number;
  non_cash_other_usd: number;
  non_cash_other_cdf: number;
  status: 'closed' | 'closed_with_discrepancy';
  notes: string | null;
  is_locked: boolean;
  validated_by_name: string;
  correction_reason: string | null;
  closed_at: string;
  created_at: string;
}

export interface SupplierRecord {
  id: string;
  restaurant_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface IngredientRecord {
  id: string;
  restaurant_id: string;
  name: string;
  category?: InventoryCategory;
  description?: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  unit_cost: number;
  currency?: CurrencyCode;
  supplier_id?: string | null;
  expiry_date?: string | null;
  storage_location?: string | null;
  is_archived?: boolean;
}

export interface InventoryMovementRecord {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  movement_type: ExtendedMovementType;
  quantity: number;
  unit_cost_snapshot?: number;
  reference_type?: string | null;
  reference_id?: string | null;
  reason: string | null;
  performed_by: string | null;
  performed_by_label?: string;
  created_at: string;
}

export interface RecipeRecord {
  id: string;
  restaurant_id: string;
  product_id: string;
  yield_portions: number;
  notes: string | null;
  is_active: boolean;
}

export interface RecipeItemRecord {
  id: string;
  restaurant_id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
  unit: string;
}

export interface PurchaseOrderRecord {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  order_number: string;
  status: 'draft' | 'pending' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  total_amount: number;
  currency: CurrencyCode;
  exchange_rate_applied: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  attachment_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseOrderItemRecord {
  id: string;
  restaurant_id: string;
  purchase_order_id: string;
  ingredient_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
}

export interface EmployeeRecord {
  id: string;
  restaurant_id: string;
  member_id: string | null;
  full_name: string;
  job_title: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
  hire_date: string | null;
  contract_type: 'cdi' | 'cdd' | 'extra' | 'stagiaire';
  salary_amount?: number;
  salary_currency?: CurrencyCode;
  employment_status?: 'active' | 'on_leave' | 'suspended' | 'terminated';
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;
  restaurant_id: string;
  employee_id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: 'present' | 'late' | 'absent' | 'leave';
  delay_minutes: number;
  note: string | null;
  created_at: string;
}

export interface LeaveRequestRecord {
  id: string;
  restaurant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  restaurant_id: string;
  employee_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  bonuses: number;
  advances: number;
  deductions: number;
  net_salary: number;
  currency: CurrencyCode;
  exchange_rate_applied: number;
  status: 'draft' | 'validated' | 'paid';
  notes: string | null;
  created_at: string;
}

export interface SalaryPaymentRecord {
  id: string;
  restaurant_id: string;
  payroll_id: string;
  employee_id: string;
  amount_paid: number;
  currency: CurrencyCode;
  payment_method: 'cash' | 'mobile_money' | 'bank_transfer';
  reference_code: string;
  paid_at: string;
  notes: string | null;
}

export interface ExpenseRecord {
  id: string;
  restaurant_id: string;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate_applied?: number;
  payment_method?: 'cash' | 'mobile_money' | 'card' | 'bank_transfer';
  beneficiary?: string | null;
  expense_date: string;
  recorded_by: string | null;
  receipt_storage_path: string | null;
  status?: 'active' | 'cancelled' | 'archived';
  archived_reason?: string | null;
  archived_at?: string | null;
}

export interface NotificationRecord {
  id: string;
  restaurant_id: string | null;
  recipient_profile_id: string;
  title: string;
  message: string;
  channel: 'in_app' | 'email' | 'whatsapp_pending';
  event_type?: string;
  related_entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  restaurant_id: string | null;
  actor_profile_id: string | null;
  actor_label?: string;
  action: string;
  entity_table: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export type MaintenanceContractStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface MaintenanceContractRecord {
  id: string;
  restaurant_id: string;
  license_id: string;
  contract_number: string;
  duration_months: number;
  price_amount: number;
  currency: CurrencyCode;
  included_services: string;
  start_date: string;
  end_date: string;
  status: MaintenanceContractStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenancePaymentRecord {
  id: string;
  restaurant_id: string;
  contract_id: string;
  amount: number;
  currency: CurrencyCode;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'other';
  reference_code: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'refunded';
  admin_comment: string | null;
  paid_at: string | null;
  created_at: string;
}

export type CommercialDocumentType =
  | 'license_confirmation'
  | 'sale_invoice'
  | 'payment_receipt'
  | 'maintenance_contract'
  | 'restaurant_sheet';

export interface CommercialDocumentSnapshot {
  documentType: CommercialDocumentType;
  documentTitle: string;
  documentNumber: string;
  issuedAt: string;
  platformName: string;
  platformLogoUrl: string | null;
  platformContactEmail: string;
  platformContactPhone: string;
  platformAddress: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantCity: string;
  restaurantAddress: string | null;
  restaurantPhone: string | null;
  restaurantEmail: string | null;
  ownerName: string | null;
  businessClientName: string | null;
  businessClientContact: string | null;
  businessClientPhone: string | null;
  businessClientEmail: string | null;
  licenseKey: string | null;
  licenseTypeLabel: string | null;
  licenseStatusLabel: string | null;
  saleDate: string | null;
  contractNumber: string | null;
  contractPeriod: string | null;
  contractServices: string | null;
  paymentReference: string | null;
  paymentMethodLabel: string | null;
  amount: number | null;
  currency: CurrencyCode | null;
  commercialTerms: string | null;
  notes: string | null;
}

export interface CommercialDocumentRecord {
  id: string;
  restaurant_id: string;
  license_id: string | null;
  maintenance_contract_id: string | null;
  payment_id: string | null;
  document_type: CommercialDocumentType;
  document_number: string;
  issued_at: string;
  snapshot_json: CommercialDocumentSnapshot;
  created_at: string;
}

export interface CommercialInquiryRecord {
  id: string;
  full_name: string;
  restaurant_name: string;
  city: string;
  phone: string;
  email: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  created_at: string;
}

