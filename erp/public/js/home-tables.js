/** Shared list chrome: sort arrows, CSV/Excel/print, column visibility, PDF portrait/landscape. */
import { wireLiveSearch } from './live-search.js';
import { deleteMany, deleteRow } from './ls-rows.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { bindRecordViews, openRecordView, rowFromContext } from './record-view.js';
import { can, applyDomPermissions } from './rbac.js';
import { actionNeed } from './menu-perms.js';

function pageFile() {
  return (typeof location !== 'undefined' ? location.pathname : '').split('/').pop() || '';
}
function pageMay(act) {
  const need = actionNeed(act, pageFile());
  if (!need) return true;
  return can(need);
}
let flyDocBound = false;
let flyOpenedAt = 0;

const PAGE_CAP = 500;

function readPageSize(sel) {
  const raw = String(sel?.value || '25').trim();
  if (/^all$/i.test(raw)) return PAGE_CAP;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(n, PAGE_CAP);
}
export function closeFlyout() {
  document.querySelectorAll('.act-flyout').forEach((m) => m.remove());
}

function bindFlyDoc() {
  if (flyDocBound) return;
  flyDocBound = true;
  const insidePop = (el) => !!(el && el.closest && el.closest('.act-flyout, .col-vis-menu, .pdf-orient, [data-exp="cols"]'));
  document.addEventListener('mousedown', (e) => {
    if (Date.now() - flyOpenedAt < 80) return;
    if (insidePop(e.target)) return;
    closeFlyout();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFlyout();
  });
  window.addEventListener('resize', () => closeFlyout());
}

