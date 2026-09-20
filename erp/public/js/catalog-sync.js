/**
 * Push the day-zero Operations Hub catalog into the live company database.
 * Must run as a signed-in HQ Admin (RLS). Anon cannot insert products.
 */
import { supabase } from './supabaseClient.js';
import { ensureLocalCatalog, SEED_PRODUCTS, SEED_SUPPLIERS, SEED_CATEGORIES, SEED_BRANDS, KEYS } from './catalog-seed.js';
import { readLs } from './ls-rows.js';
import { isHqRole, loadMyProfile } from './access-rules.js';
import { ackResult } from './confirm-action.js';

export const REMOTE_FLAG = 'df_remote_catalog_v1';
const STATUS_KEY = 'df_remote_catalog_status';

const DEMO_SKU = /^(AXI|FIB|BNP|DEL)(\d|-)/i;
const KEEP_SKU = /^(OPH|WHV)-\d{4,8}/i;

const PRODUCT_COLS = [
  'name', 'sku', 'barcode', 'description', 'category', 'subcategory', 'brand', 'unit',
  'product_type', 'barcode_type', 'purchase_price', 'cost_price', 'selling_price',
  'unit_selling_price', 'manage_stock', 'alert_quantity', 'alert_qty',
  'current_stock_value', 'current_sale_value', 'profit_margin', 'image_url',
  'active', 'is_active', 'subsidiary_code', 'home_subsidiary', 'location_code',
  'tax_name', 'tax_type', 'not_for_selling', 'featured', 'is_featured',
  'model', 'color', 'colour', 'size', 'capacity', 'variations', 'specs',
  'woocommerce_enabled', 'woo_commerce',
  'product_class', 'item_kind', 'item_group', 'product_family', 'status',
  'supplier_id', 'supplier', 'pricing_class', 'tax_class', 'costing_method',
  'inventory_class', 'retail_price', 'wholesale_price', 'distributor_price',
  'agent_price', 'has_variants', 'warranty',
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isDemoSku(sku) {
  const s = String(sku || '').toUpperCase();
  if (KEEP_SKU.test(s)) return false;
  return DEMO_SKU.test(s);
}

export function readSyncStatus() {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) || 'null') || null; } catch { return null; }
}

function writeStatus(row) {
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(row)); } catch { /* ignore */ }
}

function mapProduct(p, { sub = 'ops', loc = 'OPS-HUB' } = {}) {
  const sell = num(p.selling_price ?? p.price ?? p.unit_selling_price);
  const cost = num(p.purchase_price ?? p.cost_price ?? p.cost);
  const row = {
    name: String(p.name || p.sku || 'Item').slice(0, 180),
    sku: String(p.sku || '').slice(0, 64),
    barcode: p.barcode || p.vendor_sku || null,
    description: p.description || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    brand: p.brand || null,
    unit: p.unit || 'Pcs',
    product_type: p.product_type || 'single',
    barcode_type: 'Code 128 (C128)',
    purchase_price: cost,
    cost_price: cost,
    selling_price: sell,
    unit_selling_price: sell,
    manage_stock: true,
    alert_quantity: 5,
    alert_qty: 5,
    current_stock_value: 0,
    current_sale_value: 0,
    profit_margin: 0,
    image_url: p.image_url || p.image || null,
    active: true,
    is_active: true,
    subsidiary_code: sub,
    home_subsidiary: sub,
    location_code: loc,
    tax_name: p.tax_name || null,
    tax_type: p.tax_type || 'exclusive',
    not_for_selling: false,
    featured: false,
    is_featured: false,
    model: p.model || null,
    color: p.color || null,
    capacity: p.capacity || null,
    variations: Array.isArray(p.variations) ? p.variations : [],
    specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
    product_class: p.product_class || 'finished_good',
    item_kind: p.item_kind || 'stockable',
    item_group: p.item_group || null,
    product_family: p.product_family || null,
    status: p.status || 'active',
    supplier_id: p.supplier_id || null,
    supplier: p.supplier || p.supplier_name || null,
    pricing_class: p.pricing_class || null,
    tax_class: p.tax_class || null,
    costing_method: p.costing_method || null,
    inventory_class: p.inventory_class || null,
    retail_price: num(p.retail_price ?? sell),
    wholesale_price: num(p.wholesale_price),
    distributor_price: num(p.distributor_price),
    agent_price: num(p.agent_price),
    has_variants: !!p.has_variants || p.product_type === 'variable',
    warranty: p.warranty || null,
  };
  const out = {};
  PRODUCT_COLS.forEach((k) => {
    if (row[k] !== undefined) out[k] = row[k];
  });
  return out;
}

