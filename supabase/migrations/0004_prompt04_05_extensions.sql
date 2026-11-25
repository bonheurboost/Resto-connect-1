-- RestoConnect — Migration 0004 : Prompt 04 & 05 Extensions (Menus, Options, Delivery Zones, Tracking, Reservations, Inventory ERP, Recipes, Suppliers, Purchasing, Attendance, Payroll, Expenses & Financial Reports)
-- Strict multi-tenant isolation enforced via restaurant_id and PostgreSQL RLS.

-- 1. Extensions des produits, commandes, réservations, ingrédients, mouvements, employés, dépenses
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_temporarily_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_zone_id UUID,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_commune TEXT,
  ADD COLUMN IF NOT EXISTS delivery_quartier TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC(12,2) NOT NULL DEFAULT 2850,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS unit_price_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS options_summary TEXT;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 90;

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Ingrédients',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS supplier_id UUID,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS storage_location TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS unit_cost_snapshot NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_label TEXT;

REVOKE UPDATE, DELETE ON public.inventory_movements FROM authenticated, anon;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC(12,2) NOT NULL DEFAULT 2850,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS beneficiary TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Nouvelles tables Prompt 04 (Options plats, Zones livraison, Snapshots options, Historique statuts immuable)
CREATE TABLE IF NOT EXISTS public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('size','supplement','variant','side')),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  extra_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  commune TEXT NOT NULL,
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_minutes INTEGER NOT NULL DEFAULT 35,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_name_snapshot TEXT NOT NULL,
  value_label_snapshot TEXT NOT NULL,
  extra_price_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_label TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE UPDATE, DELETE ON public.order_status_history FROM authenticated, anon;

-- 3. Nouvelles tables Prompt 05 (Fournisseurs, Recettes, Bons d'achat, Présences, Congés, Paie, Versements salaires)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category TEXT NOT NULL DEFAULT 'Produits alimentaires',
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  yield_portions NUMERIC(10,2) NOT NULL DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurant_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity_per_unit NUMERIC(12,4) NOT NULL CHECK (quantity_per_unit > 0),
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('draft','pending','ordered','partially_received','received','cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(12,2) NOT NULL DEFAULT 2850,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  attachment_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity_ordered NUMERIC(12,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('present','late','absent','leave')),
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_day
  ON public.attendance_records (restaurant_id, employee_id, attendance_date);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(12,2) NOT NULL DEFAULT 0,
  advances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(12,2) NOT NULL DEFAULT 2850,
  status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('draft','validated','paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, employee_id, period_label)
);

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payroll_id UUID NOT NULL REFERENCES public.payroll_records(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','mobile_money','bank_transfer')),
  reference_code TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- 4. RLS Multi-Tenant strict
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Lecture publique sur options et zones de livraison d'établissements actifs
CREATE POLICY product_options_public_read ON public.product_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.status = 'active')
  );
CREATE POLICY product_option_values_public_read ON public.product_option_values
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.status = 'active')
  );
CREATE POLICY delivery_zones_public_read ON public.delivery_zones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.status = 'active')
  );

-- Isolation stricte restaurant_admin / manager sur paie, fournisseurs, achats, présences
CREATE POLICY suppliers_admin_manager ON public.suppliers
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY purchase_orders_admin_manager ON public.purchase_orders
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY purchase_order_items_admin_manager ON public.purchase_order_items
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY attendance_admin_manager ON public.attendance_records
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY leave_requests_admin_manager ON public.leave_requests
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY payroll_admin_manager ON public.payroll_records
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY salary_payments_admin_manager ON public.salary_payments
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY recipes_tenant_member ON public.recipes
  FOR ALL USING (public.is_super_admin() OR public.is_active_restaurant_member(restaurant_id))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY recipe_items_tenant_member ON public.recipe_items
  FOR ALL USING (public.is_super_admin() OR public.is_active_restaurant_member(restaurant_id))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

-- 5. Fonctions RPC sécurisées (Suivi commande par jeton & déduction stock atomique)
CREATE OR REPLACE FUNCTION public.get_order_by_tracking_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE tracking_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(oi)) FROM public.order_items oi WHERE oi.order_id = v_order.id), '[]'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at) FROM public.order_status_history h WHERE h.order_id = v_order.id), '[]'::jsonb)
  );
END;
$$;
