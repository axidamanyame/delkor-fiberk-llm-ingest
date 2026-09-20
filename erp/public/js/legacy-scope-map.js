/**
 * Old ERP labels → current subsidiary and location codes.
 *
 * The migration brought rows across carrying the deprecated ERP's own text
 * labels — FIBERK SHOP, FIBERK EASYBUY, "EasyBuy - <agent>", "JUMIA - <shop>" —
 * in fields like `group`, `location_name` or `business_location`. The current
 * system filters by code (`subsidiary_code: 'fiberk'`, `location_code:
 * 'FIB-SHOP'`), so a migrated customer matched nothing: select Fiberk and
 * Fiberk Shop and the list comes back empty even though the records are there.
 *
 * This is the translation table. A row keeps whatever it already has — nothing
 * is overwritten — and only missing codes are filled in from its legacy label.
 *
 * Current structure, for reference:
 *
 *   ops         Operations Hub
 *   axidigetek  Axidigetek (E-comm HQ)     AXI-ONLINE
 *   bnpl        BuyNowPaysLater            BNPL-FIELD, BNPL-ONLINE, BNPL-FSH
 *   delkor      Delkor Logistics           DEL-ONLINE, DEL-FURN
 *   fiberk      Fiberk (Electronics)       FIB-SHOP
 *
 * Add a line when you meet a label that is not here. Order matters — the first
 * match wins — so put the specific patterns above the general ones.
 */

export const LEGACY_SCOPE_ALIASES = [
  /* Fiberk — the physical electronics shop */
  { match: /^fiberk[\s-]*shop$/i, subsidiary: 'fiberk', location: 'FIB-SHOP' },
  { match: /^fiberk$/i, subsidiary: 'fiberk', location: 'FIB-SHOP' },
  { match: /^delkor\s*ii\s*fiberk$/i, subsidiary: 'fiberk', location: 'FIB-SHOP' },

  /* EasyBuy was the hire-purchase book, now BNPL. Agent rows read
     "EasyBuy - AGNES HEDAGBI", so match the prefix and keep the agent name
     wherever the row already carries it. */
  { match: /^fiberk[\s-]*easybuy$/i, subsidiary: 'bnpl', location: 'BNPL-FIELD' },
  { match: /^easybuy\b/i, subsidiary: 'bnpl', location: 'BNPL-FIELD' },

  /* Delkor Logistics */
  { match: /^delkor\s*logistics$/i, subsidiary: 'delkor', location: 'DEL-ONLINE' },
  { match: /^delkor\s*(online|furn\w*)$/i, subsidiary: 'delkor', location: 'DEL-ONLINE' },
  { match: /^delkor$/i, subsidiary: 'delkor', location: 'DEL-ONLINE' },

  /* Marketplace rows. Confirm this one — "JUMIA - BEST ELECTRONICS GH" could
     belong to Axidigetek as the e-commerce HQ, or to the subsidiary that owned
     the stock. Left on axidigetek because the marketplace desks live there. */
  { match: /^jumia\b/i, subsidiary: 'axidigetek', location: 'AXI-ONLINE' },
  { match: /^axidigetek/i, subsidiary: 'axidigetek', location: 'AXI-ONLINE' },
  { match: /dsa|field\s*ops|bnpl/i, subsidiary: 'bnpl', location: 'BNPL-FIELD' },
];

export const LIVE_LOCATION_LABEL = {
  'FIB-SHOP': 'Fiberk Shop',
  'BNPL-FIELD': 'BNPL Field',
  'BNPL-ONLINE': 'BNPL Online',
  'AXI-ONLINE': 'Axidigetek eCommerce',
  'DEL-ONLINE': 'Delkor Online',
  'DEL-FURN': 'Delkor Online',
  'OPS-HUB': 'Operations Hub',
};

/** Old shop/agent label → one live marketplace name for charts and filters. */
export function chartLocationName(row) {
  const n = normaliseScope(row || {});
  if (n.location_code && LIVE_LOCATION_LABEL[n.location_code]) {
    return LIVE_LOCATION_LABEL[n.location_code];
  }
  const label = legacyLabelOf(n) || n.location_name || n.location || n.group || '';
  const hit = resolveLegacyScope(label);
  if (hit?.location && LIVE_LOCATION_LABEL[hit.location]) return LIVE_LOCATION_LABEL[hit.location];
  const blob = String(label).toLowerCase();
  if (/jumia|axidigetek/.test(blob)) return 'Axidigetek eCommerce';
  if (/easybuy|hire.?purchase|dsa|bnpl|field/.test(blob)) return 'BNPL Field';
  if (/fiberk|franko/.test(blob)) return 'Fiberk Shop';
  if (/delkor|furn/.test(blob)) return 'Delkor Online';
  const sub = String(n.subsidiary_code || n.home_subsidiary || '').toLowerCase();
  if (sub === 'bnpl' || sub === 'buynowpayslater') return 'BNPL Field';
  if (sub === 'axidigetek') return 'Axidigetek eCommerce';
  if (sub === 'delkor' || sub === 'delkor-logistics') return 'Delkor Online';
  if (sub === 'fiberk') return 'Fiberk Shop';
  if (sub === 'ops') return 'Operations Hub';
  return 'Unassigned';
}

/** Fields the old system used to say where a row belonged. */
const LEGACY_FIELDS = [
  'group', 'customer_group', 'supplier_group', 'contact_group',
  'business_location', 'location_name', 'location', 'office',
  'subsidiary', 'company', 'book', 'source_group',
];

const unmapped = new Map();

export function legacyLabelOf(row) {
  if (!row || typeof row !== 'object') return '';
  for (const f of LEGACY_FIELDS) {
    const v = row[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** @returns {{subsidiary: string, location: string}|null} */
export function resolveLegacyScope(label) {
  const text = String(label || '').trim();
  if (!text) return null;
  for (const a of LEGACY_SCOPE_ALIASES) {
    if (a.match.test(text)) return { subsidiary: a.subsidiary, location: a.location };
  }
  unmapped.set(text, (unmapped.get(text) || 0) + 1);
  return null;
}

/**
 * Fill in missing codes on one row. Never overwrites a code the row already
 * has — if the migration set a subsidiary, that wins.
 */
export function normaliseScope(row) {
  if (!row || typeof row !== 'object') return row;
  if (row.subsidiary_code && row.location_code) return row;
  const hit = resolveLegacyScope(legacyLabelOf(row));
  if (!hit) return row;
  const next = { ...row };
  if (!next.subsidiary_code) next.subsidiary_code = hit.subsidiary;
  if (!next.location_code) next.location_code = hit.location;
  if (!next.legacy_label) next.legacy_label = legacyLabelOf(row);
  return next;
}

export function normaliseScopes(rows) {
  return Array.isArray(rows) ? rows.map(normaliseScope) : rows;
}

/**
 * Labels seen that no alias covers, so you can tell me what they map to
 * instead of hunting for them. Run in the console on any desk:
 *
 *   import('/js/legacy-scope-map.js').then(m => console.table(m.unmappedLabels()))
 */
export function unmappedLabels() {
  return [...unmapped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, rows]) => ({ label, rows }));
}

if (typeof window !== 'undefined') {
  window.__dfUnmappedScopes = unmappedLabels;
}
