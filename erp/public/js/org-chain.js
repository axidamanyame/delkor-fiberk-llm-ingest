/**
 * Supply-chain classification.
 * Operations Hub → Subsidiary → Business Location → Business Department
 *
 * Delkor-Fiberk is the parent name on non-operational books only
 * (clients, partners, investors, and as the parent label in accounting / HR).
 * Operational tables never print Delkor-Fiberk.
 */
export const PARENT_COMPANY = {
  code: 'group',
  name: 'Delkor-Fiberk',
  short: 'Delkor-Fiberk',
  operational: false,
};

export const OPS_HUB_ORG = {
  code: 'ops',
  location_code: 'OPS-HUB',
  name: 'Operations Hub',
  short: 'Operations Hub',
  role: 'warehouse',
  operational: true,
};

export const OPERATING_COMPANIES = [
  { code: 'axidigetek', name: 'Axidigetek', short: 'Axidigetek' },
  { code: 'bnpl', name: 'BuyNowPaysLater', short: 'BuyNowPaysLater' },
  { code: 'delkor', name: 'Delkor Logistics', short: 'Delkor Logistics' },
  { code: 'fiberk', name: 'Fiberk', short: 'Fiberk' },
];

/** Public marketplaces (virtual + physical). */
export const MARKETPLACES = [
  {
    code: 'AXI-ONLINE',
    name: 'Axidigetek eCommerce',
    subsidiary: 'axidigetek',
    kind: 'online',
    warehouse: 'axidigetek-MAIN',
    online: true,
  },
  {
    code: 'BNPL-FIELD',
    name: 'BNPL Field',
    subsidiary: 'bnpl',
    kind: 'field',
    warehouse: 'bnpl-MAIN',
    field: true,
    primary: true,
  },
  {
    code: 'BNPL-ONLINE',
    name: 'BNPL Online',
    subsidiary: 'bnpl',
    kind: 'online',
    warehouse: 'bnpl-MAIN',
    online: true,
  },
  {
    code: 'DEL-ONLINE',
    name: 'Delkor Online',
    subsidiary: 'delkor',
    kind: 'online',
    warehouse: 'delkor-MAIN',
    online: true,
    aliases: ['DEL-FURN'],
  },
  {
    code: 'FIB-SHOP',
    name: 'Fiberk Shop',
    subsidiary: 'fiberk',
    kind: 'shop',
    warehouse: 'fiberk-MAIN',
    physical: true,
    direct_store: true,
  },
];

/**
 * Handoff departments — where goods meet the customer
 * (online, shop, field agents, delivery).
 * Fiberk Shop is both the marketplace and the department because it is
 * the only physical shop and the only shop that may receive POs directly.
 */
export const DEPARTMENTS = [
  {
    code: 'AXI-SC',
    name: 'Axidigetek Stock Centre',
    subsidiary: 'axidigetek',
    locations: ['AXI-ONLINE'],
    kind: 'online',
  },
  {
    code: 'BNP-SC',
    name: 'BNPL Stock Centre',
    subsidiary: 'bnpl',
    locations: ['BNPL-FIELD', 'BNPL-ONLINE'],
    kind: 'field',
  },
  {
    code: 'DEL-DC',
    name: 'Delkor Delivery Centre',
    subsidiary: 'delkor',
    locations: ['DEL-ONLINE', 'DEL-FURN'],
    kind: 'delivery',
  },
  {
    code: 'FIB-SHOP',
    name: 'Fiberk Shop',
    subsidiary: 'fiberk',
    locations: ['FIB-SHOP'],
    kind: 'shop',
    receive_po: true,
    physical: true,
  },
];

export const DEPARTMENT_KINDS = [
  ['online', 'Online'],
  ['shop', 'Shop'],
  ['field', 'Field sales agents'],
  ['delivery', 'Delivery team'],
];

const NON_OP_TABLES = new Set([
  'clients', 'partners', 'investors', 'consultants',
  'client_groups', 'df_clients', 'df_partners', 'df_investors',
]);

export function isOperationalTable(table) {
  return !NON_OP_TABLES.has(String(table || ''));
}

export function isParentCompany(code) {
  const c = String(code || '').toLowerCase();
  return c === 'group' || c === 'delkor-fiberk' || c === 'delkorfiberk';
}

