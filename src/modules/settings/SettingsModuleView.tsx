import { useEffect, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  Store,
  Palette,
  SlidersHorizontal,
  ImagePlus,
  Trash2,
  Globe,
  Monitor,
  Smartphone,
  ArrowRightLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { sanitizeMediaUrl } from '@/src/lib/domain/commercial';
import { readImageFileAsDataUrl } from '@/src/lib/media/imageUpload';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import type { CurrencyCode } from '@/src/lib/supabase/database.types';

export type SettingsSubViewMode = 'profile' | 'customization' | 'settings';

interface SettingsModuleViewProps {
  restaurantId?: string;
  mode?: SettingsSubViewMode;
}

export function SettingsModuleView({ restaurantId, mode = 'customization' }: SettingsModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    slugRedirects,
    updateRestaurantSettings,
    updateRestaurantSlugAndDomain,
  } = useRestoStore();
  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId) ?? restaurants[0] ?? null;

  const [name, setName] = useState(restaurant?.name ?? '');
  const [description, setDescription] = useState(restaurant?.description ?? '');
  const [logoUrl, setLogoUrl] = useState(restaurant?.logo_url ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(restaurant?.cover_image_url ?? '');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(restaurant?.gallery_urls ?? []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [address, setAddress] = useState(restaurant?.address ?? '');
  const [commune, setCommune] = useState(restaurant?.commune ?? '');
  const [city, setCity] = useState(restaurant?.city ?? '');
  const [country, setCountry] = useState(restaurant?.country ?? 'République démocratique du Congo');
  const [phone, setPhone] = useState(restaurant?.phone ?? '');
  const [email, setEmail] = useState(restaurant?.email ?? '');
  const [whatsappPhone, setWhatsappPhone] = useState(restaurant?.whatsapp_phone ?? '');
  const [openingHours, setOpeningHours] = useState(restaurant?.opening_hours ?? '');
  const [cuisineType, setCuisineType] = useState(restaurant?.cuisine_type ?? '');
  const [additionalInfo, setAdditionalInfo] = useState(restaurant?.additional_info ?? '');

  const [primaryColor, setPrimaryColor] = useState(restaurant?.primary_color ?? '#163C2E');
  const [accentColor, setAccentColor] = useState(restaurant?.accent_color ?? '#B8923A');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const [slugInput, setSlugInput] = useState(restaurant?.slug ?? '');
  const [subdomainPrefix, setSubdomainPrefix] = useState(restaurant?.subdomain_prefix ?? restaurant?.slug ?? '');
  const [customDomain, setCustomDomain] = useState(restaurant?.custom_domain ?? '');
  const [domainFeedback, setDomainFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(restaurant?.default_currency ?? 'USD');
  const [secondaryCurrency, setSecondaryCurrency] = useState<CurrencyCode | 'none'>(
    restaurant?.secondary_currency ?? 'none'
  );
  const [exchangeRate, setExchangeRate] = useState(String(restaurant?.exchange_rate_usd_cdf ?? 2850));
  const [timezone, setTimezone] = useState(restaurant?.timezone ?? 'Africa/Kinshasa');
  const [orderModes, setOrderModes] = useState<Array<'dine_in' | 'takeaway' | 'delivery'>>(
    restaurant?.allowed_order_modes ?? ['dine_in', 'takeaway']
  );
  const [deliveryModes, setDeliveryModes] = useState<Array<'pickup' | 'local_courier'>>(
    restaurant?.allowed_delivery_modes ?? ['pickup']
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(restaurant?.cancellation_policy ?? '');
  const [notifyOrders, setNotifyOrders] = useState(restaurant?.notification_email_orders ?? true);
  const [notifyLowStock, setNotifyLowStock] = useState(restaurant?.notification_low_stock ?? true);
  const [allowPartialPayments, setAllowPartialPayments] = useState(
    restaurant?.allow_partial_payments ?? true
  );
  const [customPaymentMethodLabel, setCustomPaymentMethodLabel] = useState(
    restaurant?.custom_payment_method_label ?? ''
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setDescription(restaurant.description ?? '');
    setLogoUrl(restaurant.logo_url ?? '');
    setCoverImageUrl(restaurant.cover_image_url ?? '');
    setGalleryUrls(restaurant.gallery_urls ?? []);
    setAddress(restaurant.address ?? '');
    setCommune(restaurant.commune ?? '');
    setCity(restaurant.city);
    setCountry(restaurant.country);
    setPhone(restaurant.phone ?? '');
    setEmail(restaurant.email ?? '');
    setWhatsappPhone(restaurant.whatsapp_phone ?? '');
    setOpeningHours(restaurant.opening_hours ?? '');
    setCuisineType(restaurant.cuisine_type ?? '');
    setAdditionalInfo(restaurant.additional_info ?? '');
    setPrimaryColor(restaurant.primary_color);
    setAccentColor(restaurant.accent_color);
    setSlugInput(restaurant.slug);
    setSubdomainPrefix(restaurant.subdomain_prefix ?? restaurant.slug);
    setCustomDomain(restaurant.custom_domain ?? '');
    setDefaultCurrency(restaurant.default_currency);
    setSecondaryCurrency(restaurant.secondary_currency ?? 'none');
    setExchangeRate(String(restaurant.exchange_rate_usd_cdf));
    setTimezone(restaurant.timezone);
    setOrderModes(restaurant.allowed_order_modes);
    setDeliveryModes(restaurant.allowed_delivery_modes);
    setCancellationPolicy(restaurant.cancellation_policy ?? '');
    setNotifyOrders(restaurant.notification_email_orders);
    setNotifyLowStock(restaurant.notification_low_stock);
    setAllowPartialPayments(restaurant.allow_partial_payments ?? true);
    setCustomPaymentMethodLabel(restaurant.custom_payment_method_label ?? '');
  }, [restaurant]);

  useEffect(() => {
    setSavedMsg(null);
    setDomainFeedback(null);
  }, [restaurant?.id, mode]);

  if (!restaurant) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-xs text-[var(--rc-muted)]">
          Aucun établissement sélectionné.
        </CardContent>
      </Card>
    );
  }

  const tenantRedirects = slugRedirects.filter((r) => r.restaurant_id === restaurant.id);

  function flashSaved(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2800);
  }

  function handleAddGalleryUrl(raw: string) {
    const clean = sanitizeMediaUrl(raw);
    if (!clean) {
      flashSaved('URL média invalide (utilisez https:// ou importez une image locale).');
      return;
    }
    if (galleryUrls.includes(clean)) {
      setNewGalleryUrl('');
      return;
    }
    setGalleryUrls((prev) => [...prev, clean]);
    setNewGalleryUrl('');
  }

  async function handleLocalUpload(
    files: FileList | null,
    onResult: (dataUrl: string) => void
  ) {
    const file = files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onResult(dataUrl);
      flashSaved(`Image "${file.name}" importée.`);
    } catch (err) {
      flashSaved(err instanceof Error ? err.message : "Erreur d'importation.");
    }
  }

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    updateRestaurantSettings(restaurant.id, {
      name: name.trim() || restaurant.name,
      description: description.trim() || null,
      logo_url: logoUrl.trim() || null,
      cover_image_url: coverImageUrl.trim() || null,
      gallery_urls: galleryUrls,
      address: address.trim() || null,
      commune: commune.trim() || null,
      city: city.trim() || restaurant.city,
      country: country.trim() || restaurant.country,
      phone: phone.trim() || null,
      email: email.trim() || null,
      whatsapp_phone: whatsappPhone.trim() || null,
      opening_hours: openingHours.trim() || null,
      cuisine_type: cuisineType.trim() || null,
      additional_info: additionalInfo.trim() || null,
    });
    flashSaved('Profil complet du restaurant enregistré.');
  }

  function handleSaveCustomization(e: FormEvent) {
    e.preventDefault();
    updateRestaurantSettings(restaurant.id, {
      name: name.trim() || restaurant.name,
      description: description.trim() || null,
      logo_url: logoUrl.trim() || null,
      cover_image_url: coverImageUrl.trim() || null,
      gallery_urls: galleryUrls,
      primary_color: primaryColor,
      accent_color: accentColor,
      cuisine_type: cuisineType.trim() || null,
      opening_hours: openingHours.trim() || null,
      phone: phone.trim() || null,
      whatsapp_phone: whatsappPhone.trim() || null,
      email: email.trim() || null,
    });
    flashSaved('Identité visuelle et galerie publiées pour votre vitrine.');
  }

  function handleSaveSlugAndDomain(e: FormEvent) {
    e.preventDefault();
    setDomainFeedback(null);
    const res = updateRestaurantSlugAndDomain(restaurant.id, {
      slug: slugInput,
      subdomainPrefix,
      customDomain,
    });
    if (!res.ok) {
      setDomainFeedback({ ok: false, text: res.error });
      return;
    }
    setSlugInput(res.slug);
    setDomainFeedback({
      ok: true,
      text: res.redirectedOldSlug
        ? `Adresse mise à jour vers /restaurant/${res.slug}. L'ancien lien /restaurant/${res.redirectedOldSlug} redirige automatiquement.`
        : `Adresse publique /restaurant/${res.slug} et configuration domaine enregistrées.`,
    });
  }

  function handleSaveOperationalSettings(e: FormEvent) {
    e.preventDefault();
    updateRestaurantSettings(restaurant.id, {
      default_currency: defaultCurrency,
      secondary_currency: secondaryCurrency === 'none' ? null : secondaryCurrency,
      exchange_rate_usd_cdf: Math.max(1, Number(exchangeRate) || 2850),
      timezone,
      opening_hours: openingHours.trim() || null,
      allowed_order_modes: orderModes.length > 0 ? orderModes : ['dine_in'],
      allowed_delivery_modes: deliveryModes.length > 0 ? deliveryModes : ['pickup'],
      cancellation_policy: cancellationPolicy.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      whatsapp_phone: whatsappPhone.trim() || null,
      notification_email_orders: notifyOrders,
      notification_low_stock: notifyLowStock,
      allow_partial_payments: allowPartialPayments,
      custom_payment_method_label: customPaymentMethodLabel.trim() || 'Autre mode configurable',
    });
    flashSaved('Paramètres opérationnels, caisse et devises enregistrés.');
  }

  function toggleOrderMode(m: 'dine_in' | 'takeaway' | 'delivery') {
    setOrderModes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleDeliveryMode(m: 'pickup' | 'local_courier') {
    setDeliveryModes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  if (mode === 'profile') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[var(--rc-gold)]" aria-hidden="true" />
            <span>Mon restaurant · Profil complet de {restaurant.name}</span>
          </CardTitle>
          <CardDescription>
            Toutes ces informations sont strictement isolées à votre établissement et alimentent votre vitrine publique (
            <code className="font-mono">/restaurant/{restaurant.slug}</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Nom commercial *</Label>
              <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-cuisine">Type de cuisine</Label>
              <Input
                id="prof-cuisine"
                placeholder="ex: Cuisine congolaise, Grillades..."
                value={cuisineType}
                onChange={(e) => setCuisineType(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="prof-desc">Description</Label>
              <Input
                id="prof-desc"
                placeholder="Présentation de votre table..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-logo">Logo (URL ou fichier local)</Label>
              <div className="flex gap-2">
                <Input id="prof-logo" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                <label className="inline-flex items-center px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                  <span>Importer</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => void handleLocalUpload(e.target.files, setLogoUrl)}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-cover">Image de couverture (URL ou fichier local)</Label>
              <div className="flex gap-2">
                <Input
                  id="prof-cover"
                  placeholder="https://..."
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                />
                <label className="inline-flex items-center px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                  <span>Importer</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => void handleLocalUpload(e.target.files, setCoverImageUrl)}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-address">Adresse physique</Label>
              <Input id="prof-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-commune">Commune</Label>
              <Input id="prof-commune" value={commune} onChange={(e) => setCommune(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-city">Ville</Label>
              <Input id="prof-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-country">Pays</Label>
              <Input id="prof-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone">Téléphone</Label>
              <Input id="prof-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-whatsapp">Numéro WhatsApp</Label>
              <Input id="prof-whatsapp" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-email">E-mail de contact</Label>
              <Input id="prof-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-hours">Horaires d&apos;ouverture</Label>
              <Input
                id="prof-hours"
                placeholder="ex: Mar - Dim · 11h30 - 23h00"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="prof-info">Autres informations utiles (parking, salon privé, accès...)</Label>
              <Input
                id="prof-info"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-4 pt-2">
              <span className="text-xs font-medium text-[var(--rc-gold-text)]">{savedMsg ?? ''}</span>
              <Button type="submit">Enregistrer le profil du restaurant</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'customization') {
    const safeCoverPreview = sanitizeMediaUrl(coverImageUrl);
    const safeLogoPreview = sanitizeMediaUrl(logoUrl);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Personnalisation visuelle isolée</span>
              </CardTitle>
              <CardDescription>
                Chaque restaurant personnalise son logo, sa couverture, ses couleurs et ses photos de présentation sans
                affecter aucun autre établissement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCustomization} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-name">Nom affiché sur la vitrine</Label>
                    <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-cuisine">Type de cuisine</Label>
                    <Input
                      id="cust-cuisine"
                      value={cuisineType}
                      onChange={(e) => setCuisineType(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-desc">Texte de présentation</Label>
                  <Input id="cust-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-logo">Logo (URL ou fichier)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cust-logo"
                        placeholder="https://..."
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                      />
                      <label className="inline-flex items-center px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                        <span>Importer</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          onChange={(e) => void handleLocalUpload(e.target.files, setLogoUrl)}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-cover">Image de couverture (URL ou fichier)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cust-cover"
                        placeholder="https://..."
                        value={coverImageUrl}
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                      />
                      <label className="inline-flex items-center px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                        <span>Importer</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          onChange={(e) => void handleLocalUpload(e.target.files, setCoverImageUrl)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-primary">Couleur principale</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Sélecteur couleur principale"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-10 w-12 rounded border border-[var(--rc-border-strong)] bg-[var(--rc-card)] p-1 cursor-pointer"
                      />
                      <Input
                        id="settings-primary"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-accent">Couleur secondaire (accent)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Sélecteur couleur secondaire"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-10 w-12 rounded border border-[var(--rc-border-strong)] bg-[var(--rc-card)] p-1 cursor-pointer"
                      />
                      <Input
                        id="settings-accent"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[var(--rc-border)] pt-3">
                  <Label htmlFor="cust-gallery-input">Photos de présentation ({galleryUrls.length})</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="cust-gallery-input"
                      placeholder="https://... ou importer une photo"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      className="flex-1 min-w-[160px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddGalleryUrl(newGalleryUrl)}
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      <span>Ajouter URL</span>
                    </Button>
                    <label className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-xs font-medium cursor-pointer hover:bg-[var(--rc-card-elevated)] shrink-0">
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      <span>Importer photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) =>
                          void handleLocalUpload(e.target.files, (dataUrl) => handleAddGalleryUrl(dataUrl))
                        }
                      />
                    </label>
                  </div>
                  {galleryUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {galleryUrls.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="relative rounded-md border border-[var(--rc-border)] overflow-hidden bg-[var(--rc-bg-subtle)] aspect-[16/10]"
                        >
                          <img src={url} alt={`Galerie ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            aria-label={`Retirer la photo ${idx + 1}`}
                            onClick={() => setGalleryUrls((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 rounded bg-[var(--rc-card)]/90 p-1 text-[var(--rc-danger-fg)] shadow-xs hover:bg-[var(--rc-card)] cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <span className="text-xs font-medium text-[var(--rc-gold-text)]">{savedMsg ?? ''}</span>
                  <Button type="submit">Publier l&apos;identité visuelle</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Aperçu en direct de votre vitrine publique</CardTitle>
                <CardDescription>Rendu instantané avant publication</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    aria-label="Aperçu ordinateur"
                    className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 cursor-pointer ${
                      previewDevice === 'desktop' ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold' : 'text-[var(--rc-muted)]'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Bureau</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    aria-label="Aperçu mobile"
                    className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 cursor-pointer ${
                      previewDevice === 'mobile' ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold' : 'text-[var(--rc-muted)]'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Mobile</span>
                  </button>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/restaurant/${restaurant.slug}`}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ouvrir</span>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div
                className={`rounded-xl border border-[var(--rc-border)] overflow-hidden bg-[var(--rc-card)] shadow-sm transition-all ${
                  previewDevice === 'mobile' ? 'w-full max-w-[340px]' : 'w-full'
                }`}
                data-testid="live-branding-preview"
              >
                <div className="h-28 relative overflow-hidden bg-[var(--rc-surface-muted)]">
                  {safeCoverPreview && (
                    <img
                      src={safeCoverPreview}
                      alt={`Couverture ${name}`}
                      className="w-full h-full object-cover opacity-85"
                    />
                  )}
                  <div
                    className="absolute inset-0 opacity-65"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {safeLogoPreview ? (
                        <img
                          src={safeLogoPreview}
                          alt={name}
                          className="h-10 w-10 rounded-md object-cover border border-white/30 shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-md flex items-center justify-center font-display font-bold text-xs border border-white/30 shrink-0"
                          style={{ backgroundColor: accentColor, color: '#0B0B0B' }}
                        >
                          {(name || 'R').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-display text-base font-bold leading-tight truncate">
                          {name || restaurant.name}
                        </h4>
                        <p className="text-[11px] opacity-90 truncate">
                          {cuisineType || restaurant.establishment_type} · {city}
                        </p>
                      </div>
                    </div>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-[#0B0B0B] shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      {defaultCurrency}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-[var(--rc-bg-subtle)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rc-muted)]">
                    <span>{openingHours || 'Horaires à définir'}</span>
                    <span className="font-mono">/restaurant/{restaurant.slug}</span>
                  </div>
                  <p className="text-xs text-[var(--rc-muted)] leading-relaxed">
                    {description || 'Ajoutez une présentation pour accueillir vos convives en ligne.'}
                  </p>
                  {galleryUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {galleryUrls.slice(0, 3).map((gUrl, idx) => (
                        <img
                          key={`${gUrl}-${idx}`}
                          src={gUrl}
                          alt={`Aperçu ${idx + 1}`}
                          className="h-12 w-full rounded object-cover border border-[var(--rc-border)]"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Commander au menu
                    </span>
                    <span
                      className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium text-[var(--rc-fg)]"
                      style={{ borderColor: accentColor }}
                    >
                      Réserver une table
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
              <span>Adresse publique (Slug), redirections &amp; domaine personnalisé</span>
            </CardTitle>
            <CardDescription>
              Modifiez le slug de votre restaurant tout en conservant une redirection automatique depuis les anciennes
              adresses. Préparez un sous-domaine ou domaine personnalisé dédié.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSaveSlugAndDomain} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="slug-input">Slug public (/restaurant/...)</Label>
                <Input
                  id="slug-input"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="font-mono"
                  required
                />
                <p className="text-[11px] text-[var(--rc-muted)]">
                  Lien actif : <code className="font-mono">/restaurant/{restaurant.slug}</code>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subdomain-input">Préfixe sous-domaine envisagé</Label>
                <Input
                  id="subdomain-input"
                  placeholder="ex: mon-restaurant"
                  value={subdomainPrefix}
                  onChange={(e) => setSubdomainPrefix(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-[var(--rc-muted)]">
                  Réservé au routage sous-domaine futur (non activé DNS ici).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-domain-input">Domaine personnalisé (optionnel)</Label>
                <Input
                  id="custom-domain-input"
                  placeholder="ex: commander.monrestaurant.cd"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-[var(--rc-muted)]">
                  Statut DNS :{' '}
                  <strong className="text-[var(--rc-fg)]">
                    {restaurant.domain_verification_status ?? 'not_configured'}
                  </strong>
                </p>
              </div>

              {domainFeedback && (
                <p
                  className={`md:col-span-3 text-xs font-medium ${
                    domainFeedback.ok ? 'text-[var(--rc-gold-text)]' : 'text-[var(--rc-danger-fg)]'
                  }`}
                >
                  {domainFeedback.text}
                </p>
              )}

              <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--rc-border)] pt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--rc-muted)]">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--rc-gold)]" aria-hidden="true" />
                  <span>
                    Redirections actives ({tenantRedirects.length}) :{' '}
                    {tenantRedirects.length === 0
                      ? 'aucune ancienne adresse archivée'
                      : tenantRedirects.map((r) => `/restaurant/${r.old_slug}`).join(', ')}
                  </span>
                </div>
                <Button type="submit" size="sm">
                  Mettre à jour le slug &amp; domaine
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apparence de votre espace</CardTitle>
          <CardDescription>
            Choisissez votre thème d&apos;affichage préféré (mode sombre principal, mode clair ou automatique selon le système).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle variant="detailed" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[var(--rc-gold)]" aria-hidden="true" />
            <span>Paramètres d&apos;exploitation &amp; Devise ({restaurant.name})</span>
          </CardTitle>
          <CardDescription>
            Devises locales (USD/CDF), taux de conversion configurable, fuseau horaire RDC et politiques de service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOperationalSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-curr-main">Devise principale</Label>
                <select
                  id="set-curr-main"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value as CurrencyCode)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                >
                  <option value="USD">Dollar américain (USD)</option>
                  <option value="CDF">Franc congolais (CDF)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-curr-sec">Devise secondaire (optionnelle)</Label>
                <select
                  id="set-curr-sec"
                  value={secondaryCurrency}
                  onChange={(e) => setSecondaryCurrency(e.target.value as CurrencyCode | 'none')}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                >
                  <option value="CDF">Franc congolais (CDF)</option>
                  <option value="USD">Dollar américain (USD)</option>
                  <option value="none">Aucune devise secondaire</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-rate">Taux configurable (1 USD = CDF)</Label>
                <Input
                  id="set-rate"
                  type="number"
                  min="1"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-tz">Fuseau horaire</Label>
                <select
                  id="set-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3 text-sm text-[var(--rc-fg)]"
                >
                  <option value="Africa/Kinshasa">Africa/Kinshasa (WAT, UTC+1)</option>
                  <option value="Africa/Lubumbashi">Africa/Lubumbashi (CAT, UTC+2)</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="set-hours">Horaires de service</Label>
                <Input id="set-hours" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[var(--rc-border)] pt-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--rc-fg)]">Modes de commande acceptés</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(
                    [
                      { key: 'dine_in', label: 'Sur place' },
                      { key: 'takeaway', label: 'À emporter' },
                      { key: 'delivery', label: 'Livraison' },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orderModes.includes(item.key)}
                        onChange={() => toggleOrderMode(item.key)}
                        className="h-4 w-4"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--rc-fg)]">Modes de retrait / livraison</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(
                    [
                      { key: 'pickup', label: 'Retrait au comptoir' },
                      { key: 'local_courier', label: 'Coursier local' },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliveryModes.includes(item.key)}
                        onChange={() => toggleDeliveryMode(item.key)}
                        className="h-4 w-4"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="set-cancel">Politique d&apos;annulation client</Label>
              <Input
                id="set-cancel"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--rc-border)] pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-custom-pay">Libellé du 5e mode de paiement en caisse</Label>
                <Input
                  id="set-custom-pay"
                  placeholder="Libellé du mode de paiement"
                  value={customPaymentMethodLabel}
                  onChange={(e) => setCustomPaymentMethodLabel(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPartialPayments}
                    onChange={(e) => setAllowPartialPayments(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Autoriser les paiements partiels et acomptes en caisse</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOrders}
                  onChange={(e) => setNotifyOrders(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Notifications e-mail sur nouvelles commandes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyLowStock}
                  onChange={(e) => setNotifyLowStock(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Alertes automatiques de stock bas</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[var(--rc-border)] pt-4">
              <div className="flex items-center gap-3">
                <StatusLabel label={`Fuseau : ${timezone}`} tone="neutral" />
                <span className="text-xs font-medium text-[var(--rc-gold-text)]">{savedMsg ?? ''}</span>
              </div>
              <Button type="submit">Enregistrer les paramètres</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
