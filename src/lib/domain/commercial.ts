import type {
  CommercialDocumentSnapshot,
  CommercialDocumentType,
  CurrencyCode,
  LicenseRecord,
  MaintenanceContractRecord,
  PaymentRecord,
  RestaurantRecord,
  RestaurantSlugRedirectRecord,
} from '../supabase/database.types';
import { LICENSE_STATUS_META, LICENSE_TYPE_LABELS } from '../licensing/licenseRules';

export interface PlatformCommercialConfig {
  platformName: string;
  tagline: string;
  logoUrl: string | null;
  supportEmail: string;
  commercialPhone: string;
  commercialWhatsapp: string;
  commercialAddress: string;
  defaultCountry: string;
  defaultTimezone: string;
  referenceCurrency: CurrencyCode;
  defaultUsdCdfRate: number;
  standardLicensePriceUsd: number;
  maintenanceAnnualPriceUsd: number;
  maintenanceAlertDays: number;
  commercialTerms: string;
}

export const RESERVED_SLUGS = new Set([
  'login',
  'admin',
  'staff',
  'super-admin',
  'apercu-architecture',
  'suivi',
  'suivi-commande',
  'presentation',
  'fonctionnalites',
  'avantages',
  'demonstration',
  'contact',
  'faq',
  'conditions-utilisation',
  'confidentialite',
  'restaurant',
  'r',
]);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valide une URL média publique ou asset local pour éviter toute injection javascript:/data:text/html.
 */
export function sanitizeMediaUrl(rawUrl: string | null | undefined): string | null {
  const value = (rawUrl ?? '').trim();
  if (!value) return null;
  if (value.startsWith('/assets/')) {
    return value;
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function validateHexColor(rawColor: string | null | undefined, fallback: string): string {
  const trimmed = (rawColor ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function validateSlugChange(
  restaurants: readonly RestaurantRecord[],
  redirects: readonly RestaurantSlugRedirectRecord[],
  targetRestaurantId: string,
  rawSlug: string
): { valid: true; normalizedSlug: string } | { valid: false; error: string } {
  const normalized = rawSlug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length < 3 || normalized.length > 64) {
    return {
      valid: false,
      error: "Le slug doit contenir entre 3 et 64 caractères alphanumériques (a-z, 0-9, '-').",
    };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return {
      valid: false,
      error: `Le slug « ${normalized} » est réservé par la plateforme RestoConnect.`,
    };
  }
  const takenByOther = restaurants.some(
    (r) => r.id !== targetRestaurantId && r.slug.toLowerCase() === normalized
  );
  if (takenByOther) {
    return {
      valid: false,
      error: `Le slug « ${normalized} » est déjà utilisé par un autre établissement.`,
    };
  }
  const takenAsOtherRedirect = redirects.some(
    (red) => red.old_slug.toLowerCase() === normalized && red.restaurant_id !== targetRestaurantId
  );
  if (takenAsOtherRedirect) {
    return {
      valid: false,
      error: `Le slug « ${normalized} » correspond à une redirection historique d'un autre restaurant.`,
    };
  }
  return { valid: true, normalizedSlug: normalized };
}

export function resolveRestaurantSlugOrRedirect(
  restaurants: readonly RestaurantRecord[],
  redirects: readonly RestaurantSlugRedirectRecord[],
  requestedSlug: string | undefined
): { restaurant: RestaurantRecord | null; redirectedFrom: string | null } {
  if (!requestedSlug) {
    return { restaurant: null, redirectedFrom: null };
  }
  const clean = requestedSlug.trim().toLowerCase();
  const direct = restaurants.find((r) => r.slug.toLowerCase() === clean);
  if (direct) {
    return { restaurant: direct, redirectedFrom: null };
  }
  const redir = redirects.find((red) => red.old_slug.toLowerCase() === clean);
  if (redir) {
    const target = restaurants.find((r) => r.id === redir.restaurant_id) ?? null;
    if (target) {
      return { restaurant: target, redirectedFrom: clean };
    }
  }
  return { restaurant: null, redirectedFrom: null };
}

export function validateDomainConfig(
  input: { subdomainPrefix?: string | null; customDomain?: string | null },
  restaurants: readonly RestaurantRecord[],
  targetRestaurantId: string
): { valid: true; subdomainPrefix: string | null; customDomain: string | null } | { valid: false; error: string } {
  const sub = (input.subdomainPrefix ?? '').trim().toLowerCase() || null;
  const dom = (input.customDomain ?? '').trim().toLowerCase() || null;

  if (sub) {
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(sub)) {
      return {
        valid: false,
        error: 'Le préfixe de sous-domaine doit contenir 3 à 50 caractères (lettres minuscules, chiffres, tirets).',
      };
    }
    if (restaurants.some((r) => r.id !== targetRestaurantId && r.subdomain_prefix?.toLowerCase() === sub)) {
      return { valid: false, error: 'Ce sous-domaine est déjà attribué à un autre établissement.' };
    }
  }

  if (dom) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(dom)) {
      return {
        valid: false,
        error: 'Format de domaine personnalisé invalide (ex: commander.monrestaurant.cd).',
      };
    }
    if (restaurants.some((r) => r.id !== targetRestaurantId && r.custom_domain?.toLowerCase() === dom)) {
      return { valid: false, error: 'Ce domaine personnalisé est déjà attribué à un autre établissement.' };
    }
  }

  return { valid: true, subdomainPrefix: sub, customDomain: dom };
}

