/**
 * Project hub — list / kanban / create modal (UPOS).
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { hubTabs, bindHubTabs, emptyRow, settingsCard, modalHtml, bindModal, fakeEditor, svgIco, maybePaintNest, resolveHubTab, nestsFor, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';

const FILE = '/projects.html';
const KEY = 'df_project_hub_v1';
const FLAG = 'df_project_hub_seed_v2';
const TABS = [
  { key: 'list', label: 'Projects' },
  { key: 'tasks', label: 'My Tasks' },
  { key: 'reports', label: 'Reports' },
  { key: 'cats', label: 'Project Categories' },
];
const STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const BRAND = `${svgIco('folder')} Project`;

function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readLs(KEY, null)) return; } catch { /* ignore */ }
  writeLs(KEY, {
    cats: [
      { id: 'pc1', name: 'Installation' },
      { id: 'pc2', name: 'Interior' },
      { id: 'pc3', name: 'IT / Network' },
    ],
    projects: [],
    tasks: [],
  });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}
function load() { seed(); return readLs(KEY, {}); }
function save(d) { writeLs(KEY, d); }
function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'list';
  return resolveHubTab(t, TABS, 'list', nestsFor(FILE));
}
function view() { return new URLSearchParams(location.search).get('view') === 'kanban' ? 'kanban' : 'list'; }
function go(t, extra) {
  const q = new URLSearchParams();
  if (t && t !== 'list') q.set('tab', t);
  if (extra?.view && extra.view !== 'list') q.set('view', extra.view);
  const path = FILE + (q.toString() ? '?' + q.toString() : '');
  history.pushState({ spa: path }, '', path);
  paint();
}
function nav(on) { return floorNav(BRAND, on, 'list', FILE); }

