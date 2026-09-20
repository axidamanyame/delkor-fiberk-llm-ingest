/** Universal ERP query — pages, manuals, silo, live rows. Click goes to the desk. */
import { MANUAL } from './desk-manual.js';
import { TRAIN_MODULES } from './staff-learn.js';
import { esc } from './ls-rows.js';

function lsArr(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function flattenMenu(items, parent = '') {
  const out = [];
  (items || []).forEach((it) => {
    if (it.href) out.push({ label: it.label, href: it.href, parent });
    (it.pages || []).forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
    (it.leaves || []).forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
    if (it.children) out.push(...flattenMenu(it.children, it.label));
  });
  return out;
}

const ALIASES = [
  { q: ['pinaro', 'paper invoice', 'paper slip', '00475', 'odumase'], label: 'Paper invoice (Pinaro)', href: '/paper-purchase.html', parent: 'Procurement', kind: 'page' },
  { q: ['migrated', 'fiberkapp', 'silo', 'old pos'], label: 'Sales book', href: '/sales-orders.html', parent: 'Sales', kind: 'page' },
  { q: ['uba', 'bank statement', '03216347302516'], label: 'UBA Fiberk', href: '/uba-fiberk.html', parent: 'Finance', kind: 'page' },
  { q: ['default', 'arrears', 'collections'], label: 'Collections desk', href: '/collections-desk.html', parent: 'CRM', kind: 'page' },
  { q: ['receipt', 'whatsapp receipt', 'sms receipt'], label: 'Receipt printers', href: '/printers.html', parent: 'Settings', kind: 'page' },
  { q: ['franko', 'product photo'], label: 'Franko photos', href: '/franko-sync.html', parent: 'Products', kind: 'page' },
  { q: ['product catalog', 'catalogue', 'listings', 'capable of selling'], label: 'Product Catalog', href: '/product-catalog.html', parent: 'Products', kind: 'page' },
  { q: ['product inventory', 'live stock', 'on hand', 'ordered stock'], label: 'Product Inventory', href: '/products.html?view=inventory', parent: 'Products', kind: 'page' },
  { q: ['manual', 'how to', 'user guide', 'academy', 'staff manual', 'training doc'], label: 'Academy — User Manual', href: '/academy.html?tab=manuals', parent: 'Academy', kind: 'manual' },
  { q: ['knowledge base', 'kb', 'how-to card'], label: 'Academy — Knowledge Base', href: '/academy.html?tab=kb', parent: 'Academy', kind: 'manual' },
  { q: ['policy', 'policies', 'house rules'], label: 'Academy — Policies', href: '/academy.html?tab=policies', parent: 'Academy', kind: 'manual' },
  { q: ['sil-01', 'prd-01', 'ref sil', 'ref prd', 'technical documentation', 'desk notes'], label: 'Technical documentation', href: '/manual.html', parent: 'Settings', kind: 'manual' },
  { q: ['training', 'classroom'], label: 'Training', href: '/training.html', parent: 'HRM', kind: 'help' },
];

function score(term, text) {
  const t = String(text || '').toLowerCase();
  if (!term) return 0;
  if (t === term) return 100;
  if (t.startsWith(term)) return 80;
  if (t.includes(term)) return 50;
  const parts = term.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => t.includes(p))) return 40;
  return 0;
}

function pagesFromMenu(menu) {
  return flattenMenu(menu).map((m) => ({
    kind: 'page',
    label: m.label,
    href: m.href,
    parent: m.parent || 'Menu',
    hint: m.parent ? m.parent + ' → ' + m.label : m.label,
  }));
}

function manualHits() {
  const out = [];
  MANUAL.forEach((cat) => {
    out.push({
      kind: 'manual',
      label: (cat.ref ? cat.ref + ' ' : '') + cat.title,
      href: '/manual.html#' + cat.id,
      parent: 'User Manual',
      hint: cat.intro || 'Manual',
      body: `${cat.ref || ''} ${cat.intro || ''}`,
    });
    (cat.topics || []).forEach((t) => {
      out.push({
        kind: 'manual',
        label: (t.ref ? t.ref + ' ' : '') + t.title,
        href: '/manual.html#' + t.id,
        parent: 'Manual · ' + cat.title,
        hint: (t.body || '').slice(0, 90),
        body: `${t.ref || ''} ${t.body || ''}`,
      });
    });
  });
  TRAIN_MODULES.forEach((m) => {
    out.push({
      kind: 'help',
      label: m.title,
      href: '/training.html',
      parent: 'Training',
      hint: 'Staff classroom',
      body: m.body || '',
    });
  });
  return out;
}

