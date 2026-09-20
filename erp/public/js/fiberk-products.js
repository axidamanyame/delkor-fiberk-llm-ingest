/** Fiberkapp + staged-queue product book. Catalog images stay off POS until verified. */
import { readLs, writeLs, esc } from './ls-rows.js';
import { hostedProductImage } from './product-images.js';

const JSON_URL = '/js/fiberk-products.json';
const FLAG = 'df_fiberk_products_v1';
const HEAD_KEY = 'df_fiberk_product_headers';
const HEAD_FIELDS = [
  'id', 'upos_id', 'sku', 'name', 'brand', 'type', 'buy', 'sell', 'old_stock',
  'loc', 'location_code', 'location_name', 'legacy_location', 'subsidiary_code',
  'legacy_cat', 'legacy_sub', 'category', 'subcategory', 'category_id', 'subcategory_id', 'channel', 'inactive', 'furniture',
  'copy', 'source', 'is_active', 'not_for_selling', 'pos_image_ready', 'image_source',
];

let BOOK = null;

function toHeader(row) {
  const o = { source: 'fiberkapp', stock: 0, current_stock: 0, qty: 0, image_url: '', pos_image_ready: false };
  HEAD_FIELDS.forEach((k) => {
    const v = row[k];
    if (v !== '' && v != null) o[k] = v;
  });
  if (row.catalog_image_url) o.catalog_image_url = row.catalog_image_url;
  return o;
}

function cedi(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fiberkProducts() {
  if (BOOK?.products?.length) return BOOK.products;
  const head = readLs(HEAD_KEY, []) || [];
  return head;
}

export function fiberkProductCount() {
  return fiberkProducts().length;
}

export function findFiberkProduct(idOrSku) {
  const k = String(idOrSku || '');
  const full = (BOOK?.products || []).find((r) => String(r.id) === k || String(r.sku) === k);
  if (full) return full;
  return fiberkProducts().find((r) => String(r.id) === k || String(r.sku) === k) || null;
}

export function catalogThumb(p) {
  return hostedProductImage(p?.catalog_image_url || p?.image_url, p);
}

export function posThumb(p) {
  if (p && p.pos_image_ready === false) return '';
  return hostedProductImage(p?.image_url || p?.catalog_image_url, p);
}

export function fiberkProductMetrics() {
  const rows = fiberkProducts();
  if (BOOK?.metrics) {
    return {
      n: BOOK.metrics.n || rows.length,
      with_image: BOOK.metrics.with_image || rows.filter((r) => r.catalog_image_url).length,
      from_fiberkapp: BOOK.metrics.from_local || BOOK.metrics.from_fiberkapp || 0,
      from_live: BOOK.metrics.from_live || 0,
      inactive: BOOK.metrics.inactive || rows.filter((r) => r.inactive).length,
      furniture: BOOK.metrics.furniture || rows.filter((r) => r.furniture).length,
    };
  }
  if (!rows.length) return { ...PACK_METRICS.products };
  return {
    n: rows.length,
    with_image: rows.filter((r) => r.catalog_image_url).length,
    from_fiberkapp: rows.filter((r) => r.image_source === 'fiberkapp').length,
    from_live: rows.filter((r) => r.image_source && r.image_source !== 'fiberkapp').length,
    inactive: rows.filter((r) => r.inactive).length,
    furniture: rows.filter((r) => r.furniture).length,
  };
}

export function fiberkProductsBanner() {
  return `<p class="manual-ref"><a href="/manual.html#silo">Ref SIL-01</a></p>`;
}

export async function ensureFiberkProducts() {
  try {
    if (BOOK?.products?.length >= 4000) {
      return { ok: true, skipped: true, n: BOOK.products.length };
    }
  } catch { /* continue */ }
  const res = await fetch(JSON_URL, { cache: 'force-cache' });
  if (!res.ok) return { ok: false, n: 0 };
  BOOK = await res.json();
  const products = BOOK.products || [];
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  return { ok: true, n: products.length, images: BOOK.metrics?.with_image || 0 };
}

export { esc, cedi };
