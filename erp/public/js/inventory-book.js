/**
 * Catalog vs inventory vs till.
 *
 * Catalog  = every SKU the group is capable of selling (photos, copy, prices).
 * Inventory = a catalog SKU the moment it is ordered, at any stage
 *             (draft / pending / ordered / received / in transit).
 * Till     = inventory that is actually on-hand at the open till location.
 *
 * Catalog listings never sit on the register. Ordered units sit on
 * Product Inventory even before they physically arrive.
 */
import { readLs, writeLs, uid } from './ls-rows.js';
import { KEYS, isCirculatingProduct, isDemoProduct } from './catalog-seed.js';
import { appendMovements } from './sku-lifecycle.js';
import { findLocation, isHubWarehouse } from './scope.js';
import { normalizeProductBook } from './org-chain.js';

export const POSITIONS_KEY = 'df_inventory_positions';
export const BOOK_FLAG = 'df_inventory_book_v1';

export const STAGES = {
  listing: 'listing',
  ordered: 'ordered',
  incoming: 'incoming',
  on_hand: 'on_hand',
  reserved: 'reserved',
};

const ORDERED_STAGES = new Set(['draft', 'pending', 'ordered', 'confirmed', 'partial', 'processing', 'open']);
const RECEIVED_STAGES = new Set(['received', 'completed', 'closed', 'invoiced', 'posted']);
const IN_TRANSIT_STAGES = new Set(['in_transit', 'transfer', 'putaway', 'dispatched', 'shipped']);

export function stageOfStatus(status) {
  const s = String(status || '').toLowerCase();
  if (RECEIVED_STAGES.has(s) || s === 'received') return STAGES.on_hand;
  if (IN_TRANSIT_STAGES.has(s)) return STAGES.incoming;
  if (ORDERED_STAGES.has(s) || !s) return STAGES.ordered;
  return STAGES.ordered;
}

export function inventoryStatusOf(p) {
  if (!p) return STAGES.listing;
  const raw = String(p.inventory_status || '').toLowerCase();
  if (raw && STAGES[raw]) return raw;
  if (p.open_stock === true || p.sku_locked === true) {
    const qty = Number(p.stock ?? p.current_stock ?? p.qty ?? 0);
    return qty > 0 ? STAGES.on_hand : STAGES.ordered;
  }
  if (Number(p.ordered_qty || p.committed_qty || 0) > 0) return STAGES.ordered;
  return STAGES.listing;
}

export function isCatalogListing(p) {
  if (!p || isDemoProduct(p)) return false;
  return inventoryStatusOf(p) === STAGES.listing;
}

export function isInventoryItem(p) {
  if (!p || isDemoProduct(p)) return false;
  if (p.not_for_selling === true && inventoryStatusOf(p) === STAGES.listing) return false;
  return inventoryStatusOf(p) !== STAGES.listing || isCirculatingProduct(p);
}

export function onHandQty(p, locCode) {
  if (!p) return 0;
  const loc = String(locCode || '').trim();
  const positions = loadPositions().filter((r) => String(r.product_id) === String(p.id));
  if (loc) {
    const here = positions.filter((r) => r.location_code === loc && r.stage === STAGES.on_hand);
    const sum = here.reduce((n, r) => n + Number(r.qty || 0), 0);
    if (sum) return sum;
    if (String(p.location_code || '') === loc) return Number(p.stock ?? p.current_stock ?? 0);
    return 0;
  }
  const all = positions.filter((r) => r.stage === STAGES.on_hand);
  const sum = all.reduce((n, r) => n + Number(r.qty || 0), 0);
  if (sum) return sum;
  return Number(p.stock ?? p.current_stock ?? 0);
}

export function orderedQty(p) {
  if (!p) return 0;
  const positions = loadPositions().filter((r) => String(r.product_id) === String(p.id));
  const pipeline = positions
    .filter((r) => r.stage === STAGES.ordered || r.stage === STAGES.incoming)
    .reduce((n, r) => n + Number(r.qty || 0), 0);
  return pipeline || Number(p.ordered_qty || p.committed_qty || 0);
}

/** Sellable on the open till — live on-hand at that shop, not the hub catalog. */
export function isTillLive(p, locCode) {
  if (!p || isDemoProduct(p)) return false;
  if (p.is_active === false || p.not_for_selling) return false;
  if (!isInventoryItem(p)) return false;
  const loc = String(locCode || p.location_code || '').trim();
  if (!loc) return onHandQty(p) > 0;
  if (isHubWarehouse(loc)) return false;
  return onHandQty(p, loc) > 0;
}

export function loadPositions() {
  return readLs(POSITIONS_KEY, []) || [];
}

function writePositions(rows) {
  writeLs(POSITIONS_KEY, rows.slice(0, 20000));
}

function patchProduct(id, patch) {
  const rows = readLs(KEYS.products, []) || [];
  let found = false;
  const next = rows.map((r) => {
    if (String(r.id) !== String(id)) return r;
    found = true;
    return { ...r, ...patch };
  });
  if (found) writeLs(KEYS.products, next);
  return found;
}

