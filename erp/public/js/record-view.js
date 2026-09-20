/**
 * Read-only View. Products use the Fiberkapp product sheet.
 */
import { esc, pickRow, readLs } from './ls-rows.js';
import { hostedProductImage, loadCatalogPhotos } from './product-images.js';
import { viewCard } from './view-card.js';
import { subsidiaryLabel } from './entity-scope.js';
import { displayRole } from './access-rules.js';
import { isDelkorJob, isUpostJob } from './job-catalog.js';
import { applyStaffJob, publicJobLabel } from './staff-jobs.js';
import { materializePerms, visiblePermGroups } from './perm-catalog.js';
import { CORE_MODULE_FLAGS, ADDON_MODULE_FLAGS } from './settings-store.js';
import { effectiveMap } from './module-grants.js';

const SKIP = new Set([
  'source', 'live', 'pos_image_ready', 'image_source', 'copy', 'raw', 'view',
  'locations', 'ledger_tables', 'text',
]);

const DEDICATED_VIEW = /\/(customer-view|product-view|contact-view|catalogue-view)\.html/i;

const LABELS = {
  id: 'ID', sku: 'SKU', name: 'Name', full_name: 'Name', business_name: 'Business',
  contact_code: 'Contact code', contact_type: 'Type', entity: 'Entity',
  brand: 'Brand', category: 'Category', subcategory: 'Sub category',
  unit: 'Unit', type: 'Type', product_type: 'Product type',
  phone: 'Phone', mobile: 'Mobile', email: 'Email',
  address: 'Address', city: 'City', landline: 'Landline',
  sell: 'Selling price', selling_price: 'Selling price',
  buy: 'Purchase price', cost_price: 'Cost', purchase_price: 'Purchase price',
  stock: 'On hand', current_stock: 'On hand', qty: 'Qty',
  subsidiary_code: 'Subsidiary', location_code: 'Location code',
  location_name: 'Business location', department_name: 'Department',
  agent: 'Agent', cashier: 'Cashier', customer_name: 'Customer',
  supplier_name: 'Supplier', reference: 'Reference', reference_no: 'Reference',
  status: 'Status', invoice_no: 'Invoice', order_date: 'Date',
  total_amount: 'Total', amount_paid: 'Paid', tax: 'Tax',
  first_name: 'First name', last_name: 'Last name',
  role: 'Role', username: 'Username',
};

const ORDER = [
  'name', 'full_name', 'business_name', 'first_name', 'last_name',
  'sku', 'contact_code', 'id', 'brand', 'category', 'subcategory',
  'phone', 'mobile', 'email', 'address', 'city',
  'sell', 'selling_price', 'buy', 'cost_price', 'stock', 'current_stock',
  'subsidiary_code', 'location_name', 'location_code', 'department_name',
  'status', 'invoice_no', 'order_date', 'total_amount', 'amount_paid',
  'customer_name', 'supplier_name', 'agent', 'role', 'username',
];

