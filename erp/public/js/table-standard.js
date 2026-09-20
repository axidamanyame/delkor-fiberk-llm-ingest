/**
 * The table standard.
 *
 * Every record table carries the same eight actions in the same order, and an
 * action that does not apply to a desk is greyed out rather than missing — so
 * staff learn one menu instead of eighteen variations. Before this, action
 * menus were hand-listed per page and had drifted: some desks offered four
 * items, some eight, some named the same job differently.
 *
 * A desk says what it can do and leaves the rest alone:
 *
 *   actMenu(r.id, standardActions(r.id, {
 *     entity: 'customers',                      // View → /customer-view.html
 *     form: '/customer-form.html',              // Edit
 *     ledger: `/contact-ledger.html?id=${r.id}`,
 *     print: `/customer-form.html?id=${r.id}&print=1`,
 *     del: true,                                // act: 'del'
 *   }))
 *
 * Anything not supplied is rendered disabled, with a title saying why.
 */

/**
 * The dedicated view pages — the sectioned summaries, not a disabled edit form.
 * A desk that lists one of these entities gets View pointed here; anything else
 * falls back to the record-view facts panel.
 */
export const VIEW_PAGES = {
  customers: '/customer-view.html',
  customer: '/customer-view.html',
  contacts: '/contact-view.html',
  suppliers: '/contact-view.html',
  supplier: '/contact-view.html',
  products: '/product-view.html',
  product: '/product-view.html',
  catalog: '/product-view.html',
  users: '/user-view.html',
  user: '/user-view.html',
  staff: '/user-view.html',
};

/** The canonical order. Do not reorder without deciding to — staff learn it. */
export const STANDARD_ACTIONS = [
  'view', 'edit', 'print', 'history', 'ledger', 'pay', 'default', 'del',
];

export const ACTION_LABELS = {
  view: 'View',
  edit: 'Edit',
  print: 'Print',
  history: 'History',
  ledger: 'Ledger',
  pay: 'Mark paid',
  default: 'Set as default',
  del: 'Delete',
};

const NOT_HERE = {
  view: 'No read-only view for this record',
  edit: 'Not editable from this desk',
  print: 'Nothing to print for this record',
  history: 'No audit trail for this record',
  ledger: 'This record has no ledger',
  pay: 'Payment status is not tracked here',
  default: 'This list has no default',
  del: 'Cannot be deleted from this desk',
};

function withId(href, id) {
  if (!href) return '';
  if (href.includes('${') || /[?&]id=/.test(href)) return href;
  return href + (href.includes('?') ? '&' : '?') + 'id=' + encodeURIComponent(id);
}

/**
 * @param {string} id row id
 * @param {object} opts
 *   form     base form page — produces View (with view=1) and Edit
 *   view     explicit View href (overrides form)
 *   edit     explicit Edit href (overrides form)
 *   print    href, or true to use form + print=1
 *   history  href
 *   ledger   href
 *   pay      href, or true for act:'pay'
 *   default  true for act:'def'
 *   del      true for act:'del', or false to grey it out
 *   omit     array of keys to leave out entirely rather than grey
 */
