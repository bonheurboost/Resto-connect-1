import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Clock,
  CalendarClock,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Plus,
  Minus,
  Trash2,
  Star,
  Truck,
  SlidersHorizontal,
  Mail,
  MessageCircle,
  Globe,
  Search,
  UtensilsCrossed,
  Image as ImageIcon,
} from 'lucide-react';
import { BrandMark } from '@/src/components/layout/BrandMark';
import { SiteAttributionBar } from '@/src/components/layout/SiteAttributionBar';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import {
  addCartItemSafe,
  computeAuthoritativeOrder,
  formatMoney,
  type CartOptionSelection,
  type CartState,
} from '@/src/lib/domain/operations';
import { resolveRestaurantSlugOrRedirect, sanitizeMediaUrl } from '@/src/lib/domain/commercial';
import type { OrderRecord, ProductRecord } from '@/src/lib/supabase/database.types';

const CART_STORAGE_KEY = 'restoconnect_cart_v1';

function loadSessionCart(): CartState {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { restaurantId: null, items: [] };
    const parsed = JSON.parse(raw) as CartState;
    if (!parsed || !Array.isArray(parsed.items)) return { restaurantId: null, items: [] };
    return parsed;
  } catch {
    return { restaurantId: null, items: [] };
  }
}

export function PublicRestaurantPortal() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const {
    restaurants,
    slugRedirects,
    categories,
    products,
    productImages,
    productOptions,
    productOptionValues,
    deliveryZones,
    activeTenantId,
    setActiveTenantId,
    createOrder,
    createReservation,
  } = useRestoStore();

  const activeRestaurants = restaurants.filter((r) => r.status === 'active');
  const resolvedSlug = slug
    ? resolveRestaurantSlugOrRedirect(restaurants, slugRedirects, slug)
    : { restaurant: null, redirectedFrom: null };

  useEffect(() => {
    if (resolvedSlug.redirectedFrom && resolvedSlug.restaurant) {
      navigate(`/restaurant/${resolvedSlug.restaurant.slug}`, { replace: true });
    }
  }, [resolvedSlug.redirectedFrom, resolvedSlug.restaurant, navigate]);

  const notFoundForSlug = Boolean(slug && !resolvedSlug.restaurant);

  const currentRestaurant =
    resolvedSlug.restaurant ||
    restaurants.find((r) => r.id === activeTenantId) ||
    activeRestaurants[0] ||
    restaurants[0] ||
    null;

  const tenantId = currentRestaurant?.id ?? '';
  const tenantCategories = categories.filter(
    (c) => c.restaurant_id === tenantId && c.is_active
  );
  const tenantProducts = products.filter(
    (p) =>
      p.restaurant_id === tenantId &&
      p.is_available &&
      !p.is_temporarily_disabled
  );
  const tenantZones = deliveryZones.filter(
    (z) => z.restaurant_id === tenantId && z.is_active
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [dishSearch, setDishSearch] = useState('');

  const [cart, setCart] = useState<CartState>(() => loadSessionCart());
  useEffect(() => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  const [configuringProduct, setConfiguringProduct] = useState<ProductRecord | null>(null);
  const [selectedOptionValues, setSelectedOptionValues] = useState<Record<string, string[]>>({});
  const [itemSpecialNote, setItemSpecialNote] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);

  const [pendingConflictItem, setPendingConflictItem] = useState<{
    productId: string;
    quantity: number;
    selectedOptions: CartOptionSelection[];
    specialInstructions?: string;
  } | null>(null);

  const allowedModes = currentRestaurant?.allowed_order_modes ?? ['takeaway'];
  const [orderType, setOrderType] = useState<OrderRecord['order_type']>(
    allowedModes.includes('takeaway')
      ? 'takeaway'
      : allowedModes[0] ?? 'dine_in'
  );
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [orderCustomerPhone, setOrderCustomerPhone] = useState('');
  const [deliveryZoneId, setDeliveryZoneId] = useState<string>(tenantZones[0]?.id ?? '');
  const [deliveryCommune, setDeliveryCommune] = useState(tenantZones[0]?.commune ?? '');
  const [deliveryQuartier, setDeliveryQuartier] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [orderNotice, setOrderNotice] = useState<{
    type: 'success' | 'error';
    message: string;
    trackingToken?: string | null;
  } | null>(null);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [reservedFor, setReservedFor] = useState('2026-11-26T19:30');
  const [reservationNotes, setReservationNotes] = useState('');
  const [reservationNotice, setReservationNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactNotice, setContactNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const visibleProducts = useMemo(() => {
    const byCat =
      selectedCategoryId === 'all'
        ? tenantProducts
        : tenantProducts.filter((p) => p.category_id === selectedCategoryId);
    const q = dishSearch.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [tenantProducts, selectedCategoryId, dishSearch]);

  const isCartForOtherRestaurant =
    Boolean(currentRestaurant) &&
    cart.restaurantId !== null &&
    cart.restaurantId !== tenantId &&
    cart.items.length > 0;

  const cartRestaurantName = cart.restaurantId
    ? restaurants.find((r) => r.id === cart.restaurantId)?.name ?? 'un autre restaurant'
    : '';

  const currentCartItems = useMemo(
    () => (tenantId && cart.restaurantId === tenantId ? cart.items : []),
    [cart, tenantId]
  );

  const effectiveZoneId = useMemo(() => {
    if (orderType !== 'delivery') return null;
    if (tenantZones.some((z) => z.id === deliveryZoneId)) return deliveryZoneId;
    return tenantZones[0]?.id ?? null;
  }, [orderType, tenantZones, deliveryZoneId]);

  const cartCalculation = useMemo(() => {
    if (!currentRestaurant || currentCartItems.length === 0) return null;
    return computeAuthoritativeOrder({
      restaurantId: currentRestaurant.id,
      orderType,
      defaultCurrency: currentRestaurant.default_currency,
      exchangeRateUsdCdf: currentRestaurant.exchange_rate_usd_cdf,
      products,
      productOptions,
      optionValues: productOptionValues,
      deliveryZones,
      deliveryZoneId: effectiveZoneId,
      requestedItems: currentCartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions,
        specialInstructions: i.specialInstructions,
      })),
    });
  }, [
    currentCartItems,
    currentRestaurant,
    orderType,
    products,
    productOptions,
    productOptionValues,
    deliveryZones,
    effectiveZoneId,
  ]);

  function openOrQuickAddProduct(product: ProductRecord) {
    if (!currentRestaurant) return;
    const opts = productOptions.filter(
      (o) => o.product_id === product.id && o.restaurant_id === currentRestaurant.id
    );
    if (opts.length === 0) {
      attemptAddCartItem({
        productId: product.id,
        quantity: 1,
        selectedOptions: [],
      });
      return;
    }
    const initialSelections: Record<string, string[]> = {};
    for (const opt of opts) {
      const vals = productOptionValues.filter((v) => v.option_id === opt.id && v.is_available);
      if (opt.is_required && vals.length > 0) {
        initialSelections[opt.id] = [vals[0].id];
      } else {
        initialSelections[opt.id] = [];
      }
    }
    setSelectedOptionValues(initialSelections);
    setItemSpecialNote('');
    setConfigError(null);
    setConfiguringProduct(product);
  }

  function attemptAddCartItem(
    payload: {
      productId: string;
      quantity: number;
      selectedOptions: CartOptionSelection[];
      specialInstructions?: string;
    },
    replaceIfDifferent = false
  ) {
    if (!currentRestaurant) return;
    const res = addCartItemSafe(
      cart,
      {
        restaurantId: currentRestaurant.id,
        productId: payload.productId,
        quantity: payload.quantity,
        selectedOptions: payload.selectedOptions,
        specialInstructions: payload.specialInstructions,
      },
      replaceIfDifferent
    );
    if (!res.ok) {
      setPendingConflictItem(payload);
      return;
    }
    setCart(res.nextCart);
    setPendingConflictItem(null);
    setConfiguringProduct(null);
  }

  function handleConfirmConfiguredItem(e: FormEvent) {
    e.preventDefault();
    if (!configuringProduct) return;
    const opts = productOptions.filter((o) => o.product_id === configuringProduct.id);
    for (const opt of opts) {
      const picked = selectedOptionValues[opt.id] ?? [];
      if (opt.is_required && picked.length === 0) {
        setConfigError(`Sélection requise : ${opt.name}`);
        return;
      }
    }
    const flattened: CartOptionSelection[] = [];
    for (const [optionId, valIds] of Object.entries(selectedOptionValues)) {
      for (const valueId of valIds) {
        flattened.push({ optionId, valueId });
      }
    }
    attemptAddCartItem({
      productId: configuringProduct.id,
      quantity: 1,
      selectedOptions: flattened,
      specialInstructions: itemSpecialNote.trim() || undefined,
    });
  }

  function updateCartItemQty(cartKey: string, delta: number) {
    setCart((prev) => {
      const nextItems = prev.items
        .map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
      return {
        restaurantId: nextItems.length > 0 ? prev.restaurantId : null,
        items: nextItems,
      };
    });
  }

  function clearCart() {
    setCart({ restaurantId: null, items: [] });
    setPendingConflictItem(null);
  }

  function handleSubmitPublicOrder(e: FormEvent) {
    e.preventDefault();
    if (!currentRestaurant) return;
    setOrderNotice(null);
    if (currentCartItems.length === 0) {
      setOrderNotice({ type: 'error', message: 'Ajoutez au moins un plat à votre commande.' });
      return;
    }
    if (!orderCustomerName.trim()) {
      setOrderNotice({ type: 'error', message: 'Veuillez indiquer votre nom complet.' });
      return;
    }
    if (!orderCustomerPhone.trim()) {
      setOrderNotice({ type: 'error', message: 'Veuillez saisir un numéro de téléphone de contact.' });
      return;
    }

    const res = createOrder({
      restaurantId: currentRestaurant.id,
      orderType,
      customerName: orderCustomerName.trim(),
      customerPhone: orderCustomerPhone.trim(),
      deliveryZoneId: orderType === 'delivery' ? effectiveZoneId : null,
      deliveryCommune: orderType === 'delivery' ? deliveryCommune : undefined,
      deliveryQuartier: orderType === 'delivery' ? deliveryQuartier : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      deliveryInstructions: orderType === 'delivery' ? deliveryInstructions : undefined,
      paymentMethod,
      items: currentCartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions,
        specialInstructions: i.specialInstructions,
      })),
    });

    if (!res.ok) {
      setOrderNotice({ type: 'error', message: res.error });
      return;
    }

    clearCart();
    setOrderCustomerName('');
    setOrderCustomerPhone('');
    setDeliveryQuartier('');
    setDeliveryAddress('');
    setDeliveryInstructions('');
    setOrderNotice({
      type: 'success',
      message: `Commande ${res.order.order_number} transmise à ${currentRestaurant.name}.`,
      trackingToken: res.order.tracking_token,
    });
  }

  function handleReservationSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentRestaurant) return;
    setReservationNotice(null);
    const res = createReservation({
      restaurantId: currentRestaurant.id,
      guestName,
      guestPhone,
      partySize: Number(partySize) || 2,
      reservedFor,
      notes: reservationNotes,
    });
    if (!res.ok) {
      setReservationNotice({ type: 'error', message: res.error });
      return;
    }
    setGuestName('');
    setGuestPhone('');
    setReservationNotes('');
    setReservationNotice({
      type: 'success',
      message: `Demande de table enregistrée pour ${res.reservation.guest_name} chez ${currentRestaurant.name}.`,
    });
  }

  function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentRestaurant) return;
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactNotice({
        type: 'error',
        message: 'Merci de compléter tous les champs du message.',
      });
      return;
    }
    setContactName('');
    setContactEmail('');
    setContactMessage('');
    setContactNotice({
      type: 'success',
      message: `Message transmis à l'équipe de ${currentRestaurant.name}.`,
    });
  }

  if (notFoundForSlug) {
    return (
      <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-md w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-8 text-center space-y-4 shadow-sm">
            <BrandMark className="justify-center" />
            <h1 className="font-display text-2xl font-bold text-[var(--rc-fg)]">
              Restaurant introuvable
            </h1>
            <p className="text-sm text-[var(--rc-muted)]">
              L&apos;adresse publique <code className="font-mono">/restaurant/{slug}</code> ne correspond à aucun
              établissement actif.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="sm">
                <Link to="/">Découvrir RestoConnect</Link>
              </Button>
              {activeRestaurants[0] && (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/restaurant/${activeRestaurants[0].slug}`}>
                    Voir {activeRestaurants[0].name}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
        <footer className="border-t border-[var(--rc-border)] bg-[var(--rc-card)]">
          <SiteAttributionBar />
        </footer>
      </div>
    );
  }

  if (!currentRestaurant) {
    return (
      <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex flex-col">
        <header className="border-b border-[var(--rc-border)] bg-[var(--rc-header)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <Link to="/">
              <BrandMark />
            </Link>
            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="compact" />
              <Button asChild size="sm">
                <Link to="/login">Connexion</Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="max-w-lg w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-8 text-center space-y-4">
            <UtensilsCrossed className="h-9 w-9 mx-auto text-[var(--rc-gold)]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold text-[var(--rc-fg)]">
              Aucun restaurant disponible pour le moment
            </h1>
            <p className="text-sm text-[var(--rc-muted)]">
              Créez votre premier établissement depuis l&apos;espace Super Administrateur pour publier sa vitrine,
              ses menus et ses photos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="sm">
                <Link to="/apercu-architecture">Ouvrir la plateforme</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/">Accueil</Link>
              </Button>
            </div>
          </div>
        </main>
        <footer className="border-t border-[var(--rc-border)] bg-[var(--rc-card)]">
          <SiteAttributionBar />
        </footer>
      </div>
    );
  }

  const featuredProducts = tenantProducts.filter((p) => p.is_featured);
  const safeGallery = (currentRestaurant.gallery_urls ?? [])
    .map((u) => sanitizeMediaUrl(u))
    .filter((u): u is string => Boolean(u));
  const safeLogoUrl = sanitizeMediaUrl(currentRestaurant.logo_url);
  const safeCoverUrl = sanitizeMediaUrl(currentRestaurant.cover_image_url);
  const presentationPhoto = safeGallery[1] ?? safeGallery[0] ?? safeCoverUrl;

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
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--rc-muted)]"
          >
            <a href="#presentation" className="hover:text-[var(--rc-fg)] transition-colors whitespace-nowrap shrink-0">
              Présentation
            </a>
            <a href="#menu" className="hover:text-[var(--rc-fg)] transition-colors whitespace-nowrap shrink-0">
              Menu
            </a>
            <a href="#reservations" className="hover:text-[var(--rc-fg)] transition-colors whitespace-nowrap shrink-0">
              Réservations
            </a>
            <Link to="/suivi-commande" className="hover:text-[var(--rc-fg)] transition-colors whitespace-nowrap shrink-0">
              Suivi commande
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <ThemeToggle variant="compact" />
            </div>
            <a
              href="#panier"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)]"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {cart.items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </a>
            <Button asChild size="sm">
              <Link to="/login">Connexion</Link>
            </Button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="md:hidden rounded-md p-2 text-[var(--rc-fg)] hover:bg-[var(--rc-surface-muted)] cursor-pointer"
              aria-label={mobileNavOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-[var(--rc-border)] bg-[var(--rc-card)] px-4 py-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--rc-border)]">
              <span className="text-xs font-medium text-[var(--rc-muted)]">Thème</span>
              <ThemeToggle variant="compact" />
            </div>
            <a href="#presentation" onClick={() => setMobileNavOpen(false)} className="block py-1.5 text-sm font-medium text-[var(--rc-fg)]">
              Présentation
            </a>
            <a href="#menu" onClick={() => setMobileNavOpen(false)} className="block py-1.5 text-sm font-medium text-[var(--rc-fg)]">
              Menu
            </a>
            <a href="#reservations" onClick={() => setMobileNavOpen(false)} className="block py-1.5 text-sm font-medium text-[var(--rc-fg)]">
              Réservations
            </a>
            <Link to="/suivi-commande" onClick={() => setMobileNavOpen(false)} className="block py-1.5 text-sm font-medium text-[var(--rc-fg)]">
              Suivi commande
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 1. ACCUEIL / HERO */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {safeLogoUrl ? (
                      <img
                        src={safeLogoUrl}
                        alt={`Logo ${currentRestaurant.name}`}
                        className="h-10 w-10 rounded-lg object-cover border border-[var(--rc-border)]"
                      />
                    ) : (
                      <span
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-display text-sm font-bold shrink-0 border border-white/15"
                        style={{ backgroundColor: currentRestaurant.primary_color }}
                      >
                        {currentRestaurant.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-[var(--rc-fg)]">{currentRestaurant.name}</p>
                      <p className="text-[11px] font-medium text-[var(--rc-gold-text)]">
                        {currentRestaurant.cuisine_type ?? currentRestaurant.establishment_type} · {currentRestaurant.city}
                      </p>
                    </div>
                  </div>
                  {activeRestaurants.length > 1 && (
                    <select
                      aria-label="Choisir un restaurant partenaire"
                      value={currentRestaurant.slug}
                      onChange={(e) => {
                        const chosen = restaurants.find((r) => r.slug === e.target.value);
                        if (chosen) {
                          setActiveTenantId(chosen.id);
                          setSelectedCategoryId('all');
                          setDishSearch('');
                          setConfiguringProduct(null);
                          setPendingConflictItem(null);
                          navigate(`/restaurant/${chosen.slug}`);
                        }
                      }}
                      className="h-8 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2.5 text-xs text-[var(--rc-fg)]"
                    >
                      {activeRestaurants.map((r) => (
                        <option key={r.id} value={r.slug}>
                          Vitrine : {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--rc-fg)] leading-[1.12] text-balance">
                  {slug ? currentRestaurant.name : 'La gestion intelligente de votre restaurant.'}
                </h1>
                <p className="text-base leading-relaxed text-[var(--rc-muted)] max-w-xl">
                  {currentRestaurant.description ??
                    'Espace client dédié pour consulter la carte du jour, commander en ligne et réserver votre table.'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <a href="#menu">
                      <span>Commander au menu</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                  {slug ? (
                    <Button asChild variant="outline" size="lg">
                      <a href="#reservations">Réserver une table</a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="lg">
                      <Link to="/apercu-architecture">Explorer les 4 espaces</Link>
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--rc-muted)] pt-3 border-t border-[var(--rc-border)]">
                  <span>{currentRestaurant.opening_hours ?? 'Service continu'}</span>
                  <span>Devise : {currentRestaurant.default_currency}</span>
                  <span>Adresse publique : /restaurant/{currentRestaurant.slug}</span>
                  {currentRestaurant.custom_domain && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      {currentRestaurant.custom_domain}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="h-full min-h-[280px] sm:min-h-[360px] rounded-xl overflow-hidden border border-[var(--rc-border)] relative flex items-center justify-center bg-[var(--rc-card)]"
                style={safeCoverUrl ? { backgroundColor: currentRestaurant.primary_color } : undefined}
              >
                {safeCoverUrl ? (
                  <img
                    src={safeCoverUrl}
                    alt={`Salle principale du restaurant ${currentRestaurant.name}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-8 text-center space-y-2 text-[var(--rc-muted)]">
                    <ImageIcon className="h-8 w-8 mx-auto text-[var(--rc-gold)]" aria-hidden="true" />
                    <p className="text-xs">Aucune photo de couverture importée</p>
                  </div>
                )}
                <div
                  className="h-1.5 w-full absolute bottom-0 inset-x-0"
                  style={{ backgroundColor: currentRestaurant.accent_color }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* 2. PRÉSENTATION DU RESTAURANT & GALERIE */}
        <section id="presentation" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[var(--rc-border)] bg-[var(--rc-card)] flex items-center justify-center">
                {presentationPhoto ? (
                  <img
                    src={presentationPhoto}
                    alt={`Ambiance d'accueil de ${currentRestaurant.name}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-6 text-center space-y-2 text-[var(--rc-muted)]">
                    <ImageIcon className="h-7 w-7 mx-auto text-[var(--rc-gold)]" aria-hidden="true" />
                    <p className="text-xs">Aucune photo de présentation importée</p>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Présentation de l&apos;établissement
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                  {currentRestaurant.name} — {currentRestaurant.city}
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-[var(--rc-muted)]">
                  {currentRestaurant.additional_info ||
                    currentRestaurant.description ||
                    'Portail client isolé avec carte en temps réel, commande en ligne et réservation de table.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--rc-gold-text)]">
                    <MapPin className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                    <span>Adresse</span>
                  </div>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {currentRestaurant.address ?? currentRestaurant.city}
                    {currentRestaurant.commune ? `, ${currentRestaurant.commune}` : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--rc-gold-text)]">
                    <Clock className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                    <span>Horaires</span>
                  </div>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {currentRestaurant.opening_hours ?? '11h30 - 23h00'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--rc-gold-text)]">
                    <Truck className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                    <span>Livraison &amp; Retrait</span>
                  </div>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {currentRestaurant.allowed_order_modes.includes('delivery')
                      ? `${tenantZones.length} zone(s) desservie(s) · Retrait comptoir`
                      : 'Retrait au comptoir & Service à table'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--rc-muted)] pt-1">
                {currentRestaurant.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                    <strong className="text-[var(--rc-fg)]">{currentRestaurant.phone}</strong>
                  </span>
                )}
                {currentRestaurant.whatsapp_phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                    <span>WhatsApp : {currentRestaurant.whatsapp_phone}</span>
                  </span>
                )}
                {currentRestaurant.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                    <span>{currentRestaurant.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {safeGallery.length > 0 && (
            <div className="space-y-3" data-testid="restaurant-gallery-strip">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-muted)]">
                Galerie de présentation de {currentRestaurant.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {safeGallery.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="aspect-[16/10] rounded-xl overflow-hidden border border-[var(--rc-border)] bg-[var(--rc-card)]"
                  >
                    <img
                      src={url}
                      alt={`${currentRestaurant.name} — photo ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {featuredProducts.length > 0 && (
            <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Plats populaires de la maison
                </p>
                <a href="#menu" className="text-xs font-medium text-[var(--rc-fg)] hover:text-[var(--rc-gold-text)] hover:underline">
                  Voir toute la carte →
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {featuredProducts.map((fp) => (
                  <div
                    key={fp.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--rc-fg)] truncate">{fp.name}</p>
                      <p className="font-mono text-xs font-bold mt-0.5 text-[var(--rc-gold-text)]">
                        {formatMoney(fp.price_amount, fp.currency)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Ajouter ${fp.name}`}
                      onClick={() => openOrQuickAddProduct(fp)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <Separator />

        {/* 3. MENU & COMMANDE CLIENT */}
        <section id="menu" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <div className="flex flex-col gap-5 mb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                  Carte &amp; Commande en ligne
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                  Menu de {currentRestaurant.name}
                </h2>
              </div>

              <div className="relative w-full md:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rc-muted)]"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Rechercher un plat dans le menu"
                  placeholder="Rechercher un plat ou ingrédient..."
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1 self-start">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                Tout le menu
              </button>
              {tenantCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                      : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {pendingConflictItem && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="text-xs text-[var(--rc-warn-fg)] space-y-1">
                <p className="font-semibold">
                  Panier verrouillé sur « {cartRestaurantName} »
                </p>
                <p>
                  Un panier ne peut contenir que les plats d&apos;un seul établissement à la fois.
                  Voulez-vous vider votre panier actuel pour commander chez {currentRestaurant.name} ?
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => attemptAddCartItem(pendingConflictItem, true)}
                >
                  Vider et remplacer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingConflictItem(null)}
                >
                  Conserver mon panier
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              {configuringProduct && (
                <Card className="border-[var(--rc-gold)]">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{configuringProduct.name}</CardTitle>
                      <CardDescription>
                        Personnalisez les options et suppléments avant ajout au panier.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Fermer les options"
                      onClick={() => setConfiguringProduct(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleConfirmConfiguredItem} className="space-y-4">
                      {productOptions
                        .filter((o) => o.product_id === configuringProduct.id)
                        .map((opt) => {
                          const vals = productOptionValues.filter(
                            (v) => v.option_id === opt.id && v.is_available
                          );
                          const currentSel = selectedOptionValues[opt.id] ?? [];
                          return (
                            <div key={opt.id} className="space-y-2 border-b border-[var(--rc-border)] pb-3 last:border-b-0">
                              <div className="flex items-center justify-between text-xs font-semibold text-[var(--rc-fg)]">
                                <span>{opt.name}</span>
                                <span className="text-[var(--rc-muted)] font-normal">
                                  {opt.is_required ? 'Obligatoire' : 'Optionnel'}
                                  {opt.is_multiple ? ' · Choix multiples' : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {vals.map((val) => {
                                  const checked = currentSel.includes(val.id);
                                  return (
                                    <label
                                      key={val.id}
                                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                                        checked
                                          ? 'border-[var(--rc-gold)] bg-[var(--rc-gold-tint)]'
                                          : 'border-[var(--rc-border)] bg-[var(--rc-card)]'
                                      }`}
                                    >
                                      <span className="flex items-center gap-2">
                                        <input
                                          type={opt.is_multiple ? 'checkbox' : 'radio'}
                                          name={`opt-${opt.id}`}
                                          checked={checked}
                                          onChange={() => {
                                            setSelectedOptionValues((prev) => {
                                              const prevArr = prev[opt.id] ?? [];
                                              if (opt.is_multiple) {
                                                return {
                                                  ...prev,
                                                  [opt.id]: checked
                                                    ? prevArr.filter((id) => id !== val.id)
                                                    : [...prevArr, val.id],
                                                };
                                              }
                                              return { ...prev, [opt.id]: [val.id] };
                                            });
                                          }}
                                        />
                                        <span>{val.label}</span>
                                      </span>
                                      <span className="font-mono text-[11px] text-[var(--rc-gold-text)] tabular-nums">
                                        {val.extra_price > 0
                                          ? `+${formatMoney(val.extra_price, val.currency)}`
                                          : 'Inclus'}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                      <div className="space-y-1.5">
                        <Label htmlFor="item-note">Instructions particulières</Label>
                        <Input
                          id="item-note"
                          placeholder="Ex: bien cuit, sans oignons, piment à part..."
                          value={itemSpecialNote}
                          onChange={(e) => setItemSpecialNote(e.target.value)}
                        />
                      </div>

                      {configError && <p className="text-xs text-[var(--rc-danger-fg)]">{configError}</p>}

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfiguringProduct(null)}>
                          Annuler
                        </Button>
                        <Button type="submit" size="sm">
                          Ajouter au panier
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="divide-y divide-[var(--rc-border)] rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)]">
                {visibleProducts.length === 0 ? (
                  <p className="p-6 text-sm text-[var(--rc-muted)] text-center">
                    Aucun plat disponible pour cette sélection pour le moment.
                  </p>
                ) : (
                  visibleProducts.map((product) => {
                    const imgs = productImages.filter((pi) => pi.product_id === product.id);
                    const primaryImg = imgs.find((i) => i.is_primary) ?? imgs[0];
                    const hasOpts = productOptions.some((o) => o.product_id === product.id);
                    const qtyInCart = currentCartItems
                      .filter((i) => i.productId === product.id)
                      .reduce((s, i) => s + i.quantity, 0);

                    return (
                      <div
                        key={product.id}
                        className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-[var(--rc-card-elevated)] transition-colors"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          {primaryImg ? (
                            <img
                              src={primaryImg.public_url ?? primaryImg.storage_path}
                              alt={product.name}
                              className="h-16 w-16 rounded-lg object-cover border border-[var(--rc-border)] shrink-0"
                            />
                          ) : (
                            <span className="h-16 w-16 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] text-[var(--rc-muted)] flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[var(--rc-fg)]">{product.name}</p>
                              {product.is_featured && (
                                <span className="inline-flex items-center gap-1 rounded bg-[var(--rc-gold-tint)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--rc-gold-text)]">
                                  <Star className="h-3 w-3" aria-hidden="true" />
                                  Recommandé
                                </span>
                              )}
                            </div>
                            {product.description && (
                              <p className="text-xs text-[var(--rc-muted)]">{product.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                              <span className="font-mono font-semibold text-[var(--rc-gold-text)] tabular-nums">
                                {formatMoney(product.price_amount, product.currency)}
                              </span>
                              {hasOpts && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--rc-muted)]">
                                  <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                                  Options disponibles
                                </span>
                              )}
                              {imgs.length > 1 && (
                                <span className="text-[11px] text-[var(--rc-muted)]">
                                  {imgs.length} photos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {qtyInCart > 0 && (
                            <span className="font-mono text-xs px-2 py-1 rounded bg-[var(--rc-surface-muted)] text-[var(--rc-fg)] tabular-nums">
                              {qtyInCart}×
                            </span>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={qtyInCart > 0 ? 'default' : 'outline'}
                            aria-label={`Ajouter ${product.name}`}
                            onClick={() => openOrQuickAddProduct(product)}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{hasOpts ? 'Choisir' : 'Ajouter'}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PANIER & COMMANDE */}
            <div className="lg:col-span-5" id="panier">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle>Votre panier</CardTitle>
                    <CardDescription>
                      Commande exclusive chez {currentRestaurant.name} ({currentRestaurant.default_currency}).
                    </CardDescription>
                  </div>
                  {cart.items.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      aria-label="Vider le panier"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--rc-danger-fg)]" aria-hidden="true" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitPublicOrder} className="space-y-4">
                    {isCartForOtherRestaurant ? (
                      <div className="rounded-md border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-3 text-xs text-[var(--rc-warn-fg)] space-y-2">
                        <p>
                          Votre panier contient {cart.items.length} article(s) de{' '}
                          <strong>{cartRestaurantName}</strong>.
                        </p>
                        <Button type="button" size="sm" variant="outline" onClick={clearCart}>
                          Vider pour commander ici
                        </Button>
                      </div>
                    ) : currentCartItems.length === 0 ? (
                      <p className="text-xs text-[var(--rc-muted)] py-4 border-y border-[var(--rc-border)]">
                        Sélectionnez des plats dans la carte pour préparer votre commande.
                      </p>
                    ) : (
                      <div className="space-y-3 border-y border-[var(--rc-border)] py-3 text-sm">
                        {currentCartItems.map((item) => {
                          const lineMeta = cartCalculation?.ok
                            ? cartCalculation.lines.find(
                                (l) =>
                                  l.product.id === item.productId &&
                                  (l.specialInstructions ?? '') === (item.specialInstructions ?? '')
                              )
                            : undefined;
                          const prod = products.find((p) => p.id === item.productId);
                          const imgs = productImages.filter((pi) => pi.product_id === item.productId);
                          const thumb = imgs.find((i) => i.is_primary) ?? imgs[0];
                          return (
                            <div key={item.cartKey} className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  {thumb && (
                                    <img
                                      src={thumb.public_url ?? thumb.storage_path}
                                      alt={prod?.name ?? ''}
                                      className="h-10 w-10 rounded object-cover border border-[var(--rc-border)] shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs text-[var(--rc-fg)]">
                                      {prod?.name ?? item.productId}
                                    </p>
                                    {lineMeta?.optionsSummary && (
                                      <p className="text-[11px] text-[var(--rc-muted)]">
                                        {lineMeta.optionsSummary}
                                      </p>
                                    )}
                                    {item.specialInstructions && (
                                      <p className="text-[11px] text-[var(--rc-gold-text)]">
                                        Note : {item.specialInstructions}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6"
                                    aria-label={`Diminuer ${prod?.name}`}
                                    onClick={() => updateCartItemQty(item.cartKey, -1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="font-mono text-xs w-4 text-center tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6"
                                    aria-label={`Augmenter ${prod?.name}`}
                                    onClick={() => updateCartItemQty(item.cartKey, 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {lineMeta && (
                                <p className="text-right font-mono text-xs text-[var(--rc-gold-text)] tabular-nums">
                                  {formatMoney(lineMeta.lineTotal, currentRestaurant.default_currency)}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {cartCalculation?.ok && (
                          <div className="space-y-1 pt-2 border-t border-[var(--rc-border)] text-xs">
                            <div className="flex justify-between text-[var(--rc-muted)]">
                              <span>Sous-total</span>
                              <span className="font-mono tabular-nums">
                                {formatMoney(cartCalculation.subtotal, cartCalculation.currency)}
                              </span>
                            </div>
                            {orderType === 'delivery' && (
                              <div className="flex justify-between text-[var(--rc-muted)]">
                                <span>Frais de livraison</span>
                                <span className="font-mono tabular-nums">
                                  {formatMoney(cartCalculation.deliveryFee, cartCalculation.currency)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold text-[var(--rc-fg)] pt-1">
                              <span>Total ({cartCalculation.currency})</span>
                              <span className="font-mono tabular-nums text-[var(--rc-gold-text)]">
                                {formatMoney(cartCalculation.totalAmount, cartCalculation.currency)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="pub-order-name">Votre nom *</Label>
                        <Input
                          id="pub-order-name"
                          placeholder="Nom complet"
                          value={orderCustomerName}
                          onChange={(e) => setOrderCustomerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pub-order-phone">Téléphone *</Label>
                        <Input
                          id="pub-order-phone"
                          type="tel"
                          placeholder="+243 ..."
                          value={orderCustomerPhone}
                          onChange={(e) => setOrderCustomerPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="pub-order-type">Mode de service</Label>
                        <select
                          id="pub-order-type"
                          value={orderType}
                          onChange={(e) => setOrderType(e.target.value as OrderRecord['order_type'])}
                          className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                        >
                          {currentRestaurant.allowed_order_modes.includes('takeaway') && (
                            <option value="takeaway">Retrait sur place</option>
                          )}
                          {currentRestaurant.allowed_order_modes.includes('dine_in') && (
                            <option value="dine_in">Sur place</option>
                          )}
                          {currentRestaurant.allowed_order_modes.includes('delivery') &&
                            tenantZones.length > 0 && (
                              <option value="delivery">Livraison locale</option>
                            )}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pub-pay-method">Paiement (sur place / réception)</Label>
                        <select
                          id="pub-pay-method"
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(e.target.value as 'cash' | 'mobile_money' | 'card')
                          }
                          className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                        >
                          <option value="cash">Espèces (USD ou CDF) à la caisse / livraison</option>
                          <option value="mobile_money">Mobile Money sur place</option>
                          <option value="card">Carte bancaire sur terminal (TPE)</option>
                        </select>
                        <p className="text-[11px] text-[var(--rc-muted)]">
                          Aucun paiement en ligne obligatoire — règlement vérifié à la réception.
                        </p>
                      </div>
                    </div>

                    {orderType === 'delivery' && (
                      <div className="space-y-3 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] p-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="pub-del-zone">Zone de livraison</Label>
                          <select
                            id="pub-del-zone"
                            value={effectiveZoneId ?? ''}
                            onChange={(e) => {
                              const z = tenantZones.find((zn) => zn.id === e.target.value);
                              setDeliveryZoneId(e.target.value);
                              if (z) setDeliveryCommune(z.commune);
                            }}
                            className="flex h-9 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-2.5 text-xs text-[var(--rc-fg)]"
                          >
                            {tenantZones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.zone_name} (+{formatMoney(z.fee_amount, z.currency)}, ~{z.estimated_minutes} min)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="pub-del-commune" className="text-xs">Commune *</Label>
                            <Input
                              id="pub-del-commune"
                              value={deliveryCommune}
                              onChange={(e) => setDeliveryCommune(e.target.value)}
                              placeholder="Commune"
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="pub-del-quartier" className="text-xs">Quartier</Label>
                            <Input
                              id="pub-del-quartier"
                              value={deliveryQuartier}
                              onChange={(e) => setDeliveryQuartier(e.target.value)}
                              placeholder="Quartier / Repère"
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="pub-del-addr" className="text-xs">Adresse complète *</Label>
                          <Input
                            id="pub-del-addr"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Avenue, n°, bâtiment..."
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="pub-del-instr" className="text-xs">Instructions livreur</Label>
                          <Input
                            id="pub-del-instr"
                            value={deliveryInstructions}
                            onChange={(e) => setDeliveryInstructions(e.target.value)}
                            placeholder="Appeler à l'arrivée..."
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {orderNotice && (
                      <div
                        role="status"
                        className={`rounded-md border p-3 text-xs space-y-2 ${
                          orderNotice.type === 'error'
                            ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
                            : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {orderNotice.type === 'error' ? (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <span>{orderNotice.message}</span>
                        </div>
                        {orderNotice.trackingToken && (
                          <div className="pt-1 border-t border-[var(--rc-success-border)] flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{orderNotice.trackingToken}</span>
                            <Link
                              to={`/suivi/${orderNotice.trackingToken}`}
                              className="underline font-semibold"
                            >
                              Suivre ma commande →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isCartForOtherRestaurant}>
                      Envoyer la commande
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Separator />

        {/* 4. RÉSERVATIONS & CONTACT */}
        <section id="reservations" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Réserver une table</CardTitle>
                  <CalendarClock className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                </div>
                <CardDescription>
                  Vérification instantanée des créneaux et capacités chez {currentRestaurant.name}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReservationSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="res-name">Nom complet</Label>
                      <Input
                        id="res-name"
                        placeholder="Nom complet"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="res-phone">Téléphone</Label>
                      <Input
                        id="res-phone"
                        type="tel"
                        placeholder="+243 ..."
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="res-size">Nombre de couverts</Label>
                      <Input
                        id="res-size"
                        type="number"
                        min={1}
                        max={30}
                        value={partySize}
                        onChange={(e) => setPartySize(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="res-date">Date et heure</Label>
                      <Input
                        id="res-date"
                        type="datetime-local"
                        value={reservedFor}
                        onChange={(e) => setReservedFor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="res-notes">Précision (allergies, occasion...)</Label>
                    <Input
                      id="res-notes"
                      placeholder="Terrasse souhaitée..."
                      value={reservationNotes}
                      onChange={(e) => setReservationNotes(e.target.value)}
                    />
                  </div>

                  {reservationNotice && (
                    <div
                      role="status"
                      className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                        reservationNotice.type === 'error'
                          ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
                          : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                      }`}
                    >
                      {reservationNotice.type === 'error' ? (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span>{reservationNotice.message}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full">
                    Confirmer la demande de réservation
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card id="contact">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contacter {currentRestaurant.name}</CardTitle>
                  <Phone className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                </div>
                <CardDescription>
                  Demande d&apos;information, privatisation ou événement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Votre nom</Label>
                      <Input
                        id="contact-name"
                        placeholder="Nom et prénom"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-mail</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="vous@exemple.cd"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-msg">Message</Label>
                    <textarea
                      id="contact-msg"
                      rows={3}
                      placeholder="Votre demande..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="flex w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3.5 py-2 text-sm text-[var(--rc-fg)] placeholder:text-[var(--rc-muted)]"
                    />
                  </div>

                  {contactNotice && (
                    <div
                      role="status"
                      className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                        contactNotice.type === 'error'
                          ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
                          : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                      }`}
                    >
                      {contactNotice.type === 'error' ? (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span>{contactNotice.message}</span>
                    </div>
                  )}

                  <Button type="submit" variant="outline" className="w-full">
                    Envoyer le message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--rc-border)] bg-[var(--rc-card)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-display text-sm font-bold text-[var(--rc-fg)]">
              {currentRestaurant.name} · {currentRestaurant.city}
            </p>
            <p className="text-xs text-[var(--rc-muted)]">
              Propulsé par{' '}
              <Link to="/" className="font-semibold text-[var(--rc-gold-text)] hover:underline">
                RestoConnect
              </Link>{' '}
              — Plateforme SaaS multi-tenant pour la restauration en RDC
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-[var(--rc-muted)]">
            <Link to="/" className="hover:text-[var(--rc-fg)]">
              Découvrir RestoConnect
            </Link>
            <Link to="/suivi-commande" className="hover:text-[var(--rc-fg)]">
              Suivi de commande
            </Link>
            <Link to="/login" className="hover:text-[var(--rc-fg)]">
              Connexion professionnelle
            </Link>
          </div>
        </div>
        <SiteAttributionBar />
      </footer>
    </div>
  );
}
