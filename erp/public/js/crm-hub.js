/**
 * CRM hub — UPOS dashboard + tabbed right pane.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { tableBar, tableFoot } from './accounting.js';
import { bindTable } from './home-tables.js';
import { hubTabs, bindHubTabs, cyanPill, orangePill, emptyRow, settingsCard, svgIco, maybePaintNest, resolveHubTab, nestsFor, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import { collectionCrmFollowups, ensureCollections, viewAccount, todayYmd } from './collections-desk.js';
import { callCenterFollowups, callCenterTodayCount } from './call-center.js';

const FILE = '/crm.html';
const KEY = 'df_crm_hub_v1';
const FLAG = 'df_crm_hub_seed_v2';
const TABS = [
  { key: 'followups', label: 'Follow ups' },
  { key: 'leads', label: 'Leads' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'login', label: 'Contacts Login ▾' },
  { key: 'reports', label: 'Reports' },
  { key: 'ptpl', label: 'Proposal template' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'sources', label: 'Sources' },
  { key: 'life', label: 'Life Stage' },
  { key: 'fcat', label: 'Followup Category' },
];
const BRAND = `${svgIco('users')} CRM`;

function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readLs(KEY, null)) return; } catch { /* ignore */ }
  writeLs(KEY, {
    customers: [],
    leads: [],
    followups: [],
    campaigns: [],
    sources: [
      { id: 's1', name: 'Walk-in', total: 0, conv: 0 },
      { id: 's2', name: 'Website', total: 0, conv: 0 },
      { id: 's3', name: 'Referral', total: 0, conv: 0 },
    ],
    life: [
      { id: 'ls1', name: 'New', total: 0 },
      { id: 'ls2', name: 'Returning', total: 0 },
      { id: 'ls3', name: 'VIP', total: 0 },
    ],
    fcats: [
      { id: 'fc1', name: 'Call' }, { id: 'fc2', name: 'Visit' }, { id: 'fc3', name: 'WhatsApp' },
    ],
    proposals: [],
    templates: [],
    logins: [],
  });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}
function load() { seed(); return readLs(KEY, {}); }
function save(d) { writeLs(KEY, d); }

function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'dash';
  if (t === 'reports' || t === 'setup' || t === 'topics' || t === 'settings' || t === 'setting') return t;
  return resolveHubTab(t, TABS, 'dash', nestsFor(FILE));
}
function go(t, extra) {
  const u = new URL(FILE, location.origin);
  if (t && t !== 'dash') u.searchParams.set('tab', t);
  if (extra && typeof extra === 'object') {
    Object.entries(extra).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
  }
  const next = u.pathname + u.search;
  history.pushState({ spa: next }, '', next);
  try { sessionStorage.setItem('df_last_path', next); } catch { /* ignore */ }
  paint();
}
function nav(on) { return floorNav(BRAND, on, 'dash', FILE); }

function crmFuRows(d) {
  const today = todayYmd();
  return (d.followups || []).map((f) => ({
    ...f,
    source: 'crm',
    phone: f.phone || '',
    dueToday: String(f.when || '').slice(0, 10) === today && !['Completed', 'Cancelled'].includes(f.status),
  }));
}

function mergedFollowups(d, colRows, callRows) {
  return [...crmFuRows(d), ...(colRows || []), ...(callRows || [])];
}