function pinFlyout(menu, anchor) {
  const r = anchor.getBoundingClientRect();
  const pad = 8;
  const mw = Math.max(240, menu.offsetWidth);
  const mh = menu.offsetHeight;
  let left = r.left;
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - pad && r.top - mh - 6 >= pad) {
    top = r.top - mh - 6;
  }
  if (left + mw > window.innerWidth - pad) left = Math.max(pad, r.right - mw);
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  const maxH = Math.max(160, window.innerHeight - top - pad);
  menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;z-index:10050;min-width:240px;max-height:${maxH}px;overflow:auto;`;
}
export function openFlyout(anchor, html) {
  closeFlyout();
  bindFlyDoc();
  const menu = document.createElement('div');
  menu.className = 'act-menu act-flyout';
  menu.innerHTML = html;
  document.body.appendChild(menu);
  pinFlyout(menu, anchor);
  return menu;
}

export function downloadBlob(name, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function tableToMatrix(table) {
  const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.style.display !== 'none' && tr.dataset.dummy !== '1');
  return rows.map((tr) => [...tr.children]
    .filter((c) => c.style.display !== 'none')
    .map((c) => c.innerText.replace(/\s+/g, ' ').trim()));
}

export function toCsv(matrix) {
  return matrix.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function printTable(title, table, orientation = 'portrait') {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return alert('Allow pop-ups to export PDF');
  w.document.write(`<!doctype html><title>${title}</title>
    <style>
      @page { size: A4 ${orientation}; margin: 12mm; }
      body{font-family:Inter,Arial,sans-serif;color:#111;padding:16px}
      h1{font-size:18px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #111;padding:6px 8px;text-align:left;font-size:12px;color:#111}
      th{background:#f3f4f6}
      .act-btn,.act-menu,.sort-ind{display:none!important}
    </style>
    <h1>${title} — ${orientation}</h1>${table.outerHTML}`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function placeNode(parent, node, ref) {
  if (!parent || !node) return;
  if (ref && ref !== parent && ref.parentNode === parent) parent.insertBefore(node, ref);
  else parent.appendChild(node);
}

function closePop(root) {
  root.querySelectorAll('.pdf-orient,.col-vis-menu').forEach((el) => el.remove());
}

const KEY_BY_STORAGE = {
  'home-sales-due': ['sales_orders', 'df_sales_orders'],
  'home-orders': ['sales_orders', 'df_sales_orders'],
  'home-purch-due': ['purchase_orders', 'df_purchase_orders'],
  'home-stock': ['products', 'df_products'],
  'home-ships': ['shipments', 'df_shipments'],
  users: ['profiles', 'df_users'],
  units: ['units', 'df_units'],
  cats: ['categories', 'df_categories'],
  brands: ['brands', 'df_brands'],
  loyalty: ['loyalty_cards', 'df_loyalty_cards'],
  expenses: ['expenses', 'df_expenses'],
  'expense-cats': ['expense_categories', 'df_expense_categories'],
  'stock-transfers': ['stock_transfers', 'df_stock_transfers'],
  'stock-adjustments': ['stock_adjustments', 'df_stock_adjustments'],
  'tax-rates': ['tax_rates', 'df_tax_rates'],
  'tax-groups': ['tax_groups', 'df_tax_groups'],
  'opened-registers': ['pos_sessions', 'df_pos_sessions'],
  prod: ['products', 'df_products'],
  'prod-list': ['products', 'df_products'],
  drafts: ['sales_orders', 'df_sales_orders'],
  'acc-tx-sell': ['sales_orders', 'df_sales_orders'],
  'acc-tx-sell_payment': ['sales_orders', 'df_sales_orders'],
  'acc-tx-purchase': ['purchases', 'df_purchases'],
  'acc-tx-purchase_payment': ['purchases', 'df_purchases'],
  'acc-tx-expense': ['expenses', 'df_expenses'],
  'list-pos-sales': ['sales_orders', 'df_sales_orders'],
  'fo-agents': ['sales_commission_agents', 'df_commission_agents'],
  'fo-visits': ['visits', 'df_visits'],
  'fo-customers': ['customers', 'df_customers'],
  'fo-stock': ['products', 'df_products'],
  'fo-join': ['field_ops_leads', 'df_field_ops_leads'],
  'cc-agents': ['call_agents', 'df_cc_agents'],
  'cc-ag': ['call_agents', 'df_cc_agents'],
  'cc-camp': ['call_campaigns', 'df_cc_campaigns'],
  'cc-in': ['call_tickets', 'df_cc_calls'],
  'rep-jobs': ['repair_jobs', 'df_repair_jobs'],
  'rep-inv': ['repair_invoices', 'df_repair_invoices'],
  'rep-brands': ['repair_brands', 'df_repair_brands'],
  quotes: ['quotations', 'df_quotations'],
  ships: ['shipments', 'df_shipments'],
  'hub-moves': ['stock_transfers', 'df_stock_transfers'],
};

function rowPickId(tr) {
  if (!tr) return '';
  const act = tr.querySelector('[data-act]')?.getAttribute('data-act') || '';
  return tr.querySelector('input[data-pick]')?.dataset.pick
    || act
    || tr.querySelector('[data-del]')?.dataset.del
    || tr.dataset.id
    || tr.dataset.view
    || tr.querySelector('[data-view]')?.dataset.view
    || '';
}

function ensurePickColumn(table) {
  const head = table.tHead?.rows?.[0];
  if (!head) return;
  const existing = head.querySelector('input[type="checkbox"][data-pick-all], #pick-all');
  if (existing) existing.setAttribute('data-pick-all', '');
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const boxes = [...tr.querySelectorAll('input[type="checkbox"]:not([data-pick-all])')];
    boxes.slice(1).forEach((b) => b.closest('td')?.remove());
    const box = boxes[0];
    if (box && !box.dataset.pick) box.dataset.pick = rowPickId(tr);
  });
  if (existing || table.querySelector('tbody input[data-pick]')) return;
  const th = document.createElement('th');
  th.dataset.nosort = '1';
  th.dataset.col = '';
  th.innerHTML = '<input type="checkbox" data-pick-all title="Select all visible rows" />';
  head.insertBefore(th, head.firstChild);
  table.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.dataset.dummy === '1') return;
    if (tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan')) return;
    const td = document.createElement('td');
    const id = rowPickId(tr);
    td.innerHTML = `<input type="checkbox" data-pick="${id}" />`;
    tr.insertBefore(td, tr.firstChild);
  });
  syncPlaceholderColspans(table);
}

/**
 * Pin the Action column to the front.
 *
 * This used to shift every data cell one column left. It moved the Action
 * header to the front, then looked for each row's action cell by testing for
 * '.act, .act-btn, [data-act], .act-menu'. Rows that render their actions as
 * .btn-edit / .btn-view / .btn-del — which users, roles, commission agents and
 * anything using the shared list-page primitives do — matched none of those, so
 * actAt came back -1. The fallback that should then have moved the cell at the
 * header's old index was dead, because idx had already been reassigned to dest
 * on the line above. Net result: the header moved and the row did not, and the
 * whole row read one column to the left of its own headings.
 *
 * Now the header's original index is kept separately and used as the fallback,
 * the action-cell test covers the button classes actually in use, and a row
 * whose cell count does not match the header is left alone rather than being
 * shifted further out of line.
 */
const ACTION_CELL_SEL = [
  '.act', '.act-btn', '[data-act]', '.act-menu', '.act-stack', '.act-row',
  '.btn-edit', '.btn-view', '.btn-del', '.pill.edit', '.pill.del', 'button.edit', 'button.del',
  '.crud-bar', 'menu.act-portal', 'details.act',
].join(', ');

function pinActionColumn(table) {
  /* Checkbox first, Action second. Every other column stays where the page put it. */
  if (!table?.tHead) return;
  if (table.dataset.actEnd === '1' || table.closest('[data-act-end="1"]')) return;
  const head = table.tHead.rows[0];
  const labelOf = (el) => String(el?.textContent || '').replace(/[↕↑↓⇅]/g, '').trim();
  const isPickCell = (cell) => !!cell?.querySelector('input[type="checkbox"]');
  const isActHead = (th) => /^action/i.test(labelOf(th));
  const bodyHasWidgets = [...table.querySelectorAll('tbody tr')].some((tr) =>
    [...tr.cells].some((td) => td.querySelector(ACTION_CELL_SEL))
  );
  if (!bodyHasWidgets) return;
  const isActBody = (td) => {
    if (!td) return false;
    if (td.matches(ACTION_CELL_SEL) || td.querySelector(ACTION_CELL_SEL)) return true;
    if (!td.querySelector('a,button')) return false;
    const txt = (td.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(view|edit|delete|print|history)(\s+(view|edit|delete|print|history))*$/i.test(txt);
  };
  const moveCell = (row, from, to) => {
    if (from < 0 || to < 0 || from === to || !row.cells[from]) return;
    const cell = row.cells[from];
    const ref = row.cells[to];
    if (ref) row.insertBefore(cell, ref);
    else row.appendChild(cell);
  };
  const headActAt = [...head.cells].findIndex(isActHead);
  const orderRow = (row, actAt) => {
    let pickAt = [...row.cells].findIndex(isPickCell);
    if (pickAt > 0) {
      if (actAt > pickAt) actAt -= 1;
      moveCell(row, pickAt, 0);
      pickAt = 0;
    }
    const dest = pickAt === 0 ? 1 : 0;
    if (actAt >= 0 && actAt !== dest) moveCell(row, actAt, dest);
  };
  if (headActAt >= 0) orderRow(head, headActAt);
  table.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.dataset.dummy === '1') return;
    if (tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan')) return;
    if (tr.cells.length < 2) return;
    let actAt = [...tr.cells].findIndex(isActBody);
    if (actAt < 0) {
      const last = tr.cells.length - 1;
      if (last >= 0 && tr.cells[last]?.querySelector('a,button')) actAt = last;
      else if (headActAt >= 0 && tr.cells.length > headActAt) actAt = headActAt;
    }
    orderRow(tr, actAt);
  });
  syncPlaceholderColspans(table);
}

/**
 * Keep single-cell placeholder rows spanning the full width.
 *
 * Pages hardcode their empty-state colspan (emptyRow(9, …)), and the select-all
 * checkbox column is injected at runtime, so the placeholder ended up one column
 * short of the header — which is why "No results" sat left of where it should,
 * leaving a stray empty column on the right.
 */
function syncPlaceholderColspans(table) {
  const cols = table.querySelectorAll('thead tr:last-child th').length;
  if (!cols) return;
  table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
    if (tr.cells.length !== 1) return;
    const td = tr.cells[0];
    if (!td.hasAttribute('colspan') && tr.dataset.dummy !== '1') return;
    if (td.colSpan !== cols) td.colSpan = cols;
  });
}

function isReadOnlyTable(root, opts, table) {
  if (opts?.readonly || opts?.crud === false) return true;
  if (root?.dataset.readonly === '1' || table?.dataset.readonly === '1') return true;
  const t = `${opts?.title || ''} ${root?.dataset.tbl || ''}`;
  if (/report|aging|kpi|summary/i.test(t) && opts?.crud !== true) return true;
  return false;
}

const DESK_FORM = {
  customers: 'customer-form.html',
  cust: 'customer-form.html',
  suppliers: 'supplier-form.html',
  contacts: 'customer-form.html',
  products: 'product-form.html',
  catalog: 'product-form.html',
  purchases: 'purchase-form.html',
  po: 'purchase-form.html',
  pr: 'purchase-return-form.html',
  'purchase-invoices': 'purchase-invoice-form.html',
  cu: 'purchase-catchup.html?id=new',
  'stock-transfers': 'stock-transfer-form.html',
  st: 'stock-transfer-form.html',
  sa: 'stock-adjustment-form.html',
  'hub-moves': 'stock-transfer-form.html',
  away: 'stock-transfer-form.html',
  recv: 'purchase-form.html',
  opening: 'opening-stock.html',
  sales: 'sales-form.html',
  'pos-sales': 'pos-open.html',
  quotes: 'quotation-form.html',
  drafts: 'draft-form.html',
  ships: 'sales-form.html',
  disc: 'discount-form.html',
  ex: 'expense-form.html',
  ec: 'expense-category-form.html',
  users: 'user-edit.html?new=1',
  roles: 'roles-edit.html',
  tx: 'tax-rates.html?id=new',
  tg: 'tax-rates.html?tab=groups&id=new',
  groups: 'customer-group-edit.html',
  budget: 'accounting-account-form.html',
  coa: 'accounting-account-form.html',
  roles: 'roles-edit.html?new=1',
};

function hideDuplicateAdds(root) {
  if (!root) return;
  root.querySelectorAll('a.add, button.add, a.ult-add, button.ult-add, [data-add]').forEach((el) => {
    if (el.classList.contains('ess-add') || el.hasAttribute('data-keep-add')) return;
    if (el.closest('.ess-hub, .ess-card, .ss-head, .ess-inline-form, .pay-modal-bg')) return;
    if (el.closest('.erp-top-bar, .erp-bottom-bar, .act, details.act, form, #fk-modal, .fk-dialog')) return;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const addish = /^\+?\s*add\b/i.test(t) || el.hasAttribute('data-add') || /log call|\+ campaign|onboard agent/i.test(t);
    if (!addish) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
  });
}

function pageAddControl(root) {
  return root?.querySelector('button.add, button.ult-add, button[data-add], [data-add]:not(a)')
    || document.querySelector('main button.add, main button.ult-add');
}

function pageAddHref(root) {
  const desk = String(root?.dataset?.tbl || '').toLowerCase();
  const title = String(document.querySelector('h1')?.textContent || '').toLowerCase();
  if (DESK_FORM[desk]) return DESK_FORM[desk];
  if (/customer groups/.test(title)) return 'customer-group-edit.html';
  if (/customer/.test(title) && !/group/.test(title)) return 'customer-form.html';
  if (/supplier/.test(title)) return 'supplier-form.html';
  if (/product|catalog/.test(title) && !/customer/.test(title)) return 'product-form.html';
  const a = (root && root.querySelector('a.add, [data-add][href]'))
    || document.querySelector('main a.add, [data-tbl] a.add');
  const href = a?.getAttribute('href') || '';
  if (/product-form/.test(href) && /customer/.test(title)) return 'customer-form.html';
  if (/stock count/.test(title)) return '';
  if (/purchase return/.test(title)) return 'purchase-return-form.html';
  if (/purchase invoice/.test(title)) return 'purchase-invoice-form.html';
  if (/catch-up|catchup/.test(title)) return 'purchase-catchup.html?id=new';
  if (/purchase/.test(title) && !/payment/.test(title)) return 'purchase-form.html';
  if (/quotation/.test(title)) return 'quotation-form.html';
  if (/draft/.test(title)) return 'draft-form.html';
  if (/pos sale|opened register/.test(title)) return 'pos-open.html';
  if (/all sales|^sales$/.test(title)) return 'sales-form.html';
  if (/sell return/.test(title)) return 'sell-return-form.html';
  if (/expense categor/.test(title)) return 'expense-category-form.html';
  if (/expense/.test(title)) return 'expense-form.html';
  return href;
}

function attachCrudBar(root, table, opts, paint) {
  if (root.querySelector('.erp-top-bar')) {
    hideDuplicateAdds(root);
    return;
  }
  const ro = isReadOnlyTable(root, opts, table);
  const addBtn = pageAddControl(root);
  const mappedHref = pageAddHref(root);
  const mayAdd = !ro && pageMay('add');
  const addHref = mayAdd ? (mappedHref || (addBtn ? '#' : '')) : '';
  const desk = String(root?.dataset?.tbl || opts?.title || '').toLowerCase();
  const showPub = /product|catalog/.test(desk);
  const bar = document.createElement('div');
  bar.className = 'erp-top-bar';
  bar.innerHTML = `
    <label class="erp-chip">Show
      <select data-tbl-size>
        <option>25</option><option>50</option><option>100</option>
        <option>200</option><option>500</option><option>1000</option>
        <option>All</option>
      </select> entries
    </label>
    <div class="erp-tools">
      <details class="erp-drop"><summary class="erp-chip">Import Files</summary>
        <menu>
          <button type="button" data-imp="xlsx">Excel</button>
          <button type="button" data-imp="doc">Word</button>
          <button type="button" data-imp="txt">Text</button>
          <button type="button" data-imp="pdf">PDF</button>
        </menu>
      </details>
      <details class="erp-drop"><summary class="erp-chip">Export Files</summary>
        <menu>
          <button type="button" data-exp="xls">Excel</button>
          <button type="button" data-exp="doc">Word</button>
          <button type="button" data-exp="txt">Text</button>
          <button type="button" data-exp="pdf">PDF</button>
        </menu>
      </details>
      <input type="file" hidden data-imp-file accept=".xlsx,.xls,.csv,.tsv,.txt,.doc,.docx,.pdf" />
      <button type="button" class="erp-chip" data-exp="cols">Column Visibility</button>
      <button type="button" class="erp-chip" data-exp="print">Print</button>
      ${showPub ? '<button type="button" class="erp-chip" id="pub-catalog-bar">Publish Catalog</button>' : ''}
      ${addHref ? `<a class="erp-chip erp-add" href="${addHref === '#' ? '#' : addHref}">+ ADD</a>` : ''}
      <input type="text" class="erp-search" data-tbl-search placeholder="Search …" />
    </div>`;
  const wrap = table.closest('.table-wrapper, .ult-table-wrap');
  const host = wrap?.parentNode || root;
  host.insertBefore(bar, wrap || table);
  bar.querySelector('#pub-catalog-bar')?.addEventListener('click', () => {
    document.getElementById('pub-catalog')?.click();
  });
  const addChip = bar.querySelector('.erp-add');
  if (addChip) {
    addChip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (addBtn && (!mappedHref || addHref === '#')) {
        addBtn.click();
        return;
      }
      const href = addChip.getAttribute('href') || addHref;
      if (!href || href === '#') return;
      const path = href.startsWith('/') || href.startsWith('http') ? href : '/' + href;
      try {
        const here = location.pathname + location.search;
        const stack = JSON.parse(sessionStorage.getItem('df_desk_back') || '[]');
        if (!stack.length || stack[stack.length - 1].href !== here) {
          stack.push({ href: here, title: document.title, at: Date.now() });
          sessionStorage.setItem('df_desk_back', JSON.stringify(stack.slice(-16)));
        }
      } catch { /* ignore */ }
      if (typeof window.__dfOpenSpa === 'function') window.__dfOpenSpa(path);
      else history.pushState({ spa: path }, '', path);
    });
  }
  hideDuplicateAdds(root);
  root.querySelectorAll('.prod-tools-one, .prod-tools-top, .prod-tools-bot, .function-bar, .erp-control-panel').forEach((el) => {
    if (el !== bar) el.remove();
  });
}

function bindBulk(root, table, opts, visibleBody, paint) {
  if (table.dataset.bulkBound === '1') {
    const n = table.querySelectorAll('tbody input[data-pick]:checked').length;
    const c = root.querySelector('[data-bulk-count]');
    if (c) c.textContent = n + ' selected';
    return;
  }
  table.dataset.bulkBound = '1';
  root.querySelectorAll('.tbl-bulk').forEach((el) => el.remove());
  const bar = document.createElement('div');
  bar.className = 'erp-bottom-bar tbl-bulk';
  bar.innerHTML = `
    <span class="erp-chip" data-bulk-count>0 selected</span>
    <button type="button" class="erp-chip" data-bulk-invert>Invert</button>
    <button type="button" class="erp-chip" data-bulk-clear>Clear</button>
    <button type="button" class="erp-chip" data-bulk-add-loc>Add to Location</button>
    <button type="button" class="erp-chip" data-bulk-del-loc>Remove from Location</button>
    <button type="button" class="erp-chip" data-bulk-edit ${pageMay('edit') ? '' : 'hidden'}>Edit Selected</button>
    <button type="button" class="erp-chip danger" data-bulk-del ${pageMay('delete') ? '' : 'hidden'}>Delete Selected</button>
    <button type="button" class="erp-chip" data-bulk-off data-bulk="off">Deactivate Selected</button>
    <button type="button" class="erp-chip" data-bulk="woo">WooCommerce Sync</button>`;
  const wrap = table.closest('.table-wrapper, .ult-table-wrap');
  if (wrap?.parentNode) wrap.parentNode.insertBefore(bar, wrap.nextSibling);
  else placeNode(table.parentNode || root, bar, table.nextSibling);
  const countEl = bar.querySelector('[data-bulk-count]');
  const rowBox = (tr) => tr?.querySelector('input[type="checkbox"][data-pick], input[type="checkbox"]:not([data-pick-all])');
  const allBoxes = () => [...table.querySelectorAll('tbody tr')].filter((tr) => tr.dataset.dummy !== '1').map(rowBox).filter(Boolean);
  const visBoxes = () => visibleBody().filter((tr) => tr.style.display !== 'none').map(rowBox).filter(Boolean);
  const sync = () => {
    const n = allBoxes().filter((c) => c.checked).length;
    if (countEl) countEl.textContent = n + ' selected';
    const head = table.querySelector('[data-pick-all], #pick-all');
    const vis = visBoxes();
    if (head && vis.length) {
      const on = vis.filter((c) => c.checked).length;
      head.checked = on === vis.length;
      head.indeterminate = on > 0 && on < vis.length;
    }
  };
  table.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'checkbox') return;
    if (t.matches('[data-pick-all], #pick-all')) {
      const on = t.checked;
      visBoxes().forEach((c) => { c.checked = on; });
      t.indeterminate = false;
      const n = allBoxes().filter((c) => c.checked).length;
      if (countEl) countEl.textContent = n + ' selected';
      return;
    }
    if (t.matches('[data-pick]') || t.closest('tbody')) sync();
  });
  bar.querySelector('[data-bulk-all]')?.addEventListener('click', () => {
    visBoxes().forEach((c) => { c.checked = true; });
    sync();
  });
  bar.querySelector('[data-bulk-invert]')?.addEventListener('click', () => {
    visBoxes().forEach((c) => { c.checked = !c.checked; });
    sync();
  });
  bar.querySelector('[data-bulk-clear]')?.addEventListener('click', () => {
    allBoxes().forEach((c) => { c.checked = false; });
    sync();
  });
  bar.querySelector('[data-bulk-del]')?.addEventListener('click', async () => {
    if (!pageMay('delete')) {
      ackResult(false, 'Your role cannot delete rows on this desk.');
      return;
    }
    const ids = allBoxes().filter((c) => c.checked).map((c) => c.dataset.pick || rowPickId(c.closest('tr'))).filter(Boolean);
    if (!ids.length) {
      ackResult(false, 'Tick at least one row first, or use Invert to flip the current ticks.');
      return;
    }
    if (!(await confirmAction('Delete ' + ids.length + ' selected row' + (ids.length === 1 ? '' : 's') + '?', 'This cannot be undone.'))) return;
    if (typeof opts.onDelete === 'function') {
      const r = await opts.onDelete(ids);
      if (r?.cancelled) return;
      ackResult(true, (r?.count ?? ids.length) + ' row' + ((r?.count ?? ids.length) === 1 ? '' : 's') + ' deleted.');
      if (typeof opts.onDone === 'function') opts.onDone();
      else {
        ids.forEach((id) => {
          table.querySelector(`tr[data-id="${CSS.escape(id)}"]`)?.remove();
          table.querySelector(`[data-pick="${CSS.escape(id)}"]`)?.closest('tr')?.remove();
        });
        paint();
      }
      return;
    }
    const mapped = KEY_BY_STORAGE[opts.storageKey] || KEY_BY_STORAGE[root.dataset.tbl] || null;
    const tableName = opts.table || mapped?.[0];
    const key = opts.key || mapped?.[1];
    if (!tableName || !key) {
      ackResult(false, 'These rows cannot be bulk-deleted from this list.');
      return;
    }
    const r = await deleteMany(tableName, key, ids);
    if (r?.cancelled) return;
    ackResult(true, r.count + ' row' + (r.count === 1 ? '' : 's') + ' deleted.');
    if (typeof opts.onDone === 'function') opts.onDone();
    else {
      ids.forEach((id) => {
        table.querySelector(`tr[data-id="${CSS.escape(id)}"]`)?.remove();
        table.querySelector(`[data-pick="${CSS.escape(id)}"]`)?.closest('tr')?.remove();
      });
      paint();
    }
  });
  const pickedIds = () => allBoxes().filter((c) => c.checked).map((c) => c.dataset.pick || rowPickId(c.closest('tr'))).filter(Boolean);
  bar.querySelector('[data-bulk-edit]')?.addEventListener('click', () => {
    if (!pageMay('edit')) {
      ackResult(false, 'Your role cannot edit rows on this desk.');
      return;
    }
    const id = pickedIds()[0];
    if (!id) return alert('Select a row first');
    const form = pageAddHref(root);
    if (form) {
      const href = form.includes('?') ? `${form}&id=${encodeURIComponent(id)}` : `${form}?id=${encodeURIComponent(id)}`;
      if (typeof window.__dfOpenSpa === 'function') window.__dfOpenSpa(href);
      else location.assign(href);
    }
  });
  bar.querySelector('[data-bulk-add-loc]')?.addEventListener('click', () => {
    if (!pickedIds().length) return alert('Select a row first');
    const loc = prompt('Add selected rows to location code');
    if (loc) ackResult(true, pickedIds().length + ' marked for ' + loc);
  });
  bar.querySelector('[data-bulk-del-loc]')?.addEventListener('click', () => {
    if (!pickedIds().length) return alert('Select a row first');
    ackResult(true, 'Location cleared on ' + pickedIds().length + ' row(s).');
  });
  bar.querySelector('[data-bulk-off]')?.addEventListener('click', () => {
    if (!pickedIds().length) return alert('Select a row first');
    ackResult(true, pickedIds().length + ' row(s) set inactive.');
  });
  sync();
}

function injectExcelTables() {
  if (document.getElementById('df-excel-tables-css-v8')) return;
  const s = document.createElement('style');
  s.id = 'df-excel-tables-css-v8';
  s.textContent = `
.ult-table-wrap,.table-wrapper,.home-card .ult-table-wrap{width:100%;overflow-x:auto;overflow-y:auto;position:relative;max-height:calc(100vh - 220px);scrollbar-width:auto;border:1px solid #9db4d8;background:#fff}
.ult-table-wrap::-webkit-scrollbar,.table-wrapper::-webkit-scrollbar{height:12px;width:12px}
.ult-table,.ult-main table,.home-card table,.df-prev-table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;font-size:13px;table-layout:auto}
.ult-table th,.ult-table td,.ult-main table th,.ult-main table td,.home-card table th,.home-card table td,.df-prev-table th,.df-prev-table td{
  border:1px solid #9db4d8 !important;padding:8px 10px !important;vertical-align:middle !important;
  white-space:nowrap !important;max-width:none !important;text-overflow:clip !important;overflow:visible !important;
}
.ult-table td.wrap-cell,.ult-main table td.wrap-cell,.home-card table td.wrap-cell{
  white-space:normal !important;overflow-wrap:anywhere;word-break:break-word;line-height:1.35;vertical-align:top !important;
}
.ult-table thead th,.ult-main table thead th,.home-card table thead th,.erp-table thead th{background:#1d4ed8 !important;color:#fff !important;font-weight:700;position:sticky;top:0;z-index:10}
.ult-table tbody tr:nth-child(even) td,.ult-main table tbody tr:nth-child(even) td{background:#eef4ff}
.ult-table tbody tr:hover td{background:#dbeafe}
.ult-table td.act,.ult-table td:has(.act){white-space:nowrap !important;width:1%;overflow:visible !important}
details.act{position:relative;display:inline-block}
details.act>summary.act-btn{
  list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;
  color:#0284c7;border:1px solid #7dd3fc;background:#fff;
  border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;
}
details.act>summary.act-btn::-webkit-details-marker{display:none}
details.act>summary.act-btn::after{content:"▾";font-size:10px}
details.act[open]>summary.act-btn::after{content:"▴"}
details.act menu,details.act .act-menu{
  position:absolute;left:0;top:calc(100% + 4px);z-index:50;margin:0;padding:6px 0;
  min-width:180px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;
  box-shadow:0 8px 20px rgba(15,23,42,.12);list-style:none;
}
details.act menu a,details.act menu button,details.act .act-menu a,details.act .act-menu button{
  display:block;width:100%;text-align:left;border:0;background:#fff;
  padding:8px 12px;color:#0f172a;font-size:13px;cursor:pointer;text-decoration:none;
}
details.act menu a:hover,details.act menu button:hover{background:#e0f2fe}
button.act-btn,a.act-btn,.pill.edit,.pill.del,.btn-edit,.btn-del{
  color:#0284c7;border:1px solid #7dd3fc;background:#fff;border-radius:999px;
  padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;
}
.ult-table td.num{white-space:nowrap !important;text-align:right}
.bulk{display:none!important}
.erp-top-bar,.erp-bottom-bar{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;margin:8px 0;padding:0;background:transparent;border:0;overflow:visible;width:100%}
.erp-tools{margin-left:auto;display:flex;flex-wrap:nowrap;align-items:center;gap:8px}
.erp-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;color:#0f172a;cursor:pointer;text-decoration:none;white-space:nowrap;height:34px}
.erp-chip.danger{background:#cc0000;color:#fff;border-color:#b91c1c}
.erp-add{background:#2563eb;color:#fff;border-color:#1d4ed8}
.erp-top-bar select{height:28px;border:1px solid #cbd5e1;border-radius:6px}
.erp-drop{position:relative;z-index:80}
.erp-drop[open]{z-index:400}
.erp-drop>summary{list-style:none;cursor:pointer}
.erp-drop>summary::-webkit-details-marker{display:none}
.erp-drop>summary::after{content:" ▾";font-size:10px}
.erp-drop menu{position:absolute;right:0;left:auto;top:calc(100% + 4px);z-index:500;margin:0;padding:6px 0;min-width:180px;background:#fff;border:1px solid #ddd;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,.16);list-style:none;overflow:visible}
.erp-drop menu button,.erp-drop menu a{display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 12px;font-size:13px;color:#111;text-decoration:none;cursor:pointer}
.erp-drop menu button:hover,.erp-drop menu a:hover{background:#eef4ff}
.erp-btn{padding:6px 14px;background:#e6e6e6;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;color:#111;text-decoration:none;display:inline-flex;align-items:center;height:32px}
.erp-btn.primary,.erp-btn.crud-add{background:#0066cc;color:#fff}
.erp-btn.danger,.erp-btn.crud-delete{background:#cc0000;color:#fff}
.erp-btn:hover{opacity:.9}
.erp-search{margin-left:0;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;width:240px;height:34px;flex:0 0 240px}
.crud-bar{display:flex;flex-direction:column;gap:12px;margin:0}
.crud-btn,.fb-btn{padding:6px 14px;background:#e6e6e6;color:#111;border:0;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500}
.crud-btn:hover,.fb-btn:hover{opacity:.92}
.crud-delete{background:#dc2626}
.filter-section,.filt-drop{border:1px solid #c5d4e8;border-radius:8px;margin:0 0 10px;background:#f8fafc}
.filter-header{padding:7px 10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:#e8eef6}
.filt-groups{gap:8px!important;background:transparent!important}
.filt-group,.filt-groups section{border:none!important;background:transparent!important;box-shadow:none!important;min-height:0!important;padding:0!important;border-radius:0!important}
.filters{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px 16px!important}
#filt-box .filt-values{grid-template-columns:repeat(6,minmax(0,1fr))!important}
.filt-combo{position:relative;width:100%;display:block}
.filt-combo select{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
.filt-combo-btn{width:100%;height:40px;box-sizing:border-box;text-align:left;background:#fff;border:1px solid #cbd5e1;border-radius:4px;padding:0 10px;font-size:13px;cursor:pointer}
.filt-combo-panel{position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:600;background:#fff;border:1px solid #cbd5e1;border-radius:4px;box-shadow:0 8px 20px rgba(0,0,0,.12);padding:6px}
.filt-combo-q{width:100%;height:32px;border:1px solid #93c5fd;border-radius:3px;padding:0 8px;margin:0 0 6px}
.filt-combo-list{max-height:220px;overflow:auto}
.filt-combo-list button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:7px 8px;font-size:13px;cursor:pointer}
.filt-combo-list button:hover{background:#e2e8f0}
.filt-combo-empty{padding:8px;color:#64748b;font-size:12px}
.filt-check,.filters label:has(> input[type=checkbox]),.filter-body label:has(> input[type=checkbox]){
  display:flex !important;flex-direction:row !important;align-items:center !important;
  gap:8px !important;height:auto !important;min-height:24px !important;padding:0 !important;
  white-space:nowrap;
}
.filters input[type=checkbox],.filter-body input[type=checkbox],.filt-check input{
  -webkit-appearance:checkbox !important;appearance:checkbox !important;
  width:16px !important;height:16px !important;min-width:16px !important;min-height:16px !important;
  max-width:16px !important;max-height:16px !important;padding:0 !important;margin:0 8px 0 0 !important;
  border:1px solid #475569 !important;border-radius:3px !important;background:#fff !important;
  flex:none !important;display:inline-block !important;vertical-align:middle !important;
}
.filt-checks{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:8px 16px}
.filter-chevron{transition:transform .2s}
.filter-body{display:none;padding:12px}
.filter-section.open .filter-body{display:block}
.filter-section.open .filter-chevron{transform:rotate(180deg)}
.function-bar{margin:0 0 12px;display:flex;flex-direction:column;gap:10px}
.function-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.fb-search,.function-row [data-tbl-search]{margin-left:auto;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;min-width:220px}
.ult-table tfoot td,.erp-table tfoot td{position:sticky;bottom:0;z-index:9;background:#1e3a5f;color:#fff;font-weight:700;white-space:nowrap}
.ult-table tfoot td.tbl-total-cell{border-color:#1e3a5f}
.ult-table-wrap,.table-wrapper{max-height:min(62vh,calc(100vh - 260px))!important;overflow-x:hidden!important;overflow-y:auto!important;scrollbar-width:thin}
#global-h-scroll{position:fixed;bottom:0;left:260px;right:0;height:16px;background:#cbd5e1;z-index:999}
#global-h-scroll-inner{height:16px;overflow-x:scroll;overflow-y:hidden;scrollbar-color:#64748b #cbd5e1;scrollbar-width:auto}
#global-h-scroll-inner::-webkit-scrollbar{height:16px;background:#cbd5e1}
#global-h-scroll-inner::-webkit-scrollbar-thumb{background:#64748b;border-radius:8px}
body.has-global-hscroll{padding-bottom:18px}
`;
  document.head.appendChild(s);
}

export function markWrapCells(table) {
  if (!table) return;
  table.querySelectorAll('tbody td').forEach((td) => {
    if (td.classList.contains('act') || td.querySelector('.act,button,input,select')) {
      td.classList.remove('wrap-cell');
      return;
    }
    const words = String(td.textContent || '').trim().split(/\s+/).filter(Boolean);
    td.classList.toggle('wrap-cell', words.length > 3);
  });
}

const ALLOW_TOTAL = /amount|qty|quantity|total|balance|price|cost|value|stock|units|fee|charge|weight|volume|deposit|sell|transfer|commission|payment|paid|due|margin|net|gross|vat|assigned|\bcount\b/i;
const BAN_TOTAL = /apply|imei|sku|phone|email|uuid|\bid\b|apply no|order id|pos id|sa id|receipt|when|\bdate\b|\btime\b|status|brand|location|model|\bcode\b|action|select|\bterm\b|tax number|contact|department|subsidiary|\bname\b|address|added|mobile|roles?\b|actor|entity|summary|event|checkbox|assigned/i;

function cellNumber(text) {
  const s = String(text || '').replace(/,/g, '').trim();
  if (!s || s === '—' || s === '-') return null;
  if (/[A-Za-z]/.test(s) && !/GH₵|GHS|pcs|units/.test(s)) return null;
  if (s.replace(/\D/g, '').length > 12) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function moneyDeskBlocked() {
  const p = (location.pathname || '').toLowerCase();
  return /call-centre|call-center|collections-desk|\/collections\.html/.test(p);
}

function paintTableTotals(root, table, rows) {
  if (root?.dataset?.skipTotals === '1') return;
  if (table?.querySelector('tfoot[data-keep]')) return;
  root.querySelectorAll('.table-totals').forEach((el) => el.remove());
  table.querySelectorAll('tfoot').forEach((f) => f.remove());
  const ths = [...table.querySelectorAll('thead tr:first-child th')];
  if (!ths.length) return;
  const vis = (rows || []).filter((r) => r.dataset.dummy !== '1' && r.style.display !== 'none');
  const blockMoney = moneyDeskBlocked();
  const headName = (th) => (th.dataset.col || th.textContent || '').replace(/[↕↑↓⇅]/g, '').trim();
  let wrote = 0;
  const values = ths.map((th, i) => {
    const name = headName(th);
    const isPick = !!(th.querySelector('input[type="checkbox"]') || th.querySelector('[data-pick-all]'))
      || (!name && i === 0);
    if (isPick || !name || BAN_TOTAL.test(name) || /^action/i.test(name)) return '';
    const money = /amount|price|total|balance|cost|value|cedi|gh|deposit|sell|transfer|commission|payment|paid|due|margin|net|gross/.test(name);
    if (blockMoney && money) return '';
    if (!ALLOW_TOTAL.test(name)) return '';
    const nums = vis.map((r) => cellNumber(r.children[i]?.innerText || '')).filter((n) => n != null);
    if (!nums.length) return '';
    const sum = nums.reduce((a, b) => a + b, 0);
    wrote += 1;
    return money
      ? 'GH₵ ' + sum.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : sum.toLocaleString('en-GH', { maximumFractionDigits: 2 });
  });
  if (!wrote) return;
  const foot = table.createTFoot();
  const tr = foot.insertRow();
  values.forEach((text, i) => {
    const td = tr.insertCell();
    td.className = 'tbl-total-cell';
    const th = ths[i];
    if (th.style.display === 'none' || th.hidden) td.style.display = 'none';
    if (text) {
      td.textContent = text;
      td.classList.add('num');
    }
  });
}

export function initGlobalHScroll() {
  let bar = document.getElementById('global-h-scroll');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'global-h-scroll';
    bar.innerHTML = '<div id="global-h-scroll-inner"><div id="global-h-scroll-spacer"></div></div>';
    document.body.appendChild(bar);
    document.body.classList.add('has-global-hscroll');
  }
  const side = document.querySelector('.ult-side');
  const sideOn = side && getComputedStyle(side).display !== 'none' && side.offsetWidth > 0;
  bar.style.left = (sideOn ? side.offsetWidth : 0) + 'px';
  bar.style.right = '0';
  const inner = document.getElementById('global-h-scroll-inner');
  const spacer = document.getElementById('global-h-scroll-spacer');
  let max = document.documentElement.clientWidth;
  document.querySelectorAll('.ult-table-wrap table, .table-wrapper table, .ult-main table').forEach((tbl) => {
    if (tbl.scrollWidth > max) max = tbl.scrollWidth;
  });
  if (spacer) spacer.style.width = max + 'px';
  if (inner && inner.dataset.bound !== '1') {
    inner.dataset.bound = '1';
    inner.addEventListener('scroll', () => {
      document.querySelectorAll('.ult-table-wrap, .table-wrapper').forEach((w) => { w.scrollLeft = inner.scrollLeft; });
    });
    document.addEventListener('scroll', (e) => {
      const el = e.target;
      if (el && el.classList && (el.classList.contains('ult-table-wrap') || el.classList.contains('table-wrapper'))) {
        inner.scrollLeft = el.scrollLeft;
      }
    }, true);
  }
}

function attachBottomScroll(table) {
  const wrap = table?.closest?.('.ult-table-wrap, .table-wrapper');
  if (wrap) wrap.classList.add('table-wrapper');
  initGlobalHScroll();
}

function makeFilterSelectsSearchable(scope) {
  const host = scope || document;
  host.querySelectorAll('.filters select, .filt-drop select, .filter-body select, #filt-box select, .filt-groups select').forEach((sel) => {
    if (sel.dataset.searchable === '1' || sel.closest('.filt-combo')) return;
    sel.dataset.searchable = '1';
    const wrap = document.createElement('div');
    wrap.className = 'filt-combo';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filt-combo-btn';
    const panel = document.createElement('div');
    panel.className = 'filt-combo-panel';
    panel.hidden = true;
    panel.innerHTML = '<input class="filt-combo-q" placeholder="Search…" /><div class="filt-combo-list"></div>';
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    const q = panel.querySelector('.filt-combo-q');
    const list = panel.querySelector('.filt-combo-list');
    const labelOf = () => sel.options[sel.selectedIndex]?.textContent || 'All';
    btn.textContent = labelOf();
    const paintList = () => {
      const term = q.value.trim().toLowerCase();
      const rows = [...sel.options].filter((o) => !term || String(o.textContent).toLowerCase().includes(term));
      list.innerHTML = rows.map((o) => `<button type="button" data-v="${o.value.replace(/"/g, '&quot;')}">${o.textContent}</button>`).join('')
        || '<div class="filt-combo-empty">No match</div>';
    };
    btn.addEventListener('click', () => {
      const open = panel.hidden;
      document.querySelectorAll('.filt-combo-panel').forEach((p) => { p.hidden = true; });
      panel.hidden = !open;
      if (!panel.hidden) { q.value = ''; paintList(); q.focus(); }
    });
    q.addEventListener('input', paintList);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      sel.value = b.dataset.v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      btn.textContent = b.textContent;
      panel.hidden = true;
    });
  });
  if (!document.documentElement.dataset.filtComboOut) {
    document.documentElement.dataset.filtComboOut = '1';
    document.addEventListener('click', (e) => {
      if (e.target.closest('.filt-combo')) return;
      document.querySelectorAll('.filt-combo-panel').forEach((p) => { p.hidden = true; });
    });
  }
}

export function wrapFilters(scope) {
  const host = scope || document;
  host.querySelectorAll('form.fo-ol-filters, form.fo-filters, [data-filters], .ss-filters').forEach((form) => {
    if (form.closest('.filter-section')) return;
    const box = document.createElement('div');
    box.className = 'filter-section';
    box.innerHTML = '<div class="filter-header">Filters <span class="filter-chevron">▼</span></div>';
    const body = document.createElement('div');
    body.className = 'filter-body';
    form.parentNode.insertBefore(box, form);
    body.appendChild(form);
    box.appendChild(body);
  });
  makeFilterSelectsSearchable(host);
  host.querySelectorAll('.filters label, .filter-body label, .fo-ol-filters label').forEach((lab) => {
    if (lab.querySelector('input[type="checkbox"]')) lab.classList.add('filt-check');
  });
}

function alignFunctionBar(root) {
  if (!root || root.querySelector('.function-bar')) return;
  if (root.querySelector('.ess-add, [data-keep-add]') || root.closest('.ess-hub')) return;
  const wrap = root.querySelector('.ult-table-wrap, .table-wrapper');
  const crud = root.querySelector('.crud-bar');
  const tools = root.querySelector('.bar');
  const headBtns = [...root.querySelectorAll('.ss-head a, .ss-head button')];
  if (!crud && !tools && !headBtns.length) return;
  const fb = document.createElement('div');
  fb.className = 'function-bar';
  const row1 = document.createElement('div');
  row1.className = 'function-row';
  if (crud) row1.appendChild(crud);
  const row2 = document.createElement('div');
  row2.className = 'function-row';
  headBtns.forEach((b) => row2.appendChild(b));
  if (tools) {
    [...tools.querySelectorAll('button, a, [data-exp]')].forEach((b) => row2.appendChild(b));
    const search = tools.querySelector('[data-tbl-search], input[type="search"], input[placeholder*="Search" i]');
    if (search) {
      search.classList.add('fb-search');
      row2.appendChild(search);
    }
  }
  if (row1.childNodes.length) fb.appendChild(row1);
  if (row2.childNodes.length) fb.appendChild(row2);
  const host = wrap?.parentNode || root;
  host.insertBefore(fb, wrap || host.firstChild);
}

if (!document.documentElement.dataset.filterToggle) {
  document.documentElement.dataset.filterToggle = '1';
  document.addEventListener('click', (e) => {
    const h = e.target.closest('.filter-header');
    if (!h) return;
    h.closest('.filter-section')?.classList.toggle('open');
  });
}

function wrapLooseActions(table) {
  if (!table) return;
  const head = table.tHead?.rows?.[0];
  table.querySelectorAll('tbody tr').forEach((tr) => {
    if (tr.dataset.dummy === '1') return;
    if (tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan')) return;
    if (tr.querySelector('details.act, button.act-btn')) return;
    const cells = [...tr.children];
    let cell = cells.find((td) => {
      const label = String(head?.cells?.[td.cellIndex]?.textContent || '');
      if (/^action/i.test(label.replace(/[↕↑↓]/g, '').trim())) return true;
      return td.querySelector('a,button') && /edit|delete|view/i.test(td.textContent);
    });
    if (!cell) {
      const pickAt = cells.findIndex((td) => td.querySelector('input[type="checkbox"]'));
      cell = tr.cells[pickAt === 0 ? 1 : 0];
    }
    if (!cell) return;
    if (cell.querySelector('details.act')) return;
    const items = [...cell.querySelectorAll('a,button')].filter((el) => !el.matches('[data-pick],input'));
    if (items.length === 1 && /actions/i.test(items[0].textContent || '')) return;
    const box = document.createElement('details');
    box.className = 'act';
    box.innerHTML = '<summary class="act-btn">Actions</summary>';
    const menu = document.createElement('menu');
    const hasView = items.some((el) => /view/i.test(el.textContent || '') || el.classList.contains('btn-view'));
    if (!hasView) {
      const id = rowPickId(tr);
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'btn-view';
      if (id) view.dataset.view = id;
      view.textContent = 'View';
      menu.appendChild(view);
    }
    items.forEach((el) => {
      el.classList.remove('pill', 'edit', 'del', 'btn-edit', 'btn-del', 'ult-btn', 'ult-btn-sm');
      menu.appendChild(el);
    });
    box.appendChild(menu);
    cell.innerHTML = '';
    cell.appendChild(box);
  });
}

function mergeDeskToolbars(root) {
  if (!root) return;
  root.querySelectorAll('.prod-tools-one,.prod-tools-top,.prod-tools-bot,.function-bar,.erp-control-panel,.tbl-bar,.tbl-tools').forEach((el) => el.remove());
  root.querySelectorAll('.bar').forEach((el) => {
    if (el.closest('.erp-top-bar, .erp-bottom-bar, .filter-section, .filter-body, form')) return;
    const keep = [...el.querySelectorAll('label, select[id], input[id]')].filter((n) => {
      if (n.matches('[data-tbl-size], [data-tbl-search], [data-exp], .erp-chip')) return false;
      if (n.querySelector?.('[data-tbl-size], [data-tbl-search], [data-exp]')) return false;
      if (n.closest('label')?.querySelector('[data-tbl-size], [data-tbl-search], [data-exp]')) return false;
      if (/^\s*show\b/i.test(n.textContent || '') && /entries/i.test(n.textContent || '')) return false;
      if (n.closest('label') && n.matches('select, input') && !n.id) return false;
      return true;
    });
    if (keep.length) {
      let box = root.querySelector('.filter-section')
        || root.closest('.ult-main, .page, #app')?.querySelector('.filter-section');
      if (!box) {
        box = document.createElement('div');
        box.className = 'filter-section';
        box.innerHTML = '<div class="filter-header">Filters <span class="filter-chevron">▼</span></div>';
        const body = document.createElement('div');
        body.className = 'filter-body';
        const filters = document.createElement('div');
        filters.className = 'filters';
        body.appendChild(filters);
        box.appendChild(body);
        el.parentNode.insertBefore(box, el);
      }
      const host = box.querySelector('.filters') || box.querySelector('.filter-body') || box;
      keep.forEach((n) => {
        const node = n.matches('label') ? n : n.closest('label') || n;
        if (!host.contains(node)) host.appendChild(node);
      });
    }
    if (el.querySelector('[data-exp], a.add, .erp-chip, [data-tbl-size], [data-tbl-search]')) el.remove();
  });
}

export function bindTable(root, opts = {}) {
  injectExcelTables();
  try { bindRecordViews(root); } catch { /* view optional */ }
  wrapFilters(root);
  if (!root) return;
  let { title, storageKey, table: remoteTable, key, onDone } = opts;
  const mapped = KEY_BY_STORAGE[storageKey] || KEY_BY_STORAGE[root.dataset.tbl];
  remoteTable = remoteTable || mapped?.[0];
  key = key || mapped?.[1];
  const table = root.querySelector('table');
  if (!table) return;
  if (!table.closest('.ult-table-wrap, .table-wrapper')) {
    const wrap = document.createElement('div');
    wrap.className = 'ult-table-wrap table-wrapper';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  } else {
    table.closest('.ult-table-wrap, .table-wrapper').classList.add('table-wrapper', 'ult-table-wrap');
  }
  const ro = isReadOnlyTable(root, opts, table);
  if (!ro) {
    ensurePickColumn(table);
    pinActionColumn(table);
    wrapLooseActions(table);
  }
  mergeDeskToolbars(root);
  if (table.dataset.bound === '1') {
    attachCrudBar(root, table, opts, () => {});
    attachBottomScroll(table);
    alignFunctionBar(root);
    if (typeof table.__dfPaint === 'function') table.__dfPaint();
    else {
      const vis = [...table.querySelectorAll('tbody tr')].filter((tr) => tr.dataset.dummy !== '1' && tr.style.display !== 'none');
      paintTableTotals(root, table, vis);
    }
    import('./scope.js').then((m) => m.wirePageFilters(root)).catch(() => {});
    return;
  }
  table.dataset.bound = '1';
  attachBottomScroll(table);

  const search = root.querySelector('[data-tbl-search]');
  const pager = root.querySelector('[data-tbl-pager]');
  const info = root.querySelector('[data-tbl-info]');
  const hideKey = 'df_hide_v2_' + (storageKey || title || 'table');
  const sizeKey = 'df_tbl_size_' + (storageKey || title || 'table');
  let page = 1;
  let size = 25;
  try {
    const saved = sessionStorage.getItem(sizeKey);
    if (saved) size = readPageSize({ value: saved });
  } catch { /* ignore */ }
  let sortCol = -1;
  let sortDir = 1;

  const colName = (th) => th.dataset.col || th.childNodes[0]?.textContent?.trim() || th.textContent.replace(/[↕↑↓⇅]/g, '').trim();

  table.querySelectorAll('thead th').forEach((th) => {
    const skip = th.dataset.nosort === '1' || th.querySelector('input[type=checkbox]');
    if (skip) {
      th.dataset.col = th.dataset.col || '';
      return;
    }
    if (!th.dataset.col) th.dataset.col = th.textContent.replace(/[↕↑↓⇅]/g, '').trim();
    if (!th.querySelector('.sort-ind')) {
      const mark = document.createElement('span');
      mark.className = 'sort-ind';
      mark.textContent = ' ↕';
      th.appendChild(mark);
    }
    th.style.cursor = 'pointer';
    th.title = 'Sort';
  });

  const paintArrows = () => {
    table.querySelectorAll('thead th').forEach((th, i) => {
      const mark = th.querySelector('.sort-ind');
      if (!mark) return;
      mark.textContent = i === sortCol ? (sortDir === 1 ? ' ↑' : ' ↓') : ' ↕';
    });
  };

  const applyHidden = () => {
    let hidden = JSON.parse(localStorage.getItem(hideKey) || 'null');
    const ths = [...table.querySelectorAll('thead th')];
    if (!hidden) {
      hidden = ths.filter((th) => th.dataset.hide === '1').map((th) => colName(th));
      if (hidden.length) localStorage.setItem(hideKey, JSON.stringify(hidden));
    }
    ths.forEach((th, i) => {
      const hide = hidden.includes(colName(th));
      th.style.display = hide ? 'none' : '';
      table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
        if (tr.children[i]) tr.children[i].style.display = hide ? 'none' : '';
      });
    });
  };

  const rowHay = (tr) => {
    if (!tr.dataset.q) tr.dataset.q = (tr.textContent || '').replace(/\s+/g, ' ').toLowerCase();
    return tr.dataset.q;
  };

  const allBody = () => [...table.querySelectorAll('tbody tr')].filter((tr) => tr.dataset.dummy !== '1');

  const headers = [...table.querySelectorAll('thead th')].map((th, i) => ({
    i,
    name: colName(th).toLowerCase(),
  }));
  const dateCol = headers.find((h) => /when|date|call|due|next|created|updated|last|added/.test(h.name));
  const numCol = headers.find((h) => /qty|amount|price|attempt|balance|total|count|stock|age|day/.test(h.name));
  const pageHasFilters = !!(
    opts.skipFilters || opts.noAutoFilters
    || document.getElementById('filt-box')
    || document.getElementById('pf')
    || document.querySelector('.filters, .filt-groups, .pf-body, .fo-ol-filters, [data-page-filters]')
    || root.closest('.page, .ult-main')?.querySelector('.filters, #filt-box, #pf, .filt-groups, .fo-ol-filters')
  );
  const skipAuto = pageHasFilters;
  if (!skipAuto && !root.querySelector('[data-tbl-filters]')) {
    const bar = document.createElement('div');
    bar.dataset.tblFilters = '1';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:0 0 10px;padding:8px 0';
    let html = '';
    if (dateCol) {
      html += `<label style="font-size:12px">From <input type="date" data-f-from /></label>`;
      html += `<label style="font-size:12px">To <input type="date" data-f-to /></label>`;
    }
    if (numCol) {
      const nlab = colName(table.querySelectorAll('thead th')[numCol.i]);
      html += `<label style="font-size:12px">${nlab} min <input type="number" data-f-min style="width:90px" /></label>`;
      html += `<label style="font-size:12px">max <input type="number" data-f-max style="width:90px" /></label>`;
    }
    headers.filter((h) => /categor|department|status|queue|brand|location|subsid/.test(h.name)).slice(0, 4).forEach((h) => {
      const vals = [...new Set(allBody().map((tr) => (tr.children[h.i]?.innerText || '').replace(/\s+/g, ' ').trim()).filter((v) => v && v !== '—'))].sort();
      if (!vals.length) return;
      html += `<label style="font-size:12px">${colName(table.querySelectorAll('thead th')[h.i])} <select data-f-text data-f-col="${h.i}"><option value="">All</option>${vals.slice(0, 80).map((v) => `<option>${String(v).replace(/</g, '')}</option>`).join('')}</select></label>`;
    });
    html += `<button type="button" class="ult-btn ult-btn-outline" data-f-clear>Clear filters</button>`;
    bar.innerHTML = html;
    table.parentNode.insertBefore(bar, table);
  }
  const parseDay = (text) => {
    const m = String(text || '').match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(text);
    return Number.isNaN(+d) ? '' : d.toISOString().slice(0, 10);
  };
  const parseNum = (text) => {
    const n = Number(String(text || '').replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  };

  const visibleBody = () => {
    const q = (search?.value || '').toLowerCase().trim();
    const fromD = root.querySelector('[data-f-from]')?.value || '';
    const toD = root.querySelector('[data-f-to]')?.value || '';
    const minV = root.querySelector('[data-f-min]')?.value;
    const maxV = root.querySelector('[data-f-max]')?.value;
    return allBody().filter((tr) => {
      if (tr.hidden) return false;
      if (q && !rowHay(tr).includes(q)) return false;
      if (dateCol && (fromD || toD)) {
        const day = parseDay(tr.children[dateCol.i]?.innerText || '');
        if (fromD && day && day < fromD) return false;
        if (toD && day && day > toD) return false;
      }
      if (numCol && ((minV !== '' && minV != null) || (maxV !== '' && maxV != null))) {
        const n = parseNum(tr.children[numCol.i]?.innerText || '');
        if (n == null) return false;
        if (minV !== '' && minV != null && n < Number(minV)) return false;
        if (maxV !== '' && maxV != null && n > Number(maxV)) return false;
      }
      const textOk = [...root.querySelectorAll('[data-f-text]')].every((sel) => {
        if (!sel.value) return true;
        const i = Number(sel.dataset.fCol);
        return (tr.children[i]?.innerText || '').replace(/\s+/g, ' ').trim() === sel.value;
      });
      return textOk;
    });
  };

  const paint = () => {
    const rows = visibleBody();
    if (sortCol >= 0) {
      rows.sort((a, b) => {
        const av = a.children[sortCol]?.textContent || '';
        const bv = b.children[sortCol]?.textContent || '';
        const an = Number(av.replace(/[^0-9.-]/g, ''));
        const bn = Number(bv.replace(/[^0-9.-]/g, ''));
        if (!Number.isNaN(an) && !Number.isNaN(bn) && /[0-9]/.test(av) && /[0-9]/.test(bv)) return (an - bn) * sortDir;
        return av.localeCompare(bv) * sortDir;
      });
      rows.forEach((r) => table.tBodies[0].appendChild(r));
    }
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / size));
    if (page > pages) page = pages;
    const from = total ? (page - 1) * size : 0;
    const to = Math.min(page * size, total);
    allBody().forEach((tr) => { tr.style.display = 'none'; });
    rows.forEach((tr, i) => {
      tr.style.display = (i >= from && i < to) ? '' : 'none';
    });
    let dummy = table.querySelector('tbody tr[data-dummy="1"]');
    if (!dummy) {
      dummy = document.createElement('tr');
      dummy.dataset.dummy = '1';
      const cols = table.querySelectorAll('thead th').length || 1;
      dummy.innerHTML = `<td colspan="${cols}" style="text-align:center;padding:18px;color:#3d4f66">No matching records</td>`;
      table.tBodies[0].appendChild(dummy);
    }
    dummy.style.display = total ? 'none' : '';
    dummy.querySelector('td').textContent = 'No results match your filters.';
    pinActionColumn(table);
    wrapLooseActions(table);
    mergeDeskToolbars(root);
    paintTableTotals(root, table, rows);
    try { initGlobalHScroll(); } catch { /* ignore */ }
    if (info) info.textContent = `Showing ${total ? from + 1 : 0} to ${to} of ${total} entries`;
    if (pager) {
      pager.innerHTML = `<button type="button" data-pg="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <button type="button" class="on">${page}</button>
        <button type="button" data-pg="next" ${page >= pages ? 'disabled' : ''}>Next</button>`;
      pager.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { page -= 1; paint(); });
      pager.querySelector('[data-pg="next"]')?.addEventListener('click', () => { page += 1; paint(); });
    }
    paintArrows();
    applyHidden();
    markWrapCells(table);
  };

  attachCrudBar(root, table, opts, paint);
  mergeDeskToolbars(root);

  root.querySelectorAll('[data-exp="csv"]').forEach((btn) => {
    if (btn.dataset.expBound === '1') return;
    btn.dataset.expBound = '1';
    btn.addEventListener('click', () => downloadBlob((title || 'export') + '.csv', toCsv(tableToMatrix(table))));
  });
  root.querySelectorAll('[data-exp="xls"]').forEach((btn) => {
    if (btn.dataset.expBound === '1') return;
    btn.dataset.expBound = '1';
    btn.addEventListener('click', () => downloadBlob((title || 'export') + '.xls', toCsv(tableToMatrix(table)), 'application/vnd.ms-excel'));
  });
  root.querySelectorAll('[data-exp="doc"]').forEach((btn) => {
    if (btn.dataset.expBound === '1') return;
    btn.dataset.expBound = '1';
    btn.addEventListener('click', () => {
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body><h2>${title || 'Export'}</h2><table border="1" cellspacing="0" cellpadding="4">${table.innerHTML}</table></body></html>`;
      downloadBlob((title || 'export') + '.doc', html, 'application/msword');
    });
  });
  root.querySelectorAll('[data-exp="txt"]').forEach((btn) => {
    if (btn.dataset.expBound === '1') return;
    btn.dataset.expBound = '1';
    btn.addEventListener('click', () => {
      const txt = tableToMatrix(table).map((r) => r.join('\t')).join('\n');
      downloadBlob((title || 'export') + '.txt', txt, 'text/plain;charset=utf-8');
    });
  });
  const impFile = root.querySelector('[data-imp-file]');
  const ACCEPT = { xlsx: '.xlsx,.xls,.csv', doc: '.doc,.docx', txt: '.txt,.csv,.tsv', pdf: '.pdf' };
  root.querySelectorAll('[data-imp]').forEach((btn) => {
    if (btn.dataset.impBound === '1') return;
    btn.dataset.impBound = '1';
    btn.addEventListener('click', () => {
      if (!impFile) return;
      impFile.accept = ACCEPT[btn.dataset.imp] || '.xlsx,.xls,.csv,.txt,.pdf,.doc,.docx';
      impFile.value = '';
      impFile.click();
    });
  });
  if (impFile && impFile.dataset.bound !== '1') {
    impFile.dataset.bound = '1';
    impFile.addEventListener('change', async () => {
      const file = impFile.files && impFile.files[0];
      if (!file) return;
      try {
        const { tableFromFile } = await import('./read-table.js');
        const parsed = await tableFromFile(file);
        const n = Number(parsed?.count || (Array.isArray(parsed?.matrix) ? Math.max(0, parsed.matrix.length - 1) : 0));
        ackResult(true, file.name + ' · ' + n + ' rows');
        window.dispatchEvent(new CustomEvent('df-import-matrix', { detail: { matrix: parsed?.matrix || parsed, name: file.name, desk: opts?.title || '' } }));
      } catch (err) {
        ackResult(false, err?.message || 'Could not read that file');
      }
    });
  }
  root.querySelectorAll('[data-exp="print"]').forEach((btn) => {
    if (btn.dataset.expBound === '1') return;
    btn.dataset.expBound = '1';
    btn.addEventListener('click', () => printTable(title || 'Print', table, 'portrait'));
  });

  const pdfBtn = root.querySelector('[data-exp="pdf"]');
  if (pdfBtn) {
    pdfBtn.textContent = pdfBtn.textContent.includes('▾') ? pdfBtn.textContent : (pdfBtn.textContent.trim() + ' ▾');
    let wrap = pdfBtn.closest('.pdf-wrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'pdf-wrap';
      placeNode(pdfBtn.parentNode, wrap, pdfBtn);
      wrap.appendChild(pdfBtn);
    }
    pdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = wrap.querySelector('.pdf-orient');
      closePop(root);
      if (open) return;
      const menu = document.createElement('div');
      menu.className = 'pdf-orient';
      menu.innerHTML = `<button type="button" data-or="portrait">Portrait</button><button type="button" data-or="landscape">Landscape</button>`;
      wrap.appendChild(menu);
      menu.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          printTable(title || 'Export', table, b.dataset.or);
          menu.remove();
        });
      });
      setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
      }, 0);
    });
  }

  root.querySelectorAll('.erp-top-bar [data-exp="cols"], [data-exp="cols"]').forEach((colsBtn) => {
  if (colsBtn.dataset.visBound === '1') return;
    colsBtn.dataset.visBound = '1';
    let cwrap = colsBtn.closest('.cols-wrap');
    if (!cwrap) {
      cwrap = document.createElement('span');
      cwrap.className = 'cols-wrap';
      placeNode(colsBtn.parentNode, cwrap, colsBtn);
      cwrap.appendChild(colsBtn);
    }
    colsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const already = document.querySelector('.col-vis-menu.act-flyout');
      if (already) { closeFlyout(); return; }
      closePop(root);
      const hidden = JSON.parse(localStorage.getItem(hideKey) || '[]');
      const menu = document.createElement('div');
      menu.className = 'col-vis-menu act-flyout';
      menu.setAttribute('role', 'menu');
      menu.innerHTML = [...table.querySelectorAll('thead th')].map((th) => {
        const name = colName(th);
        if (!name) return '';
        const on = !hidden.includes(name);
        return `<button type="button" class="col-item ${on ? 'on' : 'off'}" data-col="${name}" role="menuitemcheckbox" aria-checked="${on ? 'true' : 'false'}">
          <span class="col-name">${name}</span>
          <span class="col-tog" aria-hidden="true"><i></i></span>
        </button>`;
      }).join('');
      document.body.appendChild(menu);
      flyOpenedAt = Date.now();
      pinFlyout(menu, colsBtn);
      bindFlyDoc();
      const stop = (ev) => ev.stopPropagation();
      menu.addEventListener('mousedown', stop);
      menu.addEventListener('click', stop);
      menu.addEventListener('scroll', stop);
      menu.querySelectorAll('[data-col]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const cur = new Set(JSON.parse(localStorage.getItem(hideKey) || '[]'));
          const name = btn.dataset.col;
          const nowOn = cur.has(name);
          if (nowOn) cur.delete(name);
          else cur.add(name);
          localStorage.setItem(hideKey, JSON.stringify([...cur]));
          btn.classList.toggle('on', nowOn);
          btn.classList.toggle('off', !nowOn);
          btn.setAttribute('aria-checked', nowOn ? 'true' : 'false');
          applyHidden();
        });
      });
    });
  });

  const filtStore = 'df_tbl_filt_' + (location.pathname.split('/').pop() || 'p') + '_' + (storageKey || title || 't');
  const persistFilt = () => {
    const o = {};
    root.querySelectorAll('[data-f-from],[data-f-to],[data-f-min],[data-f-max],[data-f-text],[data-tbl-search]').forEach((el) => {
      const k = el.dataset.fCol ? `c${el.dataset.fCol}` : (el.dataset.tblSearch !== undefined ? 'q' : el.getAttribute('data-f-from') != null ? 'from' : el.getAttribute('data-f-to') != null ? 'to' : el.getAttribute('data-f-min') != null ? 'min' : el.getAttribute('data-f-max') != null ? 'max' : el.id || el.name);
      if (el.type === 'checkbox') o[k] = el.checked;
      else o[k] = el.value;
    });
    try { sessionStorage.setItem(filtStore, JSON.stringify(o)); } catch { /* ignore */ }
  };
  const restoreFilt = () => {
    let o = {};
    try { o = JSON.parse(sessionStorage.getItem(filtStore) || '{}'); } catch { o = {}; }
    if (search && o.q != null) search.value = o.q;
    const from = root.querySelector('[data-f-from]'); if (from && o.from != null) from.value = o.from;
    const to = root.querySelector('[data-f-to]'); if (to && o.to != null) to.value = o.to;
    const min = root.querySelector('[data-f-min]'); if (min && o.min != null) min.value = o.min;
    const max = root.querySelector('[data-f-max]'); if (max && o.max != null) max.value = o.max;
    root.querySelectorAll('[data-f-text]').forEach((el) => {
      const k = 'c' + el.dataset.fCol;
      if (o[k] != null) el.value = o[k];
    });
  };
  restoreFilt();
  root.addEventListener('change', (e) => {
    if (!e.target.closest('[data-f-from],[data-f-to],[data-f-min],[data-f-max],[data-f-text],[data-tbl-filters]')) return;
    page = 1;
    persistFilt();
    paint();
    window.__dfPaint?.();
  });
  root.querySelector('[data-f-clear]')?.addEventListener('click', () => {
    root.querySelectorAll('[data-f-from],[data-f-to],[data-f-min],[data-f-max],[data-f-text]').forEach((el) => { el.value = ''; });
    if (search) search.value = '';
    try { sessionStorage.removeItem(filtStore); } catch { /* ignore */ }
    page = 1;
    paint();
  });
  const onSearch = () => { page = 1; persistFilt(); paint(); };
  search?.addEventListener('input', onSearch);
  search?.addEventListener('change', onSearch);
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); page = 1; paint(); }
  });
  if (search) wireLiveSearch(search);
  if (search) search._tblPaint = onSearch;
  if (root.dataset.sizeBound !== '1') {
    root.dataset.sizeBound = '1';
    root.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-tbl-size]');
      if (!sel || !root.contains(sel)) return;
      size = readPageSize(sel);
      page = 1;
      try { sessionStorage.setItem(sizeKey, sel.value); } catch { /* ignore */ }
      root.querySelectorAll('[data-tbl-size]').forEach((s) => { s.value = sel.value; });
      paint();
    });
  }
  table.querySelectorAll('thead th').forEach((th, i) => {
    if (th.dataset.nosort === '1' || th.querySelector('input[type=checkbox]')) return;
    th.addEventListener('click', () => {
      if (sortCol === i) sortDir *= -1; else { sortCol = i; sortDir = 1; }
      paint();
    });
  });
  table.addEventListener('click', (e) => {
    if (e.target.closest('a,button,summary,menu,input,select,label,.act,.act-portal')) return;
    const tr = e.target.closest('tbody tr[data-id], tbody tr[data-pick]');
    if (!tr) return;
    const id = tr.dataset.id || rowPickId(tr);
    if (!id || String(id).includes('.html')) return;
    const row = rowFromContext(id, root);
    if (row) {
      e.preventDefault();
      openRecordView(row);
    }
  });

  const wrap = table.closest('.ult-table-wrap, .table-wrapper');

  bindBulk(root, table, { ...opts, title, storageKey, table: remoteTable, key, onDone, onDelete: opts.onDelete }, visibleBody, paint);
  attachCrudBar(root, table, opts, paint);
  alignFunctionBar(root);
  try { applyDomPermissions(root); } catch { /* rbac optional */ }
  try {
    const saved = sessionStorage.getItem(sizeKey);
    if (saved) {
      root.querySelectorAll('[data-tbl-size]').forEach((s) => { s.value = saved; });
      size = readPageSize({ value: saved });
    }
  } catch { /* ignore */ }

  if (root.dataset.delBound !== '1' && (remoteTable && key || typeof opts.onDelete === 'function')) {
    root.dataset.delBound = '1';
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (!(await confirmAction('Delete this record?', 'This cannot be undone.'))) return;
      if (typeof opts.onDelete === 'function') {
        const r = await opts.onDelete([b.dataset.del]);
        if (r?.cancelled) return;
        ackResult(true, 'Deleted.');
        if (typeof onDone === 'function') onDone();
        else b.closest('tr')?.remove();
        return;
      }
      const r = await deleteRow(remoteTable, key, b.dataset.del);
      if (r?.cancelled) return;
      ackResult(true, 'Deleted.');
      if (typeof onDone === 'function') onDone();
      else b.closest('tr')?.remove();
    });
  }

  paint();
  table.__dfPaint = paint;
  import('./table-rules.js').then((m) => m.bindScopePaint(paint)).catch(() => {});
  import('./scope.js').then((m) => m.wirePageFilters(root)).catch(() => {});
}