/**
 * Promote a catalog SKU into the inventory book.
 * Called the moment a purchase, paper invoice, sales order or BNPL order
 * names the SKU — status does not matter.
 */
export function promoteToInventory(product, {
  qty = 0,
  stage,
  status,
  source = 'order',
  ref = '',
  location = '',
  note = '',
} = {}) {
  if (!product || !product.id) return null;
  const loc = findLocation(location) || {};
  const nextStage = stage || stageOfStatus(status);
  const qtyN = Math.max(0, Number(qty || 0));
  const now = new Date().toISOString();
  const positions = loadPositions();
  const key = [product.id, nextStage, loc.code || location || '', ref || source].join('|');
  const existing = positions.find((r) => r.key === key);
  if (existing) {
    existing.qty = Math.max(Number(existing.qty || 0), qtyN);
    existing.updated_at = now;
  } else {
    positions.unshift({
      id: uid(),
      key,
      product_id: product.id,
      sku: product.sku || '',
      name: product.name || '',
      qty: qtyN,
      stage: nextStage,
      source,
      reference: ref,
      location_code: loc.code || location || '',
      location_name: loc.name || '',
      created_at: now,
      updated_at: now,
      note,
    });
  }
  writePositions(positions);

  const onHand = nextStage === STAGES.on_hand;
  const patch = {
    inventory_status: nextStage,
    inventory_source: source,
    inventory_ref: ref || product.inventory_ref || '',
    ordered_qty: Math.max(Number(product.ordered_qty || 0), nextStage === STAGES.ordered || nextStage === STAGES.incoming ? qtyN : Number(product.ordered_qty || 0)),
    open_stock: true,
    not_for_selling: product.not_for_selling === true ? true : false,
  };
  if (onHand && qtyN) {
    patch.stock = Number(product.stock || product.current_stock || 0) || qtyN;
    patch.current_stock = patch.stock;
    patch.qty = patch.stock;
    if (loc.code) {
      patch.location_code = loc.code;
      patch.location_name = loc.name;
    }
  }
  patchProduct(product.id, patch);
  return { ...product, ...patch };
}

export function promoteLinesToInventory(lines, meta = {}) {
  const catalog = readLs(KEYS.products, []) || [];
  const out = [];
  for (const line of lines || []) {
    const id = line.product_id || line.id;
    const sku = String(line.sku || '').toUpperCase();
    const p = catalog.find((r) => String(r.id) === String(id) || String(r.sku || '').toUpperCase() === sku);
    if (!p) continue;
    out.push(promoteToInventory(p, {
      qty: line.qty || line.quantity || 0,
      status: meta.status,
      stage: meta.stage,
      source: meta.source || 'purchase',
      ref: meta.ref || meta.reference || '',
      location: meta.location || meta.location_code || line.location_code || '',
      note: meta.note || '',
    }));
  }
  return out;
}

function collectOrderLines() {
  const bags = [
    ['purchase', 'df_purchases'],
    ['purchase', 'df_purchase_orders'],
    ['purchase_invoice', 'df_purchase_invoices'],
    ['sale', 'df_sales_orders'],
    ['bnpl', 'df_bnpl_field_orders'],
    ['paper', 'df_paper_jobs'],
  ];
  const out = [];
  for (const [source, key] of bags) {
    const rows = readLs(key, []) || [];
    rows.forEach((row) => {
      const lines = row.lines || row.items || row.products || [];
      const status = row.status || row.purchase_status || row.order_status || '';
      const ref = row.reference || row.reference_no || row.vendor_invoice_no || row.id || '';
      const loc = row.location_code || row.destination || '';
      lines.forEach((l) => {
        out.push({
          source,
          status,
          ref,
          location: loc,
          product_id: l.product_id || l.id,
          sku: l.sku,
          name: l.name,
          qty: l.qty || l.quantity || 0,
        });
      });
    });
  }
  return out;
}

/** One-shot: every existing order line becomes inventory, catalog listings stay listings. */
export function hydrateInventoryBook() {
  try {
    if (localStorage.getItem(BOOK_FLAG) === '1' && loadPositions().length) {
      return { ok: true, skipped: true, n: loadPositions().length };
    }
  } catch { /* continue */ }
  const catalog = normalizeProductBook(readLs(KEYS.products, []) || []);
  try { writeLs(KEYS.products, catalog); } catch { /* quota */ }
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  const bySku = new Map(catalog.map((p) => [String(p.sku || '').toUpperCase(), p]));
  let n = 0;
  collectOrderLines().forEach((line) => {
    const p = byId.get(String(line.product_id || '')) || bySku.get(String(line.sku || '').toUpperCase());
    if (!p) return;
    promoteToInventory(p, {
      qty: line.qty,
      status: line.status,
      source: line.source,
      ref: line.ref,
      location: line.location,
      note: 'Hydrated from existing order book',
    });
    n += 1;
  });
  catalog.forEach((p) => {
    if (isCirculatingProduct(p) && inventoryStatusOf(p) === STAGES.listing) {
      promoteToInventory(p, {
        qty: Number(p.stock || p.current_stock || 0),
        stage: Number(p.stock || p.current_stock || 0) > 0 ? STAGES.on_hand : STAGES.ordered,
        source: 'open_stock',
        location: p.location_code || '',
        note: 'Already circulating',
      });
      n += 1;
    }
  });
  try { localStorage.setItem(BOOK_FLAG, '1'); } catch { /* ignore */ }
  return { ok: true, n };
}