async function paintDash(app, active = 'dash') {
  const d = load();
  const col = collectionCrmFollowups();
  const cc = callCenterFollowups();
  const ccN = callCenterTodayCount();
  const fu = mergedFollowups(d, col, cc);
  const by = (s) => fu.filter((f) => f.status === s).length;
  const todayRows = fu.filter((f) => f.dueToday).sort((a, b) => String(a.contact).localeCompare(String(b.contact)));
  const conv = 1;
  app.innerHTML = `
    ${nav(active)}
    <div class="col-dash-stack">
    <a class="ult-card col-dash-card" href="/collections-desk.html">
      <div>
        <strong>Collections — Easybuy hire purchase</strong>
        <p class="ult-muted" id="col-dash-copy" style="margin:4px 0 0">${col.length} accounts · ${todayRows.filter((r) => r.source === 'collections').length} due today · ${col.filter((r) => r.credit_grade === 'A').length} eligible for appliance HP.</p>
      </div>
      <span class="ult-btn ult-btn-primary">Open</span>
    </a>
    <a class="ult-card col-dash-card" href="/call-centre.html">
      <div>
        <strong>Call Centre — ads, WhatsApp, shop rings</strong>
        <p class="ult-muted" style="margin:4px 0 0">${ccN.today} today · ${ccN.missed} missed / abandoned · ${ccN.total} tickets. Campaigns live on this desk.</p>
      </div>
      <span class="ult-btn ult-btn-primary">Open</span>
    </a>
    </div>
    <div class="wms-grid" style="margin:0 0 16px">
      <a class="wms-card" href="/crm.html?tab=followups"><strong>Follow ups</strong><b>${fu.length}</b></a>
      <a class="wms-card" href="/crm.html?tab=leads"><strong>Leads</strong><b>${(d.leads || []).length}</b></a>
      <a class="wms-card" href="/crm.html?tab=campaigns"><strong>Campaigns</strong><b>${(d.campaigns || []).length}</b></a>
      <a class="wms-card" href="/crm.html?tab=proposals"><strong>Proposals</strong><b>${(d.proposals || []).length}</b></a>
      <a class="wms-card" href="/collections-desk.html"><strong>Easybuy accounts</strong><b>${col.length}</b></a>
      <a class="wms-card" href="/call-centre.html"><strong>Call Centre</strong><b>${ccN.total}</b></a>
    </div>
    <div class="crm-top">
      <div class="crm-left-pills">
        <a class="crm-pill-link" href="/crm.html?tab=followups&scope=today" data-fu-scope="today">${cyanPill('cal', "Today's Follow ups", todayRows.length)}</a>
        <a class="crm-pill-link" href="/crm.html?tab=leads" data-htab="leads">${cyanPill('user', 'My Leads', (d.leads || []).length)}</a>
        ${cyanPill('conv', 'My leads to customer conversion', conv)}
      </div>
      <div class="ult-card crm-follow-card">
        <strong>My Follow ups</strong>
        <table class="ult-table"><tbody>
          <tr><td>Scheduled</td><td>${by('Scheduled')}</td></tr>
          <tr><td>Open</td><td>${by('Open')}</td></tr>
          <tr><td>Cancelled</td><td>${by('Cancelled')}</td></tr>
          <tr><td>Completed</td><td>${by('Completed')}</td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="ult-card" data-tbl="fu-today">
      <div class="ss-head"><strong>Today's follow ups</strong>
        <a href="/crm.html?tab=followups&scope=today" data-fu-scope="today" class="ult-btn">View all</a></div>
      <p class="ult-muted" style="margin:0 0 8px">CRM reminders, Easybuy collection calls, and Call Centre callbacks due today.</p>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Grade</th><th>Contact</th><th>Phone</th><th>Category</th><th>Status</th><th>User</th><th>When</th></tr></thead>
        <tbody>${todayRows.map((f) => `<tr data-acc="${esc(f.id)}" data-src="${esc(f.source)}">
          <td>${f.credit_grade ? `<span class="col-grade col-g-${esc(f.credit_grade)}">${esc(f.credit_grade)}</span>` : '—'}</td>
          <td>${f.source === 'collections' ? `<a href="/collections-desk.html">${esc(f.contact)}</a>` : f.source === 'calls' ? `<a href="/call-centre.html">${esc(f.contact)}</a>` : esc(f.contact)}</td>
          <td>${esc(f.phone || '—')}</td>
          <td>${esc(f.cat)}</td>
          <td>${esc(f.status)}</td>
          <td>${esc(f.user || '—')}</td>
          <td>${esc(f.when || '')}</td>
        </tr>`).join('') || emptyRow(7, 'Nothing due today.')}</tbody>
      </table></div>
      ${tableFoot()}
    </div>
    <hr class="crm-rule" />
    <div class="crm-kpis">
      ${cyanPill('users', 'Customers', (d.customers || []).length)}
      ${cyanPill('user', 'Leads', (d.leads || []).length)}
      ${orangePill('search', 'Sources', (d.sources || []).length)}
      ${orangePill('sun', 'Life Stages', (d.life || []).length)}
    </div>
    <div class="crm-bottom">
      <div class="ult-card">
        <strong>Sources</strong>
        <table class="ult-table"><thead><tr><th>Sources</th><th>Total</th><th>Conversion</th></tr></thead>
        <tbody>${(d.sources || []).map((s) => `<tr><td>${esc(s.name)}</td><td>${s.total}</td><td>${s.conv}</td></tr>`).join('') || emptyRow(3)}</tbody></table>
      </div>
      <div class="ult-card">
        <strong>Life Stages</strong>
        <table class="ult-table"><thead><tr><th>Life Stages</th><th>Total</th></tr></thead>
        <tbody>${(d.life || []).map((s) => `<tr><td>${esc(s.name)}</td><td>${s.total}</td></tr>`).join('') || emptyRow(2)}</tbody></table>
      </div>
      <div class="ult-card">
        <div class="ss-head"><strong>${svgIco('cake')} Birthdays</strong>
          <button type="button" class="wish-btn" id="wish">${svgIco('plane')} Send wishes</button></div>
        <p class="ult-muted" style="margin:0 0 6px">Today</p>
        <table class="ult-table"><thead><tr><th>#</th><th>Name</th></tr></thead>
        <tbody>${(d.customers || []).filter((c) => c.birthday === todayYmd()).map((c, i) =>
          `<tr><td><input type="checkbox" class="wish-id" value="${esc(c.id)}" checked /> ${i + 1}</td><td>${esc(c.name)}</td></tr>`).join('') || emptyRow(2)}</tbody></table>
        <p class="ult-muted" style="margin:12px 0 6px">Upcoming</p>
        <table class="ult-table"><thead><tr><th>#</th><th>Name</th><th>Birthday on</th></tr></thead>
        <tbody>${(d.customers || []).filter((c) => c.birthday && c.birthday !== todayYmd()).map((c, i) =>
          `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.birthday)}</td></tr>`).join('') || emptyRow(3)}</tbody></table>
      </div>
    </div>
    <div class="ult-card" data-tbl="fu-user">
      <strong>Follow ups by user</strong>
      <div class="pr-filters" style="margin-top:10px">
        <label>Date Range:<input value="01/01/2026 - 12/31/2026" readonly /></label>
        <label>Followup Category:* <select><option>All</option>${(d.fcats || []).map((c) => `<option>${esc(c.name)}</option>`).join('')}<option>Collections</option></select></label>
      </div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>User</th><th>Scheduled</th><th>Open</th><th>Cancelled</th><th>Completed</th><th>None</th><th>Total follow ups</th></tr></thead>
        <tbody>${userFuRows(fu)}</tbody>
      </table></div>
      ${tableFoot()}
    </div>
    <div class="ult-card" data-tbl="ltc">
      <strong>Leads to customer conversion</strong>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th></th><th>Converted By</th><th>Total</th></tr></thead>
        <tbody></tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindFuScope(app);
  bindColViews(app);
  bindTable(app.querySelector('[data-tbl="fu-today"]'), { title: "Today's follow ups", storageKey: 'crm-fu-today' });
  bindTable(app.querySelector('[data-tbl="fu-user"]'), { title: 'Follow ups by user', storageKey: 'crm-fu' });
  bindTable(app.querySelector('[data-tbl="ltc"]'), { title: 'Lead conversion', storageKey: 'crm-ltc' });
  app.querySelector('#wish').onclick = () => {
    const n = app.querySelectorAll('.wish-id:checked').length;
    if (!n) return alert('Please select the users to send wishes.');
    alert(`Birthday wishes queued for ${n} contact(s) via SMS.`);
  };
}

function bindFuScope(app) {
  app.querySelectorAll('[data-fu-scope]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      go('followups', { scope: a.dataset.fuScope });
    };
  });
}

function bindColViews(app) {
  app.querySelectorAll('[data-view]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      viewAccount(a.dataset.view, () => paint());
    };
  });
}

async function paintFollowups(app) {
  const d = load();
  const all = mergedFollowups(d, collectionCrmFollowups(), callCenterFollowups());
  const scope = new URLSearchParams(location.search).get('scope') || 'all';
  const rows = all.filter((f) => {
    if (scope === 'today') return f.dueToday;
    if (scope === 'scheduled') return f.status === 'Scheduled';
    if (scope === 'open') return f.status === 'Open';
    if (scope === 'collections') return f.source === 'collections' && f.status !== 'Completed';
    if (scope === 'calls') return f.source === 'calls';
    if (scope === 'crm') return f.source === 'crm';
    if (scope === 'completed') return f.status === 'Completed';
    return f.status !== 'Completed';
  }).sort((a, b) => String(a.when || '').localeCompare(String(b.when || '')) || String(a.contact).localeCompare(String(b.contact)));
  const filters = [
    ['all', 'All open'],
    ['today', 'Due today'],
    ['scheduled', 'Scheduled'],
    ['open', 'Open'],
    ['collections', 'Collections'],
    ['calls', 'Call Centre'],
    ['crm', 'CRM'],
  ];
  app.innerHTML = `${nav('followups')}
    <h1 class="hub-h1">Follow ups</h1>
    <p class="ult-lead">CRM reminders, Easybuy collection calls, and Call Centre callbacks share this list.</p>
    <div class="col-filters">${filters.map(([k, lab]) =>
      `<button type="button" data-fu-scope="${k}" class="${scope === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
    <div class="ult-card" data-tbl="fu-all">
      <div class="ss-head"><strong>Follow ups (${rows.length})</strong>
        <button type="button" class="ult-btn ult-btn-primary" id="add">+ Add</button></div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Grade</th><th>Contact</th><th>Phone</th><th>Category</th><th>Status</th><th>User</th><th>When</th></tr></thead>
        <tbody>${rows.map((f) => `<tr>
          <td>${f.credit_grade ? `<span class="col-grade col-g-${esc(f.credit_grade)}">${esc(f.credit_grade)}</span>` : '—'}</td>
          <td>${f.source === 'collections' ? `<a href="/collections-desk.html">${esc(f.contact)}</a>` : f.source === 'calls' ? `<a href="/call-centre.html">${esc(f.contact)}</a>` : esc(f.contact)}</td>
          <td>${esc(f.phone || '—')}</td>
          <td>${esc(f.cat)}${f.source === 'collections' ? ' · Easybuy' : f.source === 'calls' ? ' · Call Centre' : ''}</td>
          <td>${esc(f.status)}</td>
          <td>${esc(f.user || '—')}</td>
          <td>${esc(f.when || '')}</td>
        </tr>`).join('') || emptyRow(7)}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindFuScope(app);
  bindColViews(app);
  bindTable(app.querySelector('[data-tbl="fu-all"]'), { title: 'Follow ups', storageKey: 'crm-fu-all' });
  app.querySelector('#add').onclick = () => {
    const contact = prompt('Contact'); if (!contact) return;
    d.followups.push({
      id: uid(),
      user: 'HQ',
      contact,
      cat: 'Call',
      status: 'Scheduled',
      when: `${todayYmd()} 09:00`,
    });
    save(d);
    paint();
  };
}

function userFuRows(fu) {
  const map = {};
  fu.forEach((f) => {
    const name = f.user || 'Unassigned';
    const u = map[name] || { user: name, Scheduled: 0, Open: 0, Cancelled: 0, Completed: 0, None: 0 };
    u[f.status] = (u[f.status] || 0) + 1;
    map[name] = u;
  });
  const rows = Object.values(map);
  if (!rows.length) return emptyRow(7, 'No data available in table');
  return rows.map((u) => `<tr><td>${esc(u.user)}</td><td>${u.Scheduled}</td><td>${u.Open}</td><td>${u.Cancelled}</td><td>${u.Completed}</td><td>${u.None || 0}</td><td>${u.Scheduled + u.Open + u.Cancelled + u.Completed}</td></tr>`).join('');
}

function paintTable(app, on, title, cols, rowsHtml, addFn) {
  app.innerHTML = `${nav(on)}<h1 class="hub-h1">${title}</h1>
    <div class="ult-card">
      <div class="ss-head"><strong>${title}</strong>
        ${addFn ? `<button type="button" class="ult-btn ult-btn-primary" id="add">+ Add</button>` : ''}</div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('.ult-card'), { title, storageKey: 'crm-' + on });
  if (addFn) app.querySelector('#add').onclick = addFn;
}

