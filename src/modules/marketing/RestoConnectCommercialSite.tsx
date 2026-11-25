import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ExternalLink,
  Layers,
  Lock,
  Mail,
  MapPin,
  Menu,
  PackageCheck,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BrandMark } from '@/src/components/layout/BrandMark';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { SiteAttributionBar } from '@/src/components/layout/SiteAttributionBar';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import { formatMoney } from '@/src/lib/domain/operations';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';

const COMMERCIAL_NAV = [
  { to: '/presentation', label: 'Présentation' },
  { to: '/fonctionnalites', label: 'Fonctionnalités' },
  { to: '/avantages', label: 'Avantages' },
  { to: '/demonstration', label: 'Démonstration' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
] as const;

const REAL_MODULES = [
  {
    icon: Store,
    title: 'Vitrine & Menu public par restaurant',
    detail:
      'Chaque restaurant dispose de sa propre adresse /restaurant/slug, de son logo, de sa galerie photo, de ses couleurs et de sa carte interactive isolée.',
  },
  {
    icon: ChefHat,
    title: 'Commandes en ligne & Suivi temps réel',
    detail:
      'Service sur place, à emporter et livraison locale par commune avec options de plats, suivi public par jeton et file de préparation cuisine.',
  },
  {
    icon: CalendarClock,
    title: 'Réservations & Plan de tables',
    detail:
      'Gestion des tables, zones de salle, capacités et détection automatique de conflits horaires avant confirmation client.',
  },
  {
    icon: Wallet,
    title: 'Caisse physique USD / CDF & Reçus',
    detail:
      'Ouverture et clôture de sessions de caisse, encaissements sur place (espèces USD/CDF, Mobile Money, carte TPE), paiements partiels, remboursements et reçus A4 / 80 mm.',
  },
  {
    icon: PackageCheck,
    title: 'Stocks, Recettes & Fournisseurs',
    detail:
      'Fiches techniques par plat, déduction de stock sur commande servie, bons de commande fournisseurs, réceptions partielles et alertes de seuil minimum.',
  },
  {
    icon: Users,
    title: 'Personnel, Présences & Paie',
    detail:
      'Rôles granulaires par établissement, pointage entrées/sorties, congés, fiches de paie et règlement des salaires en USD ou CDF.',
  },
] as const;

const DRC_ADVANTAGES = [
  {
    title: 'Paiement sur place prioritaire',
    body: "Vos clients commandent en ligne sans blocage de carte bancaire internationale et règlent à la caisse, au retrait ou à la livraison en USD, CDF ou Mobile Money local.",
  },
  {
    title: 'Licence perpétuelle sans coupure automatique',
    body: "Chaque établissement acquiert sa licence d'exploitation sans expiration automatique mensuelle. La maintenance technique reste un contrat séparé et facultatif.",
  },
  {
    title: 'Isolation multi-tenant stricte',
    body: 'Chaque restaurant ne voit que ses propres menus, commandes, recettes, caisses, salariés et paramètres visuels. Aucune fuite de données entre établissements.',
  },
  {
    title: 'Adapté aux réalités de Kinshasa & des provinces',
    body: 'Double devise USD / Franc congolais avec taux configurable par établissement, fuseaux horaires WAT/CAT et zones de livraison par commune.',
  },
] as const;

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne la licence perpétuelle RestoConnect ?',
    a: "La licence est attribuée à votre établissement après règlement unique et vérification par l'administrateur de la plateforme. Elle ne comporte pas de date d'expiration automatique : votre restaurant conserve l'accès à son espace de gestion.",
  },
  {
    q: 'Le contrat de maintenance est-il obligatoire ?',
    a: "Non. La maintenance annuelle est une option séparée couvrant l'assistance prioritaire, les évolutions fonctionnelles et l'accompagnement technique. Si un contrat de maintenance arrive à échéance ou est résilié, la licence perpétuelle du restaurant reste active.",
  },
  {
    q: 'Les clients doivent-ils obligatoirement payer en ligne pour commander ?',
    a: "Non. RestoConnect est conçu pour les habitudes locales en RDC : le client valide sa commande en ligne et règle sur place à la table, au comptoir ou à la livraison (espèces USD/CDF, Mobile Money sur place ou terminal TPE).",
  },
  {
    q: 'Chaque restaurant peut-il personnaliser son lien et ses couleurs ?',
    a: "Oui. Chaque établissement configure son nom, logo, image de couverture, galerie de photos, palette principale/secondaire, horaires et slug (/restaurant/nom-du-restaurant) avec redirection automatique des anciens slugs.",
  },
  {
    q: 'Un restaurant peut-il voir les chiffres ou clients d’un autre restaurant ?',
    a: "Non. L'architecture multi-tenant isole strictement toutes les tables opérationnelles par identifiant de restaurant et contrôle d'accès par rôle.",
  },
] as const;

