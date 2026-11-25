-- RestoConnect — Migration 0005 : Prompt 06 — Gestion de la caisse, paiements sur place, clôtures, remboursements et reçus
-- Isolation multi-tenant stricte via restaurant_id et PostgreSQL RLS.
-- Aucun paiement en ligne obligatoire : paiements physiques multi-devises (USD / CDF) avec taux verrouillé à l'opération.

-- 1. Extensions restaurants & commandes
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS allow_partial_payments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS custom_payment_method_label TEXT DEFAULT 'Autre mode configurable';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_status = 'confirmed' THEN 'paid'
  WHEN payment_status IN ('pending', 'failed') OR payment_status IS NULL THEN 'unpaid'
  ELSE payment_status
END;

ALTER TABLE public.orders
  ALTER COLUMN payment_status SET DEFAULT 'unpaid';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_status_check' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_payment_status_check;
  END IF;
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid','partial','paid','refunded','cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 2. Caisses physiques par restaurant
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, code)
);

-- 3. Sessions journalières de caisse (ouverture -> encaissements/mouvements -> clôture)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  cashier_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cashier_name TEXT NOT NULL,
  opening_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount_usd >= 0),
  opening_amount_cdf NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_amount_cdf >= 0),
  primary_currency TEXT NOT NULL DEFAULT 'USD' CHECK (primary_currency IN ('USD','CDF')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','closed_with_discrepancy')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_status
  ON public.cash_sessions (restaurant_id, status, opened_at DESC);

-- 4. Mouvements internes de caisse (entrées / sorties autorisées, journal immuable)
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','CDF')),
  reason TEXT NOT NULL,
  performed_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE UPDATE, DELETE ON public.cash_movements FROM authenticated, anon;

-- 5. Transactions d'encaissement détaillées (liées sans doublon à public.payments si besoin)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_number TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','CDF')),
  exchange_rate_applied NUMERIC(12,2) NOT NULL CHECK (exchange_rate_applied > 0),
  converted_amount_order_currency NUMERIC(14,2) NOT NULL CHECK (converted_amount_order_currency > 0),
  order_currency TEXT NOT NULL CHECK (order_currency IN ('USD','CDF')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash_usd','cash_cdf','mobile_money','card','other')),
  payment_context TEXT NOT NULL CHECK (payment_context IN ('counter','takeaway','delivery','table')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','voided','corrected')),
  reference_code TEXT,
  note TEXT,
  void_or_correction_reason TEXT,
  cashier_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cashier_name TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, transaction_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_order
  ON public.payment_transactions (restaurant_id, order_id, paid_at DESC);

-- 6. Remboursements traçables (journal immuable)
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  refund_number TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','CDF')),
  exchange_rate_applied NUMERIC(12,2) NOT NULL CHECK (exchange_rate_applied > 0),
  converted_amount_order_currency NUMERIC(14,2) NOT NULL CHECK (converted_amount_order_currency > 0),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash_usd','cash_cdf','mobile_money','card','other')),
  reason TEXT NOT NULL,
  responsible_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_name TEXT NOT NULL,
  refunded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, refund_number)
);

REVOKE UPDATE, DELETE ON public.refunds FROM authenticated, anon;

-- 7. Reçus immuables générés lors des encaissements et remboursements (format standard & ticket 80mm)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL,
  receipt_type TEXT NOT NULL DEFAULT 'standard' CHECK (receipt_type IN ('standard','partial','refund')),
  cashier_name TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, receipt_number)
);

REVOKE UPDATE, DELETE ON public.receipts FROM authenticated, anon;

-- 8. Clôtures de caisse verrouillées avec écarts calculés USD & CDF
CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL UNIQUE REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  cashier_name TEXT NOT NULL,
  expected_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  counted_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  counted_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  discrepancy_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  discrepancy_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_mobile_money_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_mobile_money_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_card_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_card_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_other_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  non_cash_other_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('closed','closed_with_discrepancy')),
  notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  validated_by_name TEXT NOT NULL,
  correction_reason TEXT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Sécurité RLS multi-tenant & séparation des rôles caisse
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_registers_read ON public.cash_registers
  FOR SELECT USING (public.is_super_admin() OR public.is_active_restaurant_member(restaurant_id));
CREATE POLICY cash_registers_write ON public.cash_registers
  FOR ALL USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY cash_sessions_read ON public.cash_sessions
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY cash_sessions_insert ON public.cash_sessions
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY cash_sessions_update ON public.cash_sessions
  FOR UPDATE USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));

CREATE POLICY cash_movements_read ON public.cash_movements
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY cash_movements_insert ON public.cash_movements
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));

CREATE POLICY payment_tx_read ON public.payment_transactions
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY payment_tx_insert ON public.payment_transactions
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY payment_tx_correct_only_manager ON public.payment_transactions
  FOR UPDATE USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY refunds_read ON public.refunds
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY refunds_insert_manager_only ON public.refunds
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));

CREATE POLICY receipts_read ON public.receipts
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY receipts_insert ON public.receipts
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));

CREATE POLICY cash_closures_read ON public.cash_closures
  FOR SELECT USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY cash_closures_insert ON public.cash_closures
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager','cashier']));
CREATE POLICY cash_closures_correct_only_manager ON public.cash_closures
  FOR UPDATE USING (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']))
  WITH CHECK (public.is_super_admin() OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin','manager']));