export function catalogPool() {
  return (readLs(KEYS.products, []) || []).filter((p) => !isDemoProduct(p));
}

export function inventoryPool() {
  hydrateInventoryBook();
  return catalogPool().filter(isInventoryItem);
}

export function tillPool(locCode) {
  hydrateInventoryBook();
  return catalogPool().filter((p) => isTillLive(p, locCode));
}

export function bookCounts() {
  const all = catalogPool();
  const inv = all.filter(isInventoryItem);
  const live = inv.filter((p) => onHandQty(p) > 0);
  return {
    catalog: all.length,
    inventory: inv.length,
    on_hand: live.length,
    listings: all.length - inv.length,
  };
}

function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Fill unit cost and on-hand from live purchase / field books. Does not touch the silo. */
export function applyTradeFigures() {
  const products = readLs(KEYS.products, []) || [];
  if (!products.length) return products;
  const bags = [...(readLs('df_purchases', []) || []), ...(readLs('df_purchase_orders', []) || []), ...(readLs('df_purchase_invoices', []) || [])];
  const costBy = new Map();
  const boughtBy = new Map();
  bags.forEach((row) => {
    (row.lines || row.items || []).forEach((l) => {
      const unit = Number(l.unit_cost || l.cost_price || l.unit_price || l.purchase_price || l.cost || 0);
      const qty = Number(l.qty || l.quantity || 0);
      [l.sku, l.name, l.product_name].filter(Boolean).forEach((raw) => {
        const k = normKey(raw);
        if (!k) return;
        if (unit > 0) costBy.set(k, unit);
        boughtBy.set(k, (boughtBy.get(k) || 0) + qty);
      });
    });
  });
  const soldBy = new Map();
  (readLs('df_bnpl_field_orders', []) || []).forEach((o) => {
    const k = normKey(o.brand_type || o.name || '');
    if (k) soldBy.set(k, (soldBy.get(k) || 0) + 1);
  });
  (readLs('df_sales_orders', []) || []).forEach((s) => {
    (s.lines || s.items || []).forEach((l) => {
      const k = normKey(l.sku || l.name || '');
      if (k) soldBy.set(k, (soldBy.get(k) || 0) + Number(l.qty || l.quantity || 1));
    });
  });
  function lookup(map, keys) {
    for (const k of keys) {
      if (map.has(k)) return map.get(k);
    }
    for (const k of keys) {
      for (const [mk, v] of map) {
        if (k.includes(mk) || mk.includes(k)) return v;
      }
    }
    return null;
  }
  products.forEach((p) => {
    const keys = [normKey(p.sku), normKey(p.name)].filter(Boolean);
    const cost = lookup(costBy, keys);
    const bought = lookup(boughtBy, keys) || 0;
    const sold = lookup(soldBy, keys) || 0;
    if (cost > 0) {
      p.cost_price = cost;
      p.purchase_price = cost;
    }
    if (bought > 0) {
      const onhand = Math.max(0, bought - sold);
      p.stock = onhand;
      p.current_stock = onhand;
      if (onhand > 0) p.inventory_status = STAGES.on_hand;
    }
  });
  writeLs(KEYS.products, products);
  return products;
}

export function bookBanner(kind = 'inventory') {
  const id = kind === 'catalog' ? 'prod-catalog' : kind === 'till' ? 'prod-till' : 'prod-inventory';
  return `<p class="manual-ref"><a href="/manual.html#${id}">Ref ${kind === 'catalog' ? 'PRD-02' : kind === 'till' ? 'PRD-04' : 'PRD-03'}</a></p>`;
}

export function statusChip(p) {
  const st = inventoryStatusOf(p);
  const label = {
    listing: 'Catalog listing',
    ordered: 'Ordered',
    incoming: 'Incoming',
    on_hand: 'On hand',
    reserved: 'Reserved',
  }[st] || st;
  const bg = {
    listing: '#fef9c3',
    ordered: '#dbeafe',
    incoming: '#ffedd5',
    on_hand: '#d1fae5',
    reserved: '#ede9fe',
  }[st] || '#e2e8f0';
  return `<span style="display:inline-block;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:${bg};color:#0f172a">${label}</span>`;
}

/** Keep sku-lifecycle movements informed when a listing is first ordered. */
export function noteFirstOrder(product, ref) {
  appendMovements([{
    id: uid(),
    product_id: product.id,
    created_at: new Date().toISOString(),
    type: 'inventory_commit',
    qty: 0,
    sku_before: product.sku || '',
    sku_after: product.sku || '',
    catalog_sku: product.catalog_sku || product.sku,
    from_location: '',
    to_location: product.location_code || '',
    location_name: product.location_name || '',
    reference: ref || '',
    note: 'Moved from Product Catalog onto Product Inventory (ordered — any stage).',
  }]);
}