export function standardActions(id, opts = {}) {
  const omit = new Set(opts.omit || []);
  const items = [];

  for (const key of STANDARD_ACTIONS) {
    if (omit.has(key)) continue;
    const label = ACTION_LABELS[key];
    let href = '';
    let act = '';

    switch (key) {
      case 'view':
        /* Preference order: an explicit href, then the entity's dedicated view
           page, then the form in read-only mode. Passing nothing leaves the
           facts panel to handle it, which is what actMenu does with a
           View item carrying no href. */
        href = opts.view
          || (opts.entity && VIEW_PAGES[String(opts.entity).toLowerCase()]
            ? withId(VIEW_PAGES[String(opts.entity).toLowerCase()], id)
            : '')
          || (opts.viewPage ? withId(opts.viewPage, id) : '')
          || (opts.form && opts.viewViaForm ? withId(opts.form, id) + '&view=1' : '');
        break;
      case 'edit':
        href = opts.edit || (opts.form ? withId(opts.form, id) : '');
        break;
      case 'print':
        href = typeof opts.print === 'string' ? opts.print
          : (opts.print && opts.form ? withId(opts.form, id) + '&print=1' : '');
        break;
      case 'history':
        href = typeof opts.history === 'string' ? opts.history : '';
        break;
      case 'ledger':
        href = typeof opts.ledger === 'string' ? opts.ledger : '';
        break;
      case 'pay':
        if (typeof opts.pay === 'string') href = opts.pay;
        else if (opts.pay) act = 'pay';
        break;
      case 'default':
        if (opts.default) act = 'def';
        break;
      case 'del':
        if (opts.del) act = 'del';
        break;
      default:
        break;
    }

    if (href) items.push({ href, label });
    else if (act) items.push({ act, label });
    else items.push({ label, disabled: true, title: NOT_HERE[key] });
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * Product image column
 * ------------------------------------------------------------------ */

/** A product table is one whose header carries a SKU or Product column. */
export function looksLikeProductTable(table) {
  const head = table?.tHead?.rows?.[0];
  if (!head) return false;
  const labels = [...head.cells].map((c) => String(c.textContent || '').toLowerCase());
  const hasProduct = labels.some((l) => /\bproduct\b|\bitem\b/.test(l));
  const hasSku = labels.some((l) => /\bsku\b|\bcode\b|\bbarcode\b/.test(l));
  return hasProduct || hasSku;
}

const CAMERA = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"
  fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a2 2 0 0 0 1.7-1l.4-.7a1 1 0 0 1 .9-.5h4.6a1 1 0 0 1 .9.5l.4.7a2 2 0 0 0 1.7 1h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>
  <circle cx="12" cy="12.5" r="3.2"/>
</svg>`;

function cellHtml(src, alt) {
  if (src) {
    return `<img src="${src}" alt="${alt || ''}" loading="lazy"
      style="width:40px;height:40px;object-fit:contain;border-radius:6px;background:var(--ult-card-2)"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'df-no-photo',innerHTML:${JSON.stringify(CAMERA)}}))" />`;
  }
  return `<span class="df-no-photo" title="No photo yet"
    style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:6px;background:var(--ult-card-2);color:var(--ult-muted)">${CAMERA}</span>`;
}

/**
 * Insert a thumbnail column immediately after the select-all checkbox, which is
 * where the eye lands first on a product list. Idempotent, and a no-op on a
 * table that already has an image column.
 *
 * @param {HTMLTableElement} table
 * @param {(tr: HTMLTableRowElement) => object|null} rowLookup  row → product
 */
export async function addProductImageColumn(table, rowLookup) {
  if (!table || table.dataset.imageCol === '1') return;
  const head = table.tHead?.rows?.[0];
  if (!head) return;
  const labels = [...head.cells].map((c) => String(c.textContent || '').toLowerCase());
  if (labels.some((l) => /image|photo|picture/.test(l))) { table.dataset.imageCol = '1'; return; }
  table.dataset.imageCol = '1';

  let productPhoto = () => '';
  try { ({ productPhoto } = await import('./product-images.js')); } catch { /* fall back to blanks */ }

  /* after the checkbox if there is one, otherwise first */
  const at = head.querySelector('[data-pick-all]') ? 1 : 0;

  const th = document.createElement('th');
  th.dataset.nosort = '1';
  th.textContent = 'Image';
  head.insertBefore(th, head.cells[at] || null);

  table.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.dataset.dummy === '1' || (tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan'))) return;
    const td = document.createElement('td');
    let src = '';
    let alt = '';
    try {
      const row = rowLookup ? rowLookup(tr) : null;
      if (row) { src = productPhoto(row) || ''; alt = row.name || row.sku || ''; }
    } catch { /* leave blank */ }
    td.innerHTML = cellHtml(src, alt);
    tr.insertBefore(td, tr.cells[at] || null);
  });
}
