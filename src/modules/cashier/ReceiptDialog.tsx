import { useState } from 'react';
import { Download, Printer, Receipt, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { formatMoney } from '@/src/lib/domain/operations';
import type { ReceiptRecord } from '@/src/lib/supabase/database.types';

interface ReceiptDialogProps {
  receipt: ReceiptRecord | null;
  onClose: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ReceiptDialog({ receipt, onClose }: ReceiptDialogProps) {
  const [formatMode, setFormatMode] = useState<'a4' | 'thermal'>('a4');

  if (!receipt) return null;
  const s = receipt.snapshot_json;
  const issuedDateFormatted = s.issuedAt.replace('T', ' ').slice(0, 16);

  function handlePrint() {
    window.print();
  }

  function handleDownloadHtml() {
    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Reçu ${escapeHtml(s.receiptNumber)} - ${escapeHtml(s.restaurantName)}</title>
<style>
  body { font-family: ${formatMode === 'thermal' ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}; background: #faf9f5; padding: 24px; color: #141f1a; }
  .sheet { max-width: ${formatMode === 'thermal' ? '80mm' : '540px'}; margin: 0 auto; background: #fff; border: 1px solid #e4e1d7; padding: 20px; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  .muted { color: #5a6560; font-size: 12px; }
  .banner { margin: 12px 0; padding: 8px 10px; font-weight: 700; font-size: 12px; border-radius: 4px; text-align: center; }
  .banner-partial { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
  .banner-refund { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
  .banner-paid { background: #dcfce7; color: #166534; border: 1px solid #22c55e; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  th, td { padding: 6px 0; border-bottom: 1px dashed #e4e1d7; text-align: left; }
  .right { text-align: right; font-family: ui-monospace, monospace; }
  .totals { font-size: 13px; margin-top: 8px; }
  .row { display: flex; justify-content: space-between; margin: 4px 0; }
  .bold { font-weight: 700; }
</style>
</head>
<body>
  <div class="sheet">
    <h1>${escapeHtml(s.restaurantName)}</h1>
    <div class="muted">${escapeHtml(s.restaurantAddress ?? '')}${s.restaurantPhone ? ' · ' + escapeHtml(s.restaurantPhone) : ''}</div>
    <hr />
    <div class="row"><span>Reçu : <strong>${escapeHtml(s.receiptNumber)}</strong></span><span>Commande : <strong>${escapeHtml(s.orderNumber)}</strong></span></div>
    <div class="row muted"><span>Date : ${escapeHtml(issuedDateFormatted)}</span><span>Caissier : ${escapeHtml(s.cashierName)}</span></div>
    <div class="row muted"><span>Client : ${escapeHtml(s.customerName)}</span><span>${escapeHtml(s.customerPhone ?? '')}</span></div>
    <div class="banner ${s.isRefundReceipt ? 'banner-refund' : s.isPartialPayment ? 'banner-partial' : 'banner-paid'}">
      ${s.isRefundReceipt ? 'REÇU DE REMBOURSEMENT' : s.isPartialPayment ? 'PAIEMENT PARTIEL — SOLDE RESTANT DÛ' : 'PAIEMENT SOLDÉ'}
    </div>
    ${s.isRefundReceipt && s.refundReason ? `<p class="muted"><strong>Motif :</strong> ${escapeHtml(s.refundReason)}</p>` : ''}
    <table>
      <thead><tr><th>Article</th><th class="right">Qté</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${s.lines
          .map(
            (l) =>
              `<tr><td>${escapeHtml(l.productName)}${l.optionsSummary ? `<br/><span class="muted">${escapeHtml(l.optionsSummary)}</span>` : ''}</td><td class="right">${l.quantity}</td><td class="right">${escapeHtml(formatMoney(l.lineTotal, s.orderCurrency))}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Sous-total</span><span>${escapeHtml(formatMoney(s.subtotal, s.orderCurrency))}</span></div>
      ${s.deliveryFee > 0 ? `<div class="row"><span>Frais de livraison</span><span>${escapeHtml(formatMoney(s.deliveryFee, s.orderCurrency))}</span></div>` : ''}
      <div class="row bold"><span>Total commande</span><span>${escapeHtml(formatMoney(s.totalAmount, s.orderCurrency))}</span></div>
      <div class="row bold"><span>${s.isRefundReceipt ? 'Montant remboursé' : 'Montant encaissé (ce reçu)'}</span><span>${escapeHtml(formatMoney(s.amountPaidThisReceipt, s.paymentCurrency))}</span></div>
      <div class="row muted"><span>Taux verrouillé</span><span>1 USD = ${s.exchangeRateApplied} CDF</span></div>
      <div class="row"><span>Total payé cumulé</span><span>${escapeHtml(formatMoney(s.totalPaidOrderCurrency, s.orderCurrency))}</span></div>
      <div class="row bold"><span>Reste à payer</span><span>${escapeHtml(formatMoney(s.remainingBalanceOrderCurrency, s.orderCurrency))}</span></div>
      <div class="row muted"><span>Mode : ${escapeHtml(s.paymentMethodLabel)}</span><span>${escapeHtml(s.paymentContextLabel)}</span></div>
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.receiptNumber}-${s.orderNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu du reçu ${s.receiptNumber}`}
    >
      <div className="w-full max-w-[680px] rounded-xl border border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] shadow-2xl overflow-hidden my-auto">
        <div className="rc-no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rc-border)] bg-[var(--rc-card)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-[var(--rc-fg)]">
              Reçu {s.receiptNumber} · {s.orderNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFormatMode('a4')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  formatMode === 'a4'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                Standard (A4)
              </button>
              <button
                type="button"
                onClick={() => setFormatMode('thermal')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  formatMode === 'thermal'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                Thermique 80mm
              </button>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleDownloadHtml}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Télécharger</span>
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Imprimer / PDF</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label="Fermer le reçu" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 flex justify-center max-h-[78vh] overflow-y-auto">
          <div
            id="rc-printable-receipt"
            className={
              formatMode === 'thermal'
                ? 'rc-thermal-80mm w-[304px] max-w-full bg-[#ffffff] border border-[#d4d4d4] p-4 font-mono text-[11px] text-[#0b0b0b] shadow-sm space-y-3'
                : 'w-full max-w-[540px] bg-[#ffffff] border border-[#e7e7e7] rounded-lg p-6 text-xs text-[#0b0b0b] shadow-sm space-y-4'
            }
          >
            {/* En-tête restaurant */}
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#d4d4d4] pb-3">
              <div className="flex items-center gap-3">
                {s.restaurantLogoUrl ? (
                  <img
                    src={s.restaurantLogoUrl}
                    alt={s.restaurantName}
                    className="h-10 w-10 rounded object-cover border border-[#e7e7e7] shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-[#0b0b0b] text-[#f5b800] flex items-center justify-center font-display font-bold text-xs shrink-0">
                    {s.restaurantName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="font-display text-sm font-bold text-[#0b0b0b]">{s.restaurantName}</h2>
                  {s.restaurantAddress && (
                    <p className="text-[11px] text-[#5a5a5a]">{s.restaurantAddress}</p>
                  )}
                  {s.restaurantPhone && (
                    <p className="text-[11px] text-[#5a5a5a]">{s.restaurantPhone}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-[#0b0b0b]">{s.receiptNumber}</p>
                <p className="text-[11px] text-[#5a5a5a]">{issuedDateFormatted}</p>
              </div>
            </div>

            {/* Statut explicite du reçu */}
            {s.isRefundReceipt ? (
              <div className="rounded border border-[#EF4444] bg-[#FEF2F2] px-3 py-2 text-center text-[#991B1B] font-semibold">
                REÇU DE REMBOURSEMENT
                {s.refundReason && (
                  <p className="font-normal text-[11px] mt-0.5">Motif : {s.refundReason}</p>
                )}
              </div>
            ) : s.isPartialPayment ? (
              <div className="rounded border border-[#F59E0B] bg-[#FFFBEB] px-3 py-2 text-center text-[#92400E] font-semibold leading-snug">
                PAIEMENT PARTIEL — SOLDE RESTANT DÛ :{' '}
                <span className="whitespace-nowrap">
                  {formatMoney(s.remainingBalanceOrderCurrency, s.orderCurrency)}
                </span>
              </div>
            ) : (
              <div className="rounded border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-center text-[#166534] font-semibold">
                REÇU DE PAIEMENT — COMMANDE SOLDÉE
              </div>
            )}

            {/* Infos commande & client */}
            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-[#D9D5C9] pb-3">
              <div>
                <span className="text-[#5A6560]">Commande :</span>{' '}
                <strong className="font-mono">{s.orderNumber}</strong>
              </div>
              <div className="text-right">
                <span className="text-[#5A6560]">Service :</span>{' '}
                <strong>
                  {s.orderType === 'dine_in'
                    ? 'Sur place'
                    : s.orderType === 'takeaway'
                      ? 'À emporter'
                      : 'Livraison'}
                </strong>
              </div>
              <div>
                <span className="text-[#5A6560]">Client :</span> <strong>{s.customerName}</strong>
              </div>
              <div className="text-right">
                <span className="text-[#5A6560]">Tél :</span>{' '}
                <span>{s.customerPhone ?? '—'}</span>
              </div>
              <div>
                <span className="text-[#5A6560]">Mode :</span> <strong>{s.paymentMethodLabel}</strong>
              </div>
              <div className="text-right">
                <span className="text-[#5A6560]">Contexte :</span> <span>{s.paymentContextLabel}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#5A6560]">Caissier / Responsable :</span>{' '}
                <strong>{s.cashierName}</strong>
              </div>
            </div>

            {/* Lignes d'articles */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#E4E1D7] text-[11px] text-[#5A6560]">
                  <th className="py-1.5 pr-2 text-left font-medium">Article</th>
                  <th className="py-1.5 px-2 text-right font-medium whitespace-nowrap">Qté</th>
                  {formatMode === 'a4' && (
                    <th className="py-1.5 px-2 text-right font-medium whitespace-nowrap">P.U.</th>
                  )}
                  <th className="py-1.5 pl-2 text-right font-medium whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-[#E4E1D7]">
                {s.lines.map((line, i) => (
                  <tr key={`${line.productName}-${i}`}>
                    <td className="py-1.5 pr-2 align-top">
                      <p className="font-medium text-[#141F1A]">{line.productName}</p>
                      {formatMode === 'thermal' && (
                        <p className="text-[10px] text-[#5A6560]">
                          P.U. {formatMoney(line.unitPrice, s.orderCurrency)}
                        </p>
                      )}
                      {line.optionsSummary && (
                        <p className="text-[10px] text-[#5A6560]">{line.optionsSummary}</p>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums align-top whitespace-nowrap">
                      {line.quantity}
                    </td>
                    {formatMode === 'a4' && (
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums align-top whitespace-nowrap">
                        {formatMoney(line.unitPrice, s.orderCurrency)}
                      </td>
                    )}
                    <td className="py-1.5 pl-2 text-right font-mono tabular-nums font-medium align-top whitespace-nowrap">
                      {formatMoney(line.lineTotal, s.orderCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux financiers */}
            <div className="border-t border-dashed border-[#D9D5C9] pt-3 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[#5A6560]">
                <span>Sous-total commande</span>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                  {formatMoney(s.subtotal, s.orderCurrency)}
                </span>
              </div>
              {s.deliveryFee > 0 && (
                <div className="flex items-baseline justify-between gap-2 text-[#5A6560]">
                  <span>Frais de livraison</span>
                  <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                    {formatMoney(s.deliveryFee, s.orderCurrency)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2 font-semibold text-[#141F1A]">
                <span>Total commande</span>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                  {formatMoney(s.totalAmount, s.orderCurrency)}
                </span>
              </div>

              <div className="my-2 border-t border-[#E4E1D7]" />

              <div className="flex items-baseline justify-between gap-2 font-bold text-[#0b0b0b] text-[13px]">
                <span>
                  {s.isRefundReceipt ? 'Montant remboursé' : 'Montant reçu sur ce ticket'}
                </span>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                  {formatMoney(s.amountPaidThisReceipt, s.paymentCurrency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[11px] text-[#5A6560]">
                <span>Taux verrouillé</span>
                <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                  1 USD = {s.exchangeRateApplied.toLocaleString('fr-FR')} CDF
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[#141F1A]">
                <span>Total net payé ({s.orderCurrency})</span>
                <span className="font-mono tabular-nums font-semibold whitespace-nowrap shrink-0">
                  {formatMoney(s.totalPaidOrderCurrency, s.orderCurrency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 font-bold text-[#141F1A]">
                <span>Reste à payer</span>
                <span
                  className={`font-mono tabular-nums whitespace-nowrap shrink-0 ${
                    s.remainingBalanceOrderCurrency > 0 ? 'text-[#92400E]' : 'text-[#166534]'
                  }`}
                >
                  {formatMoney(s.remainingBalanceOrderCurrency, s.orderCurrency)}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-[#D9D5C9] pt-2.5 text-center text-[10px] text-[#5A6560]">
              Merci de votre visite chez {s.restaurantName} · Document généré par RestoConnect
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
