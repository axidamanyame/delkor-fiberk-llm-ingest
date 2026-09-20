/**
 * The view card — one standard for every view popup.
 *
 * Modelled on the product view, which is the one that was right: a title bar,
 * a facts grid in three columns with the image top-right, then colour-coded
 * section tables, then the actions. The colour carries meaning rather than
 * decoration:
 *
 *   green   money — prices, margins, balances, amounts owed
 *   blue    movement — stock, transfers, purchases, payments, history
 *   plain   anything that is neither
 *
 * Customer, contact and user views were each laid out differently, which is why
 * only the product one looked deliberate.
 *
 *   viewCard({
 *     title: p.name,
 *     image: productPhoto(p),
 *     facts: [
 *       [['SKU', p.sku], ['Brand', p.brand]],          // column 1
 *       [['Category', p.category]],                     // column 2
 *       [['Tax', p.tax]],                               // column 3
 *     ],
 *     sections: [
 *       { tone: 'green', columns: ['Cost', 'Selling'], rows: [[fmt(a), fmt(b)]] },
 *       { tone: 'blue', title: 'Stock', columns: [...], rows: [...] },
 *     ],
 *     actions: [{ label: 'Print', href: '…', tone: 'primary' }],
 *   })
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const EMPTY = '—';

function factsColumn(pairs) {
  return `<div class="vc-facts-col">${(pairs || []).map(([label, value]) => `
    <div class="vc-fact"><span class="vc-fact-l">${esc(label)}:</span> <span class="vc-fact-v">${value == null || value === '' ? EMPTY : esc(value)}</span></div>`).join('')}</div>`;
}

function imageSlot(src, alt) {
  if (src) return `<div class="vc-image"><img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" /></div>`;
  return `<div class="vc-image vc-image-empty"><span>No image</span></div>`;
}

function section(s) {
  const tone = ['green', 'blue', 'plain'].includes(s.tone) ? s.tone : 'plain';
  /* A note explains why a band looks the way it does — "Commission only —
     paid direct, no SSNIT deduction" — so an absent column reads as
     intentional rather than lost. */
  const note = s.note ? '<p class="vc-note">' + esc(s.note) + '</p>' : '';
  const head = (s.columns || []).map((c) => `<th>${esc(c)}</th>`).join('');
  const body = (s.rows || []).length
    ? s.rows.map((r) => `<tr>${(r || []).map((c) => `<td>${c == null || c === '' ? EMPTY : esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(1, (s.columns || []).length)}" class="vc-empty">Nothing recorded</td></tr>`;
  return `
    ${s.title ? `<h3 class="vc-sec-title">${esc(s.title)}</h3>` : ''}
    <div class="vc-table-wrap">
      <table class="vc-table vc-${tone}">
        ${head ? `<thead><tr>${head}</tr></thead>` : ''}
        <tbody>${body}</tbody>
      </table>
    </div>
    ${note}`;
}

function action(a) {
  const cls = a.tone === 'primary' ? 'vc-btn vc-btn-primary'
    : a.tone === 'dark' ? 'vc-btn vc-btn-dark'
      : 'vc-btn';
  if (a.href) return `<a class="${cls}" href="${esc(a.href)}">${esc(a.label)}</a>`;
  return `<button type="button" class="${cls}" data-act="${esc(a.act || '')}">${esc(a.label)}</button>`;
}

export function viewCard(opts = {}) {
  const facts = (opts.facts || []).filter((c) => (c || []).length);
  return `<div class="vc-card">
    <div class="vc-head">
      <h2>${esc(opts.title || 'Record')}</h2>
      ${opts.subtitle ? `<span class="vc-sub">${esc(opts.subtitle)}</span>` : ''}
      <button type="button" class="vc-x po-x" data-close aria-label="Close">×</button>
    </div>
    <div class="vc-body">
      ${facts.length || opts.image !== undefined ? `<div class="vc-facts">
        ${facts.map(factsColumn).join('')}
        ${opts.image !== undefined ? imageSlot(opts.image, opts.title) : ''}
      </div>` : ''}
      ${(opts.sections || []).map(section).join('')}
    </div>
    ${(opts.actions || []).length ? `<div class="vc-foot">${opts.actions.map(action).join('')}</div>` : ''}
  </div>`;
}

/** Render into a host element and wire the close button. */
export function paintViewCard(host, opts) {
  if (!host) return;
  host.innerHTML = viewCard(opts);
  host.querySelector('[data-close]')?.addEventListener('click', () => {
    if (typeof opts.onClose === 'function') return opts.onClose();
    const back = document.getElementById('rv-back') || document.getElementById('fk-modal');
    if (back) { back.remove(); return; }
    if (typeof window.__dfOpenSpa === 'function') {
      window.__dfOpenSpa(opts.backHref || '/dashboard.html');
      return;
    }
    location.href = opts.backHref || '/dashboard.html';
  });
}
