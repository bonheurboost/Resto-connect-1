-- ============================================================================
-- RestoConnect — Migration 0002 : Politiques Row Level Security (RLS)
-- Isolation stricte multi-tenant & contrôle d'accès par rôle
-- ============================================================================

-- Fonctions utilitaires de sécurité (SECURITY DEFINER pour éviter la récursion RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.platform_role = 'super_admin'
      AND p.is_active = TRUE
  );
$$;

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
      AND (
        l.license_type = 'perpetual'
        OR l.maintenance_expires_at IS NULL
        OR l.maintenance_expires_at > NOW()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_member(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    JOIN public.profiles p ON p.id = rm.profile_id
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.profile_id = auth.uid()
      AND rm.status = 'active'
      AND p.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(p_restaurant_id UUID, p_role_codes TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    JOIN public.roles ro ON ro.id = rm.role_id
    JOIN public.profiles p ON p.id = rm.profile_id
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.profile_id = auth.uid()
      AND rm.status = 'active'
      AND p.is_active = TRUE
      AND ro.code = ANY (p_role_codes)
  );
$$;

-- Activation RLS sur l'ensemble des 23 tables (22 demandées + role_permissions)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLITIQUES PAR TABLE
-- ============================================================================

-- 1. PLANS : lecture pour utilisateurs authentifiés, écriture exclusivement Super Admin
CREATE POLICY plans_select_authenticated ON public.plans
  FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.is_super_admin());

CREATE POLICY plans_super_admin_all ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 2. RESTAURANTS : public actif lisible pour vitrine, membres lisent leur tenant, Super Admin gère tout
CREATE POLICY restaurants_public_active_select ON public.restaurants
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR public.is_super_admin()
    OR public.is_restaurant_member(id)
  );

CREATE POLICY restaurants_admin_update_own ON public.restaurants
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(id, ARRAY['restaurant_admin']) AND public.has_active_license(id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(id, ARRAY['restaurant_admin']) AND public.has_active_license(id))
  );

CREATE POLICY restaurants_super_admin_insert_delete ON public.restaurants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY restaurants_super_admin_delete ON public.restaurants
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 3. PROFILES : chaque utilisateur lit/met à jour son profil, Super Admin lit tout, collègues de restaurant lisibles par admin/manager
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_members rm_target
      JOIN public.restaurant_members rm_actor ON rm_actor.restaurant_id = rm_target.restaurant_id
      JOIN public.roles r_actor ON r_actor.id = rm_actor.role_id
      WHERE rm_target.profile_id = profiles.id
        AND rm_actor.profile_id = auth.uid()
        AND rm_actor.status = 'active'
        AND r_actor.code IN ('restaurant_admin', 'manager')
    )
  );

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- 4. ROLES, PERMISSIONS, ROLE_PERMISSIONS : lecture authentifiée, écriture Super Admin
CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY roles_super_admin_all ON public.roles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY permissions_select_authenticated ON public.permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY permissions_super_admin_all ON public.permissions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY role_permissions_select_authenticated ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY role_permissions_super_admin_all ON public.role_permissions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 5. RESTAURANT_MEMBERS : isolation stricte par restaurant_id
CREATE POLICY restaurant_members_select ON public.restaurant_members
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR profile_id = auth.uid()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager'])
  );

CREATE POLICY restaurant_members_manage ON public.restaurant_members
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']) AND public.has_active_license(restaurant_id))
  );

-- 6. LICENSES : lecture par le restaurant_admin concerné, contrôle exclusif Super Admin
CREATE POLICY licenses_select ON public.licenses
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
  );

CREATE POLICY licenses_super_admin_write ON public.licenses
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 7. MENU (CATEGORIES, PRODUCTS, PRODUCT_IMAGES) : vitrine publique + gestion par restaurant
CREATE POLICY categories_select ON public.categories
  FOR SELECT TO anon, authenticated
  USING (
    (is_active = TRUE AND public.has_active_license(restaurant_id))
    OR public.is_super_admin()
    OR public.is_restaurant_member(restaurant_id)
  );

