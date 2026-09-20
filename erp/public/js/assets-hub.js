/**
 * Asset Management hub — UPOS dashboard + allocation tabs.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { hubTabs, bindHubTabs, goFile, cyanPill, emptyRow, settingsCard, svgIco, maybePaintNest, resolveHubTab, nestsFor, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';

const FILE = '/assets.html';
const KEY = 'df_assets_hub_v1';
const FLAG = 'df_assets_hub_seed_v2';
const TABS = [
  { key: 'dash', label: 'Assets' },
  { key: 'allocated', label: 'Asset allocated' },
  { key: 'revoked', label: 'Asset revoked' },
  { key: 'maint', label: 'Asset maintenance' },
  { key: 'cats', label: 'Asset categories' },
];
const BRAND = `${svgIco('building')} Asset Management`;

function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readLs(KEY, null)) return; } catch { /* ignore */ }
  writeLs(KEY, {
    cats: [
      { id: 'ac1', name: 'IT equipment' },
      { id: 'ac2', name: 'Vehicles' },
      { id: 'ac3', name: 'Shop fittings' },
    ],
    assets: [],
    allocs: [],
    revoked: [],
    maint: [],
  });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}
function load() { seed(); return readLs(KEY, {}); }
function save(d) { writeLs(KEY, d); }
function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'dash';
  return resolveHubTab(t, TABS, 'dash', nestsFor(FILE));
}
function go(t) { goFile(FILE, t === 'dash' ? '' : t); paint(); }
function nav(on) { return floorNav(BRAND, on, 'dash', FILE); }

function expiring(assets) {
  return (assets || []).filter((a) => {
    if (!a.warranty) return false;
    const d = new Date(a.warranty);
    const now = new Date('2026-09-04');
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    return d >= now && d <= in30;
  });
}

function paintDash(app) {
  const d = load();
  const allocated = (d.assets || []).filter((a) => a.status === 'allocated');
  const exp = expiring(d.assets);
  const byCat = {};
  (d.assets || []).forEach((a) => { byCat[a.cat] = (byCat[a.cat] || 0) + 1; });
  const mine = allocated;
  app.innerHTML = `
    ${nav('dash')}
    <div class="crm-top">
      ${cyanPill('box', 'Assets Allocated to you', mine.length.toFixed(2))}
      <div class="ult-card" style="flex:1">
        <strong>Assets expired or expiring in one month</strong>
        <table class="ult-table"><thead><tr><th>Category</th><th>Assets Allocated to you</th></tr></thead>
        <tbody>${exp.length ? exp.map((a) => `<tr><td>${esc(a.cat)}</td><td>${esc(a.name)}</td></tr>`).join('') : emptyRow(2)}</tbody></table>
      </div>
    </div>
    <hr class="crm-rule" />
    <div class="crm-bottom">
      <div class="crm-left-pills">
        ${cyanPill('box', 'Total Assets', (d.assets || []).length.toFixed(2))}
        ${cyanPill('up', 'Total assets allocated', allocated.length.toFixed(2))}
      </div>
      <div class="ult-card">
        <strong>Assets by category</strong>
        <table class="ult-table"><thead><tr><th>Category</th><th>Total Assets</th></tr></thead>
        <tbody>${Object.keys(byCat).length ? Object.entries(byCat).map(([n, c]) => `<tr><td>${esc(n)}</td><td>${c}</td></tr>`).join('') : emptyRow(2)}</tbody></table>
      </div>
      <div class="ult-card">
        <strong>Assets expired or expiring in one month</strong>
        <table class="ult-table"><thead><tr><th>Assets</th><th>Warranty status</th></tr></thead>
        <tbody>${exp.length ? exp.map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(a.warranty)}</td></tr>`).join('') : emptyRow(2)}</tbody></table>
      </div>
    </div>`;
  bindHubTabs(app, go);
}

function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  seed();
  const on = tab();
  const d = load();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'dash', file: FILE, go })) return;
  if (on === 'dash') return paintDash(app);
  if (on === 'allocated') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Asset allocated</h1>
      <div class="ult-card">
        <div class="ss-head"><strong>Allocated</strong>
          <button type="button" class="ult-btn ult-btn-primary" id="add-as">+ Add asset</button></div>
        <table class="ult-table">
          <thead><tr><th>Asset</th><th>Serial</th><th>Allocated to</th><th>Since</th></tr></thead>
          <tbody>${(d.allocs || []).map((a) => `<tr><td>${esc(a.asset)}</td><td>${esc(a.serial)}</td><td>${esc(a.to)}</td><td>${esc(a.since)}</td></tr>`).join('') || emptyRow(4)}</tbody>
        </table>
      </div>`;
    bindHubTabs(app, go);
    app.querySelector('#add-as').onclick = () => {
      const name = prompt('Asset name'); if (!name) return;
      const to = prompt('Allocated to') || '';
      d.assets.push({ id: uid(), name, cat: 'IT equipment', serial: 'NEW', status: 'allocated', to, warranty: '2027-09-04', value: 0 });
      d.allocs.push({ id: uid(), asset: name, serial: 'NEW', to, since: '2026-09-04' });
      save(d); paint();
    };
    return;
  }
  if (on === 'revoked') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Asset revoked</h1>
      <div class="ult-card"><table class="ult-table">
        <thead><tr><th>Asset</th><th>Was allocated to</th><th>Revoked</th></tr></thead>
        <tbody>${(d.revoked || []).map((a) => `<tr><td>${esc(a.asset)}</td><td>${esc(a.to)}</td><td>${esc(a.when)}</td></tr>`).join('') || emptyRow(3)}</tbody>
      </table></div>`;
    return bindHubTabs(app, go);
  }
  if (on === 'maint') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Asset maintenance</h1>
      <div class="ult-card"><table class="ult-table">
        <thead><tr><th>Date</th><th>Asset</th><th>Description</th><th>Cost</th><th>Vendor</th></tr></thead>
        <tbody>${(d.maint || []).map((m) => `<tr><td>${esc(m.date)}</td><td>${esc(m.asset)}</td><td>${esc(m.desc)}</td><td>${Number(m.cost).toLocaleString()}</td><td>${esc(m.vendor)}</td></tr>`).join('') || emptyRow(5)}</tbody>
      </table></div>`;
    return bindHubTabs(app, go);
  }
  if (on === 'cats') {
    app.innerHTML = `${nav(on)}<h1 class="hub-h1">Asset categories</h1>
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
  app.innerHTML = `${nav('dash')}${settingsCard('Asset Management', 'Open a topic from the headings.')}`;
  bindHubTabs(app, go);
}

export async function bootAssetsHub() {
  onHubNavigate(paint);
  try { paint(); } catch (err) {
    console.warn('assets-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>Asset Management</h1><p>${esc(err?.message || err)}</p></div>`;
  }
}
