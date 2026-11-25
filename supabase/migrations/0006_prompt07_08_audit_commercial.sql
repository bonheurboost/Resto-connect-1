-- ============================================================================
-- RestoConnect — Migration 0006 : Prompt 07 & 08 (Audit SQL/RLS + Commercialisation)
-- Corrections non destructives, personnalisation avancée, redirections de slug,
-- licences perpétuelles, contrats de maintenance, documents commerciaux & paramètres
-- ============================================================================

-- 1. AUDIT FIX #1 : Définir public.is_active_restaurant_member (manquante dans 0002, appelée par 0004 & 0005)
CREATE OR REPLACE FUNCTION public.is_active_restaurant_member(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_restaurant_member(p_restaurant_id);
$$;

-- 2. AUDIT FIX #2 : Licence perpétuelle — la fin d'un contrat de maintenance
-- NE DOIT JAMAIS désactiver une licence perpétuelle active.
CREATE OR REPLACE FUNCTION public.has_active_license(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.licenses l
    JOIN public.restaurants r ON r.id = l.restaurant_id
    WHERE l.restaurant_id = p_restaurant_id
      AND r.status = 'active'
      AND l.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_maintenance(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.maintenance_contracts mc
    WHERE mc.restaurant_id = p_restaurant_id
      AND mc.status = 'active'
      AND (mc.end_date IS NULL OR mc.end_date >= CURRENT_DATE)
  );
$$;

-- 3. AUDIT FIX #3 : Contraintes CHECK alignées avec Prompt 04 (livraison) et Prompt 06 (5e mode de paiement)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'out_for_delivery',
      'delivered',
      'picked_up',
      'served',
      'completed',
      'cancelled'
    )
  );

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'bank_transfer', 'other'));

-- 4. AUDIT FIX #4 : Politiques d'écriture manquantes sur tables 0004 (options, zones, historique)
CREATE POLICY product_options_tenant_write ON public.product_options
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY product_option_values_tenant_write ON public.product_option_values
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY delivery_zones_tenant_write ON public.delivery_zones
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY order_item_options_tenant_rw ON public.order_item_options
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_active_restaurant_member(restaurant_id))
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY order_status_history_tenant_rw ON public.order_status_history
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_active_restaurant_member(restaurant_id))
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_active_restaurant_member(restaurant_id) AND public.has_active_license(restaurant_id))
  );

-- 5. PROMPT 07 : Extension personnalisation, galerie photos, domaines & redirections de slug
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS subdomain_prefix TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS domain_verification_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (domain_verification_status IN ('not_configured', 'pending_dns', 'verified'));

CREATE TABLE IF NOT EXISTS public.restaurant_slug_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_restaurant ON public.restaurant_slug_redirects (restaurant_id);
ALTER TABLE public.restaurant_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY slug_redirects_public_read ON public.restaurant_slug_redirects
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.status = 'active')
    OR public.is_super_admin()
    OR public.is_active_restaurant_member(restaurant_id)
  );

CREATE POLICY slug_redirects_tenant_write ON public.restaurant_slug_redirects
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  );

-- RPC publique pour résoudre un slug ou un ancien slug redirigé
CREATE OR REPLACE FUNCTION public.resolve_restaurant_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_slug, '')));
  v_rest public.restaurants%ROWTYPE;
  v_redirect_id UUID;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rest
  FROM public.restaurants
  WHERE slug = v_clean AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'restaurant', to_jsonb(v_rest),
      'redirected_from', NULL
    );
  END IF;

  SELECT rsr.restaurant_id INTO v_redirect_id
  FROM public.restaurant_slug_redirects rsr
  WHERE rsr.old_slug = v_clean
  LIMIT 1;

  IF v_redirect_id IS NOT NULL THEN
    SELECT * INTO v_rest
    FROM public.restaurants
    WHERE id = v_redirect_id AND status = 'active'
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'restaurant', to_jsonb(v_rest),
        'redirected_from', v_clean
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 6. PROMPT 07 : Extension licences commerciales (client entreprise, date de vente, méthode)
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS business_client_name TEXT,
  ADD COLUMN IF NOT EXISTS business_client_contact TEXT,
  ADD COLUMN IF NOT EXISTS business_client_phone TEXT,
  ADD COLUMN IF NOT EXISTS business_client_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'bank_transfer', 'other'));

-- 7. PROMPT 07 : Contrats de maintenance optionnels & paiements de maintenance
CREATE TABLE IF NOT EXISTS public.maintenance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE RESTRICT,
  contract_number TEXT NOT NULL UNIQUE,
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  price_amount NUMERIC(12, 2) NOT NULL CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  included_services TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_restaurant ON public.maintenance_contracts (restaurant_id, status);
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_contracts_read ON public.maintenance_contracts
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
  );

