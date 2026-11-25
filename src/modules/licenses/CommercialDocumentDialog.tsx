import { Download, FileCheck2, Printer, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { formatMoney } from '@/src/lib/domain/operations';
import { escapeHtml, sanitizeMediaUrl } from '@/src/lib/domain/commercial';
import type { CommercialDocumentRecord } from '@/src/lib/supabase/database.types';

interface CommercialDocumentDialogProps {
  document: CommercialDocumentRecord | null;
  onClose: () => void;
}

export function CommercialDocumentDialog({ document: doc, onClose }: CommercialDocumentDialogProps) {
  if (!doc) return null;
  const s = doc.snapshot_json;
  const safeLogo = sanitizeMediaUrl(s.platformLogoUrl);
  const issuedDate = s.issuedAt.replace('T', ' ').slice(0, 16);
  const formattedAmount =
    s.amount !== null && s.currency ? formatMoney(s.amount, s.currency) : 'Non applicable';

  function handlePrint() {
    window.print();
  }

  function handleDownloadHtml() {
    const safeImgHtml = safeLogo
      ? `<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(s.platformName)}" style="height:44px;width:44px;object-fit:cover;border-radius:6px;border:1px solid #e7e7e7;" />`
      : `<div style="height:44px;width:44px;border-radius:6px;background:#0b0b0b;color:#f5b800;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">RC</div>`;

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(s.documentNumber)} - ${escapeHtml(s.documentTitle)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f3f3f3; color: #0b0b0b; padding: 28px; }
  .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e7e7; border-radius: 10px; padding: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b0b0b; padding-bottom: 16px; margin-bottom: 20px; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  h1 { margin: 0; font-size: 18px; color: #0b0b0b; }
  .muted { color: #5a5a5a; font-size: 12px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
  .box { background: #f9f9f9; border: 1px solid #e7e7e7; border-radius: 6px; padding: 12px; font-size: 12px; }
  .box strong { display: block; margin-bottom: 4px; color: #0b0b0b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .amount-box { background: #fff9e6; border: 1px solid #f5b800; border-radius: 6px; padding: 14px; display: flex; justify-content: space-between; align-items: center; margin: 18px 0; }
  .terms { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e7e7e7; font-size: 11px; color: #5a5a5a; }
  .mono { font-family: ui-monospace, monospace; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${safeImgHtml}
        <div>
          <h1>${escapeHtml(s.platformName)}</h1>
          <div class="muted">${escapeHtml(s.platformAddress)} · ${escapeHtml(s.platformContactPhone)} · ${escapeHtml(s.platformContactEmail)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="mono" style="font-weight:700;color:#0b0b0b;">${escapeHtml(s.documentNumber)}</div>
        <div class="muted">Émis le ${escapeHtml(issuedDate)}</div>
      </div>
    </div>

    <h2 style="font-size:16px;margin:0 0 6px;">${escapeHtml(s.documentTitle)}</h2>
    <p class="muted" style="margin:0 0 14px;">Document généré exclusivement à partir des enregistrements officiels de la plateforme.</p>

    <div class="grid">
      <div class="box">
        <strong>Établissement concerné</strong>
        <div>${escapeHtml(s.restaurantName)}</div>
        <div class="muted">Slug : /restaurant/${escapeHtml(s.restaurantSlug)}</div>
        <div class="muted">${escapeHtml(s.restaurantAddress ?? s.restaurantCity)}</div>
        <div class="muted">${escapeHtml(s.restaurantPhone ?? '—')} · ${escapeHtml(s.restaurantEmail ?? '—')}</div>
      </div>
      <div class="box">
        <strong>Client professionnel / Représentant</strong>
        <div>${escapeHtml(s.businessClientName ?? s.restaurantName)}</div>
        <div class="muted">Contact : ${escapeHtml(s.businessClientContact ?? s.ownerName ?? '—')}</div>
        <div class="muted">Tél : ${escapeHtml(s.businessClientPhone ?? s.restaurantPhone ?? '—')}</div>
        <div class="muted">E-mail : ${escapeHtml(s.businessClientEmail ?? s.restaurantEmail ?? '—')}</div>
      </div>
    </div>

    ${
      s.licenseKey
        ? `<div class="grid">
            <div class="box">
              <strong>Licence logicielle</strong>
              <div class="mono" style="font-weight:700;">${escapeHtml(s.licenseKey)}</div>
              <div class="muted">Type : ${escapeHtml(s.licenseTypeLabel ?? '—')}</div>
              <div class="muted">Statut : ${escapeHtml(s.licenseStatusLabel ?? '—')}</div>
              <div class="muted">Date de vente : ${escapeHtml(s.saleDate ?? '—')}</div>
            </div>
            <div class="box">
              <strong>Règlement &amp; Contrat</strong>
              <div>Mode : ${escapeHtml(s.paymentMethodLabel ?? '—')}</div>
              <div class="muted">Réf. paiement : ${escapeHtml(s.paymentReference ?? '—')}</div>
              ${s.contractNumber ? `<div class="muted">Contrat maintenance : ${escapeHtml(s.contractNumber)}</div>` : ''}
              ${s.contractPeriod ? `<div class="muted">Période : ${escapeHtml(s.contractPeriod)}</div>` : ''}
            </div>
          </div>`
        : ''
    }

    ${
      s.contractServices
        ? `<div class="box" style="margin-bottom:14px;">
            <strong>Services couverts par le contrat de maintenance</strong>
            <div>${escapeHtml(s.contractServices)}</div>
          </div>`
        : ''
    }

    ${
      s.amount !== null && s.currency
        ? `<div class="amount-box">
            <span style="font-weight:600;">Montant contractuel enregistré</span>
            <span class="mono" style="font-size:18px;font-weight:700;color:#0b0b0b;">${escapeHtml(formattedAmount)}</span>
          </div>`
        : ''
    }

    ${s.notes ? `<div class="box"><strong>Notes</strong><div>${escapeHtml(s.notes ?? '')}</div></div>` : ''}

    <div class="terms">
      <strong>Conditions commerciales :</strong> ${escapeHtml(s.commercialTerms ?? '')}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.documentNumber}-${s.restaurantSlug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Document commercial ${s.documentNumber}`}
    >
      <div className="w-full max-w-[760px] rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] shadow-2xl overflow-hidden my-auto">
        <div className="rc-no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rc-border)] bg-[var(--rc-card-elevated)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-[var(--rc-fg)]">
              {s.documentNumber} · {s.documentTitle}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleDownloadHtml}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Télécharger HTML</span>
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Imprimer / PDF</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Fermer le document commercial"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto bg-[var(--rc-bg-subtle)]">
          <div
            id="rc-printable-document"
            className="bg-white border border-[#E7E7E7] rounded-lg p-6 sm:p-8 text-xs text-[#0B0B0B] shadow-sm space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-[#0B0B0B] pb-4">
              <div className="flex items-center gap-3">
                {safeLogo ? (
                  <img
                    src={safeLogo}
                    alt={s.platformName}
                    className="h-11 w-11 rounded-md object-cover border border-[#E7E7E7] shrink-0"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-md bg-[#0B0B0B] text-[#F5B800] flex items-center justify-center font-display font-bold text-sm shrink-0">
                    RC
                  </div>
                )}
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0B0B0B]">{s.platformName}</h2>
                  <p className="text-[11px] text-[#5A5A5A]">{s.platformAddress}</p>
                  <p className="text-[11px] text-[#5A5A5A]">
                    {s.platformContactPhone} · {s.platformContactEmail}
                  </p>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <p className="font-mono text-sm font-bold text-[#0B0B0B]">{s.documentNumber}</p>
                <p className="text-[11px] text-[#5A5A5A]">Émis le {issuedDate}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7000]">
                Document officiel généré depuis les données vérifiées
              </p>
              <h3 className="font-display text-lg font-bold text-[#0B0B0B]">{s.documentTitle}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-md border border-[#E7E7E7] bg-[#F9F9F9] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B0B0B]">
                  Établissement
                </p>
                <p className="font-semibold text-sm text-[#0B0B0B]">{s.restaurantName}</p>
                <p className="font-mono text-[11px] text-[#5A5A5A]">/restaurant/{s.restaurantSlug}</p>
                <p className="text-[#5A5A5A]">{s.restaurantAddress ?? s.restaurantCity}</p>
                <p className="text-[#5A5A5A]">
                  {s.restaurantPhone ?? '—'} · {s.restaurantEmail ?? '—'}
                </p>
              </div>

              <div className="rounded-md border border-[#E7E7E7] bg-[#F9F9F9] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B0B0B]">
                  Client professionnel / Bénéficiaire
                </p>
                <p className="font-semibold text-sm text-[#0B0B0B]">
                  {s.businessClientName ?? s.restaurantName}
                </p>
                <p className="text-[#5A5A5A]">
                  Représentant : {s.businessClientContact ?? s.ownerName ?? '—'}
                </p>
                <p className="text-[#5A5A5A]">
                  Téléphone : {s.businessClientPhone ?? s.restaurantPhone ?? '—'}
                </p>
                <p className="text-[#5A5A5A]">
                  E-mail : {s.businessClientEmail ?? s.restaurantEmail ?? '—'}
                </p>
              </div>
            </div>

            {(s.licenseKey || s.contractNumber || s.paymentReference) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {s.licenseKey && (
                  <div className="rounded-md border border-[#E7E7E7] bg-white p-4 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B0B0B]">
                      Licence logicielle attribuée
                    </p>
                    <p className="font-mono text-sm font-bold text-[#0B0B0B]">{s.licenseKey}</p>
                    <p className="text-[#5A5A5A]">Offre : {s.licenseTypeLabel ?? '—'}</p>
                    <p className="text-[#5A5A5A]">Statut actuel : {s.licenseStatusLabel ?? '—'}</p>
                    <p className="text-[#5A5A5A]">
                      Date de vente : <span className="font-mono">{s.saleDate ?? '—'}</span>
                    </p>
                  </div>
                )}

                <div className="rounded-md border border-[#E7E7E7] bg-white p-4 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B0B0B]">
                    Détails financiers &amp; Maintenance
                  </p>
                  <p className="text-[#5A5A5A]">
                    Mode de règlement :{' '}
                    <strong className="text-[#0B0B0B]">{s.paymentMethodLabel ?? 'Non spécifié'}</strong>
                  </p>
                  <p className="text-[#5A5A5A]">
                    Référence paiement :{' '}
                    <span className="font-mono text-[#0B0B0B]">{s.paymentReference ?? '—'}</span>
                  </p>
                  {s.contractNumber && (
                    <p className="text-[#5A5A5A]">
                      Contrat maintenance :{' '}
                      <span className="font-mono text-[#0B0B0B]">{s.contractNumber}</span>
                    </p>
                  )}
                  {s.contractPeriod && (
                    <p className="text-[#5A5A5A]">Période : {s.contractPeriod}</p>
                  )}
                </div>
              </div>
            )}

            {s.contractServices && (
              <div className="rounded-md border border-[#E7E7E7] bg-[#F9F9F9] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B0B0B]">
                  Prestations incluses dans le contrat de maintenance
                </p>
                <p className="text-[#0B0B0B] leading-relaxed">{s.contractServices}</p>
              </div>
            )}

            {s.amount !== null && s.currency && (
              <div className="rounded-md border border-[#F5B800] bg-[#FFF9E6] px-5 py-4 flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-[#0B0B0B]">
                  Montant enregistré sur le justificatif
                </span>
                <span className="font-mono text-xl font-bold text-[#0B0B0B] tabular-nums">
                  {formattedAmount}
                </span>
              </div>
            )}

            {s.notes && (
              <div className="rounded-md border border-[#E7E7E7] bg-white p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A5A5A]">
                  Observations
                </p>
                <p className="text-[#0B0B0B]">{s.notes}</p>
              </div>
            )}

            <div className="border-t border-[#E7E7E7] pt-4 text-[11px] text-[#5A5A5A] leading-relaxed">
              <strong className="text-[#0B0B0B]">Clauses commerciales :</strong> {s.commercialTerms}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
