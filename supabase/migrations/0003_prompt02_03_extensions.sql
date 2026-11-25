-- ============================================================================
-- RestoConnect — Migration 0003 : Extensions Super Admin, Licences & Profil Restaurant
-- Complète 0001_initial_schema.sql et 0002_rls_policies.sql sans perte de données
-- ============================================================================

-- 1. Enrichissement de public.restaurants (Profil complet, RDC, Paramètres)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS establishment_type TEXT DEFAULT 'Restaurant',
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS cuisine_type TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"monday":"08:00-22:00","tuesday":"08:00-22:00","wednesday":"08:00-22:00","thursday":"08:00-22:00","friday":"08:00-23:00","saturday":"09:00-23:00","sunday":"10:00-22:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS exchange_rate_usd_cdf NUMERIC(12, 2) NOT NULL DEFAULT 2850.00 CHECK (exchange_rate_usd_cdf > 0),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Kinshasa',
  ADD COLUMN IF NOT EXISTS allowed_order_modes TEXT[] NOT NULL DEFAULT ARRAY['dine_in', 'takeaway', 'delivery'],
  ADD COLUMN IF NOT EXISTS allowed_delivery_modes TEXT[] NOT NULL DEFAULT ARRAY['pickup', 'local_courier'],
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email_orders":true,"email_reservations":true,"low_stock_alerts":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- 2. Enrichissement de public.licenses (montant, devise, activation, unicité licence active)
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('CDF', 'USD')),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Empêcher l'attribution simultanée de plusieurs licences actives au même restaurant
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_one_active_per_restaurant
  ON public.licenses (restaurant_id)
  WHERE status = 'active';

-- Historique dédié des modifications de licences
CREATE TABLE IF NOT EXISTS public.license_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_history_license ON public.license_history (license_id, created_at DESC);

ALTER TABLE public.license_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY license_history_select ON public.license_history
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
  );

CREATE POLICY license_history_super_admin_insert ON public.license_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 3. Enrichissement de public.payments (statut rejected/refused, commentaire admin, vérification)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'failed', 'refunded'));

-- 4. Permissions granulaires par action (consultation, création, modification, suppression, validation)
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS can_read BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_create BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_update BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_validate BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Table sécurisée d'invitations (remplace tout mot de passe en clair)
CREATE TABLE IF NOT EXISTS public.restaurant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  invitation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_restaurant ON public.restaurant_invitations (restaurant_id, status);

ALTER TABLE public.restaurant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_manage ON public.restaurant_invitations
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  );

-- 6. Immuabilité stricte des journaux d'audit pour les utilisateurs ordinaires
-- Aucune politique UPDATE ou DELETE sur public.audit_logs : seuls INSERT et SELECT contrôlés existent.
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
