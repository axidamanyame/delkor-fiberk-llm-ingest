/** Live ACM workbooks — Spreadsheet folder + Field Ops / Accounting / Stock. */
import { esc, readLs, writeLs } from './ls-rows.js';

const SS_KEY = 'df_spreadsheets_v1';
export const HP_FOLDER_ID = 'f-bnpl-field';

export const HP_WORKBOOKS = [
  {
    id: 's-hp-orders',
    name: 'Order List',
    source: 'hp-orders',
    href: '/field-ops.html?tab=orders',
    sheet: '/spreadsheet.html?sheet=s-hp-orders',
    feeds: ['Field Ops', 'Collections', 'Call Centre'],
    blurb: 'ACM hire-purchase contracts. Partner price is the customer benchmark.',
  },
  {
    id: 's-hp-payments',
    name: 'Payment Record',
    source: 'hp-payments',
    href: '/field-ops.html?tab=payments',
    sheet: '/spreadsheet.html?sheet=s-hp-payments',
    feeds: ['Accounting', 'Field Ops'],
    blurb: 'Partner reimbursement. Fiberk sell is our selling price. Deposit is the partner’s.',
  },
  {
    id: 's-hp-master',
    name: 'HP Book',
    source: 'hp-master',
    href: '/field-ops.html?tab=master',
    sheet: '/spreadsheet.html?sheet=s-hp-master',
    feeds: ['Field Ops', 'Accounting'],
    blurb: 'Order List joined to Payment Record on Apply No. Cost from Franko is blank.',
  },
  {
    id: 's-hp-skus',
    name: 'HP SKUs',
    source: 'hp-skus',
    href: '/field-ops.html?tab=stock',
    sheet: '/spreadsheet.html?sheet=s-hp-skus',
    feeds: ['Stock Hub', 'Catalogue'],
    blurb: '18 models sourced from Franko Trading. On-hand 0 — sold through.',
  },
  {
    id: 's-hp-imeis',
    name: 'IMEI register',
    source: 'hp-imeis',
    href: '/field-ops.html?tab=stock',
    sheet: '/spreadsheet.html?sheet=s-hp-imeis',
    feeds: ['Stock Hub', 'Field Ops', 'Collections'],
    blurb: 'Each phone: Franko → Ops Hub → BNPL Field → Field Stock Hub → customer.',
  },
];

export function workbookBtn(id, label = 'Open workbook') {
  const w = HP_WORKBOOKS.find((x) => x.id === id) || HP_WORKBOOKS[0];
  return `<a class="ult-btn ult-btn-outline" href="${w.sheet}">${esc(label)}</a>`;
}

export function ensureHpWorkbooks() {
  const rows = readLs(SS_KEY, []) || [];
  const today = '2026-09-08';
  const folder = {
    id: HP_FOLDER_ID,
    kind: 'folder',
    parent: null,
    name: 'BNPL Field Ops',
    updated: today,
    integrated: true,
  };
  let next = rows.slice();
  if (!next.some((r) => r.id === HP_FOLDER_ID)) next = [folder, ...next];
  else {
    next = next.map((r) => (r.id === HP_FOLDER_ID ? { ...r, ...folder, name: folder.name } : r));
  }
  for (const w of HP_WORKBOOKS) {
    const sheet = {
      id: w.id,
      kind: 'sheet',
      parent: HP_FOLDER_ID,
      name: w.name,
      source: w.source,
      updated: today,
      integrated: true,
      cells: [['Live workbook — open to load from Field Ops']],
    };
    const i = next.findIndex((r) => r.id === w.id);
    if (i < 0) next.push(sheet);
    else {
      next[i] = {
        ...next[i],
        parent: HP_FOLDER_ID,
        name: w.name,
        source: w.source,
        integrated: true,
        kind: 'sheet',
      };
    }
  }
  writeLs(SS_KEY, next);
  return next;
}

function cellRow(cols, row) {
  return cols.map((c) => {
    const v = typeof c.get === 'function' ? c.get(row) : row[c.key];
    if (v == null || v === '') return '';
    return v;
  });
}

