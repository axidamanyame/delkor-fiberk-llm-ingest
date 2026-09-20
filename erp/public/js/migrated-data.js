/**
 * Browser-style import: CSV lands in Migrated Data, never in live tables.
 * Review → tick rows → Sync selected into the realtime list.
 */
import { uid, readLs, writeLs, saveRow, esc } from './ls-rows.js';
import { KEYS, SEED_ROLES } from './catalog-seed.js';
import {
  parseCsv, previewUserRows, applyUserImport, existingUsers, USER_IMPORT_TEMPLATE, decodeSpreadsheet, headerRowIndex, headerIndex,
} from './legacy-import.js';
import { TREE, classifyProduct } from './catalog-taxonomy.js';

const BATCH_KEY = 'df_migrated_batches';
const ARCHIVE_KEY = 'df_migrated_archive';

export const MIGRATE_TYPES = [
  {
    id: 'users',
    label: 'Users',
    liveHref: '/users.html',
    liveLabel: 'Users',
    sample: '/imports/users-delkor-ii-fiberk.csv',
    template: USER_IMPORT_TEMPLATE,
    templateName: 'users-import-template.csv',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    liveHref: '/customers.html',
    liveLabel: 'Customers / suppliers',
    template: 'Contact type,Prefix,First Name,Middle Name,Last Name,Business Name,Contact ID,Tax number,Opening Balance,Pay term,Pay period,Credit Limit,Email,Mobile,Alternate,Landline,City,State,Country,Address,Address 2,DOB\n1,,Ama,,Mensah,Ama Mensah,,P000000000,0,,,0,ama@example.com,0240000000,,,,,Accra,Greater Accra\n',
    templateName: 'contacts-import-template.csv',
  },
  {
    id: 'customers',
    label: 'Customers',
    liveHref: '/customers.html',
    liveLabel: 'Customers',
    sample: '/imports/customers-delkor-ii-fiberk.csv',
    template: 'Contact ID,Business Name,Name,Email,Tax number,Credit Limit,Pay term,Opening Balance,Address,Mobile\nCO0001,,Ama Mensah,ama@example.com,,No Limit,,0,,0240000000\n',
    templateName: 'customers-import-template.csv',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    liveHref: '/suppliers.html',
    liveLabel: 'Suppliers',
    sample: '/imports/suppliers-delkor-ii-fiberk.csv',
    template: 'Contact ID,Business Name,Name,Email,Tax number,Pay term,Opening Balance,Address,Mobile\nCO0001,Sample Ltd,,,P000000000,,0,Accra,0240000000\n',
    templateName: 'suppliers-import-template.csv',
  },
  {
    id: 'agents',
    label: 'Field agents',
    liveHref: '/commission-agents.html',
    liveLabel: 'Sales Commission Agents',
    sample: '/imports/sales-commission-agents-delkor-ii-fiberk.csv',
    template: 'Name,Email,Contact Number,Address,Sales Commission Percentage (%),Team\nAma Mensah,,0240000000,,0.00,ABRAHAM\n',
    templateName: 'agents-import-template.csv',
  },
  {
    id: 'products',
    label: 'Products',
    liveHref: '/products.html',
    liveLabel: 'Products',
    sample: '/imports/products-delkor-ii-fiberk.json',
    template: 'SKU,Product,Brand,Category,Subcategory,Business Location,Unit Purchase Price,Selling Price,Current stock,Product Type\nFBK0001,Demo Cable,Generic,Power,Cables,FIBERK SHOP,10,30,0,Single\n',
    templateName: 'products-import-template.csv',
  },
  {
    id: 'stock',
    label: 'Opening stock',
    liveHref: '/products.html',
    liveLabel: 'Product stock',
    template: 'SKU,Quantity,Location\nOPH-000001,0,Operations Hub\n',
    templateName: 'opening-stock-template.csv',
  },
  {
    id: 'categories',
    label: 'Categories',
    liveHref: '/categories.html',
    liveLabel: 'Categories',
    sample: '/imports/categories-delkor-ii-fiberk.csv',
    template: 'Category,Category Code,Description\nPower Banks,PWR-PB,\n',
    templateName: 'categories-import-template.csv',
  },
];

export function typeOf(id) {
  return MIGRATE_TYPES.find((t) => t.id === id) || MIGRATE_TYPES[0];
}

export function loadBatches() {
  const rows = readLs(BATCH_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

const hydratedBatches = new Map();

function overlayKey(id) {
  return 'df_mig_ov_' + id;
}

function writeOverlay(batch) {
  if (!batch?.id) return;
  const ov = { _deleted: batch._deleted || [] };
  (batch.rows || []).forEach((r) => {
    if (!(r.selected || r.reviewed || r.synced || r._edited)) return;
    ov[r.id] = {
      selected: !!r.selected,
      reviewed: !!r.reviewed,
      synced: !!r.synced,
      _edited: !!r._edited,
      name: r.name,
      brand: r.brand,
      sku: r.sku,
      suggested_category: r.suggested_category,
      suggested_sub: r.suggested_sub,
      buy: r.buy,
      sell: r.sell,
    };
  });
  try { localStorage.setItem(overlayKey(batch.id), JSON.stringify(ov)); } catch { /* quota */ }
}

function readOverlay(id) {
  try { return JSON.parse(localStorage.getItem(overlayKey(id)) || '{}') || {}; }
  catch { return {}; }
}

function persist(list) {
  (list || []).forEach((b) => {
    if (b?.rows?.length) hydratedBatches.set(b.id, b.rows);
  });
  const stored = (list || []).map((b) => {
    if (b?.lazy || b?.source || (b?.rows || []).length > 250) {
      try { writeOverlay(b); } catch { /* ignore */ }
      const copy = { ...b, rows: [], lazy: true, count: (b.rows || []).length || b.count || 0 };
      return copy;
    }
    return b;
  });
  try {
    writeLs(BATCH_KEY, stored);
  } catch {
    try { localStorage.setItem(BATCH_KEY, JSON.stringify(stored.map((b) => ({ ...b, rows: [] })))); } catch { /* quota */ }
  }
  return list;
}

export function batchesFor(type) {
  return loadBatches().filter((b) => !type || b.type === type).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function getBatch(id) {
  const b = loadBatches().find((x) => String(x.id) === String(id)) || null;
  if (b && hydratedBatches.has(b.id)) b.rows = hydratedBatches.get(b.id);
  return b;
}

export async function hydrateBatch(batch) {
  if (!batch) return batch;
  if (batch.rows?.length) {
    hydratedBatches.set(batch.id, batch.rows);
    return batch;
  }
  if (hydratedBatches.has(batch.id)) {
    batch.rows = hydratedBatches.get(batch.id);
    return batch;
  }
  if (!batch.source) return batch;
  const res = await fetch(batch.source);
  if (!res.ok) return batch;
  const text = await res.text();
  const list = previewProductRows(text);
  const ov = readOverlay(batch.id);
  const deleted = new Set((ov._deleted || []).map(String));
  batch._deleted = [...deleted];
  liveSkus.cache = null;
  const skus = liveSkus();
  batch.rows = list
    .filter((r) => !deleted.has(String(r.id || r.sku)))
    .map((r) => annotateProduct({ ...r, id: r.id || ('upos-' + r.sku), ...(ov[r.id] || ov[r.sku] || {}) }, skus));
  batch.count = batch.rows.length;
  hydratedBatches.set(batch.id, batch.rows);
  return batch;
}

export function saveBatch(batch) {
  const all = loadBatches();
  const i = all.findIndex((b) => String(b.id) === String(batch.id));
  if (i >= 0) all[i] = batch;
  else all.unshift(batch);
  persist(all);
  return batch;
}

function liveAgents() {
  return readLs(KEYS.agents, []) || [];
}

function normPhone(s) {
  return String(s || '').replace(/[^\d+]/g, '');
}

function splitAgentName(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.*?)\s*[-–]\s*-?\s*([A-Za-z][A-Za-z .]*)$/);
  if (m && m[1].trim()) return { name: m[1].replace(/[-–]+$/g, '').trim(), team: m[2].trim().toUpperCase() };
  return { name: t, team: '' };
}

function annotateAgent(row) {
  const issues = [];
  if (!row.full_name) issues.push({ level: 'block', text: 'No name' });
  if (!row.phone) issues.push({ level: 'block', text: 'No contact number' });
  else {
    const digits = String(row.phone).replace(/\D/g, '');
    if (digits.length < 10) issues.push({ level: 'warn', text: 'Phone looks short' });
  }
  if (!row.email) issues.push({ level: 'info', text: 'No email on the old row' });
  const live = liveAgents().find((a) => {
    const p = normPhone(a.phone || a.contact_number);
    return (p && p === normPhone(row.phone))
      || String(a.full_name || a.name || '').toLowerCase() === String(row.full_name || '').toLowerCase();
  });
  if (live) {
    issues.push({ level: 'block', text: 'Already on live Agents — will not overwrite' });
    row.already_live = true;
  }
  row.issues = issues;
  row.reviewed = row.reviewed === true;
  row.selected = row.selected === true && !issues.some((x) => x.level === 'block');
  row.synced = row.synced === true;
  return row;
}

export function previewAgentRows(text) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const headAt = headerRowIndex(table, ['name', 'contact_number', 'phone', 'email']);
  const idx = {};
  (table[headAt] || []).forEach((h, i) => {
    const k = String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (k && k !== 'action' && k !== 'actions') idx[k] = i;
  });
  const start = headAt + ((idx.name != null || idx.contact_number != null || idx.phone != null) ? 1 : 0);
  const col = (row, keys, fallback) => {
    for (const k of keys) if (idx[k] != null) return String(row[idx[k]] || '').trim();
    if (fallback != null) return String(row[fallback] || '').trim();
    return '';
  };
  return table.slice(start).map((row) => {
    const rawName = col(row, ['name', 'full_name', 'agent'], 0);
    const split = splitAgentName(rawName);
    const team = col(row, ['team', 'supervisor', 'group']) || split.team;
    const commissionKey = Object.keys(idx).find((k) => k.includes('commission'));
    const phone = col(row, ['contact_number', 'phone', 'mobile', 'contact'], 2);
    const emailRaw = col(row, ['email', 'e_mail'], 1);
    return {
      full_name: split.name,
      team,
      email: emailRaw && /@/.test(emailRaw) ? emailRaw.toLowerCase() : '',
      phone,
      address: col(row, ['address'], 3),
      commission: Number(col(row, ['sales_commission_percentage', 'commission', commissionKey].filter(Boolean), 4) || 0),
      label: [split.name, team, phone].filter(Boolean).join(' · '),
    };
  }).filter((r) => r.full_name || r.phone);
}