function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  seed();
  const on = tab();
  const d = load();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'dash', file: FILE, go })) return;
  if (on === 'dash') return paintDash(app, 'dash');
  if (on === 'reports') return paintDash(app, 'reports');
  if (on === 'leads') {
    return paintTable(app, on, 'Leads',
      ['Name', 'Company', 'Phone', 'Source', 'Stage', 'Owner', 'Value (GHS)'],
      (d.leads || []).map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.company)}</td><td>${esc(l.phone)}</td><td>${esc(l.source)}</td><td>${esc(l.stage)}</td><td>${esc(l.owner)}</td><td>${Number(l.value).toLocaleString()}</td></tr>`).join('') || emptyRow(7),
      () => {
        const name = prompt('Lead name'); if (!name) return;
        d.leads.push({ id: uid(), name, company: '', phone: '', source: 'Walk-in', stage: 'New', owner: 'Akosua Darko', value: 0 });
        save(d); paint();
      });
  }
  if (on === 'followups') {
    return paintFollowups(app);
  }
  if (on === 'campaigns') {
    return paintTable(app, on, 'Campaigns', ['Name', 'Channel', 'Status', 'Reach'],
      (d.campaigns || []).map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.channel)}</td><td>${esc(c.status)}</td><td>${c.reach || 0}</td></tr>`).join('') || emptyRow(4),
      () => {
        const name = prompt('Campaign name'); if (!name) return;
        d.campaigns.push({ id: uid(), name, channel: 'SMS', status: 'Draft', reach: 0 });
        save(d); paint();
      });
  }
  if (on === 'collections') {
    return paintFollowups(app);
    return;
  }
  if (on === 'calls') {
    return paintFollowups(app);
    return;
  }
  if (on === 'login') {
    return paintTable(app, on, 'Contacts Login', ['Contact', 'Email', 'Last login'],
      (d.logins || []).map((l) => `<tr><td>${esc(l.contact)}</td><td>${esc(l.email)}</td><td>${esc(l.last)}</td></tr>`).join('') || emptyRow(3));
  }
  if (on === 'ptpl') {
    return paintTable(app, on, 'Proposal template', ['Name', 'Updated'],
      (d.templates || []).map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.updated)}</td></tr>`).join('') || emptyRow(2),
      () => { const name = prompt('Template name'); if (!name) return; d.templates.push({ id: uid(), name, updated: '2026-09-04' }); save(d); paint(); });
  }
  if (on === 'proposals') {
    return paintTable(app, on, 'Proposals', ['Title', 'Customer', 'Amount (GHS)', 'Status'],
      (d.proposals || []).map((p) => `<tr><td>${esc(p.title)}</td><td>${esc(p.customer)}</td><td>${Number(p.amount).toLocaleString()}</td><td>${esc(p.status)}</td></tr>`).join('') || emptyRow(4));
  }
  if (on === 'sources') {
    return paintTable(app, on, 'Sources', ['Name', 'Total', 'Conversion'],
      (d.sources || []).map((s) => `<tr><td>${esc(s.name)}</td><td>${s.total}</td><td>${s.conv}</td></tr>`).join('') || emptyRow(3),
      () => { const name = prompt('Source'); if (!name) return; d.sources.push({ id: uid(), name, total: 0, conv: 0 }); save(d); paint(); });
  }
  if (on === 'life') {
    return paintTable(app, on, 'Life Stage', ['Name', 'Total'],
      (d.life || []).map((s) => `<tr><td>${esc(s.name)}</td><td>${s.total}</td></tr>`).join('') || emptyRow(2),
      () => { const name = prompt('Life stage'); if (!name) return; d.life.push({ id: uid(), name, total: 0 }); save(d); paint(); });
  }
  if (on === 'fcat') {
    return paintTable(app, on, 'Followup Category', ['Name'],
      (d.fcats || []).map((c) => `<tr><td>${esc(c.name)}</td></tr>`).join('') || emptyRow(1),
      () => { const name = prompt('Category'); if (!name) return; d.fcats.push({ id: uid(), name }); save(d); paint(); });
  }
  if (on === 'settings' || on === 'setting') return bounceModuleSettings();
  app.innerHTML = `${nav('followups')}${settingsCard('CRM', 'Open a topic from the headings.')}`;
  bindHubTabs(app, go);
}

export async function bootCrmHub() {
  onHubNavigate(paint);
  try { paint(); } catch (err) {
    console.warn('crm-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>CRM</h1><p>${esc(err?.message || err)}</p></div>`;
  }
  ensureCollections().then(() => { try { paint(); } catch { /* stay on first paint */ } }).catch(() => {});
}
