/**
 * Field Ops color-coded module — right-pane headings, no left submenu.
 * Field Ops desk — lives inside the ERP. No public site publish.
 */
import { esc, loadRows, actMenu, deleteRow, readLs, isTombstoned } from './ls-rows.js';
import { KEYS, isDemoRecord } from './catalog-seed.js';
import { hubTabs, bindHubTabs, goFile, svgIco, maybePaintNest, resolveHubTab, nestsFor, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import {
  getActiveAgent, fetchAgentsForScope, isBnplFieldScope, SCOPE_EVENT,
  BNPL_FIELD_LOCATION, FIELD_STOCK_HUB_CODE, findLocation, clearAgentCache,
} from './scope.js';
import { skuReachedFieldSales } from './sku-lifecycle.js';
import { loadBizSettings, fieldOpsAllowed, fieldOpsOpenBooks, FIELD_OPS_FLOWS, MODULES_CHANGED } from './settings-store.js';
import { publishPublicSnapshot, readPublicSnapshot, publicAge, readJoinLeads, deleteJoinLead } from './field-ops-sync.js';
import { paintOrderList, loadOrders, uniqueCustomers, uniqueAgents } from './bnpl-field-orders.js';
import { paintPaymentRecord, paintMasterBook, loadPayments } from './bnpl-field-payments.js';
import { paintHpStock } from './bnpl-field-phones.js';
import { paintWorkbookHub, floorWorkbookStrip, ensureHpWorkbooks } from './hp-workbooks.js';
import { ensureHpOpsFlow } from './hp-ops-flow.js';
import { bindTable } from './home-tables.js';
import { deskHow } from './desk-manual.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { listHandoffs, setHandoffStatus, gradeBadge } from './collection-ops.js';

const FILE = '/field-ops.html';
const TABS = [
  { key: 'floor', label: 'Floor' },
  { key: 'orders', label: 'Order List' },
  { key: 'payments', label: 'Payment Record' },
  { key: 'master', label: 'HP Book' },
  { key: 'books', label: 'Workbooks' },
  { key: 'visits', label: 'Visits' },
  { key: 'agents', label: 'Agents' },
  { key: 'join', label: 'Join' },
  { key: 'stock', label: 'Stock Hub' },
  { key: 'collect', label: 'Collections' },
  { key: 'sync', label: 'Sync' },
];
const BRAND = `${svgIco('people') || '🤝'} Field Ops`;

function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'floor';
  return resolveHubTab(t, TABS, 'floor', nestsFor(FILE));
}
function go(t) { goFile(FILE, (!t || t === 'floor') ? '' : t); paint(); }
function nav(on) { return floorNav(BRAND, on, 'floor', FILE); }

function isFieldRow(row) {
  const loc = String(row?.location_code || '').toUpperCase();
  const sub = String(row?.subsidiary_code || '').toLowerCase();
  return loc === BNPL_FIELD_LOCATION || loc === FIELD_STOCK_HUB_CODE || sub === 'bnpl';
}

function live(row, table, key) {
  if (!row || isDemoRecord(row)) return false;
  if (isTombstoned(table, row) || isTombstoned(key, row)) return false;
  return true;
}