export function validateMaintenanceContractInput(input: {
  restaurantId: string;
  licenseId: string;
  durationMonths: number;
  priceAmount: number;
  includedServices: string;
  startDate: string;
  endDate: string;
}): { valid: true } | { valid: false; error: string } {
  if (!input.restaurantId || !input.licenseId) {
    return { valid: false, error: 'Sélectionnez un restaurant et sa licence associée.' };
  }
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1) {
    return { valid: false, error: 'La durée du contrat doit être d’au moins 1 mois.' };
  }
  if (!Number.isFinite(input.priceAmount) || input.priceAmount < 0) {
    return { valid: false, error: 'Le tarif de maintenance doit être positif ou nul.' };
  }
  if (!input.includedServices.trim()) {
    return { valid: false, error: 'Décrivez les services inclus dans le contrat de maintenance.' };
  }
  if (!input.startDate || !input.endDate) {
    return { valid: false, error: 'Renseignez les dates de début et de fin du contrat.' };
  }
  if (input.endDate < input.startDate) {
    return { valid: false, error: 'La date de fin doit être postérieure ou égale à la date de début.' };
  }
  return { valid: true };
}

const COMMERCIAL_PAYMENT_LABELS: Record<PaymentRecord['payment_method'], string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte bancaire',
  bank_transfer: 'Virement bancaire',
  other: 'Autre mode',
};

const DOC_TITLES: Record<CommercialDocumentType, string> = {
  license_confirmation: 'Confirmation officielle de licence perpétuelle',
  sale_invoice: 'Facture de vente commerciale',
  payment_receipt: 'Reçu officiel de paiement commercial',
  maintenance_contract: 'Contrat de maintenance optionnel',
  restaurant_sheet: "Fiche d'informations de l'établissement",
};

const DOC_PREFIXES: Record<CommercialDocumentType, string> = {
  license_confirmation: 'CONF-LIC',
  sale_invoice: 'FAC-RC',
  payment_receipt: 'RECU-RC',
  maintenance_contract: 'CONT-MNT',
  restaurant_sheet: 'FICHE-RC',
};