export function RestoConnectCommercialSite() {
  const location = useLocation();
  const pathname = location.pathname;
  const { platformSettings, restaurants, submitCommercialInquiry } = useRestoStore();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [inquiryFeedback, setInquiryFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const activeRestaurants = restaurants.filter((r) => r.status === 'active');

  const isHome = pathname === '/';
  const isPresentation = pathname === '/presentation';
  const isFeatures = pathname === '/fonctionnalites';
  const isAdvantages = pathname === '/avantages';
  const isDemo = pathname === '/demonstration';
  const isFaq = pathname === '/faq';
  const isContact = pathname === '/contact';
  const isTerms = pathname === '/conditions-utilisation';
  const isPrivacy = pathname === '/confidentialite';

  function handleInquirySubmit(e: FormEvent) {
    e.preventDefault();
    setInquiryFeedback(null);
    const res = submitCommercialInquiry({
      fullName,
      restaurantName,
      city,
      phone,
      email,
      message,
    });
    if (!res.ok) {
      setInquiryFeedback({ ok: false, text: res.error });
      return;
    }
    setFullName('');
    setRestaurantName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setInquiryFeedback({
      ok: true,
      text: `Demande transmise à l'équipe ${platformSettings.platformName}. Référence enregistrée pour suivi commercial.`,
    });
  }

  return (
    <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--rc-border)] bg-[var(--rc-header)] backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)] rounded shrink-0"
          >
            <BrandMark />
          </Link>

          <nav
            aria-label="Navigation commerciale RestoConnect"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-[var(--rc-muted)]"
          >
            {COMMERCIAL_NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-[var(--rc-gold-text)] font-semibold' : 'hover:text-[var(--rc-fg)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <ThemeToggle variant="compact" />
            </div>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/apercu-architecture">Aperçu SaaS</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Connexion</Link>
            </Button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="lg:hidden rounded-md p-2 text-[var(--rc-fg)] hover:bg-[var(--rc-surface-muted)] cursor-pointer"
              aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="lg:hidden border-t border-[var(--rc-border)] bg-[var(--rc-card)] px-4 py-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--rc-border)]">
              <span className="text-xs font-medium text-[var(--rc-muted)]">Thème</span>
              <ThemeToggle variant="compact" />
            </div>
            {COMMERCIAL_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className="block py-1.5 text-sm font-medium text-[var(--rc-fg)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/apercu-architecture"
              onClick={() => setMobileNavOpen(false)}
              className="block py-1.5 text-sm font-semibold text-[var(--rc-gold-text)]"
            >
              Aperçu des 3 espaces privés
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        {(isHome || isPresentation) && (
          <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Plateforme SaaS multi-tenant · République démocratique du Congo
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--rc-fg)] leading-[1.1] text-balance">
                  {platformSettings.platformName} — {platformSettings.tagline}
                </h1>
                <p className="text-base leading-relaxed text-[var(--rc-muted)] max-w-xl">
                  Digitalisez la salle, la cuisine, la caisse USD/CDF, les stocks, le personnel et la vitrine
                  publique de chaque restaurant dans un environnement multi-établissement isolé, commercialisé par
                  licence perpétuelle.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button asChild size="lg">
                    <Link to="/contact">
                      <span>Demander une démonstration</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/demonstration">Voir les vitrines partenaires</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--rc-border)] text-xs">
                  <div>
                    <p className="font-mono text-lg font-bold text-[var(--rc-gold-text)] tabular-nums">
                      {formatMoney(platformSettings.standardLicensePriceUsd, 'USD')}
                    </p>
                    <p className="text-[var(--rc-muted)]">Licence perpétuelle</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-[var(--rc-fg)] tabular-nums">USD / CDF</p>
                    <p className="text-[var(--rc-muted)]">Caisse &amp; reçus locaux</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-[var(--rc-fg)] tabular-nums">
                      {activeRestaurants.length} actifs
                    </p>
                    <p className="text-[var(--rc-muted)]">Espaces isolés</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="aspect-[16/10] rounded-xl overflow-hidden border border-[var(--rc-border)] bg-[var(--rc-card)] flex flex-col items-center justify-center p-8 text-center">
                  <div className="h-14 w-14 rounded-xl bg-[var(--rc-gold-tint)] text-[var(--rc-gold)] flex items-center justify-center mb-4">
                    <Store className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="font-display text-lg font-semibold text-[var(--rc-fg)]">
                    Espace visuel prêt pour vos propres médias
                  </p>
                  <p className="mt-2 text-xs text-[var(--rc-muted)] max-w-sm leading-relaxed">
                    Importez votre logo et les photos de chaque restaurant directement depuis l&apos;administration de votre établissement.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-4">
                    <p className="text-xs font-semibold text-[var(--rc-gold-text)]">4 espaces séparés</p>
                    <p className="text-xs text-[var(--rc-muted)] mt-1">
                      Super Admin, Admin Restaurant, Personnel opérationnel et Vitrine client.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-4">
                    <p className="text-xs font-semibold text-[var(--rc-gold-text)]">Maintenance optionnelle</p>
                    <p className="text-xs text-[var(--rc-muted)] mt-1">
                      Contrat séparé à{' '}
                      <span className="font-mono text-[var(--rc-fg)]">
                        {formatMoney(platformSettings.maintenanceAnnualPriceUsd, 'USD')}/an
                      </span>{' '}
                      sans blocage de licence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {isPresentation && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 space-y-8">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Architecture &amp; Vision produit
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--rc-fg)]">
                  Un socle SaaS centralisé pour des restaurants indépendants
                </h2>
                <p className="text-sm text-[var(--rc-muted)]">
                  Conçu pour les restaurants gastronomiques, terrasses, maquis, fast-foods et hôtels-restaurants en
                  République démocratique du Congo.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <Building2 className="h-5 w-5 text-[var(--rc-gold)] mb-2" aria-hidden="true" />
                    <CardTitle className="text-base">Gouvernance Super Admin</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-[var(--rc-muted)] leading-relaxed">
                    Enregistrez vos restaurants clients, délivrez leurs licences perpétuelles, suivez les règlements et
                    générez factures, reçus et contrats officiels depuis un tableau de bord unique.
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <Layers className="h-5 w-5 text-[var(--rc-gold)] mb-2" aria-hidden="true" />
                    <CardTitle className="text-base">Espaces de gestion dédiés</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-[var(--rc-muted)] leading-relaxed">
                    Chaque gérant pilote son propre menu, ses tables, son inventaire, sa caisse et son équipe selon
                    une matrice de permissions stricte.
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <Sparkles className="h-5 w-5 text-[var(--rc-gold)] mb-2" aria-hidden="true" />
                    <CardTitle className="text-base">Vitrine publique par enseigne</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-[var(--rc-muted)] leading-relaxed">
                    Chaque restaurant expose sa propre identité visuelle sur{' '}
                    <span className="font-mono">/restaurant/slug</span> sans jamais dépendre de l&apos;apparence d&apos;un
                    autre établissement.
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}

        {(isHome || isFeatures) && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                    Périmètre fonctionnel réel
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                    Tous les modules opérationnels de votre restaurant
                  </h2>
                  <p className="text-sm text-[var(--rc-muted)]">
                    Chaque capacité présentée ci-dessous est active dans RestoConnect sans dépendance cachée.
                  </p>
                </div>
                {!isFeatures && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/fonctionnalites">Détail des fonctionnalités</Link>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {REAL_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <Card key={mod.title}>
                      <CardHeader className="pb-2">
                        <div className="h-9 w-9 rounded-lg bg-[var(--rc-gold-tint)] text-[var(--rc-gold)] flex items-center justify-center mb-2">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-base">{mod.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-[var(--rc-muted)] leading-relaxed">{mod.detail}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {(isHome || isAdvantages) && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                    Conçu pour le terrain
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                    Pourquoi les restaurateurs en RDC choisissent RestoConnect
                  </h2>
                  <p className="text-sm text-[var(--rc-muted)] leading-relaxed">
                    Pas d&apos;abonnement bloquant ni de paiement en ligne forcé : vos opérations quotidiennes restent
                    fluides, traçables et adaptées à la caisse locale.
                  </p>
                  <div className="rounded-xl border border-[var(--rc-gold)]/35 bg-[var(--rc-gold-tint)] p-5 space-y-2">
                    <p className="text-xs font-semibold text-[var(--rc-gold-text)]">Modèle de commercialisation transparent</p>
                    <p className="text-xs text-[var(--rc-fg)]">
                      • Licence perpétuelle standard :{' '}
                      <strong className="font-mono">
                        {formatMoney(platformSettings.standardLicensePriceUsd, 'USD')}
                      </strong>
                    </p>
                    <p className="text-xs text-[var(--rc-fg)]">
                      • Contrat de maintenance annuel optionnel :{' '}
                      <strong className="font-mono">
                        {formatMoney(platformSettings.maintenanceAnnualPriceUsd, 'USD')}
                      </strong>
                    </p>
                    <p className="text-[11px] text-[var(--rc-muted)] pt-1">{platformSettings.commercialTerms}</p>
                  </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DRC_ADVANTAGES.map((adv) => (
                    <Card key={adv.title}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-[var(--rc-gold)] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{adv.title}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-[var(--rc-muted)] leading-relaxed">{adv.body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {(isHome || isDemo) && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                    Vitrines publiques actives &amp; Démonstration
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                    Explorez des restaurants configurés sur RestoConnect
                  </h2>
                  <p className="text-sm text-[var(--rc-muted)]">
                    Chaque carte ouvre l&apos;espace public réel d&apos;un restaurant avec son propre thème, son menu et ses
                    commandes, ou accédez à l&apos;aperçu complet des espaces privés.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/apercu-architecture">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tester les 3 espaces de gestion</span>
                  </Link>
                </Button>
              </div>

              {activeRestaurants.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center space-y-3">
                    <Store className="h-8 w-8 text-[var(--rc-gold)] mx-auto" aria-hidden="true" />
                    <p className="font-display text-base font-semibold text-[var(--rc-fg)]">
                      Aucun restaurant enregistré pour le moment
                    </p>
                    <p className="text-xs text-[var(--rc-muted)] max-w-md mx-auto">
                      Créez votre premier établissement depuis l&apos;espace Super Administrateur pour publier sa vitrine et importer ses propres images.
                    </p>
                    <div className="pt-1">
                      <Button asChild size="sm">
                        <Link to="/apercu-architecture">Ouvrir l&apos;espace Super Administrateur</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeRestaurants.map((rest) => (
                    <Card key={rest.id} className="overflow-hidden">
                      <div className="h-44 bg-[var(--rc-surface-muted)] relative overflow-hidden flex items-center justify-center">
                        {rest.cover_image_url ? (
                          <img
                            src={rest.cover_image_url}
                            alt={rest.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[var(--rc-muted)]">
                            <Store className="h-7 w-7 text-[var(--rc-gold)]" aria-hidden="true" />
                            <span className="text-xs">Aucune photo importée</span>
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{rest.name}</CardTitle>
                            <CardDescription>
                              {rest.cuisine_type ?? rest.establishment_type} · {rest.city}
                            </CardDescription>
                          </div>
                          <span
                            className="h-5 w-5 rounded border border-[var(--rc-border)] shrink-0"
                            style={{ backgroundColor: rest.primary_color }}
                            title={`Couleur principale : ${rest.primary_color}`}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-xs text-[var(--rc-muted)] leading-relaxed">
                          {rest.description ?? 'Vitrine publique personnalisée avec commande en ligne et réservation.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--rc-border)]">
                          <span className="font-mono text-[11px] text-[var(--rc-muted)]">
                            /restaurant/{rest.slug}
                          </span>
                          <Button asChild size="sm">
                            <Link to={`/restaurant/${rest.slug}`}>
                              <span>Ouvrir la vitrine</span>
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {(isHome || isFaq) && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-8">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Questions fréquentes
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                  Tout savoir sur les licences et le déploiement
                </h2>
              </div>

              <div className="space-y-3 max-w-3xl">
                {FAQ_ITEMS.map((item, idx) => {
                  const open = openFaqIdx === idx;
                  return (
                    <div
                      key={item.q}
                      className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(open ? null : idx)}
                        aria-expanded={open}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] cursor-pointer"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-[var(--rc-muted)] shrink-0 transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {open && (
                        <div className="px-5 pb-4 text-xs text-[var(--rc-muted)] leading-relaxed border-t border-[var(--rc-border)] pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {(isHome || isContact) && (
          <>
            <Separator />
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                    Acquisition de licence &amp; Contact commercial
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                    Équipez votre restaurant avec {platformSettings.platformName}
                  </h2>
                  <p className="text-sm text-[var(--rc-muted)] leading-relaxed">
                    Transmettez vos coordonnées : votre demande est directement enregistrée dans l&apos;espace Super
                    Administrateur pour organiser une présentation et préparer votre licence.
                  </p>
                  <div className="space-y-3 text-xs text-[var(--rc-muted)] pt-2">
                    {platformSettings.commercialPhone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                        <span>
                          Téléphone &amp; WhatsApp :{' '}
                          <strong className="text-[var(--rc-fg)]">{platformSettings.commercialPhone}</strong>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                      <span>
                        Contact :{' '}
                        <strong className="text-[var(--rc-fg)]">{platformSettings.supportEmail}</strong>
                      </span>
                    </div>
                    {platformSettings.commercialAddress && (
                      <div className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                        <span>{platformSettings.commercialAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle className="text-lg">Demander une démonstration ou un devis de licence</CardTitle>
                    <CardDescription>
                      Réponse par notre équipe commerciale en République démocratique du Congo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleInquirySubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="com-fullname">Votre nom complet *</Label>
                          <Input
                            id="com-fullname"
                            placeholder="Nom et prénom"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="com-restoname">Nom du restaurant *</Label>
                          <Input
                            id="com-restoname"
                            placeholder="Nom de votre établissement"
                            value={restaurantName}
                            onChange={(e) => setRestaurantName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="com-city">Ville</Label>
                          <Input
                            id="com-city"
                            placeholder="Kinshasa, Lubumbashi, Goma..."
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="com-phone">Téléphone / WhatsApp *</Label>
                          <Input
                            id="com-phone"
                            type="tel"
                            placeholder="+243 ..."
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="com-email">Adresse e-mail *</Label>
                        <Input
                          id="com-email"
                          type="email"
                          placeholder="direction@monrestaurant.cd"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="com-message">Vos besoins (nombre de caisses, salles, livraison...)</Label>
                        <textarea
                          id="com-message"
                          rows={3}
                          placeholder="Décrivez votre établissement et le type d'accompagnement souhaité..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                          className="flex w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3.5 py-2 text-sm text-[var(--rc-fg)] placeholder:text-[var(--rc-muted)]"
                        />
                      </div>

                      {inquiryFeedback && (
                        <div
                          role="status"
                          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                            inquiryFeedback.ok
                              ? 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                              : 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{inquiryFeedback.text}</span>
                        </div>
                      )}

                      <Button type="submit" className="w-full">
                        Envoyer la demande commerciale
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}

        {isTerms && (
          <section className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 space-y-6">
            <div className="space-y-2 border-b border-[var(--rc-border)] pb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">Cadre contractuel</p>
              <h1 className="font-display text-3xl font-bold text-[var(--rc-fg)]">
                Conditions générales d&apos;utilisation — {platformSettings.platformName}
              </h1>
            </div>
            <div className="space-y-4 text-sm text-[var(--rc-muted)] leading-relaxed">
              <p>
                <strong className="text-[var(--rc-fg)]">1. Objet et licences perpétuelles :</strong>{' '}
                {platformSettings.platformName} concède à chaque établissement client une licence d&apos;exploitation
                non exclusive attachée à son identifiant unique. Sauf suspension ou révocation décidée par
                l&apos;administration de la plateforme en cas de non-respect grave ou de non-règlement avéré, la licence
                perpétuelle demeure active sans limite de durée.
              </p>
              <p>
                <strong className="text-[var(--rc-fg)]">2. Contrats de maintenance optionnels :</strong> Tout contrat
                de maintenance souscrit auprès de {platformSettings.platformName} est indépendant de la validité
                perpétuelle de la licence logicielle. L&apos;échéance ou la résiliation d&apos;une maintenance met fin
                uniquement aux prestations d&apos;assistance associées.
              </p>
              <p>
                <strong className="text-[var(--rc-fg)]">3. Isolation multi-tenant &amp; responsabilités :</strong> Chaque
                restaurant est responsable de l&apos;exactitude de ses prix, menus, taux de change locaux, encaissements
                en caisse et comptes utilisateurs créés pour son équipe.
              </p>
            </div>
          </section>
        )}

        {isPrivacy && (
          <section className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 space-y-6">
            <div className="space-y-2 border-b border-[var(--rc-border)] pb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">Protection des données</p>
              <h1 className="font-display text-3xl font-bold text-[var(--rc-fg)]">
                Politique de confidentialité — {platformSettings.platformName}
              </h1>
            </div>
            <div className="space-y-4 text-sm text-[var(--rc-muted)] leading-relaxed">
              <p>
                <strong className="text-[var(--rc-fg)]">1. Cloisonnement strict par restaurant :</strong> Toutes les
                données opérationnelles (commandes, réservations, stocks, écritures de caisse, salaires) sont
                partitionnées par identifiant de restaurant et protégées par contrôle d&apos;accès côté base de données.
              </p>
              <p>
                <strong className="text-[var(--rc-fg)]">2. Données collectées :</strong> Les informations saisies dans
                les formulaires publics (commandes, réservations, demandes de démonstration) servent exclusivement au
                traitement de la relation client ou commerciale, sans revente à des tiers.
              </p>
              <p>
                <strong className="text-[var(--rc-fg)]">3. Contact confidentialité :</strong> Pour toute demande d&apos;accès
                ou de suppression de données, contactez{' '}
                <span className="font-mono text-[var(--rc-fg)]">{platformSettings.supportEmail}</span>.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[var(--rc-border)] bg-[var(--rc-card)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-2">
            <BrandMark />
            <p className="text-xs text-[var(--rc-muted)] max-w-sm leading-relaxed">
              {platformSettings.tagline} — Logiciel SaaS multi-tenant pour les restaurants en République
              démocratique du Congo.
            </p>
            <p className="text-[11px] font-mono text-[var(--rc-muted)]">
              {[platformSettings.commercialPhone, platformSettings.supportEmail].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="md:col-span-3 space-y-2 text-xs">
            <p className="font-semibold text-[var(--rc-fg)]">Plateforme</p>
            <ul className="space-y-1.5 text-[var(--rc-muted)]">
              <li><Link to="/presentation" className="hover:text-[var(--rc-fg)]">Présentation</Link></li>
              <li><Link to="/fonctionnalites" className="hover:text-[var(--rc-fg)]">Fonctionnalités</Link></li>
              <li><Link to="/avantages" className="hover:text-[var(--rc-fg)]">Avantages RDC</Link></li>
              <li><Link to="/demonstration" className="hover:text-[var(--rc-fg)]">Vitrines &amp; Démo</Link></li>
            </ul>
          </div>
          <div className="md:col-span-4 space-y-2 text-xs">
            <p className="font-semibold text-[var(--rc-fg)]">Accès &amp; Informations légales</p>
            <ul className="space-y-1.5 text-[var(--rc-muted)]">
              <li><Link to="/suivi-commande" className="hover:text-[var(--rc-fg)]">Suivi de commande client</Link></li>
              <li><Link to="/faq" className="hover:text-[var(--rc-fg)]">Foire aux questions</Link></li>
              <li><Link to="/contact" className="hover:text-[var(--rc-fg)]">Contact commercial</Link></li>
              <li><Link to="/conditions-utilisation" className="hover:text-[var(--rc-fg)]">Conditions d&apos;utilisation</Link></li>
              <li><Link to="/confidentialite" className="hover:text-[var(--rc-fg)]">Politique de confidentialité</Link></li>
            </ul>
          </div>
        </div>
        <SiteAttributionBar />
      </footer>
    </div>
  );
}