export function looksLikeAgents(batch) {
  const rows = batch?.rows || [];
  if (!rows.length || batch.type === 'agents') return false;
  const header = String((rows[0].header || []).join(' ')).toLowerCase();
  if (/commission/.test(header) && /contact|phone/.test(header)) return true;
  if (/name/.test(header) && /contact number/.test(header) && !/username/.test(header)) return true;
  return false;
}

function parseMoney(s) {
  const t = String(s || '').replace(/[¢₵,\s]/g, '');
  if (/no\s*limit/i.test(t)) return null;
  const n = Number(t.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function isTotalRow(row) {
  const blob = (row || []).join(' ').toLowerCase();
  return /\btotal\s*:/.test(blob) && !(row[1] || '').trim();
}

function liveParties(kind) {
  return readLs(kind === 'supplier' ? KEYS.suppliers : KEYS.customers, []) || [];
}

function annotateParty(row) {
  const issues = [];
  if (!row.full_name && !row.business_name) issues.push({ level: 'block', text: 'No name' });
  const digits = String(row.phone || '').replace(/\D/g, '');
  if (!row.phone) issues.push({ level: 'warn', text: 'No mobile' });
  else if (/^0{6,}$/.test(digits) || digits === '1234567890' || /^0200{6,}/.test(digits)) {
    issues.push({ level: 'warn', text: 'Placeholder phone' });
  } else if (digits.length < 10) issues.push({ level: 'warn', text: 'Phone looks short' });
  if (!row.email) issues.push({ level: 'info', text: 'No email on the old row' });
  const live = liveParties(row.kind).find((p) => {
    const code = String(p.contact_code || p.contact_id || '').toLowerCase();
    if (row.contact_id && code && code === String(row.contact_id).toLowerCase()) return true;
    const phone = normPhone(p.phone || p.mobile);
    const name = String(p.full_name || p.name || p.business_name || '').toLowerCase().trim();
    const mine = String(row.full_name || row.business_name || '').toLowerCase().trim();
    if (phone && phone === normPhone(row.phone) && name && name === mine) return true;
    return false;
  });
  if (live) {
    issues.push({ level: 'block', text: 'Already on the live list — will not overwrite' });
    row.already_live = true;
  }
  row.issues = issues;
  row.reviewed = row.reviewed === true;
  row.selected = row.selected === true && !issues.some((x) => x.level === 'block');
  row.synced = row.synced === true;
  return row;
}

export function previewPartyRows(text, kind) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const headAt = headerRowIndex(table, ['contact_id', 'name', 'business_name', 'email']);
  const idx = {};
  (table[headAt] || []).forEach((h, i) => {
    const k = String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (k && k !== 'action' && k !== 'actions') idx[k] = i;
  });
  const start = headAt + ((idx.contact_id != null || idx.name != null || idx.business_name != null) ? 1 : 0);
  const col = (row, keys, fallback) => {
    for (const k of keys) if (idx[k] != null) return String(row[idx[k]] || '').trim();
    if (fallback != null) return String(row[fallback] || '').trim();
    return '';
  };
  return table.slice(start).filter((row) => !isTotalRow(row)).map((row) => {
    const contact_id = col(row, ['contact_id', 'contact_code', 'id']);
    const business_name = col(row, ['business_name', 'company']);
    const name = col(row, ['name', 'full_name']);
    const emailRaw = col(row, ['email']);
    const phone = col(row, ['mobile', 'phone', 'contact_number']);
    const address = col(row, ['address', 'address_line']);
    const titleOnly = /^(mr|mrs|ms|miss|dr)\.?$/i.test(name);
    const full_name = (!titleOnly && name) || business_name || (/^CO\d+/i.test(contact_id) ? '' : contact_id);
    if (!full_name && !contact_id && !phone) return null;
    return {
      kind,
      contact_id,
      business_name,
      full_name,
      email: emailRaw && /@/.test(emailRaw) ? emailRaw.toLowerCase() : '',
      phone,
      address,
      tax_number: col(row, ['tax_number', 'tin']),
      credit_limit: col(row, ['credit_limit']),
      pay_term: col(row, ['pay_term']),
      opening_balance: parseMoney(col(row, ['opening_balance'])),
      customer_group: col(row, ['customer_group']),
      added_on: col(row, ['added_on']),
      due: parseMoney(col(row, ['total_sale_due', 'total_purchase_due'])),
      label: [full_name, contact_id, phone].filter(Boolean).join(' · '),
    };
  }).filter(Boolean);
}

export function looksLikeCustomers(batch) {
  const header = String((batch?.rows?.[0]?.header || []).join(' ')).toLowerCase();
  return /contact id/.test(header) && /total sale due|customer group/.test(header);
}

export function looksLikeSuppliers(batch) {
  const header = String((batch?.rows?.[0]?.header || []).join(' ')).toLowerCase();
  return /contact id/.test(header) && /total purchase due|purchases/.test(header);
}

function catSlug(s) {
  return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function liveCategories() {
  return readLs(KEYS.categories, []) || [];
}

function stripStorefront(name) {
  return String(name || '').replace(/\s*[-–]\s*(FIBERK|GET4LESS|ORAIMO|ELECTROMART|COMPUGHANA|TELEFONIKA)\s*$/i, '').trim();
}

function isSkuLeaf(name) {
  const n = String(name || '');
  if (/^(test|other|approve|fiberk)$/i.test(n)) return true;
  if (/\b(cover|covers|protector|back glass|camera lens)\b/i.test(n)
    && /(iphone|galaxy|camon|spark|hot\s*\d|pova|note\s*\d|nova|mate|itel|huawei|samsung|infinix|tecno|airpod|pop\s*\d|enjoy\s*\d)/i.test(n)) return true;
  if (/^(iphone\s*\d|galaxy\s*[amszf]|camon\s*\d|spark\s*\d|hot\s*\d|pova\s*\d|note\s*\d|nova\s+\d|mate\s+[x\d]|itel\s+[aps]|pop\s*\d)/i.test(n)) return true;
  if (/^\s*(a\d{2,3}|gt\s*\d{2}|s\d{2})\b/i.test(n) && n.length < 24) return true;
  return false;
}

function isFurnitureLeaf(name) {
  return /(furniture|sofa|mattress|\bbeds?\b|wardrobe|ottoman|hammock|armchair|dining|nightstand|bookshelf|bean bag|bunk|gazebo|patio|recliner|loveseat|sectional|vanit|credenza|buffet|coat hanger|shoe rack|toy box)/i.test(name);
}

function suggestCategory(leaf) {
  const cleaned = stripStorefront(leaf);
  const s = catSlug(cleaned);
  for (const [parent, , kids] of TREE) {
    const hit = kids.find((k) => catSlug(k) === s);
    if (hit) return { category: parent, subcategory: hit, exact: true, cleaned };
  }
  const parentHit = TREE.find(([p]) => catSlug(p) === s);
  if (parentHit) return { category: parentHit[0], subcategory: parentHit[2][0], exact: true, cleaned, storefront: true };
  const hint = classifyProduct({ name: cleaned, category: cleaned });
  const fallback = hint.category === 'Accessories' && hint.subcategory === 'General Accessories';
  return { category: hint.category, subcategory: hint.subcategory, exact: false, fallback, cleaned };
}

function annotateCategory(row) {
  const issues = [];
  if (!row.full_name) issues.push({ level: 'block', text: 'No category name' });
  if (row.sku_leaf) issues.push({ level: 'warn', text: 'Brand / SKU leaf — do not add to the category tree' });
  if (row.furniture) issues.push({ level: 'warn', text: 'Furniture / home — not on the electronics tree' });
  if (row.storefront) issues.push({ level: 'info', text: 'Old storefront heading' });
  if (row.dup_count > 1) issues.push({ level: 'info', text: 'Seen ' + row.dup_count + ' times in the old file' });
  const live = liveCategories().find((c) => catSlug(c.name) === catSlug(row.full_name) || catSlug(c.name) === catSlug(row.suggested_sub));
  if (live) {
    issues.push({ level: 'block', text: 'Already on the hardcoded tree — will not overwrite' });
    row.already_live = true;
  } else if (row.exact) {
    issues.push({ level: 'info', text: 'Matches ' + row.suggested_category + ' / ' + row.suggested_sub });
  } else if (row.fallback && !row.sku_leaf && !row.furniture) {
    issues.push({ level: 'warn', text: 'No match — pick a parent from the hardcoded tree' });
  } else if (!row.sku_leaf && !row.furniture) {
    issues.push({ level: 'info', text: 'Suggested: ' + row.suggested_category + ' / ' + row.suggested_sub });
  }
  row.issues = issues;
  row.reviewed = row.reviewed === true;
  row.selected = row.selected === true && !issues.some((x) => x.level === 'block');
  row.synced = row.synced === true;
  return row;
}

export function previewCategoryRows(text) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const headAt = headerRowIndex(table, ['category', 'name', 'sub_category']);
  const idx = {};
  (table[headAt] || []).forEach((h, i) => {
    const k = String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (k && k !== 'action' && k !== 'actions') idx[k] = i;
  });
  const start = headAt + ((idx.category != null || idx.name != null) ? 1 : 0);
  const col = (row, keys, fallback) => {
    for (const k of keys) if (idx[k] != null) return String(row[idx[k]] || '').trim();
    if (fallback != null) return String(row[fallback] || '').trim();
    return '';
  };
  const list = table.slice(start).map((row) => {
    const raw = col(row, ['category', 'name'], 0);
    if (!raw || /^category$/i.test(raw)) return null;
    const dashed = /^-+/.test(raw);
    const full_name = raw.replace(/^-+/, '').trim();
    if (!full_name) return null;
    const hint = suggestCategory(full_name);
    const storefront = !dashed && /FIBERK|GET4LESS|ORAIMO|ELECTROMART|COMPUGHANA|TELEFONIKA/i.test(full_name);
    return {
      legacy_name: raw,
      full_name: hint.cleaned || full_name,
      raw_name: full_name,
      level: dashed ? 'sub' : 'parent',
      code: col(row, ['category_code', 'code'], 1),
      description: col(row, ['description'], 2),
      suggested_category: hint.category,
      suggested_sub: dashed ? (hint.cleaned || full_name) : (hint.subcategory || hint.cleaned || full_name),
      exact: hint.exact,
      fallback: hint.fallback,
      storefront,
      sku_leaf: isSkuLeaf(hint.cleaned || full_name),
      furniture: isFurnitureLeaf(hint.cleaned || full_name),
      label: hint.cleaned || full_name,
      dup_count: 1,
    };
  }).filter(Boolean);
  const seen = new Map();
  list.forEach((rec) => {
    const k = catSlug(rec.full_name);
    if (seen.has(k)) {
      seen.get(k).dup_count += 1;
      return;
    }
    seen.set(k, rec);
  });
  return [...seen.values()];
}

export function looksLikeCategories(batch) {
  const header = String((batch?.rows?.[0]?.header || []).join(' ')).toLowerCase();
  if (batch?.type === 'categories') return false;
  return /category/.test(header) && /category code|description/.test(header) && !/contact/.test(header);
}

export const CATEGORY_PARENTS = TREE.map((row) => row[0]);

function productMoney(s) {
  const t = String(s || '').replace(/[¢₵,\s]/g, '');
  if (!t || t === '--' || t === '-') return 0;
  const first = t.split(/-(?=\d)/)[0];
  const n = Number(String(first).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function productStock(s) {
  const m = String(s || '').replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/);
  return m ? Number(m[0]) : 0;
}

function splitLegacyCat(s) {
  const t = String(s || '').trim();
  if (t.includes(' -- ')) {
    const [a, b] = t.split(' -- ');
    return { parent: stripStorefront(a.trim()), child: String(b || '').trim() };
  }
  return { parent: stripStorefront(t), child: '' };
}

function liveSkus() {
  if (!liveSkus.cache) {
    liveSkus.cache = new Set((readLs(KEYS.products, []) || []).map((p) => String(p.sku || '').toUpperCase()).filter(Boolean));
  }
  return liveSkus.cache;
}
liveSkus.cache = null;

function annotateProduct(row, skuSet) {
  const issues = [];
  if (!row.name) issues.push({ level: 'block', text: 'No product name' });
  if (!row.sku) issues.push({ level: 'block', text: 'No SKU' });
  const live = skuSet || liveSkus();
  if (row.sku && live.has(String(row.sku).toUpperCase())) {
    issues.push({ level: 'block', text: 'SKU already on the live catalog — will not overwrite' });
    row.already_live = true;
  }
  if (row.inactive) issues.push({ level: 'warn', text: 'Inactive / not for selling on the old file' });
  if (row.furniture) issues.push({ level: 'warn', text: 'Furniture — not on the electronics tree' });
  if (row.copy) issues.push({ level: 'warn', text: 'Marked (copy) on the old file' });
  if (Number(row.old_stock) > 0) {
    issues.push({ level: 'info', text: 'Old stock was ' + row.old_stock + ' — stays 0 until opening stock is declared' });
  }
  const hint = classifyProduct({
    name: row.name,
    brand: row.brand,
    category: row.legacy_sub || row.legacy_cat,
    subcategory: row.legacy_sub,
  });
  if (!row.suggested_category) row.suggested_category = hint.category;
  if (!row.suggested_sub) row.suggested_sub = hint.subcategory;
  if (!row.furniture) {
    issues.push({ level: 'info', text: 'Suggested: ' + row.suggested_category + ' / ' + row.suggested_sub });
  }
  if (row.loc) issues.push({ level: 'info', text: 'Old location: ' + String(row.loc).split(',')[0].trim() });
  row.issues = issues;
  row.reviewed = row.reviewed === true;
  row.selected = row.selected === true && !issues.some((x) => x.level === 'block');
  row.synced = row.synced === true;
  row.label = [row.sku, row.name].filter(Boolean).join(' · ');
  return row;
}

export function previewProductRows(text) {
  const raw = String(text || '').trim();
  if (raw.startsWith('[')) {
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  const table = parseCsv(text);
  if (!table.length) return [];
  const idx = {};
  (table[0] || []).forEach((h, i) => {
    const k = String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (k && k !== 'action' && k !== 'actions' && k !== 'product_image' && k !== '') idx[k] = i;
  });
  const start = (idx.product != null || idx.sku != null || idx.product_name != null) ? 1 : 0;
  const col = (row, keys, fb) => {
    for (const k of keys) if (idx[k] != null) return String(row[idx[k]] || '').trim();
    if (fb != null && fb >= 0) return String(row[fb] || '').trim();
    return '';
  };
  return table.slice(start).map((row) => {
    const name = col(row, ['product', 'product_name', 'name'], idx.product != null ? idx.product : 3);
    if (!name || /add to location/i.test(name) || /^product$/i.test(name)) return null;
    const sku = col(row, ['sku'], idx.sku != null ? idx.sku : 12);
    const catRaw = col(row, ['category'], idx.category != null ? idx.category : 9);
    const split = splitLegacyCat(catRaw);
    const loc = col(row, ['business_location', 'location'], idx.business_location != null ? idx.business_location : 4);
    const sub = col(row, ['subcategory', 'sub_category']) || split.child;
    return {
      sku,
      name,
      brand: col(row, ['brand'], idx.brand != null ? idx.brand : 10),
      type: col(row, ['product_type', 'type'], idx.product_type != null ? idx.product_type : 8) || 'Single',
      buy: productMoney(col(row, ['unit_purchase_price', 'purchase_price', 'buy'], idx.unit_purchase_price != null ? idx.unit_purchase_price : 5)),
      sell: productMoney(col(row, ['selling_price', 'sell'], idx.selling_price != null ? idx.selling_price : 6)),
      old_stock: productStock(col(row, ['current_stock', 'opening_stock', 'stock'], idx.current_stock != null ? idx.current_stock : 7)),
      loc,
      legacy_cat: split.parent || catRaw,
      legacy_sub: sub,
      inactive: /inactive|not for selling/i.test(name) || /^non active/i.test(loc),
      furniture: /furniture/i.test(loc + ' ' + catRaw),
      copy: /\(copy\)/i.test(name),
    };
  }).filter(Boolean);
}

export function looksLikeProducts(batch) {
  const header = String((batch?.rows?.[0]?.header || []).join(' ') + ' ' + Object.keys(batch?.rows?.[0] || {}).join(' ')).toLowerCase();
  if (batch?.type === 'products') return false;
  return /sku/.test(header) && /product|selling price/.test(header);
}

function liveUsers() {
  return existingUsers() || [];
}

function annotateUser(row) {
  const live = liveUsers().find((u) => String(u.email || '').toLowerCase() === String(row.email || '').toLowerCase());
  const issues = [];
  if (row.skip) issues.push({ level: 'block', text: row.skip_reason || 'Cannot sync' });
  if (!row.matched) issues.push({ level: 'warn', text: row.reason || 'Role needs a look' });
  if (!row.allow_login) issues.push({ level: 'info', text: 'Login was off on the old system' });
  if (live) {
    issues.push({ level: 'block', text: 'Already on the live Users list — will not overwrite' });
    row.already_live = true;
  }
  row.issues = issues;
  row.reviewed = row.reviewed === true;
  row.selected = row.selected === true && !issues.some((x) => x.level === 'block');
  row.synced = row.synced === true;
  return row;
}

function genericRows(text, type) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const start = headerRowIndex(table, ['username', 'email', 'name', 'sku', 'contact_id', 'category', 'product']);
  const header = (table[start] || []).map((h) => String(h || '').trim());
  const looksHeader = header.some((h) => /name|sku|email|contact|user|product|category/i.test(h));
  const dataStart = looksHeader ? start + 1 : start;
  return table.slice(dataStart).map((cols, i) => {
    const rec = { id: uid(), line: i + dataStart + 1, cols, header, type };
    header.forEach((h, n) => { rec[h || ('col_' + n)] = cols[n]; });
    const issues = [];
    const first = String(cols[0] || '').trim();
    if (!first && !cols.filter(Boolean).length) issues.push({ level: 'block', text: 'Empty row' });
    else if (!first) issues.push({ level: 'warn', text: 'First column is blank' });
    rec.issues = issues;
    rec.selected = false;
    rec.reviewed = false;
    rec.synced = false;
    rec.label = cols.filter(Boolean).slice(0, 3).join(' · ');
    rec.email = rec.Email || rec.email || '';
    rec.full_name = rec.Name || rec.name || rec.label;
    rec.username = rec.Username || rec.username || '';
    return rec;
  }).filter((r) => (r.cols || []).some((c) => String(c || '').trim()));
}

export function stageFile(type, text, filename = 'upload.csv') {
  const raw = decodeSpreadsheet(text);
  let rows = [];
  let parse_error = '';
  if (type === 'users') {
    const preview = previewUserRows(raw);
    parse_error = preview.error || '';
    rows = (preview.rows || []).map((r) => annotateUser({ ...r, id: uid() }));
    if (!rows.length) {
      rows = genericRows(raw, type).map((r) => convertRow(r, 'users')).filter(Boolean);
    }
  } else if (type === 'agents') {
    rows = previewAgentRows(raw).map((r) => annotateAgent({ ...r, id: uid() }));
    if (!rows.length) rows = genericRows(raw, type);
  } else if (type === 'customers' || type === 'suppliers') {
    const kind = type === 'suppliers' ? 'supplier' : 'customer';
    rows = previewPartyRows(raw, kind).map((r) => annotateParty({ ...r, id: uid() }));
    if (!rows.length) rows = genericRows(raw, type);
  } else if (type === 'categories') {
    rows = previewCategoryRows(raw).map((r) => annotateCategory({ ...r, id: uid() }));
    if (!rows.length) rows = genericRows(raw, type);
  } else if (type === 'products') {
    rows = previewProductRows(raw).map((r) => annotateProduct({ ...r, id: r.id || uid() }));
    if (!rows.length) rows = genericRows(raw, type);
  } else {
    rows = genericRows(raw, type);
  }
  const batch = {
    id: uid(),
    type,
    file: filename,
    name: filename.replace(/\.[^.]+$/, '') || type,
    created_at: new Date().toISOString(),
    rows,
    synced_at: null,
    lazy: type === 'products' && rows.length > 400,
    count: rows.length,
    parse_error,
    source: type === 'products' && /products-delkor-ii-fiberk/i.test(filename) ? '/imports/products-delkor-ii-fiberk.json' : undefined,
  };
  if (rows.length) hydratedBatches.set(batch.id, rows);
  saveBatch(batch);
  return batch;
}

export function latestBatch(type) {
  const b = batchesFor(type)[0] || null;
  if (b && hydratedBatches.has(b.id) && !(b.rows || []).length) b.rows = hydratedBatches.get(b.id);
  return b;
}

function csvCell(s) {
  const t = String(s ?? '');
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function csvFromRow(row) {
  const header = row.header?.length ? row.header : ['Username', 'Name', 'Role', 'Email'];
  const cols = row.cols?.length ? row.cols : [row.username, row.full_name || row.label, row.legacy_role || row.role, row.email];
  return header.map(csvCell).join(',') + '\n' + cols.map(csvCell).join(',');
}

export function looksLikeUsers(batch) {
  const rows = batch?.rows || [];
  if (!rows.length || batch.type === 'users') return false;
  const header = String((rows[0].header || []).join(' ')).toLowerCase();
  if (/user\s*name|username/.test(header) && /email/.test(header)) return true;
  const sample = rows.slice(0, 12);
  const emails = sample.filter((r) => /@/.test(String((r.cols || []).join(' ') + ' ' + (r.email || '')))).length;
  return emails >= Math.min(4, sample.length);
}

function convertRow(row, destType) {
  if (destType === 'users') {
    if (row.email || row.username || row.full_name) {
      return annotateUser({
        id: uid(),
        email: String(row.email || '').toLowerCase().trim(),
        full_name: row.full_name || row.label || '',
        username: row.username || '',
        legacy_username: row.legacy_username || row.username || '',
        legacy_role: row.legacy_role || row.role || '',
        role: row.role && row.role !== 'Pending' ? row.role : (row.legacy_role || 'Pending'),
        matched: !!(row.role && row.role !== 'Pending'),
        reason: row.reason || '',
        allow_login: false,
        skip: !row.email,
        skip_reason: row.email ? '' : 'No email',
      });
    }
    const preview = previewUserRows(csvFromRow(row));
    const u = (preview.rows || [])[0];
    if (!u) {
      return annotateUser({
        id: uid(),
        email: '',
        full_name: row.label || '',
        username: '',
        legacy_role: '',
        role: 'Pending',
        matched: false,
        reason: 'Could not read as a user',
        allow_login: false,
        skip: true,
        skip_reason: 'Could not read as a user',
      });
    }
    return annotateUser({ ...u, id: uid() });
  }
  if (destType === 'agents') {
    if (row.full_name || row.phone) {
      return annotateAgent({
        id: uid(),
        full_name: row.full_name || splitAgentName(row.label || '').name,
        team: row.team || splitAgentName(row.full_name || row.label || '').team,
        email: row.email || '',
        phone: row.phone || '',
        address: row.address || '',
        commission: Number(row.commission || 0),
      });
    }
    const parsed = previewAgentRows(csvFromRow(row))[0];
    return annotateAgent({ ...(parsed || { full_name: row.label || '' }), id: uid() });
  }
  if (destType === 'customers' || destType === 'suppliers') {
    const kind = destType === 'suppliers' ? 'supplier' : 'customer';
    if (row.full_name || row.business_name || row.phone || row.contact_id) {
      return annotateParty({
        id: uid(),
        kind,
        full_name: row.full_name || row.business_name || row.label || '',
        business_name: row.business_name || '',
        contact_id: row.contact_id || '',
        email: row.email || '',
        phone: row.phone || '',
        address: row.address || '',
        tax_number: row.tax_number || '',
        opening_balance: Number(row.opening_balance || 0),
      });
    }
    const parsed = previewPartyRows(csvFromRow(row), kind)[0];
    return annotateParty({ ...(parsed || { full_name: row.label || '', kind }), id: uid(), kind });
  }
  if (destType === 'categories') {
    const parsed = previewCategoryRows(csvFromRow(row))[0];
    if (row.full_name || parsed) {
      const full_name = String(row.full_name || parsed?.full_name || row.label || '').replace(/^-+/, '').trim();
      const hint = suggestCategory(full_name);
      return annotateCategory({
        id: uid(),
        ...(parsed || {}),
        full_name,
        legacy_name: row.legacy_name || parsed?.legacy_name || full_name,
        suggested_category: row.suggested_category || hint.category,
        suggested_sub: row.suggested_sub || hint.subcategory || full_name,
        exact: hint.exact,
        fallback: hint.fallback,
      });
    }
  }
  const dest = typeOf(destType);
  const header = String(dest.template || '').split('\n')[0].split(',').map((s) => s.trim()).filter(Boolean);
  const sourceHeader = (row.header || []).map((h) => String(h || ''));
  const sourceCols = row.cols || [];
  const byName = (name) => {
    const i = sourceHeader.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (i >= 0) return sourceCols[i] || '';
    return row[name] || row[name.toLowerCase()] || '';
  };
  const bits = String(row.full_name || row.label || '').trim().split(/\s+/);
  const cols = header.map((h) => {
    const k = h.toLowerCase();
    if (k === 'email') return row.email || byName(h);
    if (k === 'first name') return bits[0] || byName(h);
    if (k === 'last name') return bits.slice(1).join(' ') || byName(h);
    if (k === 'contact type') return byName(h) || '1';
    if (k === 'sku') return row.sku || byName(h);
    if (k === 'product name') return row.name || row.full_name || byName(h);
    if (k === 'quantity') return row.quantity || byName(h) || '0';
    if (k === 'location') return row.location || byName(h) || 'Operations Hub';
    return byName(h);
  });
  const rec = {
    id: uid(),
    line: 1,
    cols,
    header,
    type: destType,
    label: cols.filter(Boolean).slice(0, 3).join(' · ') || row.label || '',
    issues: cols.some(Boolean) ? [] : [{ level: 'block', text: 'Empty row' }],
    selected: false,
    reviewed: false,
    synced: false,
  };
  header.forEach((h, n) => { rec[h] = cols[n]; });
  return rec;
}

export function moveRows(batchId, ids, destType) {
  const src = getBatch(batchId);
  if (!src) return { ok: false, error: 'No batch', count: 0 };
  if (src.type === destType) return { ok: false, error: 'Already in ' + typeOf(destType).label, count: 0 };
  const want = new Set((ids || []).map(String));
  const moving = (src.rows || []).filter((r) => want.has(String(r.id)));
  if (!moving.length) return { ok: false, error: 'Tick the rows to move first.', count: 0 };
  let dest = latestBatch(destType);
  if (!dest || dest.file === 'manual') {
    dest = saveBatch({
      id: uid(),
      type: destType,
      file: src.file || destType + '.csv',
      name: (src.name || src.file || destType) + ' (moved from ' + typeOf(src.type).label + ')',
      created_at: new Date().toISOString(),
      rows: [],
      synced_at: null,
    });
  }
  const converted = moving.map((r) => convertRow(r, destType));
  dest.rows = [...converted, ...(dest.rows || [])];
  saveBatch(dest);
  src.rows = (src.rows || []).filter((r) => !want.has(String(r.id)));
  saveBatch(src);
  try {
    import('./delete-guard.js').then((m) => m.logCrud('edit', {
      table: 'migrated_' + destType,
      summary: 'Moved ' + converted.length + ' from ' + src.type + ' to ' + destType,
      entity_id: dest.id,
    }));
  } catch { /* ignore */ }
  return { ok: true, count: converted.length, destType, dest, src };
}

export function moveBatch(batchId, destType) {
  const src = getBatch(batchId);
  if (!src) return { ok: false, error: 'No batch', count: 0 };
  return moveRows(batchId, (src.rows || []).map((r) => r.id), destType);
}

export function updateRow(batchId, rowId, patch) {
  const batch = getBatch(batchId);
  if (!batch) return null;
  batch.rows = (batch.rows || []).map((r) => {
    if (String(r.id) !== String(rowId)) return r;
    const next = { ...r, ...patch };
    if (patch.synced !== true) next.synced = false;
    let out = next;
    if (batch.type === 'users') out = annotateUser(next);
    if (batch.type === 'agents') out = annotateAgent(next);
    if (batch.type === 'customers' || batch.type === 'suppliers') out = annotateParty({ ...next, kind: batch.type === 'suppliers' ? 'supplier' : 'customer' });
    if (batch.type === 'categories') out = annotateCategory(next);
    if (batch.type === 'products') out = annotateProduct(next);
    if (patch.reviewed != null) out.reviewed = patch.reviewed === true;
    if (patch.selected != null) out.selected = patch.selected === true;
    out._edited = true;
    return out;
  });
  return saveBatch(batch);
}

export function ensureBatch(type) {
  const existing = latestBatch(type);
  if (existing) return existing;
  return saveBatch({
    id: uid(),
    type,
    file: 'manual',
    name: 'Manual staging',
    created_at: new Date().toISOString(),
    rows: [],
    synced_at: null,
  });
}

export function addStagedRow(batchId, fields = {}) {
  const batch = getBatch(batchId) || ensureBatch(fields.type || 'users');
  let row;
  if (batch.type === 'users') {
    const email = String(fields.email || '').toLowerCase().trim();
    row = annotateUser({
      id: uid(),
      email,
      full_name: fields.full_name || '',
      username: fields.username || (email.split('@')[0] || ''),
      legacy_username: fields.username || '',
      legacy_role: fields.legacy_role || '',
      role: fields.role || 'Pending',
      matched: !!fields.role,
      reason: fields.role ? '' : 'Set a role before sync',
      allow_login: false,
      skip: !email,
      skip_reason: email ? '' : 'No email',
    });
  } else if (batch.type === 'agents') {
    const email = String(fields.email || '').toLowerCase().trim();
    row = annotateAgent({
      id: uid(),
      full_name: fields.full_name || fields.name || '',
      team: fields.team || '',
      email,
      phone: fields.phone || fields.contact_number || '',
      address: fields.address || '',
      commission: Number(fields.commission || 0),
    });
  } else if (batch.type === 'customers' || batch.type === 'suppliers') {
    row = annotateParty({
      id: uid(),
      kind: batch.type === 'suppliers' ? 'supplier' : 'customer',
      full_name: fields.full_name || fields.name || '',
      business_name: fields.business_name || '',
      contact_id: fields.contact_id || '',
      email: String(fields.email || '').toLowerCase(),
      phone: fields.phone || fields.mobile || '',
      address: fields.address || '',
      tax_number: fields.tax_number || '',
      opening_balance: Number(fields.opening_balance || 0),
    });
  } else if (batch.type === 'categories') {
    const full_name = String(fields.full_name || fields.name || '').replace(/^-+/, '').trim();
    const hint = suggestCategory(full_name);
    row = annotateCategory({
      id: uid(),
      full_name,
      legacy_name: fields.legacy_name || full_name,
      level: fields.level || 'sub',
      code: fields.code || '',
      description: fields.description || '',
      suggested_category: fields.suggested_category || hint.category,
      suggested_sub: fields.suggested_sub || full_name,
      exact: hint.exact,
      fallback: hint.fallback,
    });
  } else if (batch.type === 'products') {
    row = annotateProduct({
      id: uid(),
      sku: fields.sku || '',
      name: fields.name || fields.full_name || '',
      brand: fields.brand || '',
      type: fields.type || 'Single',
      buy: Number(fields.buy || 0),
      sell: Number(fields.sell || 0),
      old_stock: Number(fields.old_stock || 0),
      loc: fields.loc || '',
      legacy_cat: fields.legacy_cat || '',
      legacy_sub: fields.legacy_sub || '',
      suggested_category: fields.suggested_category || '',
      suggested_sub: fields.suggested_sub || '',
    });
  } else {
    const header = (batch.rows[0]?.header) || Object.keys(fields).filter((k) => !['id', 'type'].includes(k));
    const cols = header.map((h) => fields[h] || fields[h.toLowerCase()] || '');
    if (!header.length) {
      const keys = Object.keys(fields);
      row = {
        id: uid(),
        line: (batch.rows.length || 0) + 1,
        cols: keys.map((k) => fields[k]),
        header: keys,
        type: batch.type,
        label: keys.map((k) => fields[k]).filter(Boolean).slice(0, 3).join(' · '),
        issues: [],
        selected: false,
        reviewed: false,
        synced: false,
        ...fields,
      };
    } else {
      row = {
        id: uid(),
        line: (batch.rows.length || 0) + 1,
        cols,
        header,
        type: batch.type,
        label: cols.filter(Boolean).slice(0, 3).join(' · '),
        issues: cols.some(Boolean) ? [] : [{ level: 'block', text: 'Empty row' }],
        selected: false,
        reviewed: false,
        synced: false,
      };
      header.forEach((h, n) => { row[h] = cols[n]; });
    }
  }
  batch.rows = [row, ...(batch.rows || [])];
  saveBatch(batch);
  return row;
}

export async function deleteStagedRows(batchId, ids) {
  const { promptDeleteKey, logCrud } = await import('./delete-guard.js');
  const ok = await promptDeleteKey('Delete from migrated queue');
  if (!ok) return { ok: false, cancelled: true, count: 0 };
  const batch = getBatch(batchId);
  if (!batch) return { ok: false, count: 0 };
  const drop = new Set((ids || []).map(String));
  const n = (batch.rows || []).filter((r) => drop.has(String(r.id))).length;
  batch.rows = (batch.rows || []).filter((r) => !drop.has(String(r.id)));
  saveBatch(batch);
  try { logCrud('delete', { table: 'migrated_' + batch.type, summary: 'Deleted ' + n + ' staged ' + batch.type, entity_id: batchId }); } catch { /* ignore */ }
  return { ok: true, count: n, batch };
}

export async function deleteBatch(batchId) {
  const { promptDeleteKey, logCrud } = await import('./delete-guard.js');
  const ok = await promptDeleteKey('Delete staged file');
  if (!ok) return { ok: false, cancelled: true };
  const all = loadBatches().filter((b) => String(b.id) !== String(batchId));
  persist(all);
  try { logCrud('delete', { table: 'migrated_batches', summary: 'Deleted staged batch', entity_id: batchId }); } catch { /* ignore */ }
  return { ok: true };
}

export function loadArchive(type) {
  const rows = readLs(ARCHIVE_KEY, []);
  const list = Array.isArray(rows) ? rows : [];
  return type ? list.filter((r) => r.type === type) : list;
}

function persistArchive(list) {
  writeLs(ARCHIVE_KEY, list);
  return list;
}

export function archiveRows(batchId, ids) {
  const batch = getBatch(batchId);
  if (!batch) return { ok: false, count: 0 };
  const want = new Set((ids || []).map(String));
  const moving = (batch.rows || []).filter((r) => want.has(String(r.id)));
  if (!moving.length) return { ok: false, count: 0, batch };
  const archive = loadArchive();
  const stamped = moving.map((r) => ({
    ...r,
    selected: false,
    archive_id: r.archive_id || uid(),
    type: batch.type,
    batch_id: batch.id,
    batch_name: batch.name || batch.file,
    archived_at: new Date().toISOString(),
  }));
  persistArchive([...stamped, ...archive]);
  batch.rows = (batch.rows || []).filter((r) => !want.has(String(r.id)));
  saveBatch(batch);
  try {
    import('./delete-guard.js').then((m) => m.logCrud('archive', {
      table: 'migrated_' + batch.type,
      summary: 'Archived ' + stamped.length + ' staged ' + batch.type,
      entity_id: batchId,
    }));
  } catch { /* ignore */ }
  return { ok: true, count: stamped.length, batch };
}

export function restoreArchiveRows(ids) {
  const want = new Set((ids || []).map(String));
  const archive = loadArchive();
  const moving = archive.filter((r) => want.has(String(r.archive_id || r.id)));
  if (!moving.length) return { ok: false, count: 0 };
  persistArchive(archive.filter((r) => !want.has(String(r.archive_id || r.id))));
  const byType = new Map();
  for (const r of moving) {
    const type = r.type || 'users';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(r);
  }
  for (const [type, list] of byType) {
    const batch = ensureBatch(type);
    const restored = list.map((r) => {
      const { archive_id, archived_at, batch_id, batch_name, ...rest } = r;
      return {
        ...rest,
        id: rest.id || uid(),
        selected: false,
        synced: false,
        restored_at: new Date().toISOString(),
      };
    });
    batch.rows = [...restored, ...(batch.rows || [])];
    saveBatch(batch);
  }
  return { ok: true, count: moving.length };
}

export async function deleteArchiveRows(ids) {
  const { promptDeleteKey, logCrud } = await import('./delete-guard.js');
  const ok = await promptDeleteKey('Delete from archives');
  if (!ok) return { ok: false, cancelled: true, count: 0 };
  const want = new Set((ids || []).map(String));
  const archive = loadArchive();
  const n = archive.filter((r) => want.has(String(r.archive_id || r.id))).length;
  persistArchive(archive.filter((r) => !want.has(String(r.archive_id || r.id))));
  try { logCrud('delete', { table: 'migrated_archive', summary: 'Deleted ' + n + ' archived rows' }); } catch { /* ignore */ }
  return { ok: true, count: n };
}

export function updateArchiveRow(id, patch) {
  const archive = loadArchive();
  const next = archive.map((r) => {
    const key = String(r.archive_id || r.id);
    if (key !== String(id)) return r;
    const merged = { ...r, ...patch };
    return merged.type === 'users' ? { ...annotateUser(merged), archive_id: r.archive_id, archived_at: r.archived_at, type: r.type } : merged;
  });
  persistArchive(next);
  return next.find((r) => String(r.archive_id || r.id) === String(id));
}

export function setSelected(batchId, ids, on) {
  const batch = getBatch(batchId);
  if (!batch) return null;
  const want = new Set((ids || []).map(String));
  batch.rows = (batch.rows || []).map((r) => want.has(String(r.id)) ? { ...r, selected: on } : r);
  return saveBatch(batch);
}

export function parkLiveUserImports() {
  const live = liveUsers();
  const parked = live.filter((u) => u.source === 'upos_import' && u.allow_login === false);
  if (!parked.length) return 0;
  if (batchesFor('users').some((b) => b.file === 'parked-from-live')) return 0;
  const rows = parked.map((u) => annotateUser({
    id: uid(),
    email: String(u.email || '').toLowerCase(),
    full_name: u.full_name || '',
    username: u.username || '',
    legacy_username: u.username || '',
    legacy_role: u.legacy_role || '',
    role: u.role || u.role_name || 'Pending',
    matched: true,
    reason: '',
    allow_login: false,
    skip: false,
  }));
  saveBatch({
    id: uid(),
    type: 'users',
    file: 'parked-from-live',
    name: 'Parked from live Users (first import)',
    created_at: new Date().toISOString(),
    rows,
    synced_at: null,
  });
  writeLs(KEYS.users, live.filter((u) => !parked.includes(u)));
  return parked.length;
}

export async function syncSelected(batchId) {
  const batch = getBatch(batchId);
  if (!batch) return { ok: false, error: 'No batch' };
  const picked = (batch.rows || []).filter((r) => r.selected && r.reviewed && !r.synced && !(r.issues || []).some((x) => x.level === 'block'));
  if (!picked.length) return { ok: false, error: 'Mark rows ready, then tick them, before sync.' };
  const result = { created: 0, skipped: 0, errors: [] };

  if (batch.type === 'users') {
    const out = applyUserImport(picked, { roles: readLs(KEYS.roles, SEED_ROLES) });
    result.created = out.created;
    result.skipped = out.protected + out.updated + out.skipped;
    result.errors = out.errors || [];
    const live = new Set(liveUsers().map((u) => String(u.email || '').toLowerCase()));
    batch.rows = batch.rows.map((r) => live.has(String(r.email || '').toLowerCase()) ? { ...r, synced: true, selected: false } : r);
  } else if (batch.type === 'contacts') {
    const { saveParty } = await import('./contact-rules.js');
    for (const r of picked) {
      const cols = r.cols || [];
      const kindMap = { '1': 'customer', '2': 'supplier', '3': 'both', customer: 'customer', supplier: 'supplier', both: 'both' };
      const kind = kindMap[String(cols[0] || '').trim().toLowerCase()] || 'customer';
      const name = [cols[1], cols[2], cols[3], cols[4]].filter(Boolean).join(' ').trim() || cols[5] || r.label;
      try {
        await saveParty(kind, {
          full_name: name,
          business_name: cols[5] || null,
          email: cols[12] || null,
          phone: cols[13] || '',
          city: cols[16] || 'Accra',
          region: cols[17] || 'Greater Accra',
          source: 'upos_import',
        });
        r.synced = true;
        r.selected = false;
        result.created += 1;
      } catch (e) {
        result.errors.push((name || 'row') + ': ' + (e.message || e));
        result.skipped += 1;
      }
    }
    batch.rows = batch.rows.map((r) => picked.find((p) => p.id === r.id) || r);
  } else if (batch.type === 'customers' || batch.type === 'suppliers') {
    const kind = batch.type === 'suppliers' ? 'supplier' : 'customer';
    const table = kind === 'supplier' ? 'suppliers' : 'customers';
    const key = kind === 'supplier' ? KEYS.suppliers : KEYS.customers;
    const existing = liveParties(kind);
    const codes = new Set(existing.map((p) => String(p.contact_code || p.contact_id || '').toLowerCase()).filter(Boolean));
    const phones = new Set(existing.map((p) => normPhone(p.phone || p.mobile)).filter(Boolean));
    for (const r of picked) {
      const code = String(r.contact_id || '').toLowerCase();
      const phone = normPhone(r.phone);
      if ((code && codes.has(code)) || (phone && phones.has(phone) && existing.some((p) => String(p.full_name || p.name || '').toLowerCase() === String(r.full_name || '').toLowerCase()))) {
        result.skipped += 1;
        r.issues = [...(r.issues || []), { level: 'block', text: 'Already on the live list — will not overwrite' }];
        r.selected = false;
        continue;
      }
      const row = {
        id: uid(),
        name: r.full_name || r.business_name,
        full_name: r.full_name || r.business_name,
        business_name: r.business_name || null,
        email: r.email || null,
        phone: r.phone || null,
        address_line: r.address || '',
        address: r.address || '',
        tax_number: r.tax_number || null,
        contact_code: r.contact_id || undefined,
        contact_id: r.contact_id || null,
        opening_balance: Number(r.opening_balance || 0),
        credit_limit: r.credit_limit || null,
        pay_term: r.pay_term || null,
        group_name: r.customer_group || null,
        contact_type: kind,
        is_active: true,
        source: 'upos_import',
      };
      await saveRow(table, key, row);
      if (code) codes.add(code);
      if (phone) phones.add(phone);
      r.synced = true;
      r.selected = false;
      result.created += 1;
    }
    batch.rows = batch.rows.map((r) => picked.find((p) => p.id === r.id) || r);
  } else if (batch.type === 'products') {
    const existing = readLs(KEYS.products, []);
    const skus = new Set(existing.map((p) => String(p.sku || '').toUpperCase()));
    for (const r of picked) {
      const sku = String(r.sku || '').trim();
      const name = r.name || r.label;
      if (sku && skus.has(sku.toUpperCase())) {
        result.skipped += 1;
        r.issues = [...(r.issues || []), { level: 'block', text: 'SKU already on the live catalog — will not overwrite' }];
        r.selected = false;
        continue;
      }
      const row = {
        id: uid(),
        name,
        brand: r.brand || '',
        unit: 'Pcs',
        category: r.suggested_category || r.legacy_cat || '',
        subcategory: r.suggested_sub || r.legacy_sub || '',
        sku: sku || undefined,
        cost_price: Number(r.buy || 0),
        selling_price: Number(r.sell || 0),
        stock: 0,
        current_stock: 0,
        qty: 0,
        open_stock: false,
        location: 'Operations Hub',
        subsidiary_code: 'ops',
        product_type: r.type || 'Single',
        status: r.inactive ? 'Inactive' : 'Active',
        source: 'upos_import',
        legacy_sku: sku,
        legacy_location: r.loc || '',
      };
      await saveRow('products', KEYS.products, row);
      if (sku) skus.add(sku.toUpperCase());
      r.synced = true;
      r.selected = false;
      result.created += 1;
    }
    batch.rows = batch.rows.map((r) => picked.find((p) => p.id === r.id) || r);
  } else if (batch.type === 'agents') {
    const existing = liveAgents();
    const phones = new Set(existing.map((a) => normPhone(a.phone || a.contact_number)).filter(Boolean));
    const names = new Set(existing.map((a) => String(a.full_name || a.name || '').toLowerCase().trim()).filter(Boolean));
    for (const r of picked) {
      const phone = normPhone(r.phone);
      const nameKey = String(r.full_name || '').toLowerCase().trim();
      if ((phone && phones.has(phone)) || (nameKey && names.has(nameKey))) {
        result.skipped += 1;
        r.issues = [...(r.issues || []), { level: 'block', text: 'Already on live Agents — will not overwrite' }];
        r.selected = false;
        continue;
      }
      const row = {
        id: uid(),
        full_name: r.full_name,
        name: r.full_name,
        email: r.email || null,
        phone: r.phone || null,
        address: r.address || '',
        team: r.team || '',
        supervisor: r.team || '',
        commission_percent: Number(r.commission || 0),
        is_field_agent: true,
        is_active: true,
        subsidiary_code: 'bnpl',
        location_code: 'BNPL-FIELD',
        source: 'upos_import',
      };
      await saveRow('sales_commission_agents', KEYS.agents, row);
      if (phone) phones.add(phone);
      if (nameKey) names.add(nameKey);
      r.synced = true;
      r.selected = false;
      result.created += 1;
    }
    batch.rows = batch.rows.map((r) => picked.find((p) => p.id === r.id) || r);
  } else if (batch.type === 'categories') {
    const existing = liveCategories();
    const names = new Set(existing.map((c) => catSlug(c.name)));
    const parentId = (name) => {
      const hit = existing.find((c) => !c.parent_id && catSlug(c.name) === catSlug(name));
      if (hit) return hit.id;
      const row = TREE.find((t) => catSlug(t[0]) === catSlug(name));
      return row ? 'cat-' + catSlug(row[0]).replace(/\s+/g, '-') : null;
    };
    for (const r of picked) {
      const leaf = r.suggested_sub || r.full_name;
      if (names.has(catSlug(leaf))) {
        result.skipped += 1;
        r.issues = [...(r.issues || []), { level: 'block', text: 'Already on the hardcoded tree — will not overwrite' }];
        r.selected = false;
        continue;
      }
      const parent = r.suggested_category || 'Accessories';
      const row = {
        id: uid(),
        name: leaf,
        short_code: String(r.code || leaf).replace(/[^A-Za-z0-9]+/g, '').slice(0, 12).toUpperCase(),
        parent_id: parentId(parent),
        parent_name: parent,
        description: r.description || (parent + ' / ' + leaf),
        source: 'upos_import',
        legacy_name: r.legacy_name || r.full_name,
      };
      await saveRow('categories', KEYS.categories, row);
      names.add(catSlug(leaf));
      r.synced = true;
      r.selected = false;
      result.created += 1;
    }
    batch.rows = batch.rows.map((r) => picked.find((p) => p.id === r.id) || r);
  } else if (batch.type === 'stock') {
    result.errors.push('Opening stock stays in Migrated Data until inventory is declared. Day zero on-hand is 0.');
    result.skipped = picked.length;
  }

  batch.synced_at = new Date().toISOString();
  saveBatch(batch);
  return { ok: true, ...result, batch };
}

export function markReviewed(batchId, ids, on = true) {
  const batch = getBatch(batchId);
  if (!batch) return null;
  const want = new Set((ids || []).map(String));
  batch.rows = (batch.rows || []).map((r) => {
    if (!want.has(String(r.id))) return r;
    const block = (r.issues || []).some((x) => x.level === 'block');
    if (on && block) return r;
    return { ...r, reviewed: on, selected: on && !block };
  });
  return saveBatch(batch);
}

export const SKIP_IMPORT_HEADERS = /^(action|actions|edit|view|delete|#)$/i;

export function displayColumns(header = []) {
  return header
    .map((h, i) => ({ h: String(h || '').trim(), i }))
    .filter((c) => c.h && !SKIP_IMPORT_HEADERS.test(c.h));
}

export function issueHtml(issues, row) {
  if (row?.synced) return '<span class="ok">Synced</span>';
  if (issues && issues.length) {
    return issues.map((x) => `<span class="iss ${x.level}">${esc(x.text)}</span>`).join(' ');
  }
  if (row?.reviewed) return '<span class="ok">Ready</span>';
  return '<span class="iss warn">Needs review</span>';
}

const AGENT_STAGED = 'df_migrated_agents_v1';

export async function ensureAgentSample() {
  try {
    if (localStorage.getItem(AGENT_STAGED) === '1') return latestBatch('agents');
    if (batchesFor('agents').some((b) => (b.rows || []).length)) {
      localStorage.setItem(AGENT_STAGED, '1');
      return latestBatch('agents');
    }
    const res = await fetch('/imports/sales-commission-agents-delkor-ii-fiberk.csv');
    if (!res.ok) return null;
    const batch = stageFile('agents', await res.text(), 'Sales Commission Agents - DELKOR II FIBERK.csv');
    localStorage.setItem(AGENT_STAGED, '1');
    return batch;
  } catch {
    return null;
  }
}

async function stageSampleOnce(flag, type, url, filename) {
  try {
    if (localStorage.getItem(flag) === '1') return latestBatch(type);
    if (batchesFor(type).some((b) => (b.rows || []).length)) {
      localStorage.setItem(flag, '1');
      return latestBatch(type);
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const batch = stageFile(type, await res.text(), filename);
    localStorage.setItem(flag, '1');
    return batch;
  } catch {
    return null;
  }
}

export async function ensureContactSamples() {
  await stageSampleOnce('df_migrated_customers_v1', 'customers', '/imports/customers-delkor-ii-fiberk.csv', 'Customers - DELKOR II FIBERK.csv');
  await stageSampleOnce('df_migrated_suppliers_v1', 'suppliers', '/imports/suppliers-delkor-ii-fiberk.csv', 'Suppliers - DELKOR II FIBERK.csv');
}

export async function ensureCategorySample() {
  try {
    if (localStorage.getItem('df_migrated_categories_v2') === '1') return latestBatch('categories');
    persist(loadBatches().filter((b) => b.type !== 'categories'));
    try { localStorage.removeItem('df_migrated_categories_v1'); } catch { /* ignore */ }
    const res = await fetch('/imports/categories-delkor-ii-fiberk.csv');
    if (!res.ok) return null;
    const batch = stageFile('categories', await res.text(), 'Categories - DELKOR II FIBERK.csv');
    localStorage.setItem('df_migrated_categories_v2', '1');
    return batch;
  } catch {
    return null;
  }
}

export async function ensureProductSample() {
  try {
    if (localStorage.getItem('df_migrated_products_v1') === '1') {
      return latestBatch('products');
    }
    persist(loadBatches().filter((b) => b.type !== 'products'));
    const batch = saveBatch({
      id: uid(),
      type: 'products',
      file: 'Products - DELKOR II FIBERK.csv',
      name: 'Products - DELKOR II FIBERK',
      created_at: new Date().toISOString(),
      rows: [],
      lazy: true,
      source: '/imports/products-delkor-ii-fiberk.json',
      count: 4294,
      synced_at: null,
    });
    localStorage.setItem('df_migrated_products_v1', '1');
    return batch;
  } catch {
    return null;
  }
}

export function queueSummary() {
  return MIGRATE_TYPES.map((t) => {
    const batches = batchesFor(t.id);
    const rows = batches.flatMap((b) => b.rows || []);
    const lazyCount = batches.reduce((n, b) => n + (b.rows?.length ? 0 : (b.count || 0)), 0);
    return {
      ...t,
      batches: batches.length,
      waiting: (rows.filter((r) => !r.synced).length) || lazyCount,
      ready: rows.filter((r) => r.selected && !r.synced).length,
      synced: rows.filter((r) => r.synced).length,
      archived: loadArchive(t.id).length,
    };
  });
}