export function buildCommercialDocumentSnapshot(params: {
  documentType: CommercialDocumentType;
  sequence: number;
  platform: PlatformCommercialConfig;
  restaurant: RestaurantRecord | undefined;
  license?: LicenseRecord;
  payment?: PaymentRecord;
  maintenanceContract?: MaintenanceContractRecord;
  issuedAt?: string;
}):
  | { ok: true; documentNumber: string; snapshot: CommercialDocumentSnapshot }
  | { ok: false; error: string } {
  const { documentType, sequence, platform, restaurant, license, payment, maintenanceContract } = params;
  if (!restaurant) {
    return { ok: false, error: 'Restaurant introuvable pour la génération du document.' };
  }

  // Règle stricte : aucun faux document sans enregistrement réel correspondant
  if (
    (documentType === 'license_confirmation' || documentType === 'sale_invoice') &&
    !license
  ) {
    return {
      ok: false,
      error: 'Aucune licence enregistrée pour générer une confirmation ou facture réelle.',
    };
  }
  if (documentType === 'payment_receipt' && (!payment || payment.status !== 'confirmed')) {
    return {
      ok: false,
      error: 'Un reçu officiel exige un paiement commercial réel confirmé.',
    };
  }
  if (documentType === 'maintenance_contract' && !maintenanceContract) {
    return {
      ok: false,
      error: 'Aucun contrat de maintenance réel sélectionné.',
    };
  }

  const now = params.issuedAt ?? new Date().toISOString();
  const docNumber = `${DOC_PREFIXES[documentType]}-${now.slice(0, 4)}-${String(sequence).padStart(4, '0')}`;

  const snapshot: CommercialDocumentSnapshot = {
    documentType,
    documentTitle: DOC_TITLES[documentType],
    documentNumber: docNumber,
    issuedAt: now,
    platformName: platform.platformName,
    platformLogoUrl: platform.logoUrl,
    platformContactEmail: platform.supportEmail,
    platformContactPhone: platform.commercialPhone,
    platformAddress: platform.commercialAddress,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    restaurantCity: restaurant.city,
    restaurantAddress: [restaurant.address, restaurant.commune, restaurant.city].filter(Boolean).join(', ') || null,
    restaurantPhone: restaurant.phone,
    restaurantEmail: restaurant.email,
    ownerName: restaurant.owner_name,
    businessClientName: license?.business_client_name ?? restaurant.name,
    businessClientContact: license?.business_client_contact ?? restaurant.owner_name,
    businessClientPhone: license?.business_client_phone ?? restaurant.phone,
    businessClientEmail: license?.business_client_email ?? restaurant.email,
    licenseKey: license?.license_key ?? null,
    licenseTypeLabel: license ? LICENSE_TYPE_LABELS[license.license_type] : null,
    licenseStatusLabel: license ? LICENSE_STATUS_META[license.status].label : null,
    saleDate: license?.sale_date ?? license?.issued_at?.slice(0, 10) ?? null,
    contractNumber: maintenanceContract?.contract_number ?? null,
    contractPeriod: maintenanceContract
      ? `${maintenanceContract.start_date} au ${maintenanceContract.end_date} (${maintenanceContract.duration_months} mois)`
      : null,
    contractServices: maintenanceContract?.included_services ?? null,
    paymentReference: payment?.reference_code ?? null,
    paymentMethodLabel: payment
      ? COMMERCIAL_PAYMENT_LABELS[payment.payment_method]
      : license?.payment_method
        ? COMMERCIAL_PAYMENT_LABELS[license.payment_method]
        : null,
    amount:
      documentType === 'payment_receipt'
        ? payment?.amount ?? null
        : documentType === 'maintenance_contract'
          ? maintenanceContract?.price_amount ?? null
          : license?.amount ?? null,
    currency:
      documentType === 'payment_receipt'
        ? payment?.currency ?? null
        : documentType === 'maintenance_contract'
          ? maintenanceContract?.currency ?? null
          : license?.currency ?? null,
    commercialTerms: platform.commercialTerms,
    notes: maintenanceContract?.notes ?? license?.notes ?? restaurant.additional_info ?? null,
  };

  return { ok: true, documentNumber: docNumber, snapshot };
}