function mapSupplier(s) {
  return {
    name: s.name,
    mobile: s.mobile || null,
    email: s.email || null,
    city: s.city || null,
    website: s.website || null,
    is_active: true,
    subsidiary_code: 'ops',
    location_code: 'OPS-HUB',
  };
}

function mapCategory(c) {
  return {
    name: c.name,
    short_code: c.short_code || c.code || null,
    description: c.description || null,
  };
}

function mapBrand(b) {
  return {
    name: b.name || b,
    description: b.description || null,
  };
}

async function peelInsert(table, rows) {
  if (!rows.length) return { ok: true, count: 0 };
  let body = rows.map((r) => ({ ...r }));
  let lastErr = null;
  const conflict = table === 'products' ? 'sku'
    : (table === 'suppliers' || table === 'categories' || table === 'brands') ? 'name'
    : null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const q = conflict
      ? supabase.from(table).upsert(body, { onConflict: conflict })
      : supabase.from(table).insert(body);
    const { error } = await q;
    if (!error) return { ok: true, count: body.length };
    lastErr = error;
    const msg = String(error.message || '');
    if (/42501|row-level security/i.test(msg)) return { ok: false, error, rls: true };
    if (/23505|duplicate key|unique constraint/i.test(msg)) {
      if (table === 'products') {
        const skus = body.map((r) => r.sku).filter(Boolean);
        const { data: exist } = await supabase.from('products').select('sku').in('sku', skus);
        const have = new Set((exist || []).map((r) => r.sku));
        body = body.filter((r) => !have.has(r.sku));
        if (!body.length) return { ok: true, count: 0 };
        continue;
      }
      return { ok: true, count: 0 };
    }
    const col = msg.match(/Could not find the '([^']+)' column/i)?.[1]
      || msg.match(/column "([^"]+)"/i)?.[1];
    if (col && body.some((r) => col in r)) {
      body = body.map((r) => {
        const n = { ...r };
        delete n[col];
        return n;
      });
      continue;
    }
    if (/ops/i.test(msg) && body.some((r) => r.subsidiary_code === 'ops')) {
      body = body.map((r) => ({ ...r, subsidiary_code: 'group', home_subsidiary: r.home_subsidiary === 'ops' ? 'group' : r.home_subsidiary }));
      continue;
    }
    if (/PGRST205|does not exist|schema cache/i.test(msg)) return { ok: false, error, missing: true };
    break;
  }
  return { ok: false, error: lastErr };
}

async function insertBatches(table, rows, size = 40) {
  let count = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const r = await peelInsert(table, chunk);
    if (!r.ok) return { ok: false, count, error: r.error, rls: r.rls };
    count += r.count;
  }
  return { ok: true, count };
}

async function deleteDemoProducts() {
  let deleted = 0;
  const { data, error } = await supabase.from('products').select('id,sku').limit(5000);
  if (error) return { deleted: 0, error };
  const wipe = (data || []).filter((r) => isDemoSku(r.sku));
  for (let i = 0; i < wipe.length; i += 50) {
    const ids = wipe.slice(i, i + 50).map((r) => r.id);
    const { error: delErr } = await supabase.from('products').delete().in('id', ids);
    if (delErr) return { deleted, error: delErr, rls: /42501|row-level security/i.test(String(delErr.message || '')) };
    deleted += ids.length;
  }
  return { deleted };
}

async function alreadyPublished() {
  try {
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).like('sku', 'OPH-%');
    if (error) return 0;
    return Number(count || 0);
  } catch { return 0; }
}

let inflight = null;

export async function syncLiveCatalogToRemote(opts = {}) {
  if (inflight) return inflight;
  inflight = runSync(opts).finally(() => { inflight = null; });
  return inflight;
}