export async function cellsForWorkbook(source) {
  if (source === 'hp-orders') {
    const { loadOrders, ORDER_COLS } = await import('./bnpl-field-orders.js');
    const { loadPayments } = await import('./bnpl-field-payments.js');
    const [orders, pays] = await Promise.all([loadOrders(), loadPayments()]);
    const by = new Map(pays.map((p) => [p.apply_no, p]));
    const cols = ORDER_COLS.map((c) => ({
      ...c,
      get: (o) => (c.key === 'downpayment' ? (by.get(o.order_id) || {}).downpayment : o[c.key]),
    }));
    return [cols.map((c) => c.label), ...orders.map((o) => cellRow(cols, o))];
  }
  if (source === 'hp-payments') {
    const { loadPayments, PAY_COLS } = await import('./bnpl-field-payments.js');
    const rows = await loadPayments();
    return [PAY_COLS.map((c) => c.label), ...rows.map((r) => cellRow(PAY_COLS, r))];
  }
  if (source === 'hp-master') {
    const { masterRows, MASTER_COLS } = await import('./bnpl-field-payments.js');
    const rows = await masterRows();
    const cols = MASTER_COLS.map((c) => ({
      ...c,
      get: (r) => (c.key === 'cost_price' ? '' : r[c.key]),
    }));
    return [cols.map((c) => c.label), ...rows.map((r) => cellRow(cols, r))];
  }
  if (source === 'hp-skus' || source === 'hp-imeis') {
    const { loadPhoneBook, SKU_COLS, UNIT_COLS, FRANKO } = await import('./bnpl-field-phones.js');
    const book = await loadPhoneBook();
    if (source === 'hp-skus') {
      const cols = SKU_COLS.map((c) => ({
        ...c,
        get: (s) => {
          if (c.key === 'partner_price') return s.partner_price_min === s.partner_price_max
            ? s.partner_price_min : `${s.partner_price_min}–${s.partner_price_max}`;
          if (c.key === 'fiberk_sell') return s.fiberk_sell_min === s.fiberk_sell_max
            ? s.fiberk_sell_min : `${s.fiberk_sell_min}–${s.fiberk_sell_max}`;
          if (c.key === 'cost_price') return '';
          if (c.key === 'supplier_name') return s.supplier_name || FRANKO.name;
          return s[c.key];
        },
      }));
      return [cols.map((c) => c.label), ...(book.skus || []).map((s) => cellRow(cols, s))];
    }
    const cols = UNIT_COLS.map((c) => ({
      ...c,
      get: (u) => {
        if (c.key === 'cost_price') return '';
        if (c.key === 'path') return (u.path || []).join(' → ');
        return u[c.key];
      },
    }));
    return [cols.map((c) => c.label), ...(book.units || []).map((u) => cellRow(cols, u))];
  }
  return [['Empty']];
}

export function paintWorkbookHub(app, { navHtml = '' } = {}) {
  async function draw() {
    ensureHpWorkbooks();
    let nOrders = 514;
    let nSkus = 18;
    let nUnits = 514;
    try {
      const { loadOrders } = await import('./bnpl-field-orders.js');
      nOrders = (await loadOrders()).length;
    } catch { /* */ }
    try {
      const { loadPhoneBook } = await import('./bnpl-field-phones.js');
      const b = await loadPhoneBook();
      nSkus = (b.skus || []).length;
      nUnits = (b.units || []).length;
    } catch { /* */ }
    const counts = {
      's-hp-orders': nOrders,
      's-hp-payments': nOrders,
      's-hp-master': nOrders,
      's-hp-skus': nSkus,
      's-hp-imeis': nUnits,
    };
    app.innerHTML = `
      ${navHtml}
      <div class="fo-ol">
        <div class="ops-toolbar">
          <p class="ops-sub">The ACM Excel workbooks live here and in <b>Spreadsheet → BNPL Field Ops</b>.
            Same rows feed Field Ops, Accounting, Stock Hub, Collections and Call Centre.
            Supplier on every IMEI: Franko Trading. Cost is blank. Profit is not calculated.</p>
        </div>
        <div class="fo-books">
          ${HP_WORKBOOKS.map((w) => `<article class="fo-book">
            <h3>${esc(w.name)}</h3>
            <p class="fo-book-n">${counts[w.id] ?? ''} rows</p>
            <p>${esc(w.blurb)}</p>
            <p class="fo-book-feeds">Feeds ${esc(w.feeds.join(' · '))}</p>
            <p class="fo-book-acts">
              <a class="ult-btn ult-btn-primary" href="${w.sheet}">Open workbook</a>
              <a class="ult-btn ult-btn-outline" href="${w.href}">Live table</a>
            </p>
          </article>`).join('')}
        </div>
      </div>`;
  }
  return draw();
}

export function floorWorkbookStrip() {
  return `<div class="fo-books fo-books-floor">
    ${HP_WORKBOOKS.map((w) => `<a class="fo-book fo-book-link" href="${w.sheet}">
      <strong>${esc(w.name)}</strong>
      <span>${esc(w.feeds.join(' · '))}</span>
    </a>`).join('')}
  </div>`;
}
