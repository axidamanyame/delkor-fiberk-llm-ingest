/**
 * Launch SKU rules
 * 1. Seed catalog lives at Operations Hub as OPH-NNNNNN (default warehouse)
 * 2. First transfer into a subsidiary shop adopts AXI / FIB / BNP / DEL + same serial
 * 3. After that receipt, base SKU is frozen
 * 4. Later moves append a 4-char movement key: FIB-000041-K7M2
 */
import { SUB_PREFIX, OPS_HUB, findLocation, isHubWarehouse, HUB_PREFIX as SCOPE_HUB, BNPL_FIELD_LOCATION, FIELD_STOCK_HUB_CODE, isFieldStockHub, isDirectStore, FIBERK_SHOP_CODE } from './scope.js';
import { stampMerch } from './catalog-merch.js';
import { readLs, writeLs, uid } from './ls-rows.js';

export const HUB_PREFIX = SCOPE_HUB || 'OPH';
export const MOVE_KEY = 'df_stock_movements';
const ALPHA = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function serialOf(sku) {
  const m = String(sku || '').toUpperCase().match(/^[A-Z]{3}-(\d{4,8})/);
  if (m) return m[1].padStart(6, '0').slice(-6);
  const d = String(sku || '').replace(/\D/g, '');
  return (d || '0').slice(-6).padStart(6, '0');
}

export function prefixOfSku(sku) {
  const m = String(sku || '').toUpperCase().match(/^([A-Z]{3})(?:-|\d)/);
  return m ? m[1] : '';
}

export function baseSkuOf(sku) {
  const s = String(sku || '').toUpperCase();
  const m = s.match(/^([A-Z]{3}-\d{6})(?:-[A-Z0-9]{4})?$/);
  return m ? m[1] : s.replace(/-[A-Z0-9]{4}$/, '');
}

export function movementOf(sku) {
  const m = String(sku || '').toUpperCase().match(/^[A-Z]{3}-\d{6}-([A-Z0-9]{4})$/);
  return m ? m[1] : '';
}

export function makeHubSku(seq) {
  return `${HUB_PREFIX}-${String(seq).padStart(6, '0')}`;
}
export const makeWhvSku = makeHubSku;

export function makeSubSku(subCode, seq) {
  const pfx = SUB_PREFIX[subCode] || String(subCode || 'GRP').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  return `${pfx}-${String(seq).padStart(6, '0')}`;
}

export function nextMovementKey(n) {
  let x = ((Number(n) || 0) + 1) * 7919 + 104729;
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out = ALPHA[x % ALPHA.length] + out;
    x = Math.floor(x / ALPHA.length);
  }
  return out;
}

export function displaySku(p = {}) {
  const base = p.base_sku || baseSkuOf(p.sku) || p.sku || '';
  const key = p.movement_key || movementOf(p.sku);
  if (p.sku_locked && key) return `${baseSkuOf(base)}-${key}`;
  return p.sku || base;
}

function sellingLoc(loc) {
  if (!loc) return false;
  return loc.sellable !== false && !loc.hub && !loc.office && !isHubWarehouse(loc.code);
}

const VENDOR_BY_SOURCE = {
  'frankotrading.com': { id: 's-franko', name: 'Franko Trading' },
  'electrolandgh.com': { id: 's-electro', name: 'Electroland Ghana' },
  'gh.oraimo.com': { id: 's-oraimo', name: 'Oraimo Ghana' },
};