async function runSync(opts = {}) {
  const force = !!opts.force;
  const silent = opts.silent !== false && !force;
  const prev = readSyncStatus();
  if (!force) {
    if (prev?.ok && prev.v === 1) return { ran: false, ...prev };
    if (/duplicate key|products_sku_key/i.test(String(prev?.error || ''))) {
      const status = { v: 1, ok: true, at: new Date().toISOString(), upserted: prev.upserted || 0, skipped: 'already-present' };
      writeStatus(status);
      return { ran: false, ...status };
    }
    const remoteOph = await alreadyPublished();
    if (remoteOph > 0) {
      const status = { v: 1, ok: true, at: new Date().toISOString(), upserted: remoteOph, skipped: 'remote-has-oph' };
      writeStatus(status);
      return { ran: false, ...status };
    }
  }
  let profile = null;
  try { profile = await loadMyProfile(); } catch { /* ignore */ }
  if (!isHqRole(profile?.role) && !opts.force) {
    return { ran: false, skipped: 'not-hq' };
  }
  try { ensureLocalCatalog(); } catch { /* ignore */ }
  const local = (readLs(KEYS.products, SEED_PRODUCTS) || SEED_PRODUCTS).filter((p) => KEEP_SKU.test(String(p.sku || '')));
  const products = (local.length ? local : SEED_PRODUCTS).map((p) => mapProduct(p));
  if (!silent) {
    try { ackResult(true, 'Publishing ' + products.length + ' Operations Hub SKUs to the company database…'); } catch { /* ignore */ }
  }

  const del = await deleteDemoProducts();
  if (del.rls) {
    const status = { v: 1, ok: false, at: new Date().toISOString(), error: 'Company database blocked delete (security policy). Stay signed in as HQ Admin and try Publish catalog again.', deleted: del.deleted || 0, upserted: 0 };
    writeStatus(status);
    if (!silent) {
      try { ackResult(false, status.error); } catch { /* ignore */ }
    }
    return { ran: true, ...status };
  }

  const ins = await insertBatches('products', products);
  if (!ins.ok) {
    const msg = ins.rls
      ? 'Company database blocked the catalog write. HQ Admin must be recognised in profiles (role HQ Admin).'
      : ('Catalog write failed: ' + (ins.error?.message || ins.error || 'unknown'));
    const status = { v: 1, ok: false, at: new Date().toISOString(), error: msg, deleted: del.deleted || 0, upserted: ins.count || 0 };
    writeStatus(status);
    if (!silent) {
      try { ackResult(false, msg); } catch { /* ignore */ }
    }
    return { ran: true, ...status };
  }

  let suppliers = 0;
  const sup = await insertBatches('suppliers', SEED_SUPPLIERS.map(mapSupplier), 10);
  if (sup.ok) suppliers = sup.count;

  const cats = SEED_CATEGORIES.filter((c) => !c.parent_id).map(mapCategory);
  await insertBatches('categories', cats, 20);
  const brands = (SEED_BRANDS || []).slice(0, 80).map(mapBrand);
  await insertBatches('brands', brands, 20);

  const remoteOph = await alreadyPublished();
  const status = {
    v: 1,
    ok: true,
    at: new Date().toISOString(),
    deleted: del.deleted || 0,
    upserted: ins.count,
    suppliers,
    remoteOph,
    error: null,
  };
  writeStatus(status);
  try { localStorage.setItem(REMOTE_FLAG, '1'); } catch { /* ignore */ }
  if (!silent) {
    try {
      ackResult(true, 'Company database updated: ' + ins.count + ' live SKUs at Operations Hub. Removed ' + (del.deleted || 0) + ' old demo products.');
    } catch { /* ignore */ }
  }
  return { ran: true, ...status };
}

export function bindPublishButton(el) {
  if (!el) return;
  el.addEventListener('click', async () => {
    el.disabled = true;
    el.textContent = 'Publishing…';
    try {
      await syncLiveCatalogToRemote({ force: true, silent: false });
    } finally {
      el.disabled = false;
      el.textContent = 'Publish catalog';
    }
  });
}
