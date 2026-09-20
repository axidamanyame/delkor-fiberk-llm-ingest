/** Self-contained public receipt card — POS modal, /r/ links, WhatsApp. */
import { lockupHtml, themeFor, themeStyle } from './brand-mark.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => (
    ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[ch]
  ));
}

function gh(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function when(iso) {
  if (!iso) return '';
  if (/[A-Za-z]|\/|,/.test(String(iso)) && Number.isNaN(Date.parse(iso))) return String(iso);
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

const ICO = {
  print: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8V3h10v5"/><rect x="6" y="13" width="12" height="8" rx="1"/><path d="M6 17H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5.5-5.5L7 19"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="M8.2 10.8 15.8 6.4M8.2 13.2l7.6 4.4"/></svg>',
};

export function customerDockHtml() {
  return `
<nav class="rc-dock" aria-label="Save or share this receipt">
  <button type="button" data-rc="print">${ICO.print}<span>Print</span></button>
  <button type="button" data-rc="pdf">${ICO.pdf}<span>PDF</span></button>
  <button type="button" class="rc-more" data-rc="more" title="Feedback">${ICO.more}<span>More</span></button>
  <button type="button" data-rc="image">${ICO.image}<span>Image</span></button>
  <button type="button" data-rc="share">${ICO.share}<span>Share</span></button>
</nav>
<div class="rc-sheet" id="rc-sheet" hidden>
  <div class="rc-sheet-card">
    <button type="button" class="rc-sheet-x" data-rc="close-sheet" aria-label="Close">✕</button>
    <h3>How was your purchase?</h3>
    <p>A short review helps us serve you better. This is not sent as a chat message.</p>
    <div class="rc-stars" id="rc-stars">
      ${[1,2,3,4,5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star">★</button>`).join('')}
    </div>
    <textarea id="rc-review" rows="3" maxlength="400" placeholder="Optional comment"></textarea>
    <button type="button" class="rc-sheet-go" data-rc="send-review">Send review</button>
    <p class="rc-sheet-ok" id="rc-review-ok" hidden>Thank you — your review was saved.</p>
  </div>
</div>`;
}

export function digitalReceiptCardHtml(r, opts = {}) {
  const t = themeFor(r.subsidiary_code || r.shop_tag || r.location_name);
  const url = r.receipt_url || '';
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(url || r.receipt_code || r.reference || 'receipt');
  const items = r.items || r.lines || [];
  const exp = r.expires_at ? new Date(r.expires_at) : new Date(Date.now() + 7 * 864e5);
  const loc = String(r.location_name || r.shop_tag || r.location || '').trim();
  const expLabel = exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const grand = r.grand_total != null ? r.grand_total : r.total;
  const dock = opts.dock === true ? customerDockHtml() : (opts.actionsHtml != null ? opts.actionsHtml : '');
  return `<article class="receipt" id="receipt-card" data-card="dfk-1" data-sub="${esc(t.code)}" style="${themeStyle(t)}">
    ${lockupHtml()}
    <header class="rc-subbar">
      <h1>${esc(t.label)}</h1>
      <p class="shop">${esc(loc || t.tag)}</p>
      <div class="rc-contact">
        ${r.shop_city ? `<span>${esc(r.shop_city)}</span>` : ''}
        ${r.shop_phone ? `<span>${esc(r.shop_phone)}</span>` : ''}
        ${r.shop_email ? `<span>${esc(r.shop_email)}</span>` : ''}
      </div>
    </header>
    <div class="rc-meta">
      <span>TIN: ${esc(r.tin || 'N/A')}</span>
      <span class="rc-pay">${esc(r.payment_method || r.payLabel || 'CASH')}</span>
    </div>
    <div class="rc-facts">
      <div class="rc-pairs">
        <div class="rc-kv">Transaction no.<b>${esc(r.reference || r.receipt_code || '')}</b></div>
        <div class="rc-kv">Date & time<b>${esc(r.at || when(r.transaction_date))}</b></div>
        <div class="rc-kv">Customer<b>${esc(r.customer_name || r.customer || 'Walk-In Customer')}</b></div>
        <div class="rc-kv">Contact<b>${esc(r.customer_phone || r.phone || '—')}</b></div>
      </div>
      <div class="rc-qr">
        <img alt="Scan to verify" src="${esc(qr)}" crossorigin="anonymous"/>
        <small>Scan to verify</small>
      </div>
    </div>
    <table class="rc-table">
      <thead><tr><th>Descriptions</th><th>Qty × Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((i) => {
          const qty = Number(i.qty || i.quantity || 1);
          const price = Number(i.price || i.unit_price || 0);
          const total = i.total != null ? i.total : qty * price;
          const name = i.description || i.name || i.product_name || '';
          return `<tr>
            <td><b>${esc(name)}</b>${i.sku ? `<span>${esc(i.sku)}</span>` : ''}</td>
            <td>${qty} × ${gh(price)}</td>
            <td>${gh(total)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="3">No lines</td></tr>'}
      </tbody>
    </table>
    <div class="sum">
      <div class="sum-title">Transaction summary</div>
      <div class="sum-row"><span>Gross Total</span><span>${gh(r.gross_total != null ? r.gross_total : r.subtotal)}</span></div>
      ${(r.tax_amount || r.tax) ? `<div class="sum-row"><span>${esc(r.tax_label || 'Tax')}</span><span>${gh(r.tax_amount || r.tax)}</span></div>` : ''}
      <div class="sum-row"><span>Discount</span><span>${gh(r.discount)}</span></div>
      <div class="sum-row grand"><span>Grand Total</span><span>${gh(grand)}</span></div>
    </div>
    <div class="warranty">
      <i>⏱</i>
      <div>
        <b>Expires in 7 days</b>
        <span>Save a copy before ${esc(expLabel)}</span>
      </div>
    </div>
    ${dock}
  </article>`;
}

export function buildPublicReceiptHtml(r) {
  const t = themeFor(r.subsidiary_code || r.shop_tag || r.location_name);
  const shop = r.shop_name || 'Delkor-Fiberk';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>Receipt ${esc(r.reference || r.receipt_code)} — ${esc(shop)}</title>
<link rel="stylesheet" href="/css/receipt.css?v=dfk-card-1"/>
</head>
<body class="rc-page" style="${themeStyle(t)}">
<div id="box">
${digitalReceiptCardHtml(r, { dock: true })}
</div>
<script type="module" src="/js/receipt-public.js?v=dfk-card-1"></script>
</body>
</html>`;
}
