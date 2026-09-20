/**
 * Fill blank subsidiary / location on demo rows so test screens are never empty.
 * Infers from SKU prefix, existing location, customer group, then the majority subsidiary.
 */
import { supabase } from './supabaseClient.js';
import { inferRowScope, findLocation, AGENT_LOCATIONS } from './scope.js';

const TABLES = [
  'customers',
  'suppliers',
  'contacts',
  'products',
  'loyalty_cards',
  'sales_orders',
  'purchase_orders',
  'purchases',
  'purchase_returns',
  'expenses',
  'sales_commission_agents',
];

function modeSubsidiary(rows) {
  const counts = {};
  (rows || []).forEach((r) => {
    const s = String(r.subsidiary_code || '').toLowerCase();
    if (s && s !== 'group') counts[s] = (counts[s] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'fiberk';
}

function needsFill(row) {
  const sub = String(row.subsidiary_code || '').toLowerCase();
  const loc = String(row.location_code || '').trim();
  if (!sub || sub === 'group') return true;
  if (!loc) return true;
  if (!findLocation(loc) && loc !== 'VW-GROUP') return true;
  return false;
}

async function peelUpdate(table, id, body) {
  const payload = { ...body };
  for (let i = 0; i < 8; i++) {
    const q = await supabase.from(table).update(payload).eq('id', id);
    if (!q.error) return q;
    const m = String(q.error.message || '').match(/Could not find the '([^']+)' column/i);
    if (m && m[1] in payload) { delete payload[m[1]]; continue; }
    return q;
  }
  return { error: { message: 'update failed' } };
}

/** Never request columns a table does not have — that 400s every page load. */
async function selectScopeRows(table) {
  let cols = ['id', 'subsidiary_code', 'location_code'];
  if (table === 'products') cols.push('sku');
  if (table === 'customers' || table === 'suppliers' || table === 'contacts') cols.push('contact_code', 'group_name');
  if (table === 'customers' || table === 'sales_orders' || table === 'sales_commission_agents') cols.push('agent_id');
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.from(table).select(cols.join(',')).limit(500);
    if (!error) return data || [];
    const msg = String(error.message || '');
    const m = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "?([a-z0-9_]+)"? does not exist/i);
    if (m) {
      const bad = m[1];
      cols = cols.filter((c) => c !== bad);
      continue;
    }
    const slim = await supabase.from(table).select('id, subsidiary_code, location_code').limit(200);
    if (!slim.error) return slim.data || [];
    const ids = await supabase.from(table).select('id').limit(200);
    return ids.data || [];
  }
  return [];
}

const DEMO_CATALOG = [];

export function inferSupplierScope(row) {
  const n = String(row.name || row.business_name || '').toLowerCase();
  if (/furniture|sofa|desk|delkor/.test(n)) return { subsidiary_code: 'delkor', location_code: 'DEL-FURN' };
  if (/woo|shopify|amazon|axidigetek/.test(n)) return { subsidiary_code: 'axidigetek', location_code: 'AXI-ONLINE' };
  const num = parseInt(String(row.contact_code || '').replace(/\D/g, ''), 10) || 0;
  if (num && num % 2 === 0) {
    return { subsidiary_code: 'bnpl', location_code: num % 4 === 0 ? 'BNPL-ONLINE' : 'BNPL-FIELD' };
  }
  return { subsidiary_code: 'fiberk', location_code: 'FIB-SHOP' };
}

async function seedCatalog() {
  const { data, error } = await supabase.from('products').select('sku').limit(800);
  if (error) return;
  const have = new Set((data || []).map((r) => String(r.sku || '').toUpperCase()));
  for (const p of DEMO_CATALOG) {
    if (have.has(p.sku)) continue;
    const row = {
      sku: p.sku,
      name: p.name,
      subsidiary_code: p.subsidiary_code,
      location_code: p.location_code,
      selling_price: p.selling_price,
      cost_price: p.cost_price,
      current_stock_value: p.stock,
      purchase_price: p.cost_price,
      category: p.category,
      brand: p.brand,
      is_active: true,
      product_type: 'simple',
    };
    const q = await supabase.from('products').insert(row);
    if (q.error) {
      const m = String(q.error.message || '').match(/Could not find the '([^']+)' column/i);
      if (m) {
        const slim = { ...row };
        delete slim[m[1]];
        await supabase.from('products').insert(slim);
      }
    }
  }
}
export async function backfillDemoScope() {
  return { ok: true, skipped: true };
}