CREATE POLICY categories_write ON public.categories
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY products_select ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    (is_available = TRUE AND public.has_active_license(restaurant_id))
    OR public.is_super_admin()
    OR public.is_restaurant_member(restaurant_id)
  );

CREATE POLICY products_write ON public.products
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY product_images_select ON public.product_images
  FOR SELECT TO anon, authenticated
  USING (
    public.has_active_license(restaurant_id)
    OR public.is_super_admin()
    OR public.is_restaurant_member(restaurant_id)
  );

CREATE POLICY product_images_write ON public.product_images
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

-- 8. TABLES, CLIENTS, COMMANDES & RÉSERVATIONS
CREATE POLICY restaurant_tables_select ON public.restaurant_tables
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY restaurant_tables_write ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'server']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'server']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY customers_write ON public.customers
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY orders_write ON public.orders
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server', 'cook']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server', 'cook']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY order_items_select ON public.order_items
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY order_items_write ON public.order_items
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server', 'cook']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier', 'server', 'cook']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY reservations_select ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY reservations_write ON public.reservations
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'server']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'server']) AND public.has_active_license(restaurant_id))
  );

-- 9. STOCKS (INGREDIENTS, INVENTORY_MOVEMENTS)
CREATE POLICY ingredients_select ON public.ingredients
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY ingredients_write ON public.ingredients
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cook']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cook']) AND public.has_active_license(restaurant_id))
  );

CREATE POLICY inventory_movements_select ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_restaurant_member(restaurant_id));

CREATE POLICY inventory_movements_insert ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cook']) AND public.has_active_license(restaurant_id))
  );

-- 10. PERSONNEL & FINANCES (EMPLOYEES, PAYMENTS, EXPENSES)
CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager'])
  );

CREATE POLICY employees_write ON public.employees
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

-- Paiements : les paiements de licence sont réservés en écriture au Super Admin
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      payment_scope = 'order'
      AND public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier'])
    )
    OR (
      payment_scope = 'license'
      AND public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin'])
    )
  );

CREATE POLICY payments_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      payment_scope = 'order'
      AND public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager', 'cashier'])
      AND public.has_active_license(restaurant_id)
    )
  );

CREATE POLICY payments_update_super_admin ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY expenses_select ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager'])
  );

CREATE POLICY expenses_write ON public.expenses
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin', 'manager']) AND public.has_active_license(restaurant_id))
  );

-- 11. NOTIFICATIONS & AUDIT LOGS
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_profile_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_profile_id = auth.uid())
  WITH CHECK (recipient_profile_id = auth.uid());

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (restaurant_id IS NOT NULL AND public.has_restaurant_role(restaurant_id, ARRAY['restaurant_admin']))
  );

CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (restaurant_id IS NOT NULL AND public.is_restaurant_member(restaurant_id))
  );

-- ============================================================================
-- 12. BUCKETS SUPABASE STORAGE & RLS SUR OBJECTS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('restaurant-assets', 'restaurant-assets', TRUE),
  ('product-images', 'product-images', TRUE),
  ('expense-receipts', 'expense-receipts', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Convention de chemin obligatoire : <restaurant_id>/<fichier>
CREATE POLICY storage_public_read_assets ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('restaurant-assets', 'product-images'));

CREATE POLICY storage_tenant_manage_assets ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('restaurant-assets', 'product-images', 'expense-receipts')
    AND (
      public.is_super_admin()
      OR public.has_restaurant_role((string_to_array(name, '/'))[1]::UUID, ARRAY['restaurant_admin', 'manager'])
    )
  )
  WITH CHECK (
    bucket_id IN ('restaurant-assets', 'product-images', 'expense-receipts')
    AND (
      public.is_super_admin()
      OR public.has_restaurant_role((string_to_array(name, '/'))[1]::UUID, ARRAY['restaurant_admin', 'manager'])
    )
  );