let _cache = null;
async function loadState() {
  try {
    const { hydratePinaroAtBnpl } = await import('./paper-purchase.js');
    hydratePinaroAtBnpl();
  } catch { /* paper invoice optional */ }
  const biz = await loadBizSettings();
  const allow = (id) => fieldOpsAllowed(biz, id);
  const agentId = getActiveAgent();
  const [remoteAgents, customers, visits, products, orders, payments] = await Promise.all([
    allow('field_flow_agents') ? fetchAgentsForScope('bnpl', BNPL_FIELD_LOCATION) : Promise.resolve([]),
    allow('field_flow_customers') ? loadRows('customers', KEYS.customers, []) : Promise.resolve([]),
    allow('field_flow_visits') ? loadRows('visits', 'df_visits', []) : Promise.resolve([]),
    (allow('field_flow_products') || allow('field_flow_stock')) ? loadRows('products', KEYS.products, []) : Promise.resolve([]),
    loadOrders().catch(() => []),
    loadPayments().catch(() => []),
  ]);
  const localAgents = (readLs(KEYS.agents, []) || []).filter((a) => live(a, 'sales_commission_agents', KEYS.agents));
  const byId = new Map();
  [...localAgents, ...(remoteAgents || [])].forEach((a) => {
    if (!live(a, 'sales_commission_agents', KEYS.agents)) return;
    byId.set(String(a.id), a);
  });
  const agents = [...byId.values()];
  const fieldCustomers = (customers || []).filter(isFieldRow).filter((c) => live(c, 'customers', KEYS.customers))
    .filter((c) => !agentId || String(c.assigned_to || c.agent_id || '') === String(agentId));
  const bookCust = uniqueCustomers(orders);
  const bookAg = uniqueAgents(orders, payments);
  const custPhones = new Set(fieldCustomers.map((c) => String(c.mobile || c.phone || '').replace(/\D/g, '')).filter(Boolean));
  const mergedCustomers = [
    ...fieldCustomers,
    ...bookCust.filter((c) => {
      const d = String(c.phone || '').replace(/\D/g, '');
      return !d || !custPhones.has(d);
    }),
  ];
  const shownAgents = agentId ? agents.filter((a) => String(a.id) === String(agentId)) : agents;
  const agentNames = new Set(shownAgents.map((a) => String(a.full_name || a.name || '').trim().toLowerCase()).filter(Boolean));
  const agentIds = new Set(shownAgents.map((a) => String(a.sa_id || a.id || '').toUpperCase()).filter(Boolean));
  const mergedAgents = [
    ...shownAgents,
    ...bookAg.filter((a) => {
      const n = String(a.full_name || '').toLowerCase();
      const id = String(a.sa_id || '').toUpperCase();
      return !agentNames.has(n) && !(id && agentIds.has(id));
    }),
  ];
  const fieldVisits = (visits || []).filter((v) => live(v, 'visits', 'df_visits'))
    .filter((v) => !v.location_code || String(v.location_code).toUpperCase() === BNPL_FIELD_LOCATION);
  const hubStock = (products || []).filter((p) => live(p, 'products', KEYS.products)).filter((p) =>
    String(p.location_code || '').toUpperCase() === FIELD_STOCK_HUB_CODE
    || skuReachedFieldSales(p));
  const state = {
    biz, allow, open: fieldOpsOpenBooks(biz),
    agents: mergedAgents, allAgents: mergedAgents,
    customers: mergedCustomers,
    visits: fieldVisits,
    stock: hubStock,
    on: isBnplFieldScope(),
    bookCount: (orders || []).length,
  };
  _cache = state;
  publishPublicSnapshot({
    agents: mergedAgents.map((a) => ({
      id: a.id, name: a.full_name || a.name, phone: a.phone || a.mobile || '',
    })),
    customers: mergedCustomers.slice(0, 40).map((c) => ({
      id: c.id, name: c.name || c.full_name || c.business_name, phone: c.mobile || c.phone || '',
    })),
    visits: fieldVisits.slice(0, 20).map((v) => ({
      id: v.id, date: v.visit_date, place: v.customer_name || v.place, status: v.status,
    })),
    stock_hub: hubStock.slice(0, 20).map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    open_books: state.open.map((f) => f.label),
  });
  return state;
}

function closedNote(id) {
  const spec = FIELD_OPS_FLOWS.find((f) => f.id === id);
  return `<p class="fo-empty">Not released to Field Ops. Tick <b>${esc(spec?.label || id)}</b> in Settings → Field Ops.</p>`;
}