/** Label for operational desks — never Delkor-Fiberk. */
export function inferSubsidiary(row) {
  const raw = String(row?.subsidiary_code || row?.subsidiary || '').toLowerCase();
  if (raw && raw !== 'ops' && raw !== 'group') {
    const hit = OPERATING_COMPANIES.find((s) => s.code === raw);
    if (hit) return hit.code;
  }
  const loc = String(row?.location_code || row?.location || '').toUpperCase();
  const market = marketplaceOfLocation(loc);
  if (market?.subsidiary) return market.subsidiary;
  if (row?.source === 'easybuy' || row?.sale_channel === 'field-hp' || row?.book === 'hp-partnership') return 'bnpl';
  const byName = String(row?.supplier_name || row?.added_by || row?.location_name || '').toLowerCase();
  if (/field ops|bnpl|hire.?purchase/.test(byName)) return 'bnpl';
  if (/fiberk|franko/.test(byName)) return 'fiberk';
  return '';
}

export function subsidiaryColumn(rowOrCode) {
  const code = typeof rowOrCode === 'string' || !rowOrCode
    ? String(rowOrCode || '').toLowerCase()
    : inferSubsidiary(rowOrCode);
  if (!code || code === 'ops' || code === 'group') return '—';
  const hit = OPERATING_COMPANIES.find((s) => s.code === code);
  return hit ? hit.name : '—';
}

export function operationalLabel(code) {
  const c = String(code || '').toLowerCase();
  if (!c || c === 'group' || c === 'ops') return '—';
  const sub = OPERATING_COMPANIES.find((s) => s.code === c);
  if (sub) return sub.name;
  const loc = MARKETPLACES.find((l) => l.code === String(code || '').toUpperCase() || (l.aliases || []).includes(String(code || '').toUpperCase()));
  if (loc) return loc.name;
  const dept = DEPARTMENTS.find((d) => d.code === String(code || '').toUpperCase());
  if (dept) return dept.name;
  return code;
}

export function parentLabel() {
  return PARENT_COMPANY.name;
}

export function marketplaceOfLocation(locCode) {
  const code = normalizeLocCode(locCode);
  if (!code || code === 'OPS-HUB') return null;
  if (code === 'BNPL-FSH') return MARKETPLACES.find((m) => m.code === 'BNPL-FIELD') || null;
  return MARKETPLACES.find((m) => m.code === code || (m.aliases || []).includes(code)) || null;
}

export function departmentOfLocation(locCode) {
  const code = normalizeLocCode(locCode);
  if (!code || code === 'OPS-HUB') return null;
  if (code === 'BNPL-FSH') return DEPARTMENTS.find((d) => d.code === 'BNP-SC') || null;
  return DEPARTMENTS.find((d) => d.locations.includes(code) || d.code === code) || null;
}

function resolveMarket(row = {}) {
  const raw = row.location_code || row.location || row.location_name || '';
  return marketplaceOfLocation(raw)
    || MARKETPLACES.find((m) => m.name.toLowerCase() === String(raw).toLowerCase())
    || MARKETPLACES.find((m) => m.name.toLowerCase() === String(row.location_name || '').toLowerCase())
    || null;
}

const SUB_ALIASES = {
  bnpl: 'bnpl', bnp: 'bnpl', 'buy now pay later': 'bnpl', buynowpayslater: 'bnpl',
  'bnpl field': 'bnpl', 'bnpl online': 'bnpl',
  axidigetek: 'axidigetek', axi: 'axidigetek',
  fiberk: 'fiberk', fib: 'fiberk',
  delkor: 'delkor', del: 'delkor', 'delkor logistics': 'delkor',
};

function resolveSubCode(raw, fallback) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'n/a' || s === 'na' || s === 'none'
    || s === 'group' || s === 'ops' || s === 'ops-hub' || s === 'delkor-fiberk' || s === 'delkor fiberk') {
    return fallback || '';
  }
  if (SUB_ALIASES[s]) return SUB_ALIASES[s];
  const byName = OPERATING_COMPANIES.find((c) => c.name.toLowerCase() === s || c.short.toLowerCase() === s);
  if (byName) return byName.code;
  if (OPERATING_COMPANIES.some((c) => c.code === s)) return s;
  return fallback || '';
}