function pretty(key) {
  return LABELS[key] || String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function val(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  if (typeof v === 'object') return '';
  return String(v);
}

export function viewFacts(row) {
  if (!row || typeof row !== 'object') return [];
  const seen = new Set();
  const out = [];
  const push = (k) => {
    if (seen.has(k) || SKIP.has(k) || k.startsWith('_')) return;
    const t = val(row[k]);
    if (!t || t === 'undefined') return;
    seen.add(k);
    out.push({ key: k, label: pretty(k), value: t });
  };
  ORDER.forEach(push);
  Object.keys(row).forEach(push);
  return out;
}

function n(v) {
  const x = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(x) ? x : 0;
}

function cedis(v) {
  return '¢ ' + n(v).toFixed(2);
}

function isProduct(row) {
  if (!row) return false;
  return !!(row.sku || row.category || row.product_type || row.selling_price || row.sell
    || row.current_stock != null || row.brand);
}

function unitOf(row) {
  return row.unit || row.unit_name || 'Pc(s)';
}

function fact(label, value) {
  return `<div class="rv-fact"><b>${esc(label)}:</b> ${esc(value || '—')}</div>`;
}

function productSheet(row) {
  const sku = row.sku || row.base_sku || row.id || '—';
  const name = row.name || row.product_name || 'Product';
  const buy = n(row.purchase_price ?? row.buy ?? row.cost_price ?? row.default_purchase_price);
  const sell = n(row.selling_price ?? row.sell ?? row.default_selling_price);
  const buyInc = n(row.purchase_price_inc ?? row.buy_inc ?? buy);
  const sellInc = n(row.selling_price_inc ?? row.sell_inc ?? sell);
  let margin = row.margin ?? row.profit_percent;
  if (margin == null && buy > 0 && sell > 0) margin = ((sell - buy) / buy) * 100;
  margin = n(margin);
  const stock = n(row.stock ?? row.current_stock ?? row.qty_available);
  const loc = row.location_name || row.available_locations || row.legacy_location || row.loc || '—';
  const sold = n(row.units_sold ?? row.total_sold);
  const xfer = n(row.units_transferred ?? row.total_transferred);
  const adj = n(row.units_adjusted ?? row.total_adjusted);
  const img = hostedProductImage(row.image_url || row.catalog_image_url, row);
  const wholesale = row.wholesale_price ?? row.group_wholesale ?? 0;
  const retail = row.retail_price ?? row.group_retail ?? 0;
  return `
    <header class="rv-title">
      <h2>${esc(name)}</h2>
      <button type="button" class="rv-x" data-rv-close aria-label="Close">×</button>
    </header>
    <div class="rv-top">
      <div class="rv-cols">
        <div>
          ${fact('SKU', sku)}
          ${fact('Brand', row.brand || '—')}
          ${fact('Unit', unitOf(row))}
          ${fact('Barcode Type', row.barcode_type || row.barcode || 'C128')}
          ${row.supplier_sku ? fact(String(row.supplier_name || row.legacy_location || 'Ref'), row.supplier_sku) : ''}
          ${fact('Available in locations', loc)}
        </div>
        <div>
          ${fact('Category', row.category || row.legacy_cat || '—')}
          ${fact('Sub category', row.subcategory || row.sub_category || '—')}
          ${fact('Manage Stock?', row.manage_stock === false ? 'No' : 'Yes')}
          ${fact('Alert quantity', row.alert_quantity ?? row.reorder_level ?? '--')}
        </div>
        <div>
          ${fact('Expires in', row.expires_in || row.expiry || 'Not Applicable')}
          ${fact('Applicable Tax', row.tax_name || row.tax || 'None')}
          ${fact('Selling Price Tax Type', row.tax_type || 'Exclusive')}
          ${fact('Product Type', row.product_type || row.type || 'Single')}
        </div>
      </div>
      <div class="rv-img">${img
        ? `<img src="${esc(img)}" alt="">`
        : `<div class="rv-img-empty">Product image</div>`}</div>
    </div>
    <table class="rv-price">
      <thead><tr>
        <th>Default Purchase Price (Exc. tax)</th>
        <th>Default Purchase Price (Inc. tax)</th>
        <th>x Margin(%)</th>
        <th>Default Selling Price (Exc. tax)</th>
        <th>Default Selling Price (Inc. tax)</th>
        <th>Group Prices</th>
        <th>Variation Images</th>
      </tr></thead>
      <tbody><tr>
        <td>${cedis(buy)}</td>
        <td>${cedis(buyInc)}</td>
        <td>${margin.toFixed(2)}</td>
        <td>${cedis(sell)}</td>
        <td>${cedis(sellInc)}</td>
        <td><b>WHOLESALE</b> - ${n(wholesale)}<br><b>RETAIL</b> - ${n(retail)}</td>
        <td></td>
      </tr></tbody>
    </table>
    <h3 class="rv-h3">Product Stock Details</h3>
    <table class="rv-stock">
      <thead><tr>
        <th>SKU</th><th>Product</th><th>Business Location</th><th>Department</th><th>Unit Price</th>
        <th>Current stock</th><th>Current Stock Value</th>
        <th>Total unit sold</th><th>Total Unit Transfered</th><th>Total Unit Adjusted</th>
      </tr></thead>
      <tbody><tr>
        <td>${esc(sku)}</td>
        <td>${esc(name)}</td>
        <td>${esc(loc)}</td>
        <td>${esc(row.department_name || row.department || '—')}</td>
        <td>${cedis(sell)}</td>
        <td>${stock.toFixed(2)}${esc(unitOf(row))}</td>
        <td>${cedis(stock * (buy || sell))}</td>
        <td>${sold.toFixed(2)}${esc(unitOf(row))}</td>
        <td>${xfer.toFixed(2)}${esc(unitOf(row))}</td>
        <td>${adj.toFixed(2)}${esc(unitOf(row))}</td>
      </tr></tbody>
    </table>
    <footer class="rv-foot">
      <button type="button" class="rv-print" data-rv-print>Print</button>
      <button type="button" class="rv-close" data-rv-close>Close</button>
    </footer>`;
}

function dash(v) { return (v == null || v === '') ? '--' : String(v); }

function linesOf(row) {
  const raw = row.lines || row.items || row.products || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((ln, i) => {
    if (Array.isArray(ln?.cells)) {
      const c = ln.cells.map((x) => String(x ?? ''));
      if (c.length >= 9) {
        return {
          i: c[0] || i + 1, name: c[1], sku: c[2], qty: c[3],
          unit: c[4], disc: c[5], before_tax: c[6], sub_ex: c[7], tax: c[8],
          after: c[9], subtotal: c[10] || c[c.length - 1],
        };
      }
      if (/^\d/.test(c[0]) && c.length >= 4) {
        return { i: c[0], name: c[1], qty: c[2], subtotal: c[3], unit: c[3] };
      }
      return { i: i + 1, name: c[0], sku: c[1], qty: c[2], subtotal: c[3] || c[2] };
    }
    return {
      i: i + 1,
      name: ln.product || ln.name || ln.product_name || '',
      sku: ln.sku || ln.product_sku || '',
      qty: ln.qty || ln.quantity || ln.return_qty || '1',
      unit: ln.unit_price || ln.unit_cost || ln.price || ln.cost || 0,
      disc: ln.discount || ln.discount_percent || 0,
      tax: ln.tax || ln.tax_amount || 0,
      inc: ln.price_inc || ln.unit_price || ln.unit_cost || ln.price || 0,
      before_tax: ln.before_tax || ln.unit_cost || ln.unit_price || ln.cost || 0,
      sub_ex: ln.sub_ex || ln.subtotal || ln.line_total || ln.amount || 0,
      after: ln.after || ln.unit_cost || ln.unit_price || ln.cost || 0,
      subtotal: ln.subtotal || ln.line_total || ln.amount || ln.return_subtotal || 0,
    };
  });
}

function paymentsOf(row) {
  const raw = row.payments || row.payments_view || [];
  if (!Array.isArray(raw) || !raw.length) return [];
  if (Array.isArray(raw[0])) {
    const rows = raw[0] && /date/i.test(String(raw[0][0] || '')) ? raw.slice(1) : raw;
    return rows.filter((r) => Array.isArray(r) && r.length).map((r, i) => ({
      i: i + 1, date: r[0], ref: r[1], amount: r[2], mode: r[3], note: r[4],
    }));
  }
  return raw.map((p, i) => ({
    i: i + 1,
    date: p.date || p.paid_on || p.created_at || '',
    ref: p.reference || p.ref || p.reference_no || '',
    amount: p.amount || p.total || 0,
    mode: p.method || p.payment_mode || p.method_label || '',
    note: p.note || p.payment_note || '',
  }));
}

function moneyCell(v) {
  const s = String(v ?? '');
  if (s.includes('¢')) return s;
  return cedis(v);
}

function kindOf(row, opts = {}) {
  if (opts.kind) return opts.kind;
  const type = String(row.contact_type || row.kind || '').toLowerCase();
  if (type === 'supplier' || type === 'customer') return type;
  const ref = String(row.ref || row.reference || row.reference_no || row.invoice_no || '');
  if (/^ST/i.test(ref) || row.from_location || (row.from && row.to)) return 'transfer';
  if (row.adjustment_date || row.adjustment_type
    || /^(normal|abnormal)$/i.test(String(row.kind || ''))
    || /^SA/i.test(ref)) return 'adjustment';
  if (row.expense_date || row.payment_to || /^exp-/i.test(String(row.id || '')) || (row.category && row.title && !row.invoice_no && !row.customer_name)) return 'expense';
  if (/^CN/i.test(ref) || row.return_date || row.return_qty != null) return 'return';
  if (/^PO/i.test(ref) || (row.supplier_name && (row.lines || row.total_amount != null))) return 'purchase';
  if (row.invoice_no || row.customer_name || row.payment_status) return 'sale';
  if (isProduct(row)) return 'product';
  if (row.tin || row.tax_number || row.pay_term != null || row.opening_balance != null) {
    if (!row.sku && !row.invoice_no) return row.customer_group ? 'customer' : 'supplier';
  }
  if (opts.kind === 'role' || (row.permissions && (row.name || row.code) && !row.email && !row.sku)) return 'role';
  if (/^r-/.test(String(row.id || '')) && !row.email && !row.sku) return 'role';
  if (row.email || row.username || row.role || row.role_name || opts.kind === 'user') return 'user';
  return 'generic';
}

function cedisParty(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function contactSheet(row, kind) {
  const isSup = kind === 'supplier';
  const title = row.business_name || row.full_name || row.name || (isSup ? 'Supplier' : 'Customer');
  const money = isSup
    ? [
      ['Opening balance', cedisParty(row.opening_balance)],
      ['Purchase due', cedisParty(row.purch_due || row.purchase_due || row.total_due)],
      ['Return due', cedisParty(row.ret_due || row.purchase_return_due)],
      ['Advance paid', cedisParty(row.advance_balance)],
    ]
    : [
      ['Opening balance', cedisParty(row.opening_balance)],
      ['Sales due', cedisParty(row.sale_due)],
      ['Returns due', cedisParty(row.ret_due)],
      ['Advance balance', cedisParty(row.advance_balance)],
    ];
  const books = isSup
    ? [['Purchases', 'df_purchases'], ['Purchase returns', 'df_purchase_returns']]
    : [['Sales', 'df_sales_orders'], ['EasyBuy', 'df_bnpl_orders']];
  const needle = String(row.id || '').toLowerCase();
  const nameNeedle = String(title).toLowerCase();
  const moves = [];
  for (const [book, key] of books) {
    for (const line of (readLs(key, []) || [])) {
      const ref = String(line.supplier_id || line.customer_id || line.contact_id || '').toLowerCase();
      const nm = String(line.supplier_name || line.customer_name || line.name || '').toLowerCase();
      if (ref !== needle && nm !== nameNeedle) continue;
      moves.push([
        String(line.date || line.created_at || line.order_date || '').slice(0, 10),
        book,
        line.ref_no || line.reference || line.invoice_no || '',
        subsidiaryLabel(line.subsidiary_code) || '',
        line.location_name || line.location_code || '',
        line.department_name || line.department_code || '',
        cedisParty(line.total || line.amount || line.grand_total || line.total_amount || 0),
      ]);
    }
  }
  moves.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return viewCard({
    title,
    subtitle: row.contact_code || row.contact_id || row.id || '',
    facts: [
      [
        ['Phone', row.mobile || row.phone],
        ['Email', row.email],
        ['Type', isSup ? 'Supplier' : 'Customer'],
      ],
      [
        ['Company', subsidiaryLabel(row.subsidiary_code) || row.company || ''],
        ['Location', row.location_name || row.location_code],
        ['Department', row.department_name || row.department_code],
      ],
      [
        ['TIN', row.tin || row.tax_number],
        ['Pay term', row.pay_term],
        ['Address', [row.address, row.city].filter(Boolean).join(', ') || row.address],
      ],
    ],
    sections: [
      { tone: 'green', columns: money.map(([l]) => l), rows: [money.map(([, v]) => v)] },
      {
        tone: 'blue',
        title: 'Recent transactions',
        columns: ['Date', 'Book', 'Ref', 'Company', 'Business Location', 'Department', 'Amount'],
        rows: moves.slice(0, 12),
      },
    ],
    actions: [
      { label: 'Edit', href: `/${isSup ? 'supplier-form' : 'customer-form'}.html?id=${encodeURIComponent(row.id || '')}`, tone: 'primary' },
      { label: 'Close', act: 'close', tone: 'dark' },
    ],
  });
}

function head3(left, mid, right) {
  return `<div class="rv-head3"><div>${left}</div><div>${mid}</div><div>${right}</div></div>`;
}

function totalsBox(rows) {
  return `<table class="rv-tot">${rows.map((r) =>
    `<tr><th>${esc(r[0])}</th><td class="op">${esc(r[2] || '')}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`;
}

function notesPair(leftLabel, leftVal, rightLabel, rightVal) {
  return `<div class="rv-notes"><div><div class="rv-nl">${esc(leftLabel)}</div><div class="rv-nv">${esc(dash(leftVal))}</div></div>
    <div><div class="rv-nl">${esc(rightLabel)}</div><div class="rv-nv">${esc(dash(rightVal))}</div></div></div>`;
}

function activityBlock(row, extraBadges = '') {
  const date = row.order_date || row.date || row.created_at || row.return_date || '';
  const by = row.added_by || row.staff || row.cashier || row.created_by || '—';
  const action = row.activity_action || 'Added';
  return `<div class="rv-act"><div class="rv-nl">Activities:</div>
    <table class="rv-act-tbl"><thead><tr><th>Date</th><th>Action</th><th>By</th><th>Note</th></tr></thead>
    <tbody><tr><td>${esc(date)}</td><td>${esc(action)}</td><td>${esc(by)}</td>
    <td class="rv-badges">${extraBadges}</td></tr></tbody></table></div>`;
}

function badge(label, tone = 'info') {
  return `<span class="rv-badge ${tone}">${esc(label)}</span>`;
}

function titleBar(text) {
  return `<header class="rv-title"><h2>${esc(text)}</h2><button type="button" class="rv-x" data-rv-close>×</button></header>`;
}

function footBtns(extra = '') {
  return `<footer class="rv-foot">${extra}
    <button type="button" class="rv-print" data-rv-print>Print</button>
    <button type="button" class="rv-close" data-rv-close>Close</button></footer>`;
}

function transferSheet(row) {
  const ref = row.ref || row.reference_no || row.reference || row.id;
  const lines = linesOf(row);
  const total = row.total_amount || row.grand_total || row.subtotal || lines.reduce((s, l) => s + n(l.subtotal), 0);
  const fromName = row.from_location_name || row.from || row.from_location || '—';
  const toName = row.to_location_name || row.to || row.to_location || '—';
  return `${titleBar('Stock transfer details (Reference No: #' + ref + ')')}
    ${head3(
      `<div class="rv-nl">Location (From):</div><div class="rv-strong">${esc(fromName)}</div>
       <div>${esc(row.from_address || row.from_department || '')}</div><div>${row.from_phone ? 'Mobile: ' + esc(row.from_phone) : ''}</div>`,
      `<div class="rv-nl">Location (To):</div><div class="rv-strong">${esc(toName)}</div>
       <div>${esc(row.to_address || row.to_department || '')}</div><div>${row.to_phone ? 'Mobile: ' + esc(row.to_phone) : ''}</div>`,
      `${fact('Reference No', '#' + ref)}${fact('Date', row.transfer_date || row.date || row.order_date || row.created_at || '')}${fact('Status', row.status || 'Completed')}${fact('Subsidiary', row.subsidiary_name || subsidiaryLabel(row.subsidiary_code) || '')}`
    )}
    <table class="rv-green"><thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Subtotal</th></tr></thead>
    <tbody>${lines.map((l) => `<tr><td>${esc(l.i)}</td><td>${esc(l.name)}</td><td>${esc(l.qty)}</td><td>${moneyCell(l.subtotal)}</td></tr>`).join('') || '<tr><td colspan="4">No lines</td></tr>'}</tbody></table>
    <div class="rv-right">${totalsBox([
      ['Net Total Amount:', moneyCell(total)],
      ['Additional Shipping charges:', moneyCell(row.shipping || row.shipping_charges || 0), '(+)'],
      ['Purchase Total:', moneyCell(total)],
    ])}</div>
    <div class="rv-pad"><div class="rv-nl">Additional Notes:</div><div class="rv-nv">${esc(dash(row.notes || row.additional_notes || row.note))}</div></div>
    ${activityBlock(row, badge(row.status || 'Completed'))}
    ${footBtns()}`;
}

function capAdj(s) {
  const t = String(s || '').trim();
  if (!t) return '—';
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function adjustmentSheet(row) {
  const ref = row.reference_no || row.reference || row.ref || row.id || '—';
  const raw = Array.isArray(row.lines) ? row.lines : [];
  const lines = raw.length ? linesOf({ ...row, lines: raw.map((l) => ({
    ...l,
    unit_price: l.unit_price ?? l.cost ?? l.unit_cost ?? 0,
    subtotal: l.subtotal ?? (Number(l.qty || 0) * Number(l.cost ?? l.unit_price ?? l.unit_cost ?? 0)),
  })) }) : [];
  const total = n(row.total_amount) || lines.reduce((s, l) => s + n(l.subtotal), 0);
  const recovered = n(row.recovered ?? row.total_amount_recovered);
  const locName = row.location_name || row.location || row.location_code || '—';
  const kind = capAdj(row.kind || row.adjustment_type);
  const body = lines.length
    ? lines.map((l) => `<tr>
        <td>${esc(l.i)}</td>
        <td>${esc(l.name || '—')}${l.sku ? `<br><small>${esc(l.sku)}</small>` : ''}</td>
        <td>${esc(l.qty || 0)}</td>
        <td>${moneyCell(l.unit)}</td>
        <td>${moneyCell(l.subtotal)}</td>
      </tr>`).join('')
    : `<tr><td>1</td><td>—</td><td>0</td><td>${moneyCell(0)}</td><td>${moneyCell(0)}</td></tr>`;
  return `${titleBar('Stock Adjustment Details (Reference No: #' + ref + ')')}
    ${head3(
      `<div class="rv-nl">Business Location:</div><div class="rv-strong">${esc(locName)}</div>
       <div>${esc(row.department_name || row.department || '')}</div>
       ${fact('Subsidiary', subsidiaryLabel(row.subsidiary_code) || row.subsidiary_code || '')}`,
      `${fact('Reference No', '#' + ref)}
       ${fact('Date', fmtViewDate(row.adjustment_date || row.date || row.created_at))}
       ${fact('Adjustment type', kind)}`,
      `${fact('Added by', row.added_by || '—')}
       ${fact('Reason', row.reason || '—')}`
    )}
    <table class="rv-green"><thead><tr>
      <th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th>
    </tr></thead>
    <tbody>${body}</tbody></table>
    <div class="rv-right">${totalsBox([
      ['Total Amount:', moneyCell(total)],
      ['Total amount recovered:', moneyCell(recovered)],
    ])}</div>
    <div class="rv-pad"><div class="rv-nl">Reason:</div><div class="rv-nv">${esc(dash(row.reason))}</div></div>
    ${activityBlock(row, badge(kind) + badge(moneyCell(total)))}
    ${footBtns()}`;
}

function fmtViewDate(s) {
  const t = String(s || '').trim();
  if (!t) return '—';
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}${iso[4] ? ' ' + iso[4] + ':' + iso[5] : ''}`;
  const dmy = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (dmy) return `${String(dmy[1]).padStart(2, '0')}/${String(dmy[2]).padStart(2, '0')}/${dmy[3]}${dmy[4] ? ' ' + dmy[4] + ':' + dmy[5] : ''}`;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return t;
}

function expenseSheet(row) {
  const amt = n(row.total_amount || row.amount);
  const paid = n(row.paid_amount);
  const due = Math.max(0, amt - paid);
  return `${titleBar('Expense')}
    ${head3(
      `${fact('Reference', row.reference_no || row.ref || row.id)}
       ${fact('Date', fmtViewDate(row.expense_date || row.date || row.created_at))}
       ${fact('Status', row.payment_status || row.status || '')}`,
      `${fact('Title', row.title || row.description || '')}
       ${fact('Payment to', row.payment_to || row.vendor || '')}
       ${fact('Category', row.category || row.category_name || '')}
       ${fact('Sub category', row.sub_category || '—')}`,
      `${fact('Location', row.location_name || row.location_code || '')}
       ${fact('Subsidiary', subsidiaryLabel(row.subsidiary_code) || row.subsidiary_code || '')}
       ${fact('Payment method', row.payment_method || row.payment_account || '')}`
    )}
    <div class="rv-pad">${totalsBox([
      ['Total amount:', moneyCell(amt)],
      ['Paid:', moneyCell(paid)],
      ['Due:', moneyCell(due)],
    ])}</div>
    ${notesPair('Expense note:', row.note || row.expense_note, 'Added by:', row.added_by || row.expense_for || '')}
    ${activityBlock(row, badge(row.payment_status || 'paid') + badge(moneyCell(amt)))}
    ${footBtns()}`;
}

function saleSheet(row) {
  const inv = row.invoice_no || row.reference || row.id;
  const lines = linesOf(row);
  const pays = paymentsOf(row);
  const total = n(row.total_amount || row.total);
  const paid = n(row.amount_paid);
  const due = Math.max(0, total - paid);
  const pack = `<button type="button" class="rv-pack" data-rv-print>Packing Slip</button>
    <button type="button" class="rv-print" data-rv-print>Print Invoice</button>`;
  return `${titleBar('Sell Details ( Invoice No. : ' + inv + ')')}
    ${head3(
      `${fact('Invoice No.', '#' + inv)}${fact('Status', row.status || 'Final')}${fact('Payment Status', row.payment_status || '')}`,
      `<div class="rv-nl">Customer name:</div><div class="rv-strong">${esc(row.customer_name || 'Walk-In Customer')}</div>
       <div class="rv-nl">Address:</div><div>${esc(row.address || row.customer_name || '')}</div>
       ${row.phone ? '<div>Mobile: ' + esc(row.phone) + '</div>' : ''}`,
      `<div class="rv-date">Date: ${esc(row.order_date || row.date || '')}</div>
       <div class="rv-nl">Cashier staff:</div><div>${esc(dash(row.staff || row.service_staff || row.cashier))}</div>
       <div class="rv-nl">Shipping:</div><div>${row.shipping_status ? badge(row.shipping_status, 'ok') : '--'}</div>
       ${row.delivered_to ? fact('Delivered To', row.delivered_to) : ''}
       ${row.delivery_person ? fact('Delivery Person', row.delivery_person) : ''}`
    )}
    <div class="rv-pad"><div class="rv-nl">Products:</div>
    <table class="rv-green"><thead><tr>
      <th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Price inc. tax</th><th>Subtotal</th>
    </tr></thead><tbody>${lines.map((l) => `<tr>
      <td>${esc(l.i)}</td><td>${esc(l.name)}${l.sku ? ', ' + esc(l.sku) : ''}</td>
      <td>${esc(l.qty)}</td><td>${moneyCell(l.unit)}</td><td>${moneyCell(l.disc || 0)}</td>
      <td>${moneyCell(l.tax || 0)}</td><td>${moneyCell(l.inc || l.unit)}</td><td>${moneyCell(l.subtotal)}</td>
    </tr>`).join('') || '<tr><td colspan="8">No lines</td></tr>'}</tbody></table></div>
    <div class="rv-split">
      <div><div class="rv-nl">Payment info:</div>
        <table class="rv-green"><thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
        <tbody>${pays.length ? pays.map((p) => `<tr><td>${p.i}</td><td>${esc(p.date)}</td><td>${esc(p.ref)}</td><td>${moneyCell(p.amount)}</td><td>${esc(p.mode)}</td><td>${esc(dash(p.note))}</td></tr>`).join('')
          : '<tr><td colspan="6">No payments found</td></tr>'}</tbody></table></div>
      ${totalsBox([
        ['Total:', moneyCell(total)],
        ['Discount:', (row.discount_pct || '0.00') + ' %', '(-)'],
        ['Packing Charge:', moneyCell(row.packing || 0), '(+)'],
        ['Order Tax:', moneyCell(row.tax || 0), '(+)'],
        ['Shipping:', moneyCell(row.shipping || 0), '(+)'],
        ['Round Off:', moneyCell(row.round_off || 0)],
        ['Total Payable:', moneyCell(total)],
        ['Total paid:', moneyCell(paid)],
        ['Total remaining:', moneyCell(due)],
      ])}
    </div>
    ${notesPair('Sell note:', row.note || row.sell_note, 'Staff note:', row.staff_note)}
    ${activityBlock(row, badge(row.status || 'Final') + badge(moneyCell(total)) + (row.payment_status ? badge(row.payment_status) : '') + (row.shipping_status ? badge(row.shipping_status, 'ok') : ''))}
    ${footBtns(pack)}`;
}

function returnSheet(row) {
  const ref = row.invoice_no || row.reference || row.id;
  const lines = linesOf(row);
  const total = n(row.total_amount || row.return_total);
  return `${titleBar('Sell Return (Invoice No.: ' + ref + ')')}
    ${head3(
      `<div class="rv-nl">Sell Return Details:</div>
       ${fact('Return Date', row.return_date || row.order_date || row.date)}
       ${fact('Customer', row.customer_name || 'Walk-In Customer')}
       ${fact('Business Location', row.location_name || row.loc || '')}`,
      `<div class="rv-nl">Sale Details:</div>
       ${fact('Invoice No.', row.parent_invoice || row.sale_invoice || '')}
       ${fact('Date', row.sale_date || row.order_date || '')}`,
      ''
    )}
    <table class="rv-blue"><thead><tr><th>#</th><th>Product Name</th><th>Unit Price</th><th>Return Quantity</th><th>Return Subtotal</th></tr></thead>
    <tbody>${lines.map((l) => `<tr><td>${esc(l.i)}</td><td>${esc(l.name)}</td><td>${moneyCell(l.unit)}</td><td>${esc(l.qty)}</td><td>${moneyCell(l.subtotal)}</td></tr>`).join('')}</tbody></table>
    <div class="rv-right">${totalsBox([
      ['Net Total Amount:', moneyCell(total)],
      ['Return Discount:', moneyCell(row.discount || 0), '(-)'],
      ['Total Return Tax:', moneyCell(row.tax || 0), '(+)'],
      ['Return Total:', moneyCell(total)],
    ])}</div>
    ${activityBlock(row, badge(moneyCell(total)))}
    ${footBtns()}`;
}

function purchaseSheet(row) {
  const ref = row.reference || row.reference_no || row.ref || row.id;
  const lines = linesOf(row);
  const pays = paymentsOf(row);
  const total = n(row.total_amount || row.total);
  return `${titleBar('Purchase Details (Reference No: #' + ref + ')')}
    ${head3(
      `<div class="rv-nl">Supplier:</div><div class="rv-strong">${esc(row.supplier_name || '—')}</div>
       <div>${esc(row.supplier_address || '')}</div><div>${row.supplier_phone ? 'Mobile: ' + esc(row.supplier_phone) : ''}</div>`,
      `<div class="rv-nl">Business:</div><div class="rv-strong">${esc(row.location_name || row.business || '')}</div>
       <div>${esc(row.business_address || '')}</div>`,
      `<div class="rv-date">Date: ${esc(row.order_date || row.date || '')}</div>
       ${fact('Reference No', '#' + ref)}
       ${fact('Date', row.order_date || row.date || '')}
       ${fact('Purchase Status', row.status || 'Received')}
       ${fact('Payment Status', row.payment_status || 'Due')}`
    )}
    <table class="rv-blue"><thead><tr>
      <th>#</th><th>Product Name</th><th>SKU</th><th>Purchase Quantity</th><th>Unit Cost (Before Discount)</th>
      <th>Discount Percent</th><th>Unit Cost (Before Tax)</th><th>Subtotal (Before Tax)</th><th>Tax</th>
      <th>Unit Cost Price (After Tax)</th><th>Subtotal</th>
    </tr></thead><tbody>${lines.map((l) => `<tr>
      <td>${esc(l.i)}</td><td>${esc(l.name)}</td><td>${esc(l.sku || '')}</td><td>${esc(l.qty)}</td>
      <td>${moneyCell(l.unit)}</td><td>${esc(l.disc || '0.00 %')}</td><td>${moneyCell(l.before_tax || l.unit)}</td>
      <td>${moneyCell(l.sub_ex || l.subtotal)}</td><td>${moneyCell(l.tax || 0)}</td>
      <td>${moneyCell(l.after || l.unit)}</td><td>${moneyCell(l.subtotal)}</td>
    </tr>`).join('')}</tbody></table>
    <div class="rv-split">
      <div><div class="rv-nl">Payment info:</div>
        <table class="rv-green"><thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
        <tbody>${pays.length ? pays.map((p) => `<tr><td>${p.i}</td><td>${esc(p.date)}</td><td>${esc(p.ref)}</td><td>${moneyCell(p.amount)}</td><td>${esc(p.mode)}</td><td>${esc(dash(p.note))}</td></tr>`).join('')
          : '<tr><td colspan="6">No payments found</td></tr>'}</tbody></table>
        <div class="rv-nl">Shipping Details:</div><div class="rv-nv">${esc(dash(row.shipping_details))}</div></div>
      <div>${totalsBox([
        ['Net Total Amount:', moneyCell(total)],
        ['Discount:', moneyCell(row.discount || 0), '(-)'],
        ['Purchase Tax:', moneyCell(row.tax || 0), '(+)'],
        ['Additional Shipping charges:', moneyCell(row.shipping || 0), '(+)'],
        ['Purchase Total:', moneyCell(total)],
      ])}<div class="rv-nl">Additional Notes:</div><div class="rv-nv">${esc(dash(row.note))}</div></div>
    </div>
    ${activityBlock(row, badge(row.status || 'Received') + badge(moneyCell(total)) + badge(row.payment_status || 'Due'))}
    ${footBtns()}`;
}

function roleSheet(row) {
  const name = displayRole(row.name) || row.name || 'Role';
  const perms = materializePerms(row.permissions, row.name);
  const assigned = visiblePermGroups(row.name).map((g) => {
    const items = [];
    for (const list of [g.radios, g.radios2, g.radios3, g.perms]) {
      if (list) list.forEach((p) => { if (perms[p.key]) items.push(p); });
    }
    return { label: g.label, items };
  }).filter((g) => g.items.length);
  let map = {};
  try { map = effectiveMap({}, { roleName: row.name }); } catch { map = {}; }
  const onMods = [...CORE_MODULE_FLAGS, ...ADDON_MODULE_FLAGS].filter(({ flag }) => map[flag]);
  const facts = [
    ['Role', name],
    ['Code', row.code || row.id || ''],
    ['Users assigned', row.users_assigned ?? row.assigned ?? ''],
    ['Permissions ticked', row.roles_assigned ?? assigned.reduce((n, g) => n + g.items.length, 0)],
    ['Modules ticked', row.modules_assigned ?? onMods.length],
    ['System role', row.is_system ? 'Yes' : 'No'],
    ['Default', row.is_default ? 'Yes' : 'No'],
    ['Group', row.dashboard_group || ''],
  ].filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== '—');
  const id = row.id || '';
  return `
    <header class="rv-title">
      <h2>${esc(name)}</h2>
      <button type="button" class="rv-x" data-rv-close aria-label="Close">×</button>
    </header>
    <div class="rv-facts">
      ${facts.map(([k, v]) => `<div class="cell"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}
    </div>
    <div class="rv-assigned">
      <div class="rv-nl">Assigned permissions</div>
      ${assigned.length ? assigned.map((g) => `
        <h3>${esc(g.label)}</h3>
        <div class="ticks">
          ${g.items.map((p) => `<label><input type="checkbox" checked disabled /> ${esc(p.label)}</label>`).join('')}
        </div>
      `).join('') : '<p class="rv-meta">None ticked</p>'}
      ${onMods.length ? `
        <h3>Modules</h3>
        <div class="ticks">
          ${onMods.map((m) => `<label><input type="checkbox" checked disabled /> ${esc(m.label)}</label>`).join('')}
        </div>
      ` : ''}
    </div>
    <footer class="rv-foot">
      <a class="vc-btn-primary" href="/roles-edit.html?id=${encodeURIComponent(id)}" style="text-decoration:none;background:#7c3aed;color:#fff;border-radius:10px;padding:10px 16px;font-weight:700">Edit</a>
      <button type="button" class="rv-print" data-rv-print>Print</button>
      <button type="button" class="rv-close" data-rv-close>Close</button>
    </footer>`;
}

function userSheet(row) {
  row = applyStaffJob(row) || row;
  const name = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || row.email || 'User';
  const role = publicJobLabel(row, row.email);
  const facts = [
    ['Username', row.username || (row.email || '').split('@')[0]],
    ['Email', row.email],
    ['Position', role],
    ['Status', row.is_active === false ? 'Inactive' : (row.status || 'Active')],
    ['Mobile', row.mobile || row.phone],
    ['Department', row.department],
    ['Subsidiary', row.subsidiary_code || row.home_subsidiary],
    ['Location', row.work_location || row.location_code || (row.all_locations !== false ? 'All locations' : '')],
    ['Allow login', row.allow_login === false ? 'No' : 'Yes'],
    ['Date of birth', row.dob],
    ['Gender', row.gender],
    ['City', row.city],
    ['Region', row.region],
    ['Digital address', row.ghana_post_gps],
    ['Bank', row.bank_name],
    ['Account', row.bank_account],
    ['TIN', row.tin],
  ].filter(([, v]) => v != null && String(v).trim() !== '');
  const id = row.id || '';
  return `
    <header class="rv-title">
      <h2>${esc(name)}</h2>
      <button type="button" class="rv-x" data-rv-close aria-label="Close">×</button>
    </header>
    <div class="rv-pad"><p class="rv-strong">${esc(role)}</p></div>
    <div class="rv-grid">${facts.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join('')}</div>
    <footer class="rv-foot">
      <a class="rv-print" href="/user-view.html?id=${encodeURIComponent(id)}" style="text-decoration:none;display:inline-flex;align-items:center">Full profile</a>
      <a class="vc-btn-primary" href="/user-edit.html?id=${encodeURIComponent(id)}" style="text-decoration:none;background:#7c3aed;color:#fff;border-radius:10px;padding:10px 16px;font-weight:700">Edit</a>
      <button type="button" class="rv-close" data-rv-close>Close</button>
    </footer>`;
}

function genericSheet(row, opts) {
  const facts = viewFacts(row);
  const title = opts.title || row.name || row.full_name || row.sku || 'Record';
  return `
    <header class="rv-title">
      <h2>${esc(title)}</h2>
      <button type="button" class="rv-x" data-rv-close aria-label="Close">×</button>
    </header>
    <div class="rv-grid">${facts.map((f) => `<div class="k">${esc(f.label)}</div><div class="v">${esc(f.value)}</div>`).join('')}</div>
    <footer class="rv-foot">
      <button type="button" class="rv-print" data-rv-print>Print</button>
      <button type="button" class="rv-close" data-rv-close>Close</button>
    </footer>`;
}

function ensureCss() {
  if (document.getElementById('rv-css')) return;
  const s = document.createElement('style');
  s.id = 'rv-css';
  s.textContent = `
    .rv-back{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:14000;display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}
    .rv-card{width:min(1180px,100%);background:#fff;color:#111;border-radius:6px;box-shadow:0 24px 60px rgba(15,23,42,.28)}
    .rv-title{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 8px;border-bottom:1px solid #e5e7eb}
    .rv-title h2{margin:0;font-size:20px;font-weight:600;color:#334155}
    .rv-x{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#64748b}
    .rv-top{display:grid;grid-template-columns:1fr 220px;gap:16px;padding:16px 20px 8px}
    .rv-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 24px}
    .rv-fact{font-size:13px;line-height:1.55;color:#111}
    .rv-fact b{font-weight:800}
    .rv-img{border:1px solid #e5e7eb;border-radius:4px;min-height:110px;display:flex;align-items:center;justify-content:center;background:#fff}
    .rv-img img{max-width:100%;max-height:140px;object-fit:contain}
    .rv-img-empty{color:#94a3b8;font-size:12px;padding:18px}
    .rv-price,.rv-stock{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0 0}
    .rv-price th{background:#2ee59d;color:#fff;font-weight:800;padding:8px 10px;text-align:left;border:0}
    .rv-price td{background:#d7dbe3;padding:10px;vertical-align:top}
    .rv-h3{margin:18px 20px 0;font-size:14px}
    .rv-stock th{background:#3b82f6;color:#fff;font-weight:800;padding:8px 10px;text-align:left}
    .rv-stock td{background:#d7dbe3;padding:8px 10px}
    .rv-grid{display:grid;grid-template-columns:180px 1fr;padding:8px 0}
    .rv-grid div{padding:8px 20px;border-bottom:1px solid #f1f5f9;font-size:13px}
    .rv-grid .k{color:#64748b;font-weight:700}
    .rv-foot{display:flex;justify-content:flex-end;gap:8px;padding:18px 20px}
    .rv-print{background:#6d28d9;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}
    .rv-pack{background:#16a34a;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}
    .rv-close{background:#0f172a;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}
    .rv-facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e7eb}
    .rv-facts .cell{display:grid;grid-template-columns:minmax(9rem,38%) 1fr;gap:10px;padding:10px 18px;border-bottom:1px solid #f1f5f9;border-right:1px solid #f1f5f9;font-size:13px;align-items:center}
    .rv-facts .k{color:#64748b;font-weight:700}
    .rv-facts .v{font-weight:600;color:#0f172a}
    .rv-assigned{padding:8px 20px 4px}
    .rv-assigned .rv-nl{font-weight:800;margin:10px 0 4px;font-size:14px}
    .rv-assigned h3{margin:12px 0 6px;font-size:13px;font-weight:800;color:#334155;letter-spacing:.03em;text-transform:uppercase}
    .rv-assigned .ticks{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
    .rv-assigned label{display:flex;align-items:center;gap:8px;font-size:13px}
    .rv-assigned input{accent-color:#2563eb;width:15px;height:15px;flex-shrink:0}
    @media(max-width:700px){
      .rv-facts{grid-template-columns:1fr}
      .rv-assigned .ticks{grid-template-columns:1fr}
    }
    .rv-head3{display:grid;grid-template-columns:1.2fr 1.2fr 1fr;gap:16px;padding:14px 20px;font-size:13px}
    .rv-strong{font-weight:800;margin:2px 0 6px}
    .rv-nl{font-weight:700;margin:8px 0 4px;font-size:13px}
    .rv-nv{background:#d7dbe3;padding:8px 10px;min-height:28px;font-size:13px}
    .rv-pad{padding:0 20px 8px}
    .rv-date{text-align:right;font-size:13px;margin-bottom:8px}
    .rv-green,.rv-blue{width:calc(100% - 40px);margin:0 20px 12px;border-collapse:collapse;font-size:12px}
    .rv-green th{background:#2ee59d;color:#fff;padding:8px 10px;text-align:left}
    .rv-blue th{background:#3b82f6;color:#fff;padding:8px 10px;text-align:left}
    .rv-green td,.rv-blue td{background:#d7dbe3;padding:8px 10px}
    .rv-split{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;padding:0 20px 8px;align-items:start}
    .rv-right{display:flex;justify-content:flex-end;padding:0 20px}
    .rv-tot{min-width:360px;border-collapse:collapse;font-size:13px;margin:8px 0}
    .rv-tot th{text-align:left;padding:8px 10px;background:#eceff3;font-weight:700}
    .rv-tot td{padding:8px 10px;background:#eceff3;text-align:right}
    .rv-tot .op{width:36px;text-align:center;color:#64748b}
    .rv-notes{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px 20px}
    .rv-act{padding:8px 20px 0}
    .rv-act-tbl{width:100%;border-collapse:collapse;font-size:13px}
    .rv-act-tbl th,.rv-act-tbl td{text-align:left;padding:8px 4px;border-bottom:1px solid #e5e7eb}
    .rv-badge{display:inline-block;background:#22d3ee;color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;margin:2px}
    .rv-badge.ok{background:#22c55e}
    .rv-badges{text-align:right}
    @media(max-width:900px){.rv-top,.rv-cols,.rv-head3,.rv-split,.rv-notes{grid-template-columns:1fr}}
    @media print{.rv-back{position:static;background:#fff;padding:0}.rv-foot,.rv-x{display:none}}
  `;
  document.head.appendChild(s);
}

export function recordSheetHtml(row, kind) {
  if (!row) return '';
  ensureCss();
  const k = kind || kindOf(row);
  if (k === 'transfer') return transferSheet(row);
  if (k === 'adjustment') return adjustmentSheet(row);
  if (k === 'sale') return saleSheet(row);
  if (k === 'expense') return expenseSheet(row);
  if (k === 'return') return returnSheet(row);
  if (k === 'purchase') return purchaseSheet(row);
  if (k === 'product') return productSheet(row);
  if (k === 'supplier' || k === 'customer') return contactSheet(row, k);
  if (k === 'user') return userSheet(row);
  if (k === 'role') return roleSheet(row);
  return genericSheet(row, { kind: k });
}

export function openRecordView(row, opts = {}) {
  if (!row) return;
  ensureCss();
  closeRecordView();
  const back = document.createElement('div');
  back.id = 'rv-back';
  back.className = 'rv-back';
  const kind = kindOf(row, opts);
  const sheet = kind === 'transfer' ? transferSheet(row)
    : kind === 'adjustment' ? adjustmentSheet(row)
    : kind === 'sale' ? saleSheet(row)
    : kind === 'expense' ? expenseSheet(row)
    : kind === 'return' ? returnSheet(row)
    : kind === 'purchase' ? purchaseSheet(row)
    : kind === 'product' ? productSheet(row)
    : (kind === 'supplier' || kind === 'customer') ? contactSheet(row, kind)
    : kind === 'user' ? userSheet(row)
    : kind === 'role' ? roleSheet(row)
    : genericSheet(row, opts);
  back.innerHTML = `<article class="rv-card" role="dialog" aria-modal="true">${sheet}</article>`;
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-rv-close],[data-close],[data-act="close"]')) closeRecordView();
    if (e.target.closest('[data-rv-print]')) window.print();
    const edit = e.target.closest('a.vc-btn-primary, a.vc-btn');
    if (edit && edit.getAttribute('href')) closeRecordView();
  });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closeRecordView(); document.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(back);
}

function normalizeRecordId(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  try {
    if (/[?&]id=/.test(s) || s.includes('.html')) {
      const u = new URL(s, 'https://local.invalid');
      return decodeURIComponent(u.searchParams.get('id') || '');
    }
  } catch { /* keep */ }
  return s;
}

export function rowFromContext(id, root) {
  const rid = normalizeRecordId(id);
  if (!rid) return null;
  const card = root?.closest?.('[data-tbl]') || document.querySelector('[data-tbl]');
  const key = card?.dataset?.ls || card?.dataset?.key || '';
  const lists = [];
  if (Array.isArray(window.__dfProductRows)) lists.push(window.__dfProductRows);
  if (Array.isArray(window.__dfSupplierRows)) lists.push(window.__dfSupplierRows);
  if (Array.isArray(window.__dfCustomerRows)) lists.push(window.__dfCustomerRows);
  if (Array.isArray(window.__dfTransferRows)) lists.push(window.__dfTransferRows);
  if (Array.isArray(window.__dfBrandRows)) lists.push(window.__dfBrandRows);
  if (Array.isArray(window.__dfWarrantyRows)) lists.push(window.__dfWarrantyRows);
  if (Array.isArray(window.__dfSalesRows)) lists.push(window.__dfSalesRows);
  if (Array.isArray(window.__dfExpenseRows)) lists.push(window.__dfExpenseRows);
  if (key) lists.push(readLs(key, []));
  ['df_products', 'df_customers', 'df_suppliers', 'df_contacts', 'df_sales_orders', 'df_purchases',
    'df_stock_transfers', 'df_stock_adjustments', 'df_sell_returns', 'df_purchase_returns',
    'df_commission_agents', 'df_hr_employees', 'df_brands', 'df_warranties', 'df_categories', 'df_expenses',
    'df_users', 'df_profiles'].forEach((k) => lists.push(readLs(k, [])));
  if (Array.isArray(window.__dfUserRows)) lists.unshift(window.__dfUserRows);
  if (Array.isArray(window.__dfRoleRows)) lists.unshift(window.__dfRoleRows);
  ['df_roles', 'df_app_roles'].forEach((k) => lists.push(readLs(k, [])));
  return pickRow(rid, lists);
}

export function bindRecordViews(root = document) {
  loadCatalogPhotos().catch(() => {});
  if (document.documentElement.dataset.rvDocBound === '1') return;
  document.documentElement.dataset.rvDocBound = '1';
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a,button');
    if (!a) return;
    if (a.closest('.erp-top-bar, .erp-bottom-bar, [data-exp], .col-vis-menu')) return;
    const label = (a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const id = a.dataset.recordView || a.dataset.prodView || a.dataset.view || a.dataset.id || '';
    const href = a.getAttribute('href') || '';
    if (DEDICATED_VIEW.test(href)) return;
    const looksView = label === 'view' || label === 'view details' || a.hasAttribute('data-record-view') || a.hasAttribute('data-prod-view')
      || /[?&]view=1/.test(href);
    if (!looksView) return;
    if (href && /edit|form/i.test(href) && !/[?&]view=1/.test(href) && label !== 'view') return;
    e.preventDefault();
    e.stopPropagation();
    const tr = a.closest('tr');
    const hrefId = (href.match(/[?&]id=([^&]+)/) || [])[1];
    const rid = id || decodeURIComponent(hrefId || '') || tr?.dataset?.id || tr?.querySelector('[data-pick]')?.dataset.pick || '';
    const row = rowFromContext(rid, tr) || rowFromContext(rid, document.querySelector('[data-tbl]')) || rowFromContext(rid);
    const blob = (href + ' ' + location.pathname).toLowerCase();
    const kind = /stock-transfer/.test(blob) ? 'transfer'
      : /stock-adjustment/.test(blob) ? 'adjustment'
      : /sales-order|sales-form|pos-sales/.test(blob) ? 'sale'
      : /expense/.test(blob) ? 'expense'
      : /purchase-order|purchase-form|purchases\.html/.test(blob) ? 'purchase'
      : /product-form|product-view|opening-stock/.test(blob) ? 'product'
      : /suppl/.test(blob) ? 'supplier'
      : /customer/.test(blob) ? 'customer'
      : /roles?\.html|roles-edit/.test(blob) ? 'role'
      : /users?\.html|user-edit|user-view/.test(blob) ? 'user'
      : undefined;
    try { document.querySelectorAll('details.act[open]').forEach((d) => d.removeAttribute('open')); } catch { /* ignore */ }
    let found = row;
    if (!found && /roles/.test(blob) && tr) {
      const tds = [...tr.querySelectorAll('td')];
      const name = (tds[2]?.innerText || tds[1]?.innerText || '').trim();
      found = { id: rid, name, users_assigned: (tds[3]?.innerText || '').trim(), permissions: {} };
    }
    if (found) openRecordView(found, { kind, title: found.name });
  }, true);
}