function barHtml() {
  return `<div class="bar">
    <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
    <div class="grow"></div>
    <button type="button" data-exp="csv">Export CSV</button>
    <button type="button" data-exp="xls">Export Excel</button>
    <button type="button" data-exp="print">Print</button>
    <input data-tbl-search placeholder="Search …" />
  </div>
  <div class="tbl-bulk">
    <span class="tbl-bulk-count" data-bulk-count>0 selected</span>
    <button type="button" data-bulk-all>Select all</button>
    <button type="button" data-bulk-invert>Invert</button>
    <button type="button" class="tbl-bulk-del" data-bulk-del>Delete selected</button>
    <button type="button" data-bulk-clear>Clear</button>
  </div>`;
}

function wrapTable(key, title, addHref, addLabel, thead, body, emptyCols) {
  return `<div class="home-card fo-split-card" data-tbl="${key}">
    <div class="head" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <h2 style="margin:0;font-size:16px">${esc(title)}</h2>
      ${addHref ? `<a class="ult-btn ult-btn-primary" href="${addHref}">${esc(addLabel)}</a>` : ''}
    </div>
    ${barHtml()}
    <div class="ult-table-wrap"><table class="ult-table">
      <thead>${thead}</thead>
      <tbody>${body || `<tr data-dummy="1"><td colspan="${emptyCols}">No data available in table</td></tr>`}</tbody>
    </table></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:6px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
  </div>`;
}