/** Labels for operational tables. Never returns Delkor-Fiberk. */
export function chainOf(row = {}) {
  const market = resolveMarket(row);
  const dept = departmentOfLocation(market?.code || row.location_code || row.location || '');
  const inferred = market?.subsidiary || dept?.subsidiary || inferSubsidiary(row) || '';
  const subCode = resolveSubCode(row.subsidiary_code, inferred);
  const sub = OPERATING_COMPANIES.find((s) => s.code === subCode);
  return {
    subsidiary_code: sub?.code || '',
    subsidiary: sub?.name || (inferred ? (OPERATING_COMPANIES.find((s) => s.code === inferred)?.name || '—') : '—'),
    location_code: market?.code || row.location_code || '',
    location: market?.name || row.location_name || '—',
    department_code: dept?.code || '',
    department: dept?.name || '—',
  };
}

/** Fiberkapp contact group → operating company. Every customer gets a subsidiary. */
export function placeFiberkappParty(row = {}) {
  const group = String(row.group || row.group_name || row.customer_group || '').toUpperCase();
  const blob = [
    row.source, row.origin, row.book, row.channel, row.sale_channel,
    row.location_name, row.location, row.business_location, row.pos_name,
    row.name, row.business_name, row.notes, row.added_by, group,
  ].join(' ').toLowerCase();
  let sub = '';
  let loc = '';
  if (/easybuy|hire.?purchase|dsa|field customer|\bbnpl\b/.test(blob) || /EASYBUY/.test(group)) {
    sub = 'bnpl'; loc = 'BNPL-FIELD';
  } else if (/jumia|axidigetek/.test(blob) || /JUMIA|AXI/.test(group)) {
    sub = 'axidigetek'; loc = 'AXI-ONLINE';
  } else if (/delkor|furniture|logistics/.test(blob) || /DELKOR/.test(group)) {
    sub = 'delkor'; loc = 'DEL-ONLINE';
  } else if (/fiberk shop|wholesale|fiberkapp|migrated|\bfiberk\b|\bshop\b|franko/.test(blob) || /FIBERK|WHOLESALE/.test(group)) {
    sub = 'fiberk'; loc = 'FIB-SHOP';
  } else if (row.source === 'fiberkapp' || row.origin === 'fiberkapp') {
    sub = 'fiberk'; loc = 'FIB-SHOP';
  }
  const placed = chainOf({
    ...row,
    subsidiary_code: sub || row.subsidiary_code,
    location_code: loc || row.location_code,
  });
  if (!placed.subsidiary_code && (row.source === 'fiberkapp' || row.origin === 'fiberkapp')) {
    return chainOf({ ...row, subsidiary_code: 'fiberk', location_code: 'FIB-SHOP' });
  }
  return placed;
}

export function normalizeProductChain(p) {
  if (!p || typeof p !== 'object') return p;
  const raw = String(p.location_code || p.location || '');
  const market = marketplaceOfLocation(raw);
  const dept = departmentOfLocation(raw || market?.code);
  if (String(raw).toUpperCase() === 'BNPL-FSH') {
    p.warehouse_code = p.warehouse_code || 'BNPL-FSH';
  }
  if (market) {
    p.location_code = market.code;
    p.location_name = market.name;
  }
  if (dept) {
    p.department_code = dept.code;
    p.department_name = dept.name;
  }
  return p;
}

export function normalizeProductBook(rows) {
  return (rows || []).map((row) => normalizeProductChain({ ...row }));
}

export function departmentsFor(subCode, locCode) {
  const sub = String(subCode || '').toLowerCase();
  const loc = String(locCode || '').toUpperCase();
  return DEPARTMENTS.filter((d) => {
    if (sub && sub !== 'group' && sub !== 'ops' && d.subsidiary !== sub) return false;
    if (loc && loc !== 'OPS-HUB' && !d.locations.includes(loc) && d.code !== loc) return false;
    return true;
  });
}

export function marketplacesFor(subCode) {
  const sub = String(subCode || '').toLowerCase();
  if (!sub || sub === 'group' || sub === 'ops') return MARKETPLACES.slice();
  return MARKETPLACES.filter((l) => l.subsidiary === sub);
}