function paintList(app) {
  const d = load();
  const v = view();
  const st = app.querySelector('#pr-st')?.value || 'All';
  const cat = app.querySelector('#pr-cat')?.value || 'All';
  let rows = d.projects || [];
  if (st !== 'All') rows = rows.filter((p) => p.status === st);
  if (cat !== 'All') rows = rows.filter((p) => p.cat === cat);

  const filters = `<div class="pr-filters">
    <label>Status:<select id="pr-st"><option>All</option>${STATUSES.map((s) => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label>End Date:<select id="pr-end"><option>All</option></select></label>
    <label>Category:<select id="pr-cat"><option>All</option>${(d.cats || []).map((c) => `<option ${c.name === cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
  </div>`;

  const list = rows.length
    ? `<div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Name</th><th>Customer</th><th>Status</th><th>Lead</th><th>End</th><th>Category</th></tr></thead>
        <tbody>${rows.map((p) => `<tr>
          <td><strong>${esc(p.name)}</strong></td><td>${esc(p.customer)}</td>
          <td>${esc(p.status)}</td><td>${esc(p.lead)}</td><td>${esc(p.end)}</td><td>${esc(p.cat)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
    : `<div class="pr-empty">Projects not found!</div>`;

  const board = `<div class="pr-kanban">${STATUSES.map((s) => {
    const col = rows.filter((p) => p.status === s);
    return `<section class="pr-col"><h4>${esc(s)} <span>${col.length}</span></h4>
      ${col.map((p) => `<article class="pr-card"><strong>${esc(p.name)}</strong><p>${esc(p.customer)}</p><small>${esc(p.end)}</small></article>`).join('') || '<p class="ult-muted">—</p>'}
    </section>`;
  }).join('')}</div>`;

  app.innerHTML = `
    ${nav('list')}
    <h1 class="hub-h1">Projects <span>All Projects</span></h1>
    <div class="ult-card">
      <div class="ss-head">
        <strong style="color:#5b21b6">Projects</strong>
        <div class="pr-view-btns">
          <button type="button" class="pr-list-btn ${v === 'list' ? 'on' : ''}" data-view="list">List View</button>
          <button type="button" class="pr-kanban-btn ${v === 'kanban' ? 'on' : ''}" data-view="kanban">Kanban Board</button>
          <button type="button" class="pr-new-btn" id="pr-new">New Project +</button>
        </div>
      </div>
      ${filters}
      ${v === 'kanban' ? board : list}
    </div>
    ${modalHtml('pr-modal', 'Create Project', `
      <div class="ult-field"><label>Name:*</label><input id="pr-name" /></div>
      <div class="ult-field"><label>Description:</label></div>
      ${fakeEditor('pr-desc')}
      <div class="pr-grid-3">
        <div class="ult-field"><label>Customer:</label>
          <select id="pr-cust"><option>Please Select</option></select></div>
        <div class="ult-field"><label>Status:*</label>
          <select id="pr-status"><option>Please Select</option>${STATUSES.map((s) => `<option>${s}</option>`).join('')}</select></div>
        <div class="ult-field"><label>Lead:*</label>
          <select id="pr-lead"><option>Please Select</option></select></div>
      </div>
      <div class="pr-grid">
        <div class="ult-field"><label>Start Date:</label><input type="date" id="pr-start" /></div>
        <div class="ult-field"><label>End Date:</label><input type="date" id="pr-endd" /></div>
        <div class="ult-field"><label>Members:*</label><input id="pr-mem" /></div>
        <div class="ult-field"><label>Category:</label><select id="pr-mc">${(d.cats || []).map((c) => `<option>${esc(c.name)}</option>`).join('')}</select></div>
      </div>
    `, { wide: true })}`;
  bindHubTabs(app, go);
  app.querySelector('#pr-st').onchange = () => paint();
  app.querySelector('#pr-cat').onchange = () => paint();
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => go('list', { view: b.dataset.view });
  });
  const modal = bindModal(app, 'pr-modal');
  app.querySelector('#pr-new').onclick = () => { modal.hidden = false; };
  modal.querySelector('[data-save]').onclick = () => {
    const name = app.querySelector('#pr-name').value.trim();
    if (!name) return alert('Name is required');
    const status = app.querySelector('#pr-status').value;
    const lead = app.querySelector('#pr-lead').value;
    if (status === 'Please Select' || lead === 'Please Select') return alert('Status and Lead are required');
    d.projects.unshift({
      id: uid(), name, desc: app.querySelector('#pr-desc').value,
      customer: app.querySelector('#pr-cust').value, status, lead,
      start: app.querySelector('#pr-start').value, end: app.querySelector('#pr-endd').value,
      members: app.querySelector('#pr-mem').value, cat: app.querySelector('#pr-mc').value,
    });
    save(d);
    modal.hidden = true;
    paint();
  };
}

function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  seed();
  const on = tab();
  const d = load();
  if (on === 'reports') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Reports</h1>
      <p class="ult-lead">Module reports only. These do not appear under ERP Reports.</p>
      <div class="ult-card"><table class="ult-table">
        <thead><tr><th>Status</th><th>Projects</th></tr></thead>
        <tbody>${STATUSES.map((s) => `<tr><td>${s}</td><td>${(d.projects || []).filter((p) => p.status === s).length}</td></tr>`).join('')}</tbody>
      </table></div>`;
    return bindHubTabs(app, go);
  }
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'list', file: FILE, go })) return;
  if (on === 'list') return paintList(app);
  if (on === 'tasks') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">My Tasks</h1>
      <div class="ult-card"><table class="ult-table">
        <thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>${(d.tasks || []).map((t) => `<tr><td>${esc(t.task)}</td><td>${esc(t.project)}</td><td>${esc(t.status)}</td><td>${esc(t.due)}</td></tr>`).join('') || emptyRow(4)}</tbody>
      </table></div>`;
    return bindHubTabs(app, go);
  }
  if (on === 'reports') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Reports</h1>
      <div class="ult-card"><table class="ult-table">
        <thead><tr><th>Status</th><th>Projects</th></tr></thead>
        <tbody>${STATUSES.map((s) => `<tr><td>${s}</td><td>${(d.projects || []).filter((p) => p.status === s).length}</td></tr>`).join('')}</tbody>
      </table></div>`;
    return bindHubTabs(app, go);
  }
  if (on === 'cats') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Project Categories</h1>
      <div class="ult-card">
        <div class="ss-head"><strong>Categories</strong><button type="button" class="ult-btn ult-btn-primary" id="add">+ Add</button></div>
        <table class="ult-table"><thead><tr><th>Name</th></tr></thead>
        <tbody>${(d.cats || []).map((c) => `<tr><td>${esc(c.name)}</td></tr>`).join('') || emptyRow(1)}</tbody></table>
      </div>`;
    bindHubTabs(app, go);
    app.querySelector('#add').onclick = () => {
      const name = prompt('Category'); if (!name) return;
      d.cats.push({ id: uid(), name }); save(d); paint();
    };
    return;
  }
  if (on === 'settings' || on === 'setting') return bounceModuleSettings();
  app.innerHTML = `${nav('list')}${settingsCard('Project', 'Open a topic from the headings.')}`;
  bindHubTabs(app, go);
}

export async function bootProjectHub() {
  onHubNavigate(paint);
  try { paint(); } catch (err) {
    console.warn('project-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>Project</h1><p>${esc(err?.message || err)}</p></div>`;
  }
}