export function stampLiveProduct(p, seq) {
  const catalog = makeHubSku(seq);
  const vendor = p.sku || p.vendor_sku || '';
  const hint = p.intended_location_code || p.location_code || '';
  const src = String(p.source || p.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const vendorRec = VENDOR_BY_SOURCE[src] || VENDOR_BY_SOURCE[String(p.source || '')] || null;
  return stampMerch({
    ...p,
    vendor_sku: vendor,
    catalog_sku: catalog,
    sku: catalog,
    base_sku: catalog,
    sku_locked: false,
    movement_key: '',
    movement_seq: 0,
    subsidiary_code: 'ops',
    home_subsidiary: 'ops',
    location_code: OPS_HUB.code,
    location_name: OPS_HUB.name,
    warehouse_code: OPS_HUB.warehouse || OPS_HUB.code,
    intended_location_code: '',
    seed_channel: hint && !/OPS-HUB|VW-GROUP|GRP-HQ/i.test(hint) ? hint : '',
    open_stock: false,
    stock: 0,
    current_stock: 0,
    qty: 0,
    alert_quantity: 0,
    min_stock: 0,
    supplier_id: vendorRec ? vendorRec.id : '',
    supplier_name: vendorRec ? vendorRec.name : '',
  });
}

export function seedMovement(p) {
  return {
    id: 'mv-seed-' + p.id,
    product_id: p.id,
    created_at: new Date().toISOString(),
    type: 'catalog_seed',
    qty: 0,
    sku_before: p.vendor_sku || '',
    sku_after: p.catalog_sku,
    catalog_sku: p.catalog_sku,
    base_sku: p.catalog_sku,
    movement_key: '',
    from_location: '',
    to_location: OPS_HUB.code,
    location_name: OPS_HUB.name,
    reference: 'SEED-OPH',
    note: 'Day-zero catalog at Operations Hub. Not assigned to a company or shop until open stock.',
  };
}

export function loadMovements() {
  return readLs(MOVE_KEY, []);
}

export function appendMovements(events) {
  const rows = loadMovements();
  writeLs(MOVE_KEY, [...events, ...rows].slice(0, 20000));
}

export function movementsFor(productId, locCode) {
  return loadMovements().filter((m) => {
    if (String(m.product_id) !== String(productId)) return false;
    if (!locCode) return true;
    return m.to_location === locCode || m.from_location === locCode || m.location_code === locCode;
  });
}

/**
 * First hop VW → shop adopts subsidiary SKU and locks it.
 * Later hops keep base SKU and stamp a new 4-char movement key.
 */
export function circulateProduct(product, { from, to, qty, reference, type = 'transfer' }) {
  const seq = serialOf(product.catalog_sku || product.sku);
  const dest = findLocation(to?.code || to) || to || {};
  const src = findLocation(from?.code || from) || from || {};
  const wasHub = isHubWarehouse(src.code) || prefixOfSku(product.sku) === HUB_PREFIX || prefixOfSku(product.sku) === 'WHV';
  let next = { ...product };
  const skuBefore = displaySku(product);
  let note = '';

  if (!next.sku_locked && sellingLoc(dest) && (wasHub || isHubWarehouse(product.location_code))) {
    const adopted = makeSubSku(dest.subsidiary, seq);
    next = {
      ...next,
      sku: adopted,
      base_sku: adopted,
      sku_locked: true,
      open_stock: true,
      location_code: dest.code,
      location_name: dest.name,
      warehouse_code: dest.warehouse || dest.code,
      subsidiary_code: dest.subsidiary || next.subsidiary_code,
      home_subsidiary: dest.subsidiary || next.home_subsidiary,
      intended_location_code: dest.code,
      movement_seq: Number(next.movement_seq || 0) + 1,
    };
    next.movement_key = nextMovementKey(next.movement_seq);
    next.sku = `${next.base_sku}-${next.movement_key}`;
    note = `Adopted ${dest.subsidiary?.toUpperCase()} SKU on first receipt at ${dest.name}`;
  } else if (next.sku_locked) {
    next.movement_seq = Number(next.movement_seq || 0) + 1;
    next.movement_key = nextMovementKey(next.movement_seq);
    next.base_sku = next.base_sku || baseSkuOf(next.sku);
    next.sku = `${baseSkuOf(next.base_sku)}-${next.movement_key}`;
    next.location_code = dest.code || next.location_code;
    next.location_name = dest.name || next.location_name;
    next.warehouse_code = dest.warehouse || dest.code || next.warehouse_code;
    note = `Movement ${next.movement_key} · SKU frozen`;
  } else if (sellingLoc(dest)) {
    const adopted = makeSubSku(dest.subsidiary, seq);
    next.sku = adopted;
    next.base_sku = adopted;
    next.location_code = dest.code;
    next.location_name = dest.name;
    note = `SKU adopted ${adopted}`;
  } else {
    next.location_code = dest.code || next.location_code;
    next.location_name = dest.name || next.location_name;
    note = 'Hub transfer';
  }

  const moved = Math.max(0, Number(qty || 0));
  if (moved) {
    next.stock = moved;
    next.current_stock = moved;
  }
  const events = [{
    id: uid(),
    product_id: next.id,
    created_at: new Date().toISOString(),
    type: type === 'transfer' ? 'transfer_in' : type,
    qty: Number(qty || 0),
    sku_before: skuBefore,
    sku_after: displaySku(next),
    catalog_sku: next.catalog_sku,
    base_sku: next.base_sku,
    movement_key: next.movement_key || '',
    from_location: src.code || '',
    to_location: dest.code || '',
    location_name: dest.name || '',
    reference: reference || '',
    note,
  }];
  if (type === 'transfer') {
    events.unshift({
      ...events[0],
      id: uid(),
      type: 'transfer_out',
      qty: -Math.abs(Number(qty || 0)),
      location_name: src.name || '',
      to_location: dest.code || '',
      from_location: src.code || '',
      note: `Left ${src.name || src.code}`,
    });
  }
  return { product: next, events };
}

export function skuHasVisited(productId, locCode) {
  const code = String(locCode || '').toUpperCase();
  if (!productId || !code) return false;
  return loadMovements().some((m) =>
    String(m.product_id) === String(productId)
    && [m.to_location, m.from_location, m.location_code].some((x) => String(x || '').toUpperCase() === code));
}

/** True if movement tracking (or current location) shows the SKU already reached BNPL Field Sales. */
export function skuReachedFieldSales(product) {
  if (!product) return false;
  if (String(product.location_code || '').toUpperCase() === BNPL_FIELD_LOCATION) return true;
  return skuHasVisited(product.id, BNPL_FIELD_LOCATION);
}

/**
 * Stock path:
 *  1. New capture is received at Operations Hub — except Fiberk Shop,
 *     which is a physical store-room and may take goods directly.
 *  2. Then transfer Hub → the selling company / shop.
 *  3. Only after movement tracking shows BNPL Field Sales may the SKU hop
 *     directly to Field Stock Hub (agent pick).
 */
export function transferGate(from, to, lines = []) {
  const src = findLocation(from?.code || from) || {};
  const dest = findLocation(to?.code || to) || {};
  if (!src.code || !dest.code) return { ok: false, message: 'Pick Location (From) and Location (To).' };
  if (src.code === dest.code) return { ok: false, message: 'From and To must be different.' };

  const destPick = isFieldStockHub(dest.code) || dest.code === FIELD_STOCK_HUB_CODE;
  if (destPick) {
    const blocked = (lines || []).filter((p) => !skuReachedFieldSales(p));
    if (blocked.length) {
      return {
        ok: false,
        message: 'Field Stock Hub only takes SKUs that already reached BNPL Field Sales. Receive at Operations Hub, transfer to BNPL Field Sales, then pick into Field Stock Hub.',
        blocked: blocked.map((p) => p.sku || p.name),
      };
    }
    if (!(lines || []).length) {
      return { ok: true, message: 'Field Stock Hub: agents pick here. Only SKUs whose movement history shows BNPL Field Sales may hop in.' };
    }
    return { ok: true, message: 'SKU already reached BNPL Field Sales — direct transfer to Field Stock Hub is allowed. Agents pick from here.' };
  }

  if (isDirectStore(dest.code) || dest.code === FIBERK_SHOP_CODE) {
    return { ok: true, message: 'Fiberk Shop is a physical store-room and can take goods directly.' };
  }

  const srcHub = isHubWarehouse(src.code) || src.hub || src.subsidiary === 'ops';
  const destHub = isHubWarehouse(dest.code) || dest.hub || dest.subsidiary === 'ops';
  const srcDirect = isDirectStore(src.code);
  if (!srcHub && !destHub && !srcDirect && src.subsidiary && dest.subsidiary
      && src.subsidiary !== dest.subsidiary
      && src.subsidiary !== 'group' && dest.subsidiary !== 'group') {
    return { ok: false, message: 'Inter-company: send From → Operations Hub first, then Hub → the selling company. Fiberk Shop is the only shop that stores directly.' };
  }
  if (srcHub) {
    return { ok: true, message: 'From Operations Hub → selling company. New stock is captured here first (Fiberk Shop excepted).' };
  }
  if (destHub) {
    return { ok: true, message: 'Returning to Operations Hub (coordination warehouse).' };
  }
  if (srcDirect) {
    return { ok: true, message: 'From Fiberk Shop (physical store-room).' };
  }
  return { ok: true, message: '' };
}

export function canReceiveNewStock(locCode) {
  return isHubWarehouse(locCode) || String(locCode || '').toUpperCase() === OPS_HUB.code || isDirectStore(locCode);
}

export function receiveMustBeHub(locCode) {
  return canReceiveNewStock(locCode);
}

export function applyProductPatch(updated) {
  const rows = readLs('df_products', []);
  const next = rows.map((r) => String(r.id) === String(updated.id) ? { ...r, ...updated } : r);
  writeLs('df_products', next);
  return next;
}