CREATE POLICY maintenance_contracts_super_admin_write ON public.maintenance_contracts
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.maintenance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.maintenance_contracts(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'bank_transfer', 'other')),
  reference_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected', 'refunded')),
  admin_comment TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_payments_contract ON public.maintenance_payments (contract_id, created_at DESC);
ALTER TABLE public.maintenance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_payments_read ON public.maintenance_payments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
  );

CREATE POLICY maintenance_payments_super_admin_write ON public.maintenance_payments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 8. PROMPT 07 : Documents commerciaux enregistrés (données réelles uniquement)
CREATE TABLE IF NOT EXISTS public.commercial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  maintenance_contract_id UUID REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'license_confirmation',
      'sale_invoice',
      'payment_receipt',
      'maintenance_contract',
      'restaurant_sheet'
    )
  ),
  document_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_json JSONB NOT NULL,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_docs_restaurant ON public.commercial_documents (restaurant_id, issued_at DESC);
ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_documents_read ON public.commercial_documents
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
  );

CREATE POLICY commercial_documents_super_admin_write ON public.commercial_documents
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 9. PROMPT 07 : Paramètres globaux de la plateforme (Super Admin uniquement)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  platform_name TEXT NOT NULL DEFAULT 'RestoConnect',
  tagline TEXT NOT NULL DEFAULT 'La gestion intelligente de votre restaurant',
  logo_url TEXT,
  support_email TEXT NOT NULL DEFAULT 'contact@restoconnect.cd',
  commercial_phone TEXT NOT NULL DEFAULT '+243 81 000 0000',
  commercial_whatsapp TEXT NOT NULL DEFAULT '+243 81 000 0000',
  commercial_address TEXT NOT NULL DEFAULT 'Boulevard du 30 Juin, Gombe, Kinshasa, RDC',
  default_country TEXT NOT NULL DEFAULT 'République démocratique du Congo',
  default_timezone TEXT NOT NULL DEFAULT 'Africa/Kinshasa',
  reference_currency TEXT NOT NULL DEFAULT 'USD' CHECK (reference_currency IN ('USD', 'CDF')),
  default_usd_cdf_rate NUMERIC(12, 2) NOT NULL DEFAULT 2850.00 CHECK (default_usd_cdf_rate > 0),
  standard_license_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 350.00 CHECK (standard_license_price_usd >= 0),
  maintenance_annual_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 150.00 CHECK (maintenance_annual_price_usd >= 0),
  maintenance_alert_days INTEGER NOT NULL DEFAULT 30 CHECK (maintenance_alert_days >= 1),
  commercial_terms TEXT NOT NULL DEFAULT 'Licence perpétuelle par établissement. Contrat de maintenance annuel optionnel.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_super_admin_all ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- RPC publique strictement limitée aux informations vitrine commerciales non sensibles
CREATE OR REPLACE FUNCTION public.get_public_platform_overview()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'platform_name', ps.platform_name,
    'tagline', ps.tagline,
    'logo_url', ps.logo_url,
    'support_email', ps.support_email,
    'commercial_phone', ps.commercial_phone,
    'commercial_whatsapp', ps.commercial_whatsapp,
    'commercial_address', ps.commercial_address,
    'reference_currency', ps.reference_currency,
    'standard_license_price_usd', ps.standard_license_price_usd,
    'maintenance_annual_price_usd', ps.maintenance_annual_price_usd,
    'commercial_terms', ps.commercial_terms
  )
  FROM public.platform_settings ps
  WHERE ps.id = 'global'
  LIMIT 1;
$$;

-- 10. PROMPT 07 : Demandes commerciales (page Contact / Démonstration)
CREATE TABLE IF NOT EXISTS public.commercial_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  restaurant_name TEXT NOT NULL CHECK (length(trim(restaurant_name)) >= 2),
  city TEXT NOT NULL DEFAULT 'Kinshasa',
  phone TEXT NOT NULL CHECK (length(trim(phone)) >= 6),
  email TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(trim(message)) >= 5),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.commercial_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_inquiries_public_insert ON public.commercial_inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND length(trim(full_name)) >= 2
    AND length(trim(restaurant_name)) >= 2
    AND length(trim(phone)) >= 6
    AND length(trim(message)) >= 5
  );

CREATE POLICY commercial_inquiries_super_admin_manage ON public.commercial_inquiries
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