function recordHits(term) {
  if (term.length < 2) return [];
  const out = [];
  const add = (kind, label, href, parent, hint) => {
    out.push({ kind, label, href, parent, hint });
  };
  lsArr('df_customers').forEach((r) => {
    const name = r.name || r.business_name || '';
    if (score(term, name) || score(term, r.phone) || score(term, r.contact_code)) {
      add('record', name || 'Customer', '/customers.html', 'Customers', r.phone || r.email || '');
    }
  });
  lsArr('df_suppliers').forEach((r) => {
    const name = r.name || r.business_name || '';
    if (score(term, name) || score(term, r.phone)) {
      add('record', name || 'Supplier', '/suppliers.html', 'Suppliers', r.phone || '');
    }
  });
  lsArr('df_products').slice(0, 1200).forEach((r) => {
    if (out.length >= 20) return;
    if (score(term, r.name) || score(term, r.sku) || score(term, r.barcode)) {
      add('record', (r.sku ? r.sku + ' · ' : '') + (r.name || 'SKU'), r.id ? '/product-view.html?id=' + encodeURIComponent(r.id) : '/products.html', 'Products', r.sku || '');
    }
  });
  [...lsArr('df_sales_orders')].slice(0, 800).forEach((r) => {
    const ref = r.reference || r.so_number || '';
    if (score(term, ref) || score(term, r.customer_name)) {
      add('record', ref || 'Sale', '/sales-orders.html', 'Sales', r.customer_name || '');
    }
  });
  [...lsArr('df_purchases'), ...lsArr('df_purchase_orders')].slice(0, 400).forEach((r) => {
    const ref = r.reference || r.reference_no || '';
    if (score(term, ref) || score(term, r.supplier_name)) {
      add('record', ref || 'Purchase', '/purchase-orders.html', 'Purchases', r.supplier_name || '');
    }
  });
  lsArr('df_collection_accounts').slice(0, 400).forEach((r) => {
    if (score(term, r.name) || score(term, r.phone)) {
      add('record', r.name || 'Account', '/collections-desk.html', 'Collections', r.phone || r.status || '');
    }
  });
  return out.slice(0, 20);
}

export function searchErp(query, menu) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return [];
  const pool = [
    ...pagesFromMenu(menu),
    ...manualHits(),
  ];
  ALIASES.forEach((a) => {
    if (a.q.some((x) => term.includes(x) || x.includes(term))) {
      pool.unshift({ kind: a.kind, label: a.label, href: a.href, parent: a.parent, hint: 'Shortcut' });
    }
  });
  const ranked = pool
    .map((h) => {
      const s = Math.max(
        score(term, h.label),
        score(term, h.parent),
        score(term, h.hint),
        score(term, h.body),
      );
      return { ...h, s };
    })
    .filter((h) => h.s > 0)
    .sort((a, b) => b.s - a.s);

  const seen = new Set();
  const out = [];
  for (const h of ranked) {
    const k = h.kind + '|' + h.href + '|' + h.label;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
    if (out.length >= 16) break;
  }
  if (out.length < 12) {
    recordHits(term).forEach((h) => {
      const k = h.kind + '|' + h.href + '|' + h.label;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ ...h, s: 30 });
    });
  }
  return out.slice(0, 18);
}

export function suggestHtml(hits) {
  if (!hits.length) {
    return '<div class="ult-sug-empty">No match. Try a page, SKU, customer, or “migrated”.</div>';
  }
  const order = ['page', 'silo', 'manual', 'help', 'record'];
  const groups = {};
  hits.forEach((h) => {
    const g = h.kind || 'page';
    (groups[g] = groups[g] || []).push(h);
  });
  const titles = { page: 'Pages', silo: 'Migrated books', manual: 'Manual', help: 'Training', record: 'Records' };
  return order.filter((g) => groups[g]?.length).map((g) =>
    `<div class="ult-sug-g">${esc(titles[g] || g)}</div>` +
    groups[g].map((h) =>
      `<a href="${esc(h.href)}" data-href="${esc(h.href)}"><strong>${esc(h.label)}</strong><span>${esc(h.parent || h.hint || '')}</span></a>`
    ).join('')
  ).join('');
}

export function firstHref(hits) {
  return hits[0]?.href || '';
}