/** Header / page filter: Hub + four companies. No parent-company row. */
export function operationalSubsidiaryOptions() {
  return [
    { code: 'ops', name: OPS_HUB_ORG.name, short: OPS_HUB_ORG.short },
    ...OPERATING_COMPANIES,
  ];
}

export function normalizeLocCode(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'DEL-FURN') return 'DEL-ONLINE';
  if (c === 'AXI-WEB' || c === 'AXI-STORE') return 'AXI-ONLINE';
  return c;
}

function headerKind(th) {
  const t = String(th.textContent || '').replace(/[↕↑↓▲▼⇄]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t === 'subsidiary' || t === 'company') return 'subsidiary';
  if (t === 'department' || t === 'dept') return 'department';
  if (t === 'location' || t === 'business location' || t === 'business locations') return 'location';
  return null;
}

function guessRow(tr, idxLoc, idxSub) {
  const locText = idxLoc >= 0 ? String(tr.children[idxLoc]?.textContent || '').trim() : '';
  const subText = idxSub >= 0 ? String(tr.children[idxSub]?.textContent || '').trim() : '';
  const byName = MARKETPLACES.find((m) => m.name.toLowerCase() === locText.toLowerCase());
  const bySub = OPERATING_COMPANIES.find((s) => s.name.toLowerCase() === subText.toLowerCase() || s.code === subText.toLowerCase());
  return chainOf({
    location_code: tr.dataset.loc || byName?.code || locText,
    location_name: locText,
    subsidiary_code: tr.dataset.sub || bySub?.code || '',
  });
}

export function applyOrgChainToTable(table) {
  if (!table || table.dataset.orgChain === '1') return;
  const ths = [...table.querySelectorAll('thead tr:first-child th')];
  if (!ths.length) return;
  const labels = ths.map((th) => String(th.textContent || '').replace(/[↕↑↓]/g, '').trim().toLowerCase());
  if (labels.some((t) => t === 'when' || t === 'actor' || t === 'summary' || t === 'event')) return;
  let idxLoc = ths.findIndex((th) => headerKind(th) === 'location');
  let idxSub = ths.findIndex((th) => headerKind(th) === 'subsidiary');
  let idxDept = ths.findIndex((th) => headerKind(th) === 'department');
  if (idxLoc < 0 && idxSub < 0) return;
  const insertAt = Math.max(idxLoc, idxSub, 0) + 1;
  if (idxDept < 0) {
    const th = document.createElement('th');
    th.textContent = 'Department';
    const ref = ths[insertAt] || null;
    if (ref) ref.parentElement.insertBefore(th, ref);
    else ths[0].parentElement.appendChild(th);
    table.querySelectorAll('tbody tr').forEach((tr) => {
      if (tr.querySelector('[colspan]')) return;
      const td = document.createElement('td');
      const at = tr.children[insertAt] || null;
      if (at) tr.insertBefore(td, at);
      else tr.appendChild(td);
    });
    idxDept = insertAt;
    if (idxLoc >= insertAt) idxLoc += 1;
    if (idxSub >= insertAt) idxSub += 1;
  }
  if (idxLoc >= 0) {
    const th = table.querySelectorAll('thead tr:first-child th')[idxLoc];
    if (th) th.textContent = 'Business Location';
  }
  table.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.querySelector('[colspan]')) return;
    const chain = guessRow(tr, idxLoc, idxSub);
    const fill = (el, val) => {
      if (!el || !val) return;
      const cur = String(el.textContent || '').trim();
      if (!cur || cur === '—') el.textContent = val;
    };
    if (idxSub >= 0) fill(tr.children[idxSub], chain.subsidiary);
    if (idxLoc >= 0) fill(tr.children[idxLoc], chain.location);
    if (idxDept >= 0) fill(tr.children[idxDept], chain.department);
  });
  table.dataset.orgChain = '1';
}

export function applyOrgChain(root = document) {
  (root.querySelectorAll ? root.querySelectorAll('table.ult-table, table') : []).forEach((table) => {
    if (!table.querySelector('thead')) return;
    if (table.closest('.silo-nav')) return;
    try { applyOrgChainToTable(table); } catch { /* ignore */ }
  });
}
