-- ============================================================================
-- RestoConnect — Seed structurel (Rôles, Permissions, Plans commerciaux)
-- Aucune donnée financière ou transaction fictive n'est insérée ici.
-- ============================================================================

INSERT INTO public.roles (code, name, description, is_system)
VALUES
  ('restaurant_admin', 'Administrateur du restaurant', 'Contrôle complet de son établissement, menu, personnel, finances et personnalisation.', TRUE),
  ('manager', 'Gestionnaire', 'Supervision opérationnelle quotidienne, stocks, réservations et équipe.', TRUE),
  ('cashier', 'Caissier', 'Encaissement des commandes, suivi de caisse et clôture des additions.', TRUE),
  ('server', 'Serveur', 'Prise de commande en salle, gestion des tables et accueil réservations.', TRUE),
  ('cook', 'Cuisinier', 'Réception des bons cuisine, suivi de préparation et alertes de stock.', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, module, description)
VALUES
  ('dashboard.view', 'dashboard', 'Consulter les indicateurs de l''établissement'),
  ('menu.read', 'menu', 'Consulter les catégories et produits'),
  ('menu.write', 'menu', 'Créer et modifier le menu et les tarifs'),
  ('orders.read', 'orders', 'Consulter les commandes'),
  ('orders.create', 'orders', 'Prendre de nouvelles commandes'),
  ('orders.kitchen', 'orders', 'Mettre à jour le statut de préparation cuisine'),
  ('payments.collect', 'finance', 'Encaisser les commandes clients'),
  ('finance.view', 'finance', 'Consulter les rapports financiers et dépenses'),
  ('reservations.manage', 'reservations', 'Gérer les réservations et le plan de salle'),
  ('inventory.manage', 'inventory', 'Gérer les ingrédients et mouvements de stock'),
  ('employees.manage', 'employees', 'Gérer le personnel et les accès'),
  ('settings.customize', 'settings', 'Personnaliser le logo, les couleurs et les paramètres')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plans (code, name, description, billing_model, base_price_usd, maintenance_annual_usd, max_staff, max_tables)
VALUES
  (
    'rc-perpetual-core',
    'Licence Perpétuelle Standard',
    'Licence d''exploitation perpétuelle par établissement, hébergement multi-tenant isolé inclus.',
    'perpetual',
    0.00,
    0.00,
    25,
    40
  ),
  (
    'rc-perpetual-maintenance',
    'Licence Perpétuelle + Maintenance',
    'Licence perpétuelle assortie d''un contrat annuel de maintenance, mises à jour et support prioritaire.',
    'perpetual_with_maintenance',
    0.00,
    0.00,
    100,
    150
  )
ON CONFLICT (code) DO NOTHING;