function paintFloor(app, s) {
  const agentRows = s.agents.map((a) => `<tr data-id="${esc(a.id)}">
    <td>${a.source === 'acm'
      ? actMenu(a.id, [{ href: '/field-ops.html?tab=orders', label: 'Orders' }])
      : actMenu(a.id, [
          { href: `/commission-agent-edit.html?id=${a.id}&view=1`, label: 'View' },
          { href: `/commission-agent-edit.html?id=${a.id}`, label: 'Edit' },
          { act: 'del', label: 'Delete' },
        ])}</td>
    <td>${esc(a.full_name || a.name || 'Agent')}${a.n ? ` <span class="ult-muted">(${a.n})</span>` : ''}</td>
    <td>${esc(a.phone || a.mobile || a.email || '')}</td>
  </tr>`).join('');
  const custRows = s.customers.map((c) => `<tr data-id="${esc(c.id)}">
    <td>${c.source === 'acm'
      ? actMenu(c.id, [
          { href: '/field-ops.html?tab=orders', label: 'Order List' },
          ...(c.phone ? [{ href: `tel:${c.phone}`, label: 'Call' }] : []),
        ])
      : actMenu(c.id, [
          { href: `/customer-form.html?id=${c.id}&view=1`, label: 'View' },
          { href: `/customer-form.html?id=${c.id}`, label: 'Edit' },
          { act: 'del', label: 'Delete' },
        ])}</td>
    <td><a href="#" data-trail="${esc(c.mobile || c.phone)}">${esc(c.name || c.full_name || c.business_name || 'Customer')}</a></td>
    <td>${c.phone || c.mobile ? `<a href="tel:${esc(c.mobile || c.phone)}">${esc(c.mobile || c.phone)}</a>` : ''}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('floor')}
    ${deskHow('field-floor')}
    ${s.bookCount ? `<p class="sub">${s.customers.length} customers · ${s.agents.length} SAs · ${s.bookCount} contracts</p>` : ''}
    ${s.bookCount ? `<div class="fo-int">
      <div class="fo-int-head">
        <h2>Workbook integrations</h2>
        <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=books">All workbooks</a>
        <a class="ult-btn ult-btn-outline" href="/spreadsheet.html?sheet=s-hp-orders">Spreadsheet</a>
      </div>
      ${floorWorkbookStrip()}
    </div>` : ''}
    <div class="wms-grid" style="margin:12px 0 16px">
      <a class="wms-card" href="/field-ops.html?tab=orders" data-htab="orders"><strong>Order List</strong><b>${s.bookCount || 0}</b></a>
      <a class="wms-card" href="/field-ops.html?tab=payments" data-htab="payments"><strong>Payment Record</strong><b>—</b></a>
      <a class="wms-card" href="/field-ops.html?tab=master" data-htab="master"><strong>HP Book</strong><b>${s.bookCount || 0}</b></a>
      <a class="wms-card" href="/field-ops.html?tab=books" data-htab="books"><strong>Workbooks</strong><b>—</b></a>
      <a class="wms-card" href="/field-ops.html?tab=visits" data-htab="visits"><strong>Visits</strong><b>${s.visits.length}</b></a>
      <a class="wms-card" href="/field-ops.html?tab=collect" data-htab="collect"><strong>Collections</strong><b>${listHandoffs().length}</b></a>
      <a class="wms-card" href="/field-ops.html?tab=stock" data-htab="stock"><strong>Stock Hub</strong><b>${(s.stock && s.stock.length) || '—'}</b></a>
      <a class="wms-card" href="/collections-desk.html"><strong>Easybuy desk</strong><b>→</b></a>
    </div>
    <div class="fo-board">
      <section class="fo-col">
        ${!s.allow('field_flow_agents') && !s.agents.length ? `<h2>Agents</h2>${closedNote('field_flow_agents')}`
          : wrapTable('fo-agents', 'Agents', '/commission-agent-edit.html', '+ Agent',
            '<tr><th data-nosort="1">Action</th><th>Name</th><th>Phone</th></tr>',
            agentRows, 3)}
      </section>
      <div class="fo-hand" aria-hidden="true">🤝</div>
      <section class="fo-col">
        ${!s.allow('field_flow_customers') && !s.customers.length ? `<h2>Customers</h2>${closedNote('field_flow_customers')}`
          : wrapTable('fo-customers', 'Customers', '/customer-form.html', '+ Customer',
            '<tr><th data-nosort="1">Action</th><th>Name</th><th>Phone</th></tr>',
            custRows, 3)}
      </section>
    </div>`;
}

function paintVisits(app, s) {
  const rows = s.visits.map((v) => `<tr data-id="${esc(v.id)}">
    <td>${actMenu(v.id, [
      { href: `/visit-form.html?id=${v.id}&view=1`, label: 'View' },
      { href: `/visit-form.html?id=${v.id}`, label: 'Edit' },
      { act: 'del', label: 'Delete' },
    ])}</td>
    <td>${esc(String(v.visit_date || '').slice(0, 10))}</td>
    <td>${esc(v.agent_name || '—')}</td>
    <td>${esc(v.customer_name || v.place || '')}</td>
    <td>${esc(v.status || '')}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('visits')}
    ${deskHow('field-floor')}
    ${!s.allow('field_flow_visits') ? closedNote('field_flow_visits')
      : wrapTable('fo-visits', 'Visits', '/visit-form.html', '+ Visit',
        '<tr><th data-nosort="1">Action</th><th>Date</th><th>Agent</th><th>Place</th><th>Status</th></tr>',
        rows, 5)}`;
}

function paintAgents(app, s) {
  const money = (n) => Number(n || 0).toLocaleString('en-GH');
  const rows = (s.allAgents || []).map((a) => `<tr data-id="${esc(a.id)}">
    <td>${a.source === 'acm'
      ? actMenu(a.id, [{ href: '/field-ops.html?tab=orders', label: 'Order List' }, { href: '/field-ops.html?tab=payments', label: 'Payment Record' }])
      : actMenu(a.id, [
          { href: `/commission-agent-edit.html?id=${a.id}&view=1`, label: 'View' },
          { href: `/commission-agent-edit.html?id=${a.id}`, label: 'Edit' },
          { act: 'del', label: 'Delete' },
        ])}</td>
    <td><strong>${esc(a.full_name || a.name || '')}</strong></td>
    <td class="fo-mono">${esc(a.sa_id || '—')}</td>
    <td>${esc(a.pos_name || '—')}</td>
    <td class="fo-mono">${esc(a.pos_id || '—')}</td>
    <td>${esc(a.phone || a.mobile || '—')}</td>
    <td class="fo-num">${a.n || 0}</td>
    <td class="fo-num">${a.n_pays || 0}</td>
    <td class="fo-num">${a.transfer ? money(a.transfer) : '—'}</td>
    <td class="fo-num">${a.commission ? '₵' + money(a.commission) : (a.commission_percent != null ? esc(a.commission_percent) + '%' : '—')}</td>
    <td>${esc(String(a.last_at || '').slice(0, 10) || '—')}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('agents')}
    ${deskHow('field-floor')}
    ${wrapTable('fo-agents', 'Agents', '/commission-agent-edit.html', '+ Agent',
      '<tr><th data-nosort="1">Action</th><th>Name</th><th>SA ID</th><th>POS</th><th>POS ID</th><th>Phone</th><th>Contracts</th><th>Payments</th><th>Fiberk sell</th><th>SA ₵100</th><th>Last</th></tr>',
      rows, 11)}`;
}

function paintJoin(app) {
  const leads = readJoinLeads();
  const rows = leads.map((r) => `<tr data-id="${esc(r.id)}">
    <td>${actMenu(r.id, [
      { href: r.interest === 'customer' ? `/customer-form.html?from_lead=${r.id}` : `/commission-agent-edit.html?from_lead=${r.id}`, label: 'Convert' },
      { act: 'del', label: 'Delete' },
    ])}</td>
    <td>${esc(String(r.created_at || '').slice(0, 16).replace('T', ' '))}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.phone)}</td>
    <td>${esc(r.area)}</td>
    <td>${esc(r.interest === 'customer' ? 'Hire purchase' : 'Agent')}</td>
    <td>${esc(r.note || '')}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('join')}
    ${deskHow('field-floor')}
    ${wrapTable('fo-join', 'Join applications', '', '',
      '<tr><th data-nosort="1">Action</th><th>When</th><th>Name</th><th>Phone</th><th>Area</th><th>Interest</th><th>Note</th></tr>',
      rows, 7)}`;
}

function paintStock(app, s) {
  return paintHpStock(app, { navHtml: nav('stock'), liveStock: s.stock || [] });
}

function paintCollect(app) {
  const hs = listHandoffs();
  const rows = hs.map((h) => `<tr data-id="${esc(h.id)}">
    <td>${esc(String(h.at || '').slice(0, 16).replace('T', ' '))}</td>
    <td><a href="/collections-desk.html">${esc(h.name)}</a></td>
    <td>${esc(h.phone || '')}</td>
    <td>${gradeBadge(h.grade)}</td>
    <td>${esc(h.from_desk || '')}</td>
    <td>${esc(h.note || '')}</td>
    <td>${esc(h.status)}</td>
    <td>${h.status === 'open' ? `<a href="#" data-hand="${esc(h.id)}" data-st="accepted">Accept</a>`
      : h.status === 'accepted' ? `<a href="#" data-hand="${esc(h.id)}" data-st="done">Complete</a>`
      : ''}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('collect')}
    ${deskHow('field-floor')}
    ${wrapTable('fo-collect', 'Collection handoffs', '/call-centre.html?pane=field', 'Open Call Centre',
      '<tr><th>When</th><th>Customer</th><th>Phone</th><th>Grade</th><th>From</th><th>Note</th><th>Status</th><th></th></tr>',
      rows, 8)}`;
  app.querySelectorAll('[data-hand]').forEach((el) => {
    el.onclick = async (e) => {
      e.preventDefault();
      const st = el.dataset.st;
      if (!(await confirmAction(st === 'accepted' ? 'Accept this handoff?' : 'Mark the field visit complete?'))) return;
      setHandoffStatus(el.dataset.hand, st);
      ackResult(true, st === 'accepted' ? 'Handoff accepted.' : 'Field visit completed.');
      paint();
    };
  });
}

function paintSync(app, s) {
  const agents = (s.agents || []).length;
  const customers = (s.customers || []).length;
  const visits = (s.visits || []).length;
  app.innerHTML = `
    ${nav('sync')}
    <div class="st-card">
      <h3 style="margin:0 0 8px">Field Ops books</h3>
      <p>Agents ${agents} · Customers ${customers} · Visits ${visits}.</p>
      <p>Open books: ${s.open.map((f) => esc(f.label)).join(', ') || 'none'}.</p>
      <p><a class="ult-btn ult-btn-primary" href="/field-ops.html">Open Field Ops</a>
         <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=agents">Agents</a>
         <a class="ult-btn ult-btn-outline" href="/visits.html">Visits</a></p>
    </div>`;
}

const STORE = {
  'fo-agents': { table: 'sales_commission_agents', key: KEYS.agents },
  'fo-customers': { table: 'customers', key: KEYS.customers },
  'fo-visits': { table: 'visits', key: 'df_visits' },
  'fo-stock': { table: 'products', key: KEYS.products },
  'fo-join': { table: 'field_ops_leads', key: 'df_field_ops_leads' },
};

async function reload() {
  clearAgentCache();
  _cache = null;
  await loadState();
  await paint();
}

function bindCrud(app) {
  app.querySelectorAll('[data-tbl]').forEach((el) => {
    const spec = STORE[el.dataset.tbl] || {};
    bindTable(el, {
      title: el.dataset.tbl,
      storageKey: el.dataset.tbl,
      table: spec.table,
      key: spec.key,
      onDone: reload,
      skipFilters: true,
    });
  });
  app.querySelectorAll('[data-act="del"]').forEach((b) => {
    b.onclick = async (e) => {
      e.preventDefault();
      const id = b.dataset.id;
      const card = b.closest('[data-tbl]');
      const spec = STORE[card?.dataset.tbl] || {};
      if (!id) return;
      if (!(await confirmAction('Delete this record?', 'This cannot be undone.'))) return;
      if (card?.dataset.tbl === 'fo-join') {
        deleteJoinLead(id);
        ackResult(true, 'Application deleted.');
        reload();
        return;
      }
      const r = await deleteRow(spec.table, spec.key, id);
      if (r?.cancelled) return;
      if (r?.error && !r.ok && !r.shared) ackResult(false, r.error.message || 'Could not delete from the company file.');
      else ackResult(true, 'Deleted.');
      reload();
    };
  });
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  const s = _cache || await loadState();
  const on = tab();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'floor', file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (on === 'orders') {
    await paintOrderList(app, { navHtml: nav('orders') });
    bindHubTabs(app, (k) => { _cache = s; go(k); });
    return;
  }
  if (on === 'payments') {
    await paintPaymentRecord(app, { navHtml: nav('payments') });
    bindHubTabs(app, (k) => { _cache = s; go(k); });
    return;
  }
  if (on === 'master') {
    await paintMasterBook(app, { navHtml: nav('master') });
    bindHubTabs(app, (k) => { _cache = s; go(k); });
    return;
  }
  if (on === 'books') {
    await paintWorkbookHub(app, { navHtml: nav('books') });
    bindHubTabs(app, (k) => { _cache = s; go(k); });
    return;
  }
  if (on === 'visits') paintVisits(app, s);
  else if (on === 'agents') paintAgents(app, s);
  else if (on === 'join') paintJoin(app);
  else if (on === 'stock') paintStock(app, s);
  else if (on === 'collect') paintCollect(app);
  else if (on === 'sync') paintSync(app, s);
  else paintFloor(app, s);
  bindHubTabs(app, (k) => { _cache = s; go(k); });
  bindCrud(app);
  import('./hp-trail.js').then((m) => m.bindTrailLinks(app)).catch(() => {});
}

export async function bootFieldOpsHub() {
  onHubNavigate(paint);
  ensureHpWorkbooks();
  try { await ensureHpOpsFlow(); } catch (e) { console.warn('hp flow', e); }
  await loadState();
  await paint();
  window.addEventListener(SCOPE_EVENT, async () => { _cache = null; await loadState(); paint(); });
  window.addEventListener(MODULES_CHANGED, async () => { _cache = null; await loadState(); paint(); });
  window.addEventListener('popstate', () => paint());
}
